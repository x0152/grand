package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"

	gonkaopenai "github.com/gonka-ai/gonka-openai/go"
	"github.com/openai/openai-go"

	"mantis/core/protocols"
	"mantis/core/types"
	"mantis/infrastructure/gonkachain"
	"mantis/shared"
)

type Gonka struct {
	*OpenAI
	opts GonkaOptions
}

const defaultPinnedGonkaBalanceSourceURL = "http://node1.gonka.ai:8000"

type GonkaOptions struct {
	PinEndpointEnabled  bool
	PinBalanceSourceURL string
}

func NewGonka() *Gonka {
	return NewGonkaWithOptions(GonkaOptions{})
}

func NewGonkaWithOptions(opts GonkaOptions) *Gonka {
	opts.PinBalanceSourceURL = strings.TrimSpace(opts.PinBalanceSourceURL)
	return &Gonka{
		OpenAI: NewOpenAI(),
		opts:   opts,
	}
}

func (g *Gonka) ListModels(ctx context.Context, baseURL, apiKey string) ([]types.ProviderModel, error) {
	client, err := g.newClient(ctx, baseURL, apiKey)
	if err != nil {
		return nil, err
	}

	pager := client.Models.ListAutoPaging(ctx)
	items := make([]types.ProviderModel, 0, 64)
	for pager.Next() {
		id := strings.TrimSpace(pager.Current().ID)
		if id == "" {
			continue
		}
		items = append(items, types.ProviderModel{ID: id})
	}
	if err := pager.Err(); err != nil {
		return nil, err
	}

	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return items, nil
}

func (g *Gonka) GetInferenceLimit(ctx context.Context, baseURL, apiKey string) (types.InferenceLimit, error) {
	balanceSourceURL, err := g.resolveBalanceSourceURL(baseURL)
	if err != nil {
		return types.InferenceLimit{}, err
	}
	privateKey := strings.TrimSpace(apiKey)
	if privateKey == "" {
		return types.InferenceLimit{}, fmt.Errorf("Gonka private key is required")
	}

	address, err := gonkaopenai.GonkaAddress(privateKey)
	if err != nil {
		return types.InferenceLimit{}, fmt.Errorf("derive Gonka address: %w", err)
	}

	amount, err := gonkachain.QueryBalance(ctx, balanceSourceURL, address)
	if err != nil {
		return types.InferenceLimit{}, err
	}

	gnk := gonkachain.TokenFloat(amount)
	return types.InferenceLimit{
		Type:  "balance",
		Label: fmt.Sprintf("Balance: %s GNK", gonkachain.FormatBalance(gnk)),
	}, nil
}

func (g *Gonka) ChatStream(ctx context.Context, _ string, baseURL, apiKey string, messages []protocols.LLMMessage, model string, tools []types.Tool, thinkingMode string) (<-chan types.StreamEvent, error) {
	client, err := g.newClient(ctx, baseURL, apiKey)
	if err != nil {
		return nil, err
	}

	params := openai.ChatCompletionNewParams{
		Model:    model,
		Messages: buildGonkaMessages(messages),
		StreamOptions: openai.ChatCompletionStreamOptionsParam{
			IncludeUsage: openai.Bool(true),
		},
	}
	if reqTools := buildGonkaTools(tools); len(reqTools) > 0 {
		params.Tools = reqTools
	}

	stream := client.Chat.Completions.NewStreaming(ctx, params)
	ch := make(chan types.StreamEvent, 32)

	go func() {
		defer close(ch)
		defer stream.Close()

		seq := 0
		toolCalls := map[int]*types.ToolCall{}
		var lastUsage *types.LLMUsage

		emitUsage := func() {
			if lastUsage == nil {
				return
			}
			ch <- types.StreamEvent{Type: "usage", Usage: lastUsage, Sequence: seq}
			seq++
			lastUsage = nil
		}

		for stream.Next() {
			chunk := stream.Current()
			if u := gonkaUsage(chunk); u != nil {
				lastUsage = u
			}
			if len(chunk.Choices) == 0 {
				continue
			}

			if reasoning := gonkaReasoningContent(chunk); reasoning != "" {
				ch <- types.StreamEvent{Type: "thinking", Delta: reasoning, Sequence: seq}
				seq++
			}

			choice := chunk.Choices[0]
			if choice.Delta.Content != "" {
				ch <- types.StreamEvent{Type: "text", Delta: choice.Delta.Content, Sequence: seq}
				seq++
			}

			for _, tc := range choice.Delta.ToolCalls {
				idx := int(tc.Index)
				existing, ok := toolCalls[idx]
				if !ok {
					existing = &types.ToolCall{ID: tc.ID, Name: tc.Function.Name}
					toolCalls[idx] = existing
				}
				if tc.ID != "" {
					existing.ID = tc.ID
				}
				if tc.Function.Name != "" {
					existing.Name = tc.Function.Name
				}
				existing.Arguments += tc.Function.Arguments
			}

			if choice.FinishReason == "tool_calls" {
				calls := orderedToolCalls(toolCalls)
				emitUsage()
				ch <- types.StreamEvent{Type: "tool_calls", ToolCalls: calls, Sequence: seq, IsFinal: true}
				return
			}
		}

		if len(toolCalls) > 0 {
			calls := orderedToolCalls(toolCalls)
			emitUsage()
			ch <- types.StreamEvent{Type: "tool_calls", ToolCalls: calls, Sequence: seq, IsFinal: true}
			return
		}

		emitUsage()

		if err := stream.Err(); err != nil {
			ch <- types.StreamEvent{Type: "error", Delta: err.Error(), IsFinal: true}
		}
	}()

	if thinkingMode != "" {
		return shared.ApplyThinkingStream(ch, thinkingMode), nil
	}

	return ch, nil
}

func (g *Gonka) newClient(ctx context.Context, baseURL, apiKey string) (*gonkaopenai.GonkaOpenAI, error) {
	sourceURL, err := normalizeGonkaSourceURL(baseURL)
	if err != nil {
		return nil, err
	}

	var endpoints []gonkaopenai.Endpoint
	if g.opts.PinEndpointEnabled {
		endpoints, err = resolvePinnedGonkaEndpoint(ctx, sourceURL)
		if err != nil {
			return nil, err
		}
	} else {
		endpoints, err = resolveDistributedGonkaEndpoints(ctx, sourceURL)
		if err != nil {
			return nil, err
		}
	}

	if len(endpoints) == 0 {
		return nil, fmt.Errorf("no gonka endpoints resolved from %q", sourceURL)
	}
	privateKey := strings.TrimSpace(apiKey)
	if privateKey == "" {
		return nil, fmt.Errorf("Gonka private key is required")
	}

	return gonkaopenai.NewGonkaOpenAI(gonkaopenai.Options{
		GonkaPrivateKey: privateKey,
		// Passing explicit endpoints bypasses flaky SDK-side filtering by chain params.
		Endpoints: endpoints,
	})
}

func normalizeGonkaSourceURL(raw string) (string, error) {
	sourceURL := strings.TrimSpace(raw)
	if sourceURL == "" {
		return "", fmt.Errorf("gonka source URL is required")
	}
	// Allow "host:port" input from UI by auto-prefixing scheme.
	if !strings.Contains(sourceURL, "://") {
		sourceURL = "http://" + sourceURL
	}
	u, err := url.Parse(sourceURL)
	if err != nil || strings.TrimSpace(u.Scheme) == "" || strings.TrimSpace(u.Host) == "" {
		return "", fmt.Errorf("invalid gonka source URL %q", strings.TrimSpace(raw))
	}
	return strings.TrimRight(sourceURL, "/"), nil
}

func (g *Gonka) resolveBalanceSourceURL(baseURL string) (string, error) {
	sourceURL, err := normalizeGonkaSourceURL(baseURL)
	if err != nil {
		return "", err
	}
	if !g.opts.PinEndpointEnabled {
		return sourceURL, nil
	}
	raw := g.opts.PinBalanceSourceURL
	if raw == "" {
		raw = defaultPinnedGonkaBalanceSourceURL
	}
	pinnedSourceURL, err := normalizeGonkaSourceURL(raw)
	if err != nil {
		return "", fmt.Errorf("invalid pinned gonka balance source URL %q: %w", raw, err)
	}
	return pinnedSourceURL, nil
}

func resolveDistributedGonkaEndpoints(ctx context.Context, sourceURL string) ([]gonkaopenai.Endpoint, error) {
	endpoints, err := gonkaopenai.GetParticipantsWithProof(ctx, sourceURL, "current")
	if err != nil {
		return nil, fmt.Errorf("resolve gonka endpoints: %w", err)
	}
	if allowed, allowedErr := gonkaopenai.FetchAllowedTransferAddresses(ctx, sourceURL); allowedErr == nil && len(allowed) > 0 {
		filtered := make([]gonkaopenai.Endpoint, 0, len(endpoints))
		for _, ep := range endpoints {
			if allowed[ep.Address] {
				filtered = append(filtered, ep)
			}
		}
		if len(filtered) > 0 {
			endpoints = filtered
		}
	}
	return endpoints, nil
}

func resolvePinnedGonkaEndpoint(ctx context.Context, sourceURL string) ([]gonkaopenai.Endpoint, error) {
	inferenceURL, err := normalizeGonkaEndpointURL(sourceURL)
	if err != nil {
		return nil, err
	}
	address, err := fetchGonkaNodeAddress(ctx, sourceURL)
	if err != nil {
		return nil, err
	}
	return []gonkaopenai.Endpoint{{URL: inferenceURL, Address: address}}, nil
}

func normalizeGonkaEndpointURL(raw string) (string, error) {
	endpointURL := strings.TrimSpace(raw)
	if endpointURL == "" {
		return "", fmt.Errorf("gonka endpoint URL is required")
	}
	if !strings.Contains(endpointURL, "://") {
		endpointURL = "http://" + endpointURL
	}
	u, err := url.Parse(endpointURL)
	if err != nil || strings.TrimSpace(u.Scheme) == "" || strings.TrimSpace(u.Host) == "" {
		return "", fmt.Errorf("invalid gonka endpoint URL %q", strings.TrimSpace(raw))
	}
	scheme := strings.ToLower(strings.TrimSpace(u.Scheme))
	host := strings.ToLower(strings.TrimSpace(u.Host))
	path := strings.TrimRight(strings.TrimSpace(u.Path), "/")
	if path == "" {
		path = "/v1"
	} else if !strings.HasSuffix(path, "/v1") {
		path += "/v1"
	}
	return fmt.Sprintf("%s://%s%s", scheme, host, path), nil
}

func fetchGonkaNodeAddress(ctx context.Context, sourceURL string) (string, error) {
	identityURL := strings.TrimRight(sourceURL, "/") + "/v1/identity"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, identityURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("fetch gonka node identity: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("gonka node identity API error %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var payload struct {
		Data struct {
			Address string `json:"address"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return "", fmt.Errorf("decode gonka node identity: %w", err)
	}

	address := strings.TrimSpace(payload.Data.Address)
	if address == "" {
		return "", fmt.Errorf("gonka node identity address is empty")
	}
	return address, nil
}

func buildGonkaMessages(messages []protocols.LLMMessage) []openai.ChatCompletionMessageParamUnion {
	out := make([]openai.ChatCompletionMessageParamUnion, 0, len(messages))
	for _, m := range messages {
		switch m.Role {
		case "system":
			out = append(out, openai.SystemMessage(m.Content))
		case "assistant":
			if len(m.ToolCalls) == 0 {
				out = append(out, openai.AssistantMessage(m.Content))
				continue
			}
			assistant := openai.ChatCompletionAssistantMessageParam{
				ToolCalls: buildGonkaAssistantToolCalls(m.ToolCalls),
			}
			if strings.TrimSpace(m.Content) != "" {
				assistant.Content = openai.ChatCompletionAssistantMessageParamContentUnion{
					OfString: openai.String(m.Content),
				}
			}
			out = append(out, openai.ChatCompletionMessageParamUnion{OfAssistant: &assistant})
		case "tool":
			if strings.TrimSpace(m.ToolCallID) == "" {
				out = append(out, openai.UserMessage(m.Content))
				continue
			}
			out = append(out, openai.ToolMessage(m.Content, m.ToolCallID))
		default:
			out = append(out, openai.UserMessage(m.Content))
		}
	}
	return out
}

func buildGonkaAssistantToolCalls(toolCalls []types.ToolCall) []openai.ChatCompletionMessageToolCallParam {
	out := make([]openai.ChatCompletionMessageToolCallParam, 0, len(toolCalls))
	for i, tc := range toolCalls {
		name := strings.TrimSpace(tc.Name)
		if name == "" {
			continue
		}
		id := strings.TrimSpace(tc.ID)
		if id == "" {
			id = fmt.Sprintf("call_%d", i)
		}
		out = append(out, openai.ChatCompletionMessageToolCallParam{
			ID: id,
			Function: openai.ChatCompletionMessageToolCallFunctionParam{
				Name:      name,
				Arguments: tc.Arguments,
			},
		})
	}
	return out
}

func buildGonkaTools(tools []types.Tool) []openai.ChatCompletionToolParam {
	out := make([]openai.ChatCompletionToolParam, 0, len(tools))
	for _, t := range tools {
		name := strings.TrimSpace(t.Name)
		if name == "" {
			continue
		}
		fn := openai.FunctionDefinitionParam{Name: name}
		if desc := strings.TrimSpace(t.Description); desc != "" {
			fn.Description = openai.String(desc)
		}
		if len(t.Parameters) > 0 {
			fn.Parameters = t.Parameters
		}
		out = append(out, openai.ChatCompletionToolParam{Function: fn})
	}
	return out
}

func gonkaReasoningContent(chunk openai.ChatCompletionChunk) string {
	raw := strings.TrimSpace(chunk.RawJSON())
	if raw == "" {
		return ""
	}
	var payload streamChunk
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return ""
	}
	if len(payload.Choices) == 0 {
		return ""
	}
	return payload.Choices[0].Delta.ReasoningContent
}

func gonkaUsage(chunk openai.ChatCompletionChunk) *types.LLMUsage {
	raw := strings.TrimSpace(chunk.RawJSON())
	if raw == "" {
		return nil
	}
	var payload streamChunk
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return nil
	}
	return convertUsage(payload.Usage)
}

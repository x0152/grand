package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"mantis/core/protocols"
	"mantis/core/types"
	"mantis/shared"
)

const defaultMaxIterations = 10

type LoopInput struct {
	ActionInput
	MaxIterations int
	MessageID     string
	ToolsProvider func(context.Context) []types.Tool
	RequiredToolNames []string
	RequireToolPrompt string
}

type AgentLoop struct {
	action *AgentAction
}

func NewAgentLoop(action *AgentAction) *AgentLoop {
	return &AgentLoop{action: action}
}

func (l *AgentLoop) Execute(ctx context.Context, in LoopInput) (<-chan types.StreamEvent, error) {
	maxIter := in.MaxIterations
	if maxIter <= 0 {
		maxIter = defaultMaxIterations
	}

	tools := in.Tools
	toolMap := map[string]types.Tool{}
	for _, t := range tools {
		toolMap[t.Name] = t
	}
	requiredTools := map[string]struct{}{}
	for _, name := range in.RequiredToolNames {
		n := strings.TrimSpace(name)
		if n == "" {
			continue
		}
		requiredTools[n] = struct{}{}
	}
	requiredSatisfied := len(requiredTools) == 0

	ch := make(chan types.StreamEvent, 32)
	go func() {
		defer close(ch)

		messages := make([]protocols.LLMMessage, len(in.Messages))
		copy(messages, in.Messages)

		for iter := 0; iter < maxIter; iter++ {
			if in.ToolsProvider != nil {
				tools = in.ToolsProvider(ctx)
				toolMap = make(map[string]types.Tool, len(tools))
				for _, t := range tools {
					toolMap[t.Name] = t
				}
			}
			actionCh, err := l.action.Execute(ctx, ActionInput{
				Provider: in.Provider,
				BaseURL:  in.BaseURL, APIKey: in.APIKey,
				Model: in.Model, Messages: messages, Tools: tools,
				ThinkingMode: in.ThinkingMode,
			})
			if err != nil {
				ch <- types.StreamEvent{Type: "error", Delta: err.Error(), Iteration: iter, IsFinal: true}
				return
			}

			var reply strings.Builder
			var toolCalls []types.ToolCall
			enforceThisIter := !requiredSatisfied
			buffered := make([]types.StreamEvent, 0, 16)

			for event := range actionCh {
				event.Iteration = iter
				switch event.Type {
				case "text":
					reply.WriteString(event.Delta)
					if enforceThisIter {
						buffered = append(buffered, event)
					} else {
						ch <- event
					}
				case "thinking":
					if enforceThisIter {
						buffered = append(buffered, event)
					} else {
						ch <- event
					}
				case "tool_calls":
					toolCalls = event.ToolCalls
				case "error":
					ch <- event
					return
				}
			}

			if enforceThisIter && !hasRequiredToolCall(toolCalls, requiredTools) {
				if iter >= maxIter-1 {
					needed := strings.Join(in.RequiredToolNames, ", ")
					ch <- types.StreamEvent{
						Type:    "error",
						Delta:   "required tool call missing: " + needed,
						IsFinal: true,
					}
					return
				}
				reminder := strings.TrimSpace(in.RequireToolPrompt)
				if reminder == "" {
					reminder = "Before answering this request, call one of the required tools first. Do not infer results without a tool run."
				}
				messages = append(messages, protocols.LLMMessage{
					Role:    "system",
					Content: reminder,
				})
				continue
			}
			if enforceThisIter {
				requiredSatisfied = true
				for _, ev := range buffered {
					ch <- ev
				}
			}

			if len(toolCalls) == 0 {
				return
			}

			messages = append(messages, protocols.LLMMessage{
				Role:      "assistant",
				Content:   reply.String(),
				ToolCalls: toolCalls,
			})

			for _, tc := range toolCalls {
				tool, ok := toolMap[tc.Name]
				if !ok {
					messages = append(messages, protocols.LLMMessage{
						Role: "tool", ToolCallID: tc.ID,
						Content: "error: unknown tool " + tc.Name,
					})
					continue
				}

				stepID := uuid.New().String()
				label := tc.Name
				if tool.Label != nil {
					label = tool.Label(tc.Arguments)
				}

				step := types.Step{
					ID: stepID, Tool: tc.Name, Label: label, Icon: tool.Icon,
					Args: tc.Arguments, Status: "running",
					StartedAt: time.Now().UTC().Format(time.RFC3339),
				}
				stepJSON, _ := json.Marshal(step)
				ch <- types.StreamEvent{Type: "tool_start", Delta: string(stepJSON), ToolID: stepID, Iteration: iter}

				toolCtx := shared.ContextWithStep(ctx, stepID, in.MessageID)

				type toolResult struct {
					result string
					err    error
				}
				resCh := make(chan toolResult, 1)
				toolDone := make(chan struct{})
				go func() {
					r, e := tool.Execute(toolCtx, tc.Arguments)
					close(toolDone)
					resCh <- toolResult{r, e}
				}()

				go func() {
					ticker := time.NewTicker(50 * time.Millisecond)
					defer ticker.Stop()
					for {
						select {
						case <-toolDone:
							return
						case <-ticker.C:
							if meta := shared.ToolMetaFromContext(toolCtx); meta != nil && meta.LogID != "" {
								ch <- types.StreamEvent{
									Type: "tool_meta", ToolID: stepID, Iteration: iter,
									LogID: meta.LogID, ModelID: meta.ModelID, ModelName: meta.ModelName,
									PresetID: meta.PresetID, PresetName: meta.PresetName, ModelRole: meta.ModelRole,
								}
								return
							}
						}
					}
				}()

				res := <-resCh
				result := normalizeToolExecutionResult(tc.Name, res.result, res.err)

				ev := types.StreamEvent{Type: "tool_end", Delta: result, ToolID: stepID, Iteration: iter}
				if meta := shared.ToolMetaFromContext(toolCtx); meta != nil {
					ev.LogID = meta.LogID
					ev.ModelID = meta.ModelID
					ev.ModelName = meta.ModelName
					ev.PresetID = meta.PresetID
					ev.PresetName = meta.PresetName
					ev.ModelRole = meta.ModelRole
				}
				ch <- ev

				messages = append(messages, protocols.LLMMessage{
					Role: "tool", ToolCallID: tc.ID, Content: result,
				})
			}
		}

		ch <- types.StreamEvent{Type: "error", Delta: fmt.Sprintf("max iterations reached: %d", maxIter), IsFinal: true}
	}()

	return ch, nil
}

func hasRequiredToolCall(calls []types.ToolCall, required map[string]struct{}) bool {
	if len(required) == 0 {
		return true
	}
	for _, tc := range calls {
		if _, ok := required[strings.TrimSpace(tc.Name)]; ok {
			return true
		}
	}
	return false
}

func normalizeToolExecutionResult(toolName, raw string, execErr error) string {
	if execErr != nil {
		return "error: " + execErr.Error()
	}
	if strings.TrimSpace(raw) != "" {
		return raw
	}
	name := strings.TrimSpace(toolName)
	if name == "" {
		name = "tool"
	}
	return fmt.Sprintf("status: success (%s completed with no output)", name)
}

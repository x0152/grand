package usecases

import (
	"context"
	"strings"
	"time"

	"mantis/core/base"
	"mantis/core/protocols"
	"mantis/core/types"
)

// inferenceLimitTimeout caps how long we wait on upstream (wrong URL, hung RPC).
const inferenceLimitTimeout = 8 * time.Second

type GetConnectionInferenceLimit struct {
	connStore protocols.Store[string, types.LlmConnection]
	catalogs  map[string]protocols.LLMCatalog
}

func NewGetConnectionInferenceLimit(connStore protocols.Store[string, types.LlmConnection], catalogs map[string]protocols.LLMCatalog) *GetConnectionInferenceLimit {
	return &GetConnectionInferenceLimit{connStore: connStore, catalogs: catalogs}
}

func (uc *GetConnectionInferenceLimit) Execute(ctx context.Context, connectionID string) (types.InferenceLimit, error) {
	items, err := uc.connStore.Get(ctx, []string{connectionID})
	if err != nil {
		return types.InferenceLimit{}, err
	}
	conn, ok := items[connectionID]
	if !ok {
		return types.InferenceLimit{}, base.ErrNotFound
	}
	catalog, ok := uc.catalogs[strings.ToLower(strings.TrimSpace(conn.Provider))]
	if !ok || catalog == nil {
		return types.InferenceLimit{
			Type:  "unlimited",
			Label: "No inference limit reported",
		}, nil
	}
	callCtx, cancel := context.WithTimeout(ctx, inferenceLimitTimeout)
	defer cancel()

	limit, err := catalog.GetInferenceLimit(callCtx, conn.BaseURL, conn.APIKey)
	if err != nil {
		// Bad base URL, unreachable host, or invalid credentials must never take down the AI Engine UI.
		return types.InferenceLimit{
			Type:  "unlimited",
			Label: softInferenceLimitError(err),
		}, nil
	}
	return limit, nil
}

func softInferenceLimitError(err error) string {
	msg := strings.TrimSpace(err.Error())
	if msg == "" {
		return "Inference limit unavailable"
	}
	const max = 140
	if len(msg) > max {
		msg = msg[:max-1] + "…"
	}
	return "Inference limit unavailable · " + msg
}

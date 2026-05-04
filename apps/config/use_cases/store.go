package usecases

import (
	"context"

	"mantis/core/protocols"
	"mantis/core/types"
)

func loadDraft(ctx context.Context, store protocols.Store[string, types.AppConfig]) (types.GlobalConfigDraft, error) {
	items, err := store.Get(ctx, []string{configID})
	if err != nil {
		return types.GlobalConfigDraft{}, err
	}
	if cfg, ok := items[configID]; ok {
		return cfg.Draft, nil
	}
	return types.GlobalConfigDraft{}, nil
}

func saveDraft(ctx context.Context, store protocols.Store[string, types.AppConfig], draft types.GlobalConfigDraft) error {
	cfg := types.AppConfig{ID: configID, Draft: draft}
	existing, err := store.Get(ctx, []string{configID})
	if err != nil {
		return err
	}
	if _, ok := existing[configID]; ok {
		_, err := store.Update(ctx, []types.AppConfig{cfg})
		return err
	}
	_, err = store.Create(ctx, []types.AppConfig{cfg})
	return err
}

package usecases

import (
	"context"

	"mantis/core/protocols"
	"mantis/core/types"
)

type ResetConfig struct {
	store    protocols.Store[string, types.AppConfig]
	resolver *Resolver
}

func NewResetConfig(store protocols.Store[string, types.AppConfig], resolver *Resolver) *ResetConfig {
	return &ResetConfig{store: store, resolver: resolver}
}

func (uc *ResetConfig) Execute(ctx context.Context) (types.GlobalConfig, error) {
	if err := uc.store.Delete(ctx, []string{configID}); err != nil {
		return types.GlobalConfig{}, err
	}
	return uc.resolver.Resolve(types.GlobalConfigDraft{}), nil
}

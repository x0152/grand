package usecases

import (
	"context"

	"mantis/core/protocols"
	"mantis/core/types"
)

type GetConfig struct {
	store    protocols.Store[string, types.AppConfig]
	resolver *Resolver
}

func NewGetConfig(store protocols.Store[string, types.AppConfig], resolver *Resolver) *GetConfig {
	return &GetConfig{store: store, resolver: resolver}
}

func (uc *GetConfig) Execute(ctx context.Context) (types.GlobalConfig, error) {
	draft, err := loadDraft(ctx, uc.store)
	if err != nil {
		return types.GlobalConfig{}, err
	}
	return uc.resolver.Resolve(draft), nil
}

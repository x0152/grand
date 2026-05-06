package usecases

import (
	"context"

	"mantis/core/protocols"
	"mantis/core/types"
)

type DeleteGuardProfile struct {
	store    protocols.Store[string, types.GuardProfile]
	reloader protocols.EgressReloader
}

func NewDeleteGuardProfile(store protocols.Store[string, types.GuardProfile], reloader protocols.EgressReloader) *DeleteGuardProfile {
	if reloader == nil {
		reloader = protocols.NoopEgressReloader{}
	}
	return &DeleteGuardProfile{store: store, reloader: reloader}
}

func (uc *DeleteGuardProfile) Execute(ctx context.Context, id string) error {
	if err := uc.store.Delete(ctx, []string{id}); err != nil {
		return err
	}
	uc.reloader.Reload(ctx)
	return nil
}

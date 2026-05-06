package usecases

import (
	"context"

	"github.com/google/uuid"

	"mantis/core/protocols"
	"mantis/core/types"
)

type CreateGuardProfile struct {
	store    protocols.Store[string, types.GuardProfile]
	reloader protocols.EgressReloader
}

func NewCreateGuardProfile(store protocols.Store[string, types.GuardProfile], reloader protocols.EgressReloader) *CreateGuardProfile {
	if reloader == nil {
		reloader = protocols.NoopEgressReloader{}
	}
	return &CreateGuardProfile{store: store, reloader: reloader}
}

func (uc *CreateGuardProfile) Execute(ctx context.Context, name, description string, capabilities types.GuardCapabilities, commandsMode types.CommandsMode, commands []types.CommandRule, egress types.EgressPolicy) (types.GuardProfile, error) {
	p := types.GuardProfile{
		ID:           uuid.New().String(),
		Name:         name,
		Description:  description,
		Builtin:      false,
		Capabilities: capabilities,
		CommandsMode: commandsMode.Normalize(),
		Commands:     commands,
		Egress:       egress.Normalize(),
	}
	if p.Commands == nil {
		p.Commands = []types.CommandRule{}
	}
	result, err := uc.store.Create(ctx, []types.GuardProfile{p})
	if err != nil {
		return types.GuardProfile{}, err
	}
	uc.reloader.Reload(ctx)
	return result[0], nil
}

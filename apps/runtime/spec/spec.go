package spec

import (
	"context"

	"mantis/apps/runtime/templates"
	"mantis/core/protocols"
	"mantis/core/types"
)

type Builder struct {
	profileStore  protocols.Store[string, types.GuardProfile]
	sharedNetwork string
}

func NewBuilder(profileStore protocols.Store[string, types.GuardProfile], sharedNetwork string) *Builder {
	return &Builder{profileStore: profileStore, sharedNetwork: sharedNetwork}
}

func (b *Builder) Build(ctx context.Context, sandboxName string, conn types.Connection, env map[string]string, labels map[string]string) types.RuntimeRunSpec {
	spec := types.RuntimeRunSpec{
		Name:   sandboxName,
		Env:    env,
		Labels: labels,
	}
	if t, ok := templates.Lookup(sandboxName); ok {
		spec.CapAdd = t.CapAdd
	}
	if sandboxName == "runtimectl" {
		spec.NoHomeVolume = true
		if b.sharedNetwork != "" {
			spec.Network = b.sharedNetwork
			return spec
		}
	}
	spec.Internal = !b.profileAllowsNetwork(ctx, conn.ProfileIDs)
	return spec
}

func (b *Builder) profileAllowsNetwork(ctx context.Context, profileIDs []string) bool {
	if len(profileIDs) == 0 {
		return true
	}
	profiles, err := b.profileStore.Get(ctx, profileIDs)
	if err != nil || len(profiles) == 0 {
		return true
	}
	for _, p := range profiles {
		if p.Capabilities.Unrestricted || p.Capabilities.NetworkOut {
			return true
		}
	}
	return false
}

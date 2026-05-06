package spec

import (
	"context"
	"errors"
	"testing"

	"mantis/core/types"
)

type fakeProfileStore struct {
	profiles map[string]types.GuardProfile
	getErr   error
}

func (s *fakeProfileStore) Create(_ context.Context, items []types.GuardProfile) ([]types.GuardProfile, error) {
	return items, nil
}

func (s *fakeProfileStore) Get(_ context.Context, ids []string) (map[string]types.GuardProfile, error) {
	if s.getErr != nil {
		return nil, s.getErr
	}
	out := make(map[string]types.GuardProfile, len(ids))
	for _, id := range ids {
		if p, ok := s.profiles[id]; ok {
			out[id] = p
		}
	}
	return out, nil
}

func (s *fakeProfileStore) List(_ context.Context, _ types.ListQuery) ([]types.GuardProfile, error) {
	return nil, nil
}

func (s *fakeProfileStore) Update(_ context.Context, items []types.GuardProfile) ([]types.GuardProfile, error) {
	return items, nil
}

func (s *fakeProfileStore) Delete(_ context.Context, _ []string) error { return nil }

func newStore(p ...types.GuardProfile) *fakeProfileStore {
	m := make(map[string]types.GuardProfile, len(p))
	for _, v := range p {
		m[v.ID] = v
	}
	return &fakeProfileStore{profiles: m}
}

func TestBuilderNoProfileMeansInternalFalse(t *testing.T) {
	b := NewBuilder(newStore(), "")
	spec := b.Build(context.Background(), "anything", types.Connection{}, nil, nil)
	if spec.Internal {
		t.Error("no profiles must default to network allowed (Internal=false)")
	}
}

func TestBuilderProfileWithoutNetworkOutMakesInternal(t *testing.T) {
	store := newStore(types.GuardProfile{ID: "ro"})
	b := NewBuilder(store, "")
	spec := b.Build(context.Background(), "anything", types.Connection{ProfileIDs: []string{"ro"}}, nil, nil)
	if !spec.Internal {
		t.Error("profile without NetworkOut/Unrestricted must produce Internal=true")
	}
}

func TestBuilderProfileWithNetworkOutAllowsNetwork(t *testing.T) {
	store := newStore(types.GuardProfile{ID: "net", Capabilities: types.GuardCapabilities{NetworkOut: true}})
	b := NewBuilder(store, "")
	spec := b.Build(context.Background(), "anything", types.Connection{ProfileIDs: []string{"net"}}, nil, nil)
	if spec.Internal {
		t.Error("NetworkOut profile must not produce Internal=true")
	}
}

func TestBuilderUnrestrictedProfileAllowsNetwork(t *testing.T) {
	store := newStore(types.GuardProfile{ID: "free", Capabilities: types.GuardCapabilities{Unrestricted: true}})
	b := NewBuilder(store, "")
	spec := b.Build(context.Background(), "anything", types.Connection{ProfileIDs: []string{"free"}}, nil, nil)
	if spec.Internal {
		t.Error("Unrestricted profile must not produce Internal=true")
	}
}

func TestBuilderAnyProfileWithNetworkWins(t *testing.T) {
	store := newStore(
		types.GuardProfile{ID: "ro"},
		types.GuardProfile{ID: "net", Capabilities: types.GuardCapabilities{NetworkOut: true}},
	)
	b := NewBuilder(store, "")
	spec := b.Build(context.Background(), "anything", types.Connection{ProfileIDs: []string{"ro", "net"}}, nil, nil)
	if spec.Internal {
		t.Error("at least one network-allowing profile must dominate")
	}
}

func TestBuilderProfileFetchErrorFailsOpen(t *testing.T) {
	store := &fakeProfileStore{profiles: map[string]types.GuardProfile{}, getErr: errors.New("db")}
	b := NewBuilder(store, "")
	spec := b.Build(context.Background(), "anything", types.Connection{ProfileIDs: []string{"x"}}, nil, nil)
	if spec.Internal {
		t.Error("profile fetch error must not silently isolate the sandbox")
	}
}

func TestBuilderRuntimectlNoHomeVolume(t *testing.T) {
	store := newStore(types.GuardProfile{ID: "ro"})
	b := NewBuilder(store, "")
	spec := b.Build(context.Background(), "runtimectl", types.Connection{ProfileIDs: []string{"ro"}}, nil, nil)
	if !spec.NoHomeVolume {
		t.Error("runtimectl must not get the persistent /home volume")
	}
}

func TestBuilderRuntimectlSharedNetworkSkipsInternal(t *testing.T) {
	store := newStore(types.GuardProfile{ID: "ro"})
	b := NewBuilder(store, "shared-net")
	spec := b.Build(context.Background(), "runtimectl", types.Connection{ProfileIDs: []string{"ro"}}, nil, nil)
	if spec.Network != "shared-net" {
		t.Errorf("Network %q, want shared-net", spec.Network)
	}
	if spec.Internal {
		t.Error("runtimectl with shared network must keep Internal=false (early return)")
	}
}

func TestBuilderRuntimectlWithoutSharedNetworkStillEvaluatesProfile(t *testing.T) {
	store := newStore(types.GuardProfile{ID: "ro"})
	b := NewBuilder(store, "")
	spec := b.Build(context.Background(), "runtimectl", types.Connection{ProfileIDs: []string{"ro"}}, nil, nil)
	if !spec.Internal {
		t.Error("runtimectl without shared network must still honour profile network restrictions")
	}
}

func TestBuilderTemplateCapAddIsApplied(t *testing.T) {
	b := NewBuilder(newStore(), "")
	spec := b.Build(context.Background(), "browser", types.Connection{}, nil, nil)
	found := false
	for _, c := range spec.CapAdd {
		if c == "SYS_ADMIN" {
			found = true
		}
	}
	if !found {
		t.Errorf("browser sandbox must inherit SYS_ADMIN cap, got %v", spec.CapAdd)
	}
}

func TestBuilderUnknownTemplateHasNoCapAdd(t *testing.T) {
	b := NewBuilder(newStore(), "")
	spec := b.Build(context.Background(), "custom-thing", types.Connection{}, nil, nil)
	if len(spec.CapAdd) != 0 {
		t.Errorf("unknown sandbox must not inherit caps, got %v", spec.CapAdd)
	}
}

func TestBuilderPropagatesEnvAndLabels(t *testing.T) {
	b := NewBuilder(newStore(), "")
	env := map[string]string{"K": "V"}
	labels := map[string]string{"app": "mantis"}
	spec := b.Build(context.Background(), "anything", types.Connection{}, env, labels)
	if spec.Env["K"] != "V" {
		t.Error("env not propagated")
	}
	if spec.Labels["app"] != "mantis" {
		t.Error("labels not propagated")
	}
	if spec.Name != "anything" {
		t.Errorf("Name %q, want anything", spec.Name)
	}
}

package usecases

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"

	"mantis/core/types"
)

type fakeGuardProfileStore struct {
	getFn    func(ctx context.Context, ids []string) (map[string]types.GuardProfile, error)
	createFn func(ctx context.Context, items []types.GuardProfile) ([]types.GuardProfile, error)
	updateFn func(ctx context.Context, items []types.GuardProfile) ([]types.GuardProfile, error)
	deleteFn func(ctx context.Context, ids []string) error
}

func (s *fakeGuardProfileStore) Create(ctx context.Context, items []types.GuardProfile) ([]types.GuardProfile, error) {
	return s.createFn(ctx, items)
}
func (s *fakeGuardProfileStore) Get(ctx context.Context, ids []string) (map[string]types.GuardProfile, error) {
	return s.getFn(ctx, ids)
}
func (s *fakeGuardProfileStore) List(_ context.Context, _ types.ListQuery) ([]types.GuardProfile, error) {
	return nil, nil
}
func (s *fakeGuardProfileStore) Update(ctx context.Context, items []types.GuardProfile) ([]types.GuardProfile, error) {
	return s.updateFn(ctx, items)
}
func (s *fakeGuardProfileStore) Delete(ctx context.Context, ids []string) error {
	return s.deleteFn(ctx, ids)
}

type countingReloader struct {
	count int32
}

func (r *countingReloader) Reload(_ context.Context) { atomic.AddInt32(&r.count, 1) }

func (r *countingReloader) Calls() int32 { return atomic.LoadInt32(&r.count) }

func TestCreateGuardProfileNormalizesAndReloads(t *testing.T) {
	var captured types.GuardProfile
	store := &fakeGuardProfileStore{
		createFn: func(_ context.Context, items []types.GuardProfile) ([]types.GuardProfile, error) {
			captured = items[0]
			return items, nil
		},
	}
	reloader := &countingReloader{}
	uc := NewCreateGuardProfile(store, reloader)

	out, err := uc.Execute(context.Background(), "p", "d", types.GuardCapabilities{}, types.CommandsMode("weird"), nil, types.EgressPolicy{Mode: "weird"})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	if out.Name != "p" || out.ID == "" {
		t.Fatal("output not populated")
	}
	if captured.CommandsMode != types.CommandsWhitelist {
		t.Errorf("commandsMode must default to whitelist when invalid, got %q", captured.CommandsMode)
	}
	if captured.Egress.Mode != types.EgressOpen {
		t.Errorf("invalid egress mode must normalize to open, got %q", captured.Egress.Mode)
	}
	if captured.Commands == nil {
		t.Error("Commands must be empty slice, not nil")
	}
	if reloader.Calls() != 1 {
		t.Errorf("reload called %d times, want 1", reloader.Calls())
	}
}

func TestCreateGuardProfileNoReloadOnError(t *testing.T) {
	store := &fakeGuardProfileStore{
		createFn: func(_ context.Context, _ []types.GuardProfile) ([]types.GuardProfile, error) {
			return nil, errors.New("db error")
		},
	}
	reloader := &countingReloader{}
	uc := NewCreateGuardProfile(store, reloader)

	if _, err := uc.Execute(context.Background(), "p", "d", types.GuardCapabilities{}, types.CommandsWhitelist, nil, types.EgressPolicy{}); err == nil {
		t.Fatal("expected error")
	}
	if reloader.Calls() != 0 {
		t.Errorf("reload must not fire on store error")
	}
}

func TestUpdateGuardProfilePreservesBuiltinAndReloads(t *testing.T) {
	var captured types.GuardProfile
	store := &fakeGuardProfileStore{
		getFn: func(_ context.Context, _ []string) (map[string]types.GuardProfile, error) {
			return map[string]types.GuardProfile{"id": {ID: "id", Builtin: true}}, nil
		},
		updateFn: func(_ context.Context, items []types.GuardProfile) ([]types.GuardProfile, error) {
			captured = items[0]
			return items, nil
		},
	}
	reloader := &countingReloader{}
	uc := NewUpdateGuardProfile(store, reloader)

	if _, err := uc.Execute(context.Background(), "id", "n", "d", types.GuardCapabilities{}, types.CommandsBlacklist, nil, types.EgressPolicy{Mode: types.EgressWhitelist, Hosts: []string{"a"}}); err != nil {
		t.Fatalf("execute: %v", err)
	}
	if !captured.Builtin {
		t.Error("Builtin must be preserved on update")
	}
	if captured.CommandsMode != types.CommandsBlacklist {
		t.Errorf("commandsMode not propagated: %q", captured.CommandsMode)
	}
	if captured.Egress.Mode != types.EgressWhitelist || len(captured.Egress.Hosts) != 1 {
		t.Errorf("egress not propagated: %+v", captured.Egress)
	}
	if reloader.Calls() != 1 {
		t.Errorf("reload not called")
	}
}

func TestDeleteGuardProfileReloads(t *testing.T) {
	store := &fakeGuardProfileStore{
		deleteFn: func(_ context.Context, _ []string) error { return nil },
	}
	reloader := &countingReloader{}
	uc := NewDeleteGuardProfile(store, reloader)
	if err := uc.Execute(context.Background(), "id"); err != nil {
		t.Fatalf("execute: %v", err)
	}
	if reloader.Calls() != 1 {
		t.Errorf("reload not called")
	}
}

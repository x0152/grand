package usecases

import (
	"context"
	"sort"
	"testing"
	"time"

	"mantis/core/types"
)

type stubEventStore struct {
	events []types.GuardEvent
}

func (s *stubEventStore) Create(_ context.Context, _ []types.GuardEvent) ([]types.GuardEvent, error) {
	return nil, nil
}
func (s *stubEventStore) Get(_ context.Context, _ []string) (map[string]types.GuardEvent, error) {
	return nil, nil
}
func (s *stubEventStore) List(_ context.Context, q types.ListQuery) ([]types.GuardEvent, error) {
	out := make([]types.GuardEvent, 0, len(s.events))
	for _, ev := range s.events {
		if v, ok := q.Filter["kind"]; ok && v != string(ev.Kind) {
			continue
		}
		if v, ok := q.Filter["connection_id"]; ok && v != ev.ConnectionID {
			continue
		}
		if v, ok := q.Filter["allowed"]; ok {
			if (v == "true") != ev.Allowed {
				continue
			}
		}
		out = append(out, ev)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	if q.Page.Limit > 0 && len(out) > q.Page.Limit {
		out = out[:q.Page.Limit]
	}
	return out, nil
}
func (s *stubEventStore) Update(_ context.Context, _ []types.GuardEvent) ([]types.GuardEvent, error) {
	return nil, nil
}
func (s *stubEventStore) Delete(_ context.Context, _ []string) error { return nil }

func TestListGuardEventsScopesByUser(t *testing.T) {
	now := time.Now()
	store := &stubEventStore{events: []types.GuardEvent{
		{ID: "1", Kind: types.GuardEventCommand, Target: "ls", UserID: "alice", CreatedAt: now.Add(-1 * time.Minute)},
		{ID: "2", Kind: types.GuardEventCommand, Target: "rm", UserID: "bob", CreatedAt: now.Add(-2 * time.Minute)},
		{ID: "3", Kind: types.GuardEventHost, Target: "x.com", UserID: "", CreatedAt: now.Add(-3 * time.Minute)},
	}}

	uc := NewListGuardEvents(store)
	got, err := uc.Execute(context.Background(), ListGuardEventsFilter{UserID: "alice", Limit: 50})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 events for alice (own + system), got %d: %+v", len(got), got)
	}
	for _, ev := range got {
		if ev.UserID != "" && ev.UserID != "alice" {
			t.Errorf("leaked event from %s", ev.UserID)
		}
	}
}

func TestListGuardEventsWithoutUserSeesAll(t *testing.T) {
	now := time.Now()
	store := &stubEventStore{events: []types.GuardEvent{
		{ID: "1", Kind: types.GuardEventCommand, UserID: "alice", CreatedAt: now},
		{ID: "2", Kind: types.GuardEventCommand, UserID: "bob", CreatedAt: now},
	}}
	uc := NewListGuardEvents(store)
	got, err := uc.Execute(context.Background(), ListGuardEventsFilter{Limit: 50})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 events when no user filter, got %d", len(got))
	}
}

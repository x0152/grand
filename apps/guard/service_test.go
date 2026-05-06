package guardapp

import (
	"context"
	"sync"
	"testing"

	"mantis/core/types"
)

type fakeProfileStore struct {
	profiles map[string]types.GuardProfile
}

func (s *fakeProfileStore) Create(_ context.Context, _ []types.GuardProfile) ([]types.GuardProfile, error) {
	return nil, nil
}
func (s *fakeProfileStore) Get(_ context.Context, ids []string) (map[string]types.GuardProfile, error) {
	out := make(map[string]types.GuardProfile)
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
func (s *fakeProfileStore) Update(_ context.Context, _ []types.GuardProfile) ([]types.GuardProfile, error) {
	return nil, nil
}
func (s *fakeProfileStore) Delete(_ context.Context, _ []string) error { return nil }

type fakeEventStore struct {
	mu     sync.Mutex
	events []types.GuardEvent
}

func (s *fakeEventStore) Create(_ context.Context, items []types.GuardEvent) ([]types.GuardEvent, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.events = append(s.events, items...)
	return items, nil
}
func (s *fakeEventStore) Get(_ context.Context, _ []string) (map[string]types.GuardEvent, error) {
	return nil, nil
}
func (s *fakeEventStore) List(_ context.Context, _ types.ListQuery) ([]types.GuardEvent, error) {
	return nil, nil
}
func (s *fakeEventStore) Update(_ context.Context, _ []types.GuardEvent) ([]types.GuardEvent, error) {
	return nil, nil
}
func (s *fakeEventStore) Delete(_ context.Context, _ []string) error { return nil }

func TestEvaluateCommandRecordsEvent(t *testing.T) {
	profiles := &fakeProfileStore{profiles: map[string]types.GuardProfile{
		"p": {
			ID:           "p",
			CommandsMode: types.CommandsWhitelist,
			Commands:     []types.CommandRule{{Command: "ls"}},
		},
	}}
	events := &fakeEventStore{}
	svc := NewService(profiles, events)

	ok := svc.EvaluateCommand(context.Background(), []string{"p"}, "conn-1", "ls -la")
	if !ok.Allowed {
		t.Fatalf("expected allow, got %s: %s", ok.Rule, ok.Message)
	}
	bad := svc.EvaluateCommand(context.Background(), []string{"p"}, "conn-1", "rm -rf /")
	if bad.Allowed {
		t.Fatalf("rm should be blocked")
	}
	if got := len(events.events); got != 2 {
		t.Fatalf("expected 2 events, got %d", got)
	}
	if events.events[0].Allowed != true || events.events[0].Target != "ls -la" {
		t.Errorf("first event wrong: %+v", events.events[0])
	}
	if events.events[1].Allowed != false || events.events[1].ConnectionID != "conn-1" {
		t.Errorf("second event wrong: %+v", events.events[1])
	}
}

func TestEvaluateHostRecordsEvent(t *testing.T) {
	profiles := &fakeProfileStore{profiles: map[string]types.GuardProfile{
		"p": {
			ID:           "p",
			CommandsMode: types.CommandsWhitelist,
			Egress: types.EgressPolicy{
				Mode:  types.EgressWhitelist,
				Hosts: []string{"api.openai.com"},
			},
		},
	}}
	events := &fakeEventStore{}
	svc := NewService(profiles, events)

	if r := svc.EvaluateHost(context.Background(), []string{"p"}, "conn", "api.openai.com"); !r.Allowed {
		t.Fatalf("expected allow, got %s", r.Reason)
	}
	if r := svc.EvaluateHost(context.Background(), []string{"p"}, "conn", "evil.com"); r.Allowed {
		t.Fatalf("evil.com should be blocked")
	}
	if got := len(events.events); got != 2 {
		t.Fatalf("expected 2 events, got %d", got)
	}
	if events.events[0].Kind != types.GuardEventHost {
		t.Errorf("kind wrong: %+v", events.events[0])
	}
}

func TestEmptyTargetIsNoop(t *testing.T) {
	events := &fakeEventStore{}
	svc := NewService(&fakeProfileStore{profiles: map[string]types.GuardProfile{}}, events)
	svc.EvaluateCommand(context.Background(), []string{"p"}, "", "")
	svc.EvaluateHost(context.Background(), []string{"p"}, "", "")
	if got := len(events.events); got != 0 {
		t.Fatalf("expected no events for empty input, got %d", got)
	}
}

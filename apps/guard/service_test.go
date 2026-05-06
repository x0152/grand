package guardapp

import (
	"context"
	"sort"
	"sync"
	"testing"
	"time"

	"mantis/core/auth"
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
func (s *fakeEventStore) List(_ context.Context, q types.ListQuery) ([]types.GuardEvent, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]types.GuardEvent, 0, len(s.events))
	for _, ev := range s.events {
		if v, ok := q.Filter["connection_id"]; ok && v != ev.ConnectionID {
			continue
		}
		if v, ok := q.Filter["kind"]; ok && v != string(ev.Kind) {
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

func TestEvaluateCommandTagsUserFromContext(t *testing.T) {
	profiles := &fakeProfileStore{profiles: map[string]types.GuardProfile{
		"p": {ID: "p", CommandsMode: types.CommandsOpen},
	}}
	events := &fakeEventStore{}
	svc := NewService(profiles, events)

	ctx := auth.WithIdentity(context.Background(), auth.Identity{UserID: "user-42", Name: "alice"})
	svc.EvaluateCommand(ctx, []string{"p"}, "conn-1", "ls")

	if got := len(events.events); got != 1 {
		t.Fatalf("expected 1 event, got %d", got)
	}
	if events.events[0].UserID != "user-42" {
		t.Errorf("expected user-42, got %q", events.events[0].UserID)
	}
}

func TestRecordHostEventInheritsLastUser(t *testing.T) {
	profiles := &fakeProfileStore{profiles: map[string]types.GuardProfile{
		"p": {ID: "p", CommandsMode: types.CommandsOpen},
	}}
	events := &fakeEventStore{}
	svc := NewService(profiles, events)

	// User runs a command — that anchors the user for subsequent gateway events.
	ctx := auth.WithIdentity(context.Background(), auth.Identity{UserID: "user-7"})
	svc.EvaluateCommand(ctx, []string{"p"}, "conn-x", "curl x.com")

	// Gateway later reports a block with no auth context.
	if err := svc.RecordHostEvent(context.Background(), types.GuardEvent{
		Target:       "evil.com",
		ConnectionID: "conn-x",
		Allowed:      false,
		Rule:         "egress whitelist",
	}); err != nil {
		t.Fatalf("record: %v", err)
	}

	if got := len(events.events); got != 2 {
		t.Fatalf("expected 2 events, got %d", got)
	}
	host := events.events[1]
	if host.UserID != "user-7" {
		t.Errorf("host event should inherit last command user, got %q", host.UserID)
	}
}

func TestRecentBlockedHostsDeduplicates(t *testing.T) {
	events := &fakeEventStore{}
	svc := NewService(&fakeProfileStore{profiles: map[string]types.GuardProfile{}}, events)
	now := time.Now()

	// Override the clock so we can sequence events. Service uses s.now() only
	// for events that have a zero CreatedAt — we set CreatedAt explicitly here.
	insert := func(target, reason string, ago time.Duration, allowed bool, profileIDs ...string) {
		_ = svc.RecordHostEvent(context.Background(), types.GuardEvent{
			Target:       target,
			ConnectionID: "conn",
			Allowed:      allowed,
			Rule:         reason,
			ProfileIDs:   profileIDs,
			CreatedAt:    now.Add(-ago),
		})
	}

	insert("a.com.", "blocked", 4*time.Second, false, "prof-a")
	insert("a.com", "blocked", 3*time.Second, false, "prof-a", "prof-b")
	insert("a.com", "blocked", 2*time.Second, false, "prof-b")
	insert("b.com", "blocked", 1*time.Second, false, "prof-a")
	insert("c.com", "ok", 1*time.Second, true, "prof-a") // allow event must be ignored

	got := svc.RecentBlockedHosts(context.Background(), "conn", now.Add(-10*time.Second), 10)
	if len(got) != 2 {
		t.Fatalf("expected 2 distinct hosts, got %d (%+v)", len(got), got)
	}
	// Most recent first: b.com then a.com (last block was 2s ago).
	if got[0].Host != "b.com" || got[0].Count != 1 {
		t.Errorf("first block wrong: %+v", got[0])
	}
	if got[1].Host != "a.com" || got[1].Count != 3 {
		t.Errorf("a.com should aggregate to 3, got %+v", got[1])
	}
	if want := []string{"prof-a"}; !equalStrings(got[0].ProfileIDs, want) {
		t.Errorf("b.com profileIDs: want %v got %v", want, got[0].ProfileIDs)
	}
	if want := []string{"prof-a", "prof-b"}; !equalStringSets(got[1].ProfileIDs, want) {
		t.Errorf("a.com profileIDs (deduped union): want %v got %v", want, got[1].ProfileIDs)
	}

	// Time window must drop older entries.
	tight := svc.RecentBlockedHosts(context.Background(), "conn", now.Add(-1500*time.Millisecond), 10)
	if len(tight) != 1 || tight[0].Host != "b.com" {
		t.Fatalf("tight window: expected only b.com, got %+v", tight)
	}
}

func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func equalStringSets(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	seen := make(map[string]int, len(a))
	for _, v := range a {
		seen[v]++
	}
	for _, v := range b {
		if seen[v] == 0 {
			return false
		}
		seen[v]--
	}
	return true
}

package egress

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"mantis/core/types"
)

func TestControllerTriggerCoalescesNonBlocking(t *testing.T) {
	c := &Controller{wake: make(chan struct{}, 1)}
	for i := 0; i < 10; i++ {
		c.Trigger()
	}
	select {
	case <-c.wake:
	default:
		t.Fatal("expected at least one signal in wake channel")
	}
}

func TestControllerRefreshAppliesAndSkipsByVersion(t *testing.T) {
	var snap atomic.Value
	snap.Store(types.EgressState{
		Sandboxes: []types.EgressSandboxState{{Name: "x", IP: "10.0.0.1", Policy: types.EgressPolicy{Mode: types.EgressOpen}}},
	})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s := snap.Load().(types.EgressState)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(s)
	}))
	defer srv.Close()

	state := &atomic.Pointer[State]{}
	client := NewSnapshotClient(srv.URL, "", srv.Client())
	firewall := NewFirewall(true)
	logger := NewLogger()
	c := NewController(state, client, firewall, logger, time.Hour)

	c.refreshOnce(context.Background())
	first := state.Load()
	if first == nil {
		t.Fatal("first refresh did not store state")
	}
	if first.Version == "" {
		t.Fatal("Version must be derived from canonical hash")
	}

	c.refreshOnce(context.Background())
	second := state.Load()
	if second != first {
		t.Error("same snapshot should not trigger re-apply (state pointer must be stable)")
	}

	snap.Store(types.EgressState{
		Sandboxes: []types.EgressSandboxState{{Name: "x", IP: "10.0.0.1", Policy: types.EgressPolicy{Mode: types.EgressClosed}}},
	})
	c.refreshOnce(context.Background())
	third := state.Load()
	if third == second {
		t.Error("policy change must produce a new applied state")
	}
	if third.Version == second.Version {
		t.Error("policy change must produce a different version")
	}
}

func TestControllerRefreshSurvivesFetchError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	}))
	defer srv.Close()

	state := &atomic.Pointer[State]{}
	client := NewSnapshotClient(srv.URL, "", srv.Client())
	c := NewController(state, client, NewFirewall(true), NewLogger(), time.Hour)
	c.refreshOnce(context.Background())
	if state.Load() != nil {
		t.Error("failed fetch must leave state untouched")
	}
}

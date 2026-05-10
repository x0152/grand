package usecases

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGetBalance_UsesRequestedNodeWhenPinDisabled(t *testing.T) {
	var hitPath string
	source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hitPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"balances":[{"denom":"ngonka","amount":"1000000000"}]}`)
	}))
	defer source.Close()

	uc := NewGetBalance(GetBalanceOptions{})
	bal, err := uc.Execute(context.Background(), "gonka1abc", source.URL)
	if err != nil {
		t.Fatal(err)
	}
	if bal.NodeURL != source.URL {
		t.Fatalf("expected source url %q, got %q", source.URL, bal.NodeURL)
	}
	if bal.Label != "1.00 GNK" {
		t.Fatalf("unexpected balance label: %q", bal.Label)
	}
	if !strings.HasPrefix(hitPath, "/chain-api/cosmos/bank/v1beta1/balances/") {
		t.Fatalf("unexpected path hit: %q", hitPath)
	}
}

func TestGetBalance_UsesPinnedNodeWhenPinEnabled(t *testing.T) {
	var requestedNodeHits int
	requestedNode := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestedNodeHits++
		http.Error(w, "should not hit requested node", http.StatusInternalServerError)
	}))
	defer requestedNode.Close()

	var pinnedPath string
	pinnedNode := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		pinnedPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"balances":[{"denom":"ngonka","amount":"250000000"}]}`)
	}))
	defer pinnedNode.Close()

	uc := NewGetBalance(GetBalanceOptions{
		PinEndpointEnabled: true,
		PinNodeURL:         pinnedNode.URL,
	})
	bal, err := uc.Execute(context.Background(), "gonka1abc", requestedNode.URL)
	if err != nil {
		t.Fatal(err)
	}
	if bal.NodeURL != pinnedNode.URL {
		t.Fatalf("expected pinned url %q, got %q", pinnedNode.URL, bal.NodeURL)
	}
	if bal.Label != "0.2500 GNK" {
		t.Fatalf("unexpected balance label: %q", bal.Label)
	}
	if requestedNodeHits != 0 {
		t.Fatalf("unexpected requested node hits: %d", requestedNodeHits)
	}
	if !strings.HasPrefix(pinnedPath, "/chain-api/cosmos/bank/v1beta1/balances/") {
		t.Fatalf("unexpected pinned path hit: %q", pinnedPath)
	}
}

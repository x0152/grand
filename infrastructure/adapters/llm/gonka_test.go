package llm

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const gonkaTestPrivateKey = "1a30d0695812c21d6c6bfc59630c1753888c23fdbe63f897686c95f2924879d2"

func TestGonkaGetInferenceLimit_Balance(t *testing.T) {
	var hit string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hit = r.URL.Path
		if !strings.HasPrefix(r.URL.Path, "/chain-api/cosmos/bank/v1beta1/balances/") {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"balances":[{"denom":"ngonka","amount":"145230000000"},{"denom":"other","amount":"1"}]}`)
	}))
	defer server.Close()

	g := NewGonka()
	limit, err := g.GetInferenceLimit(context.Background(), server.URL, gonkaTestPrivateKey)
	if err != nil {
		t.Fatal(err)
	}
	if limit.Type != "balance" {
		t.Fatalf("expected balance type, got %+v", limit)
	}
	if limit.Label != "Balance: 145.23 GNK" {
		t.Fatalf("unexpected label: %q", limit.Label)
	}
	if hit == "" {
		t.Fatalf("server not hit")
	}
}

func TestGonkaGetInferenceLimit_ZeroBalance(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"balances":[]}`)
	}))
	defer server.Close()

	g := NewGonka()
	limit, err := g.GetInferenceLimit(context.Background(), server.URL, gonkaTestPrivateKey)
	if err != nil {
		t.Fatal(err)
	}
	if limit.Type != "balance" || limit.Label != "Balance: 0 GNK" {
		t.Fatalf("unexpected limit: %+v", limit)
	}
}

func TestGonkaGetInferenceLimit_MissingPrivateKey(t *testing.T) {
	g := NewGonka()
	_, err := g.GetInferenceLimit(context.Background(), "http://node", "")
	if err == nil || !strings.Contains(err.Error(), "private key") {
		t.Fatalf("expected private key error, got %v", err)
	}
}

func TestGonkaGetInferenceLimit_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	}))
	defer server.Close()

	g := NewGonka()
	_, err := g.GetInferenceLimit(context.Background(), server.URL, gonkaTestPrivateKey)
	if err == nil || !strings.Contains(err.Error(), "gonka chain API error 500") {
		t.Fatalf("expected chain API error, got %v", err)
	}
}

func TestNormalizeGonkaEndpointURL(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"https://node4.gonka.ai", "https://node4.gonka.ai/v1"},
		{"https://node4.gonka.ai/v1", "https://node4.gonka.ai/v1"},
		{"HTTP://84.32.59.212:8000/", "http://84.32.59.212:8000/v1"},
		{"84.32.59.212:8000/v1", "http://84.32.59.212:8000/v1"},
	}
	for _, tc := range cases {
		got, err := normalizeGonkaEndpointURL(tc.in)
		if err != nil {
			t.Fatalf("normalize %q: %v", tc.in, err)
		}
		if got != tc.want {
			t.Fatalf("normalize %q: got %q want %q", tc.in, got, tc.want)
		}
	}
}

func TestResolvePinnedGonkaEndpoint(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/identity" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"data":{"address":"gonka1node4address"}}`)
	}))
	defer server.Close()

	endpoints, err := resolvePinnedGonkaEndpoint(context.Background(), server.URL)
	if err != nil {
		t.Fatal(err)
	}
	if len(endpoints) != 1 {
		t.Fatalf("expected one pinned endpoint, got %d", len(endpoints))
	}
	if endpoints[0].URL != server.URL+"/v1" {
		t.Fatalf("unexpected pinned endpoint url: %q", endpoints[0].URL)
	}
	if endpoints[0].Address != "gonka1node4address" {
		t.Fatalf("unexpected pinned endpoint address: %q", endpoints[0].Address)
	}
}

func TestResolvePinnedGonkaEndpoint_MissingAddress(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"data":{"address":""}}`)
	}))
	defer server.Close()

	_, err := resolvePinnedGonkaEndpoint(context.Background(), server.URL)
	if err == nil || !strings.Contains(err.Error(), "identity address is empty") {
		t.Fatalf("expected empty identity address error, got %v", err)
	}
}

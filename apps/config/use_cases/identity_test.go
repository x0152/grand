package usecases

import "testing"

func TestSuggestEndpointID(t *testing.T) {
	tests := []struct {
		baseURL  string
		provider string
		want     string
	}{
		{"https://api.openai.com/v1", "openai", "openai-primary"},
		{"http://localhost:1234/v1", "openai", "local-llm"},
		{"http://127.0.0.1:8080/v1", "openai", "local-llm"},
		{"http://node1.gonka.ai:8000", "gonka", "gonka-primary"},
		{"https://example.com/v1", "openai", "llm-example-com"},
	}
	for _, tt := range tests {
		got := suggestEndpointID(tt.baseURL, tt.provider)
		if got != tt.want {
			t.Errorf("suggestEndpointID(%q, %q) = %q, want %q", tt.baseURL, tt.provider, got, tt.want)
		}
	}
}

func TestNormalizeBaseURL(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"https://API.openai.com/v1/", "https://api.openai.com/v1"},
		{"http://localhost:1234", "http://localhost:1234"},
		{"  http://node1.gonka.ai:8000  ", "http://node1.gonka.ai:8000"},
	}
	for _, tt := range tests {
		got := normalizeBaseURL(tt.in)
		if got != tt.want {
			t.Errorf("normalizeBaseURL(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}

func TestMakeUniqueIDPicksSuffix(t *testing.T) {
	existing := map[string]struct{}{"openai-primary": {}, "openai-primary-2": {}}
	got := makeUniqueID("openai-primary", existing)
	if got != "openai-primary-3" {
		t.Errorf("makeUniqueID = %q, want openai-primary-3", got)
	}
}

func TestMakeUniqueIDFreeBase(t *testing.T) {
	got := makeUniqueID("local-llm", map[string]struct{}{})
	if got != "local-llm" {
		t.Errorf("makeUniqueID = %q, want local-llm", got)
	}
}

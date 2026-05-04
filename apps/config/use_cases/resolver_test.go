package usecases

import (
	"reflect"
	"testing"

	"mantis/core/types"
)

func TestResolveDefaultsToOpenAI(t *testing.T) {
	r := NewResolver(EnvSnapshot{})
	cfg := r.Resolve(types.GlobalConfigDraft{})
	if cfg.Provider.Value != DefaultProvider {
		t.Fatalf("provider = %q, want %q", cfg.Provider.Value, DefaultProvider)
	}
	if cfg.Provider.Source != types.ConfigSourceDefault {
		t.Fatalf("source = %q, want default", cfg.Provider.Source)
	}
	if cfg.OpenAI.BaseURL.Source != types.ConfigSourceUnset {
		t.Fatalf("openai base source = %q, want unset", cfg.OpenAI.BaseURL.Source)
	}
}

func TestResolveDBOverridesEnv(t *testing.T) {
	r := NewResolver(EnvSnapshot{LLMBaseURL: "https://env", LLMAPIKey: "env-key"})
	cfg := r.Resolve(types.GlobalConfigDraft{
		Provider: "openai",
		OpenAI:   types.OpenAIDraft{BaseURL: "https://db", APIKey: "db-key"},
	})
	if cfg.OpenAI.BaseURL.Value != "https://db" || cfg.OpenAI.BaseURL.Source != types.ConfigSourceDB {
		t.Fatalf("base = %+v", cfg.OpenAI.BaseURL)
	}
	if !cfg.OpenAI.APIKey.Set || cfg.OpenAI.APIKey.Source != types.ConfigSourceDB {
		t.Fatalf("api key = %+v", cfg.OpenAI.APIKey)
	}
}

func TestResolveFallsBackToEnv(t *testing.T) {
	r := NewResolver(EnvSnapshot{LLMBaseURL: "https://env", LLMAPIKey: "env-key"})
	cfg := r.Resolve(types.GlobalConfigDraft{Provider: "openai"})
	if cfg.OpenAI.BaseURL.Value != "https://env" || cfg.OpenAI.BaseURL.Source != types.ConfigSourceEnv {
		t.Fatalf("base = %+v", cfg.OpenAI.BaseURL)
	}
	if !cfg.OpenAI.APIKey.Set || cfg.OpenAI.APIKey.Source != types.ConfigSourceEnv {
		t.Fatalf("api key = %+v", cfg.OpenAI.APIKey)
	}
}

func TestResolveModelsFromEnv(t *testing.T) {
	r := NewResolver(EnvSnapshot{LLMModels: []string{"chat-model", "small-model"}})
	cfg := r.Resolve(types.GlobalConfigDraft{Provider: "openai"})
	want := []types.ConfigModelRow{{Name: "chat-model", Role: "chat"}, {Name: "small-model", Role: "summary"}}
	if !reflect.DeepEqual(cfg.Models, want) {
		t.Fatalf("models = %+v, want %+v", cfg.Models, want)
	}
}

func TestResolveModelsDBPreferred(t *testing.T) {
	r := NewResolver(EnvSnapshot{LLMModels: []string{"env-model"}})
	cfg := r.Resolve(types.GlobalConfigDraft{
		Provider: "openai",
		Models:   []types.ConfigModelRow{{Name: "db-model", Role: "chat"}},
	})
	if len(cfg.Models) != 1 || cfg.Models[0].Name != "db-model" {
		t.Fatalf("models = %+v", cfg.Models)
	}
}

func TestResolveTelegramSkipped(t *testing.T) {
	r := NewResolver(EnvSnapshot{TGBotToken: "env-token"})
	cfg := r.Resolve(types.GlobalConfigDraft{
		Provider: "openai",
		Telegram: types.TelegramDraft{Skipped: true},
	})
	if !cfg.Telegram.Skipped || cfg.Telegram.Token.Set {
		t.Fatalf("telegram = %+v", cfg.Telegram)
	}
}

func TestResolveTelegramFromEnvWhenDBEmpty(t *testing.T) {
	r := NewResolver(EnvSnapshot{TGBotToken: "env-token", TGUserIDs: []int64{1, 2}})
	cfg := r.Resolve(types.GlobalConfigDraft{Provider: "openai"})
	if !cfg.Telegram.Token.Set || cfg.Telegram.Token.Source != types.ConfigSourceEnv {
		t.Fatalf("telegram = %+v", cfg.Telegram)
	}
	if !reflect.DeepEqual(cfg.Telegram.AllowedUserIDs, []int64{1, 2}) {
		t.Fatalf("user ids = %+v", cfg.Telegram.AllowedUserIDs)
	}
}

func TestResolveValuesMergesEnvIntoEmptyDraft(t *testing.T) {
	r := NewResolver(EnvSnapshot{
		LLMBaseURL: "https://env",
		LLMAPIKey:  "env-key",
		TGBotToken: "tok",
		TGUserIDs:  []int64{42},
	})
	resolved := r.ResolveValues(types.GlobalConfigDraft{})
	if resolved.Provider != DefaultProvider {
		t.Fatalf("provider = %q", resolved.Provider)
	}
	if resolved.OpenAI.APIKey != "env-key" {
		t.Fatalf("api key = %q", resolved.OpenAI.APIKey)
	}
	if resolved.Telegram.Token != "tok" || !reflect.DeepEqual(resolved.Telegram.AllowedUserIDs, []int64{42}) {
		t.Fatalf("telegram = %+v", resolved.Telegram)
	}
}

func TestResolveValuesKeepsDBOverEnv(t *testing.T) {
	r := NewResolver(EnvSnapshot{LLMAPIKey: "env-key"})
	resolved := r.ResolveValues(types.GlobalConfigDraft{
		Provider: "openai",
		OpenAI:   types.OpenAIDraft{APIKey: "db-key"},
	})
	if resolved.OpenAI.APIKey != "db-key" {
		t.Fatalf("api key = %q", resolved.OpenAI.APIKey)
	}
}

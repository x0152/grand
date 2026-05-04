package usecases

import (
	"strings"

	"mantis/core/types"
)

type EnvSnapshot struct {
	LLMBaseURL      string
	LLMAPIKey       string
	LLMModels       []string
	GonkaNodeURL    string
	GonkaPrivateKey string
	TGBotToken      string
	TGUserIDs       []int64
}

const DefaultProvider = "openai"

type Resolver struct {
	env EnvSnapshot
}

func NewResolver(env EnvSnapshot) *Resolver {
	return &Resolver{env: env}
}

func (r *Resolver) Env() EnvSnapshot {
	return r.env
}

func (r *Resolver) ResolveValues(draft types.GlobalConfigDraft) types.GlobalConfigDraft {
	out := draft
	if strings.TrimSpace(out.Provider) == "" {
		out.Provider = DefaultProvider
	}
	if strings.TrimSpace(out.OpenAI.BaseURL) == "" {
		out.OpenAI.BaseURL = strings.TrimSpace(r.env.LLMBaseURL)
	}
	if strings.TrimSpace(out.OpenAI.APIKey) == "" {
		out.OpenAI.APIKey = strings.TrimSpace(r.env.LLMAPIKey)
	}
	if strings.TrimSpace(out.Gonka.NodeURL) == "" {
		out.Gonka.NodeURL = strings.TrimSpace(r.env.GonkaNodeURL)
	}
	if strings.TrimSpace(out.Gonka.PrivateKey) == "" {
		out.Gonka.PrivateKey = strings.TrimSpace(r.env.GonkaPrivateKey)
	}
	if len(out.Models) == 0 {
		out.Models = modelRowsFromEnv(r.env.LLMModels)
	}
	if strings.TrimSpace(out.Telegram.Token) == "" && !out.Telegram.Skipped {
		out.Telegram.Token = strings.TrimSpace(r.env.TGBotToken)
		if len(out.Telegram.AllowedUserIDs) == 0 {
			out.Telegram.AllowedUserIDs = append([]int64(nil), r.env.TGUserIDs...)
		}
	}
	if out.Telegram.AllowedUserIDs == nil {
		out.Telegram.AllowedUserIDs = []int64{}
	}
	if out.Models == nil {
		out.Models = []types.ConfigModelRow{}
	}
	return out
}

func (r *Resolver) Resolve(draft types.GlobalConfigDraft) types.GlobalConfig {
	cfg := types.GlobalConfig{
		Provider: providerField(draft),
		OpenAI: types.OpenAIConfig{
			BaseURL: r.fieldFromDB(draft.OpenAI.BaseURL, r.env.LLMBaseURL),
			APIKey:  r.secretFromDB(draft.OpenAI.APIKey, r.env.LLMAPIKey),
		},
		Gonka: types.GonkaConfig{
			NodeURL:    r.fieldFromDB(draft.Gonka.NodeURL, r.env.GonkaNodeURL),
			PrivateKey: r.secretFromDB(draft.Gonka.PrivateKey, r.env.GonkaPrivateKey),
		},
		Models:   resolveModels(draft.Models, r.env.LLMModels),
		Telegram: r.resolveTelegram(draft.Telegram),
	}
	return cfg
}

func providerField(draft types.GlobalConfigDraft) types.ConfigField {
	if v := strings.TrimSpace(draft.Provider); v != "" {
		return types.ConfigField{Value: v, Source: types.ConfigSourceDB}
	}
	return types.ConfigField{Value: DefaultProvider, Source: types.ConfigSourceDefault}
}

func (r *Resolver) fieldFromDB(dbVal, envVal string) types.ConfigField {
	if v := strings.TrimSpace(dbVal); v != "" {
		return types.ConfigField{Value: v, Source: types.ConfigSourceDB}
	}
	if v := strings.TrimSpace(envVal); v != "" {
		return types.ConfigField{Value: v, Source: types.ConfigSourceEnv}
	}
	return types.ConfigField{Source: types.ConfigSourceUnset}
}

func (r *Resolver) secretFromDB(dbVal, envVal string) types.ConfigSecret {
	if v := strings.TrimSpace(dbVal); v != "" {
		return types.ConfigSecret{Set: true, Value: v, Source: types.ConfigSourceDB}
	}
	if v := strings.TrimSpace(envVal); v != "" {
		return types.ConfigSecret{Set: true, Value: v, Source: types.ConfigSourceEnv}
	}
	return types.ConfigSecret{Source: types.ConfigSourceUnset}
}

func resolveModels(draft []types.ConfigModelRow, envModels []string) []types.ConfigModelRow {
	if len(draft) > 0 {
		return draft
	}
	return modelRowsFromEnv(envModels)
}

func modelRowsFromEnv(names []string) []types.ConfigModelRow {
	rows := make([]types.ConfigModelRow, 0, len(names))
	for i, name := range names {
		clean := strings.TrimSpace(name)
		if clean == "" {
			continue
		}
		role := ""
		if i == 0 {
			role = "chat"
		} else if i == len(names)-1 && len(names) > 1 {
			role = "summary"
		}
		rows = append(rows, types.ConfigModelRow{Name: clean, Role: role})
	}
	return rows
}

func (r *Resolver) resolveTelegram(draft types.TelegramDraft) types.TelegramConfig {
	if draft.Skipped {
		return types.TelegramConfig{
			AllowedUserIDs: nilSafeIDs(draft.AllowedUserIDs),
			Skipped:        true,
			Source:         types.ConfigSourceDB,
		}
	}
	if strings.TrimSpace(draft.Token) != "" {
		t := strings.TrimSpace(draft.Token)
		return types.TelegramConfig{
			Token:          types.ConfigSecret{Set: true, Value: t, Source: types.ConfigSourceDB},
			AllowedUserIDs: nilSafeIDs(draft.AllowedUserIDs),
			Source:         types.ConfigSourceDB,
		}
	}
	if t := strings.TrimSpace(r.env.TGBotToken); t != "" {
		return types.TelegramConfig{
			Token:          types.ConfigSecret{Set: true, Value: t, Source: types.ConfigSourceEnv},
			AllowedUserIDs: nilSafeIDs(r.env.TGUserIDs),
			Source:         types.ConfigSourceEnv,
		}
	}
	return types.TelegramConfig{
		AllowedUserIDs: []int64{},
		Source:         types.ConfigSourceUnset,
	}
}

func nilSafeIDs(in []int64) []int64 {
	if len(in) == 0 {
		return []int64{}
	}
	out := make([]int64, len(in))
	copy(out, in)
	return out
}

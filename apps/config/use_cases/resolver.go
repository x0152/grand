package usecases

import (
	"strings"

	"mantis/core/types"
)

type EnvSnapshot struct {
	LLMBaseURL       string
	LLMAPIKey        string
	LLMModels        []string
	GonkaNodeURL     string
	GonkaPrivateKey  string
	TGBotToken       string
	TGUserIDs        []int64
	EmailAddress     string
	EmailSMTPHost    string
	EmailSMTPPort    string
	EmailSMTPUser    string
	EmailSMTPPass    string
	EmailIMAPHost    string
	EmailIMAPPort    string
	EmailIMAPUser    string
	EmailIMAPPass    string
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
	if shouldPromoteEmailEnv(out.Email, r.env) {
		out.Email.Skipped = false
	}
	if !out.Email.Skipped {
		out.Email = mergeEmailFromEnv(out.Email, r.env)
	}
	if out.Models == nil {
		out.Models = []types.ConfigModelRow{}
	}
	return out
}

func mergeEmailFromEnv(e types.EmailDraft, env EnvSnapshot) types.EmailDraft {
	if strings.TrimSpace(e.Address) == "" {
		e.Address = strings.TrimSpace(env.EmailAddress)
	}
	if strings.TrimSpace(e.SMTPHost) == "" {
		e.SMTPHost = strings.TrimSpace(env.EmailSMTPHost)
	}
	if strings.TrimSpace(e.SMTPPort) == "" {
		e.SMTPPort = strings.TrimSpace(env.EmailSMTPPort)
	}
	if strings.TrimSpace(e.SMTPUsername) == "" {
		e.SMTPUsername = strings.TrimSpace(env.EmailSMTPUser)
	}
	if strings.TrimSpace(e.SMTPPassword) == "" {
		e.SMTPPassword = strings.TrimSpace(env.EmailSMTPPass)
	}
	if strings.TrimSpace(e.IMAPHost) == "" {
		e.IMAPHost = strings.TrimSpace(env.EmailIMAPHost)
	}
	if strings.TrimSpace(e.IMAPPort) == "" {
		e.IMAPPort = strings.TrimSpace(env.EmailIMAPPort)
	}
	if strings.TrimSpace(e.IMAPUsername) == "" {
		e.IMAPUsername = strings.TrimSpace(env.EmailIMAPUser)
	}
	if strings.TrimSpace(e.IMAPPassword) == "" {
		e.IMAPPassword = strings.TrimSpace(env.EmailIMAPPass)
	}
	return e
}

func shouldPromoteEmailEnv(draft types.EmailDraft, env EnvSnapshot) bool {
	return draft.Skipped && !emailDraftHasAnyValue(draft) && emailEnvHasAnyValue(env)
}

func emailDraftHasAnyValue(e types.EmailDraft) bool {
	return strings.TrimSpace(e.Address) != "" ||
		strings.TrimSpace(e.SMTPHost) != "" ||
		strings.TrimSpace(e.SMTPPort) != "" ||
		strings.TrimSpace(e.SMTPUsername) != "" ||
		strings.TrimSpace(e.SMTPPassword) != "" ||
		strings.TrimSpace(e.IMAPHost) != "" ||
		strings.TrimSpace(e.IMAPPort) != "" ||
		strings.TrimSpace(e.IMAPUsername) != "" ||
		strings.TrimSpace(e.IMAPPassword) != ""
}

func emailEnvHasAnyValue(env EnvSnapshot) bool {
	return strings.TrimSpace(env.EmailAddress) != "" ||
		strings.TrimSpace(env.EmailSMTPHost) != "" ||
		strings.TrimSpace(env.EmailSMTPPort) != "" ||
		strings.TrimSpace(env.EmailSMTPUser) != "" ||
		strings.TrimSpace(env.EmailSMTPPass) != "" ||
		strings.TrimSpace(env.EmailIMAPHost) != "" ||
		strings.TrimSpace(env.EmailIMAPPort) != "" ||
		strings.TrimSpace(env.EmailIMAPUser) != "" ||
		strings.TrimSpace(env.EmailIMAPPass) != ""
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
		Email:    r.resolveEmail(draft.Email),
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

func (r *Resolver) resolveEmail(draft types.EmailDraft) types.EmailConfig {
	if shouldPromoteEmailEnv(draft, r.env) {
		draft.Skipped = false
	}
	if draft.Skipped {
		return types.EmailConfig{
			Skipped: true,
			Source:  types.ConfigSourceDB,
		}
	}
	cfg := types.EmailConfig{
		Address:      r.fieldFromDB(draft.Address, r.env.EmailAddress),
		SMTPHost:     r.fieldFromDB(draft.SMTPHost, r.env.EmailSMTPHost),
		SMTPPort:     r.fieldFromDB(draft.SMTPPort, r.env.EmailSMTPPort),
		SMTPUsername: r.fieldFromDB(draft.SMTPUsername, r.env.EmailSMTPUser),
		SMTPPassword: r.secretFromDB(draft.SMTPPassword, r.env.EmailSMTPPass),
		IMAPHost:     r.fieldFromDB(draft.IMAPHost, r.env.EmailIMAPHost),
		IMAPPort:     r.fieldFromDB(draft.IMAPPort, r.env.EmailIMAPPort),
		IMAPUsername: r.fieldFromDB(draft.IMAPUsername, r.env.EmailIMAPUser),
		IMAPPassword: r.secretFromDB(draft.IMAPPassword, r.env.EmailIMAPPass),
	}
	cfg.Source = pickEmailSource(cfg)
	return cfg
}

func pickEmailSource(cfg types.EmailConfig) types.ConfigSource {
	sources := []types.ConfigSource{
		cfg.Address.Source, cfg.SMTPHost.Source, cfg.SMTPPort.Source,
		cfg.SMTPUsername.Source, cfg.SMTPPassword.Source,
		cfg.IMAPHost.Source, cfg.IMAPPort.Source,
		cfg.IMAPUsername.Source, cfg.IMAPPassword.Source,
	}
	hasDB, hasEnv := false, false
	for _, s := range sources {
		switch s {
		case types.ConfigSourceDB:
			hasDB = true
		case types.ConfigSourceEnv:
			hasEnv = true
		}
	}
	switch {
	case hasDB:
		return types.ConfigSourceDB
	case hasEnv:
		return types.ConfigSourceEnv
	default:
		return types.ConfigSourceUnset
	}
}

package usecases

import (
	"context"
	"strings"

	"mantis/core/base"
	"mantis/core/protocols"
	"mantis/core/types"
)

type UpdateConfig struct {
	store    protocols.Store[string, types.AppConfig]
	resolver *Resolver
}

func NewUpdateConfig(store protocols.Store[string, types.AppConfig], resolver *Resolver) *UpdateConfig {
	return &UpdateConfig{store: store, resolver: resolver}
}

func (uc *UpdateConfig) Execute(ctx context.Context, in types.GlobalConfigDraft) (types.GlobalConfig, error) {
	if err := validateDraft(in); err != nil {
		return types.GlobalConfig{}, err
	}
	existing, err := loadDraft(ctx, uc.store)
	if err != nil {
		return types.GlobalConfig{}, err
	}
	merged := mergeDrafts(existing, in)
	if err := saveDraft(ctx, uc.store, merged); err != nil {
		return types.GlobalConfig{}, err
	}
	return uc.resolver.Resolve(merged), nil
}

func validateDraft(in types.GlobalConfigDraft) error {
	provider := strings.TrimSpace(in.Provider)
	if provider == "" {
		return nil
	}
	if provider != "openai" && provider != "gonka" {
		return base.ErrValidation
	}
	return nil
}

func mergeDrafts(existing, in types.GlobalConfigDraft) types.GlobalConfigDraft {
	out := in
	if out.Models == nil {
		out.Models = []types.ConfigModelRow{}
	}
	if out.Telegram.AllowedUserIDs == nil {
		out.Telegram.AllowedUserIDs = []int64{}
	}
	if strings.TrimSpace(out.OpenAI.APIKey) == "" {
		out.OpenAI.APIKey = existing.OpenAI.APIKey
	}
	if strings.TrimSpace(out.Gonka.PrivateKey) == "" {
		out.Gonka.PrivateKey = existing.Gonka.PrivateKey
	}
	if strings.TrimSpace(out.Telegram.Token) == "" && !out.Telegram.Skipped {
		out.Telegram.Token = existing.Telegram.Token
	}
	if !out.Email.Skipped {
		if strings.TrimSpace(out.Email.SMTPPassword) == "" {
			out.Email.SMTPPassword = existing.Email.SMTPPassword
		}
		if strings.TrimSpace(out.Email.IMAPPassword) == "" {
			out.Email.IMAPPassword = existing.Email.IMAPPassword
		}
	}
	return out
}

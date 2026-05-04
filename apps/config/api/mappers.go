package api

import "mantis/core/types"

func toConfigOutput(c types.GlobalConfig) *ConfigOutput {
	return &ConfigOutput{Body: c}
}

func draftFromUpdateInput(input *UpdateConfigInput) types.GlobalConfigDraft {
	models := input.Body.Models
	if models == nil {
		models = []types.ConfigModelRow{}
	}
	tg := input.Body.Telegram
	if tg.AllowedUserIDs == nil {
		tg.AllowedUserIDs = []int64{}
	}
	return types.GlobalConfigDraft{
		Provider: input.Body.Provider,
		OpenAI:   input.Body.OpenAI,
		Gonka:    input.Body.Gonka,
		Models:   models,
		Telegram: tg,
	}
}

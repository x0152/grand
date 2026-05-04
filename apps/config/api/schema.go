package api

import (
	"mantis/core/types"
)

type ConfigOutput struct {
	Body types.GlobalConfig
}

type UpdateConfigInput struct {
	Body struct {
		Provider string                 `json:"provider"`
		OpenAI   types.OpenAIDraft      `json:"openai"`
		Gonka    types.GonkaDraft       `json:"gonka"`
		Models   []types.ConfigModelRow `json:"models"`
		Telegram types.TelegramDraft    `json:"telegram"`
	}
}

type ApplyOutput struct {
	Body struct {
		OK bool `json:"ok"`
	}
}

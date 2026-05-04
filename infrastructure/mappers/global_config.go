package mappers

import (
	"encoding/json"

	"mantis/core/types"
	"mantis/infrastructure/models"
)

func AppConfigToRow(c types.AppConfig) models.GlobalConfigRow {
	data, err := json.Marshal(c.Draft)
	if err != nil {
		data = json.RawMessage(`{}`)
	}
	return models.GlobalConfigRow{ID: c.ID, Data: data}
}

func AppConfigFromRow(r models.GlobalConfigRow) types.AppConfig {
	draft := types.GlobalConfigDraft{}
	if len(r.Data) > 0 {
		_ = json.Unmarshal(r.Data, &draft)
	}
	if draft.Models == nil {
		draft.Models = []types.ConfigModelRow{}
	}
	if draft.Telegram.AllowedUserIDs == nil {
		draft.Telegram.AllowedUserIDs = []int64{}
	}
	return types.AppConfig{ID: r.ID, Draft: draft}
}

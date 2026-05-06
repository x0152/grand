package mappers

import (
	"mantis/core/types"
	"mantis/infrastructure/models"
)

func GuardEventToRow(e types.GuardEvent) models.GuardEventRow {
	ids := e.ProfileIDs
	if ids == nil {
		ids = []string{}
	}
	return models.GuardEventRow{
		ID:           e.ID,
		Kind:         string(e.Kind),
		Target:       e.Target,
		Allowed:      e.Allowed,
		Rule:         e.Rule,
		Message:      e.Message,
		ProfileIDs:   ids,
		ConnectionID: e.ConnectionID,
		UserID:       e.UserID,
		CreatedAt:    e.CreatedAt,
	}
}

func GuardEventFromRow(r models.GuardEventRow) types.GuardEvent {
	ids := r.ProfileIDs
	if ids == nil {
		ids = []string{}
	}
	return types.GuardEvent{
		ID:           r.ID,
		Kind:         types.GuardEventKind(r.Kind),
		Target:       r.Target,
		Allowed:      r.Allowed,
		Rule:         r.Rule,
		Message:      r.Message,
		ProfileIDs:   ids,
		ConnectionID: r.ConnectionID,
		UserID:       r.UserID,
		CreatedAt:    r.CreatedAt,
	}
}

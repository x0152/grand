package usecases

import (
	"context"

	"mantis/core/protocols"
	"mantis/core/types"
)

type ListGuardEventsFilter struct {
	Kind         types.GuardEventKind
	Allowed      *bool
	ProfileID    string
	ConnectionID string
	Limit        int
}

type ListGuardEvents struct {
	store protocols.Store[string, types.GuardEvent]
}

func NewListGuardEvents(store protocols.Store[string, types.GuardEvent]) *ListGuardEvents {
	return &ListGuardEvents{store: store}
}

func (uc *ListGuardEvents) Execute(ctx context.Context, filter ListGuardEventsFilter) ([]types.GuardEvent, error) {
	limit := filter.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	q := types.ListQuery{
		Page: types.Page{Limit: limit * 4},
		Sort: []types.Sort{{Field: "created_at", Dir: types.SortDirDesc}},
	}
	q.Filter = map[string]string{}
	if filter.Kind != "" {
		q.Filter["kind"] = string(filter.Kind)
	}
	if filter.ConnectionID != "" {
		q.Filter["connection_id"] = filter.ConnectionID
	}
	if filter.Allowed != nil {
		if *filter.Allowed {
			q.Filter["allowed"] = "true"
		} else {
			q.Filter["allowed"] = "false"
		}
	}
	if len(q.Filter) == 0 {
		q.Filter = nil
	}

	rows, err := uc.store.List(ctx, q)
	if err != nil {
		return nil, err
	}

	out := make([]types.GuardEvent, 0, len(rows))
	for _, ev := range rows {
		if filter.ProfileID != "" {
			matched := false
			for _, pid := range ev.ProfileIDs {
				if pid == filter.ProfileID {
					matched = true
					break
				}
			}
			if !matched {
				continue
			}
		}
		out = append(out, ev)
		if len(out) >= limit {
			break
		}
	}
	return out, nil
}

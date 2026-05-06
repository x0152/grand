package usecases

import (
	"context"

	"mantis/core/base"
	"mantis/core/protocols"
	"mantis/core/types"
)

type SyncGuardProfileAttachments struct {
	profileStore    protocols.Store[string, types.GuardProfile]
	connectionStore protocols.Store[string, types.Connection]
}

func NewSyncGuardProfileAttachments(
	profileStore protocols.Store[string, types.GuardProfile],
	connectionStore protocols.Store[string, types.Connection],
) *SyncGuardProfileAttachments {
	return &SyncGuardProfileAttachments{profileStore: profileStore, connectionStore: connectionStore}
}

func (uc *SyncGuardProfileAttachments) Execute(ctx context.Context, profileID string, connectionIDs []string) ([]types.Connection, error) {
	profiles, err := uc.profileStore.Get(ctx, []string{profileID})
	if err != nil {
		return nil, err
	}
	if _, ok := profiles[profileID]; !ok {
		return nil, base.ErrNotFound
	}

	desired := make(map[string]struct{}, len(connectionIDs))
	for _, id := range connectionIDs {
		desired[id] = struct{}{}
	}

	all, err := uc.connectionStore.List(ctx, types.ListQuery{})
	if err != nil {
		return nil, err
	}

	var toUpdate []types.Connection
	for _, c := range all {
		hasProfile := false
		for _, pid := range c.ProfileIDs {
			if pid == profileID {
				hasProfile = true
				break
			}
		}
		_, shouldHave := desired[c.ID]
		if hasProfile == shouldHave {
			continue
		}
		next := make([]string, 0, len(c.ProfileIDs)+1)
		for _, pid := range c.ProfileIDs {
			if pid != profileID {
				next = append(next, pid)
			}
		}
		if shouldHave {
			next = append(next, profileID)
		}
		c.ProfileIDs = next
		toUpdate = append(toUpdate, c)
	}

	if len(toUpdate) == 0 {
		return all, nil
	}

	if _, err := uc.connectionStore.Update(ctx, toUpdate); err != nil {
		return nil, err
	}

	updated, err := uc.connectionStore.List(ctx, types.ListQuery{})
	if err != nil {
		return nil, err
	}
	if updated == nil {
		updated = []types.Connection{}
	}
	return updated, nil
}

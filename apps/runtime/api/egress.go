package api

import (
	"context"
	"net/http"
	"strings"

	"mantis/core/types"
)

func (e *Endpoints) egressState(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	conns, err := e.connectionStore.List(ctx, types.ListQuery{Page: types.Page{Limit: 1000}})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	containers, err := e.rt.List(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	byName := make(map[string]types.RuntimeContainer, len(containers))
	for _, c := range containers {
		byName[c.Name] = c
	}

	profiles := e.collectProfiles(ctx, conns)

	state := types.EgressState{Sandboxes: make([]types.EgressSandboxState, 0, len(conns))}
	for _, conn := range conns {
		if conn.Dockerfile == "" {
			continue
		}
		sandboxName := strings.TrimPrefix(conn.Name, registeredConnectionPrefix)
		container, ok := byName[sandboxName]
		if !ok || container.IP == "" {
			continue
		}
		policy := mergePolicies(conn.ProfileIDs, profiles)
		state.Sandboxes = append(state.Sandboxes, types.EgressSandboxState{
			Name:   sandboxName,
			IP:     container.IP,
			Policy: policy.Normalize(),
		})
	}

	writeJSON(w, http.StatusOK, state)
}

func (e *Endpoints) collectProfiles(ctx context.Context, conns []types.Connection) map[string]types.GuardProfile {
	ids := uniqueProfileIDs(conns)
	if len(ids) == 0 {
		return map[string]types.GuardProfile{}
	}
	profiles, err := e.guardProfileStore.Get(ctx, ids)
	if err != nil {
		return map[string]types.GuardProfile{}
	}
	return profiles
}

func uniqueProfileIDs(conns []types.Connection) []string {
	seen := make(map[string]struct{})
	for _, c := range conns {
		for _, id := range c.ProfileIDs {
			if id == "" {
				continue
			}
			seen[id] = struct{}{}
		}
	}
	out := make([]string, 0, len(seen))
	for id := range seen {
		out = append(out, id)
	}
	return out
}

func mergePolicies(profileIDs []string, profiles map[string]types.GuardProfile) types.EgressPolicy {
	if len(profileIDs) == 0 {
		return types.EgressPolicy{Mode: types.EgressOpen}
	}
	hosts := map[string]struct{}{}
	cidrs := map[string]struct{}{}
	mode := types.EgressMode("")
	hasPolicy := false

	for _, id := range profileIDs {
		p, ok := profiles[id]
		if !ok {
			continue
		}
		policy := p.Egress.Normalize()
		hasPolicy = true
		mode = combineMode(mode, policy.Mode)
		for _, h := range policy.Hosts {
			hosts[h] = struct{}{}
		}
		for _, c := range policy.CIDRs {
			cidrs[c] = struct{}{}
		}
	}

	if !hasPolicy {
		return types.EgressPolicy{Mode: types.EgressOpen}
	}

	out := types.EgressPolicy{
		Mode:  mode,
		Hosts: mapKeys(hosts),
		CIDRs: mapKeys(cidrs),
	}
	return out.Normalize()
}

func combineMode(current, next types.EgressMode) types.EgressMode {
	if current == "" {
		return next
	}
	if current == next {
		return current
	}
	if current == types.EgressClosed || next == types.EgressClosed {
		return types.EgressClosed
	}
	if current == types.EgressWhitelist || next == types.EgressWhitelist {
		return types.EgressWhitelist
	}
	if current == types.EgressBlacklist || next == types.EgressBlacklist {
		return types.EgressBlacklist
	}
	return types.EgressOpen
}

func mapKeys(m map[string]struct{}) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

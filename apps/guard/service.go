package guardapp

import (
	"context"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"

	"mantis/core/auth"
	"mantis/core/plugins/guard"
	"mantis/core/protocols"
	"mantis/core/types"
)

type Service struct {
	profiles protocols.Store[string, types.GuardProfile]
	events   protocols.Store[string, types.GuardEvent]
	now      func() time.Time
}

func NewService(profiles protocols.Store[string, types.GuardProfile], events protocols.Store[string, types.GuardEvent]) *Service {
	return &Service{profiles: profiles, events: events, now: time.Now}
}

type CommandResult struct {
	Allowed bool
	Rule    string
	Message string
}

type HostResult struct {
	Allowed bool
	Reason  string
}

func (s *Service) EvaluateCommand(ctx context.Context, profileIDs []string, connectionID, command string) CommandResult {
	command = strings.TrimSpace(command)
	if command == "" {
		return CommandResult{Allowed: true}
	}
	profiles := s.loadProfiles(ctx, profileIDs)
	res := evaluateCommandPure(profiles, command)
	s.recordEvent(ctx, types.GuardEvent{
		Kind:         types.GuardEventCommand,
		Target:       command,
		Allowed:      res.Allowed,
		Rule:         res.Rule,
		Message:      res.Message,
		ProfileIDs:   profileIDs,
		ConnectionID: connectionID,
		UserID:       userIDFromCtx(ctx),
	})
	return res
}

func (s *Service) EvaluateHost(ctx context.Context, profileIDs []string, connectionID, target string) HostResult {
	target = strings.TrimSpace(target)
	if target == "" {
		return HostResult{Allowed: true, Reason: "empty"}
	}
	profiles := s.loadProfiles(ctx, profileIDs)
	res := evaluateHostPure(profiles, target)
	s.recordEvent(ctx, types.GuardEvent{
		Kind:         types.GuardEventHost,
		Target:       target,
		Allowed:      res.Allowed,
		Rule:         res.Reason,
		ProfileIDs:   profileIDs,
		ConnectionID: connectionID,
		UserID:       userIDFromCtx(ctx),
	})
	return res
}

func (s *Service) RecordHostEvent(ctx context.Context, ev types.GuardEvent) error {
	ev.Kind = types.GuardEventHost
	if ev.UserID == "" {
		// Egress events come from the gateway with no auth identity. Attribute
		// them to the user that most recently ran a command on the same
		// connection so per-user views surface the corresponding blocks.
		ev.UserID = s.lastUserForConnection(ctx, ev.ConnectionID)
	}
	s.recordEvent(ctx, ev)
	return nil
}

func (s *Service) Describe(ctx context.Context, profileIDs []string) string {
	return guard.DescribeProfiles(s.loadProfiles(ctx, profileIDs))
}

func (s *Service) loadProfiles(ctx context.Context, ids []string) []types.GuardProfile {
	if len(ids) == 0 {
		return nil
	}
	m, err := s.profiles.Get(ctx, ids)
	if err != nil {
		return nil
	}
	out := make([]types.GuardProfile, 0, len(m))
	for _, p := range m {
		out = append(out, p)
	}
	return out
}

func (s *Service) lastUserForConnection(ctx context.Context, connectionID string) string {
	if s.events == nil || connectionID == "" {
		return ""
	}
	rows, err := s.events.List(ctx, types.ListQuery{
		Page:   types.Page{Limit: 20},
		Filter: map[string]string{"connection_id": connectionID, "kind": string(types.GuardEventCommand)},
		Sort:   []types.Sort{{Field: "created_at", Dir: types.SortDirDesc}},
	})
	if err != nil {
		return ""
	}
	for _, ev := range rows {
		if ev.UserID != "" {
			return ev.UserID
		}
	}
	return ""
}

// RecentBlockedHosts returns deduplicated host blocks recorded for a given
// connection since `since`. Aggregated by (host, reason): we keep the count and
// the first/last timestamp so the agent can render a compact footer.
func (s *Service) RecentBlockedHosts(ctx context.Context, connectionID string, since time.Time, limit int) []protocols.HostBlock {
	if s.events == nil || connectionID == "" {
		return nil
	}
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.events.List(ctx, types.ListQuery{
		Page: types.Page{Limit: limit * 4},
		Filter: map[string]string{
			"connection_id": connectionID,
			"kind":          string(types.GuardEventHost),
			"allowed":       "false",
		},
		Sort: []types.Sort{{Field: "created_at", Dir: types.SortDirDesc}},
	})
	if err != nil {
		return nil
	}
	type key struct{ host, reason string }
	agg := make(map[key]*protocols.HostBlock)
	seenProfile := make(map[key]map[string]bool)
	order := make([]key, 0)
	for _, ev := range rows {
		if !since.IsZero() && ev.CreatedAt.Before(since) {
			continue
		}
		host := strings.TrimSuffix(strings.TrimSpace(ev.Target), ".")
		if host == "" {
			continue
		}
		k := key{host: host, reason: strings.TrimSpace(ev.Rule)}
		hb, ok := agg[k]
		if !ok {
			hb = &protocols.HostBlock{Host: host, Reason: k.reason, FirstAt: ev.CreatedAt, LastAt: ev.CreatedAt}
			agg[k] = hb
			seenProfile[k] = map[string]bool{}
			order = append(order, k)
		}
		hb.Count++
		if ev.CreatedAt.After(hb.LastAt) {
			hb.LastAt = ev.CreatedAt
		}
		if ev.CreatedAt.Before(hb.FirstAt) {
			hb.FirstAt = ev.CreatedAt
		}
		for _, pid := range ev.ProfileIDs {
			pid = strings.TrimSpace(pid)
			if pid == "" || seenProfile[k][pid] {
				continue
			}
			seenProfile[k][pid] = true
			hb.ProfileIDs = append(hb.ProfileIDs, pid)
		}
	}
	out := make([]protocols.HostBlock, 0, len(order))
	for _, k := range order {
		out = append(out, *agg[k])
	}
	sort.Slice(out, func(i, j int) bool { return out[i].LastAt.After(out[j].LastAt) })
	if len(out) > limit {
		out = out[:limit]
	}
	return out
}

func userIDFromCtx(ctx context.Context) string {
	if id, ok := auth.FromContext(ctx); ok {
		return id.UserID
	}
	return ""
}

func (s *Service) recordEvent(ctx context.Context, ev types.GuardEvent) {
	if s.events == nil {
		return
	}
	if ev.ID == "" {
		ev.ID = uuid.New().String()
	}
	if ev.CreatedAt.IsZero() {
		ev.CreatedAt = s.now()
	}
	if ev.ProfileIDs == nil {
		ev.ProfileIDs = []string{}
	}
	_, _ = s.events.Create(ctx, []types.GuardEvent{ev})
}

func evaluateCommandPure(profiles []types.GuardProfile, command string) CommandResult {
	v := guard.Evaluate(profiles, command)
	if v == nil {
		return CommandResult{Allowed: true}
	}
	return CommandResult{Allowed: false, Rule: v.Rule, Message: v.Message}
}

func evaluateHostPure(profiles []types.GuardProfile, target string) HostResult {
	if len(profiles) == 0 {
		return HostResult{Allowed: true, Reason: "no-profiles"}
	}
	for _, p := range profiles {
		if p.Capabilities.Unrestricted {
			return HostResult{Allowed: true, Reason: "unrestricted"}
		}
	}
	policies := make([]types.EgressPolicy, 0, len(profiles))
	for _, p := range profiles {
		policies = append(policies, p.Egress)
	}
	merged := types.MergeEgressPolicies(policies)
	allow, reason := merged.Evaluate(target)
	return HostResult{Allowed: allow, Reason: reason}
}

package guardapp

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

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
	})
	return res
}

func (s *Service) RecordHostEvent(ctx context.Context, ev types.GuardEvent) error {
	ev.Kind = types.GuardEventHost
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

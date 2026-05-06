package usecases

import (
	"mantis/core/plugins/guard"
	"mantis/core/types"
)

type CommandTestResult struct {
	Command string `json:"command"`
	Allowed bool   `json:"allowed"`
	Rule    string `json:"rule,omitempty"`
	Message string `json:"message,omitempty"`
}

type HostTestResult struct {
	Target  string `json:"target"`
	Allowed bool   `json:"allowed"`
	Reason  string `json:"reason"`
}

type TestGuardProfile struct{}

func NewTestGuardProfile() *TestGuardProfile { return &TestGuardProfile{} }

func (uc *TestGuardProfile) Command(profile types.GuardProfile, command string) CommandTestResult {
	v := guard.Evaluate([]types.GuardProfile{profile}, command)
	if v == nil {
		return CommandTestResult{Command: command, Allowed: true}
	}
	return CommandTestResult{Command: command, Allowed: false, Rule: v.Rule, Message: v.Message}
}

func (uc *TestGuardProfile) Host(profile types.GuardProfile, target string) HostTestResult {
	if profile.Capabilities.Unrestricted {
		return HostTestResult{Target: target, Allowed: true, Reason: "unrestricted"}
	}
	allow, reason := profile.Egress.Normalize().Evaluate(target)
	return HostTestResult{Target: target, Allowed: allow, Reason: reason}
}

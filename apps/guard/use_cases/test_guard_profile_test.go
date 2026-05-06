package usecases

import (
	"testing"

	"mantis/core/types"
)

func TestSingleShotCommandTester(t *testing.T) {
	uc := NewTestGuardProfile()
	profile := types.GuardProfile{
		Name: "RO",
		Capabilities: types.GuardCapabilities{
			Pipes: true,
		},
		CommandsMode: types.CommandsWhitelist,
		Commands: []types.CommandRule{
			{Command: "ls"},
			{Command: "cat"},
			{Command: "psql", AllowedSQL: []string{"SELECT", "SHOW"}},
		},
		Egress: types.EgressPolicy{
			Mode:  types.EgressWhitelist,
			Hosts: []string{"api.openai.com", "*.github.com"},
		},
	}

	if r := uc.Command(profile, "ls -la /tmp"); !r.Allowed {
		t.Errorf("expected ls allowed, got %s: %s", r.Rule, r.Message)
	}
	if r := uc.Command(profile, "rm -rf /"); r.Allowed {
		t.Errorf("expected rm blocked")
	}
	if r := uc.Command(profile, `psql -c "SELECT 1"`); !r.Allowed {
		t.Errorf("expected SELECT allowed, got %s: %s", r.Rule, r.Message)
	}
	if r := uc.Command(profile, `psql -c "DROP TABLE x"`); r.Allowed {
		t.Errorf("expected DROP blocked")
	}

	if r := uc.Host(profile, "api.openai.com"); !r.Allowed {
		t.Errorf("expected api.openai.com allowed, got %s", r.Reason)
	}
	if r := uc.Host(profile, "raw.github.com"); !r.Allowed {
		t.Errorf("expected raw.github.com allowed via *.github.com, got %s", r.Reason)
	}
	if r := uc.Host(profile, "evil.com"); r.Allowed {
		t.Errorf("expected evil.com blocked, got %s", r.Reason)
	}
}

func TestBlacklistMode(t *testing.T) {
	uc := NewTestGuardProfile()
	profile := types.GuardProfile{
		CommandsMode: types.CommandsBlacklist,
		Commands: []types.CommandRule{
			{Command: "rm"},
			{Command: "dd"},
		},
	}
	if r := uc.Command(profile, "ls -la /tmp"); !r.Allowed {
		t.Errorf("non-blacklisted ls must be allowed")
	}
	if r := uc.Command(profile, "rm -rf /"); r.Allowed {
		t.Errorf("blacklisted rm must be blocked, got allowed")
	}
}

func TestOpenAndClosed(t *testing.T) {
	uc := NewTestGuardProfile()
	open := types.GuardProfile{CommandsMode: types.CommandsOpen}
	if r := uc.Command(open, "rm -rf /"); !r.Allowed {
		t.Errorf("open mode must allow anything, got blocked: %s", r.Message)
	}
	closed := types.GuardProfile{CommandsMode: types.CommandsClosed}
	if r := uc.Command(closed, "ls"); r.Allowed {
		t.Errorf("closed mode must block everything")
	}
}

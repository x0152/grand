package types

import "testing"

func TestEgressPolicyIsOpen(t *testing.T) {
	cases := []struct {
		mode EgressMode
		want bool
	}{
		{"", true},
		{EgressOpen, true},
		{EgressClosed, false},
		{EgressWhitelist, false},
		{EgressBlacklist, false},
	}
	for _, c := range cases {
		got := EgressPolicy{Mode: c.mode}.IsOpen()
		if got != c.want {
			t.Errorf("IsOpen(%q): got %v, want %v", c.mode, got, c.want)
		}
	}
}

func TestEgressPolicyNormalizeUnknownModeBecomesOpen(t *testing.T) {
	out := EgressPolicy{Mode: "weird"}.Normalize()
	if out.Mode != EgressOpen {
		t.Errorf("got %q, want open", out.Mode)
	}
	if out.Hosts == nil {
		t.Error("Hosts must be empty slice, not nil")
	}
	if out.CIDRs == nil {
		t.Error("CIDRs must be empty slice, not nil")
	}
}

func TestEgressPolicyNormalizePreservesValidMode(t *testing.T) {
	for _, m := range []EgressMode{EgressOpen, EgressClosed, EgressWhitelist, EgressBlacklist} {
		out := EgressPolicy{Mode: m}.Normalize()
		if out.Mode != m {
			t.Errorf("Normalize(%q) -> %q", m, out.Mode)
		}
	}
}

func TestEgressPolicyNormalizeKeepsLists(t *testing.T) {
	in := EgressPolicy{
		Mode:  EgressWhitelist,
		Hosts: []string{"a", "b"},
		CIDRs: []string{"10.0.0.0/8"},
	}
	out := in.Normalize()
	if len(out.Hosts) != 2 || out.Hosts[0] != "a" || out.Hosts[1] != "b" {
		t.Errorf("hosts %v", out.Hosts)
	}
	if len(out.CIDRs) != 1 || out.CIDRs[0] != "10.0.0.0/8" {
		t.Errorf("cidrs %v", out.CIDRs)
	}
}

func TestEgressPolicyEvaluate(t *testing.T) {
	whitelist := EgressPolicy{
		Mode:  EgressWhitelist,
		Hosts: []string{"api.openai.com", "*.github.com"},
		CIDRs: []string{"10.0.0.0/8", "1.2.3.4"},
	}
	cases := []struct {
		policy EgressPolicy
		target string
		allow  bool
	}{
		{EgressPolicy{Mode: EgressOpen}, "anywhere.com", true},
		{EgressPolicy{Mode: EgressClosed}, "anywhere.com", false},
		{whitelist, "api.openai.com", true},
		{whitelist, "raw.github.com", true},
		{whitelist, "evil.com", false},
		{whitelist, "10.5.0.1", true},
		{whitelist, "1.2.3.4", true},
		{whitelist, "8.8.8.8", false},
		{
			EgressPolicy{Mode: EgressBlacklist, Hosts: []string{"evil.com"}},
			"evil.com",
			false,
		},
		{
			EgressPolicy{Mode: EgressBlacklist, Hosts: []string{"evil.com"}},
			"good.com",
			true,
		},
	}
	for _, c := range cases {
		got, _ := c.policy.Evaluate(c.target)
		if got != c.allow {
			t.Errorf("Evaluate(%q) on %v: got %v want %v", c.target, c.policy, got, c.allow)
		}
	}
}

package api

import (
	"sort"
	"testing"

	"mantis/core/types"
)

func TestCombineModePriority(t *testing.T) {
	cases := []struct {
		a, b types.EgressMode
		want types.EgressMode
	}{
		{"", types.EgressWhitelist, types.EgressWhitelist},
		{types.EgressOpen, types.EgressOpen, types.EgressOpen},
		{types.EgressOpen, types.EgressClosed, types.EgressClosed},
		{types.EgressClosed, types.EgressOpen, types.EgressClosed},
		{types.EgressOpen, types.EgressWhitelist, types.EgressWhitelist},
		{types.EgressBlacklist, types.EgressOpen, types.EgressBlacklist},
		{types.EgressWhitelist, types.EgressBlacklist, types.EgressWhitelist},
		{types.EgressClosed, types.EgressWhitelist, types.EgressClosed},
		{types.EgressClosed, types.EgressBlacklist, types.EgressClosed},
	}
	for _, c := range cases {
		got := combineMode(c.a, c.b)
		if got != c.want {
			t.Errorf("combineMode(%q,%q): got %q, want %q", c.a, c.b, got, c.want)
		}
	}
}

func TestUniqueProfileIDs(t *testing.T) {
	conns := []types.Connection{
		{ProfileIDs: []string{"a", "b", ""}},
		{ProfileIDs: []string{"a", "c"}},
		{ProfileIDs: nil},
	}
	got := uniqueProfileIDs(conns)
	sort.Strings(got)
	want := []string{"a", "b", "c"}
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("got %v, want %v", got, want)
			break
		}
	}
}

func TestMergePoliciesEmpty(t *testing.T) {
	out := mergePolicies(nil, nil)
	if out.Mode != types.EgressOpen {
		t.Errorf("empty -> mode %q, want open", out.Mode)
	}
}

func TestMergePoliciesUnknownProfileFallsBackToOpen(t *testing.T) {
	out := mergePolicies([]string{"missing"}, map[string]types.GuardProfile{})
	if out.Mode != types.EgressOpen {
		t.Errorf("unknown profile -> mode %q, want open", out.Mode)
	}
}

func TestMergePoliciesUnionsHostsAndCIDRs(t *testing.T) {
	profiles := map[string]types.GuardProfile{
		"a": {Egress: types.EgressPolicy{Mode: types.EgressWhitelist, Hosts: []string{"x", "y"}, CIDRs: []string{"10.0.0.0/8"}}},
		"b": {Egress: types.EgressPolicy{Mode: types.EgressWhitelist, Hosts: []string{"y", "z"}, CIDRs: []string{"1.2.3.4/32"}}},
	}
	out := mergePolicies([]string{"a", "b"}, profiles)
	if out.Mode != types.EgressWhitelist {
		t.Fatalf("mode %q, want whitelist", out.Mode)
	}
	gotHosts := append([]string{}, out.Hosts...)
	sort.Strings(gotHosts)
	wantHosts := []string{"x", "y", "z"}
	if len(gotHosts) != 3 || gotHosts[0] != wantHosts[0] || gotHosts[1] != wantHosts[1] || gotHosts[2] != wantHosts[2] {
		t.Errorf("hosts %v, want %v", gotHosts, wantHosts)
	}
	gotCIDRs := append([]string{}, out.CIDRs...)
	sort.Strings(gotCIDRs)
	if len(gotCIDRs) != 2 || gotCIDRs[0] != "1.2.3.4/32" || gotCIDRs[1] != "10.0.0.0/8" {
		t.Errorf("cidrs %v, want [1.2.3.4/32 10.0.0.0/8]", gotCIDRs)
	}
}

func TestMergePoliciesClosedDominates(t *testing.T) {
	profiles := map[string]types.GuardProfile{
		"a": {Egress: types.EgressPolicy{Mode: types.EgressOpen}},
		"b": {Egress: types.EgressPolicy{Mode: types.EgressClosed}},
		"c": {Egress: types.EgressPolicy{Mode: types.EgressBlacklist, Hosts: []string{"evil"}}},
	}
	out := mergePolicies([]string{"a", "b", "c"}, profiles)
	if out.Mode != types.EgressClosed {
		t.Errorf("mode %q, want closed", out.Mode)
	}
}

func TestMergePoliciesWhitelistBeatsBlacklist(t *testing.T) {
	profiles := map[string]types.GuardProfile{
		"w": {Egress: types.EgressPolicy{Mode: types.EgressWhitelist, Hosts: []string{"good"}}},
		"b": {Egress: types.EgressPolicy{Mode: types.EgressBlacklist, Hosts: []string{"bad"}}},
	}
	out := mergePolicies([]string{"w", "b"}, profiles)
	if out.Mode != types.EgressWhitelist {
		t.Errorf("mode %q, want whitelist", out.Mode)
	}
}

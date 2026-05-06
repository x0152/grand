package egress

import (
	"testing"

	"mantis/core/types"
)

func TestCanonicalVersionStableAcrossSandboxOrder(t *testing.T) {
	a := types.EgressState{Sandboxes: []types.EgressSandboxState{
		{Name: "x", IP: "1.1.1.1", Policy: types.EgressPolicy{Mode: types.EgressOpen}},
		{Name: "y", IP: "2.2.2.2", Policy: types.EgressPolicy{Mode: types.EgressClosed}},
	}}
	b := types.EgressState{Sandboxes: []types.EgressSandboxState{
		{Name: "y", IP: "2.2.2.2", Policy: types.EgressPolicy{Mode: types.EgressClosed}},
		{Name: "x", IP: "1.1.1.1", Policy: types.EgressPolicy{Mode: types.EgressOpen}},
	}}
	if canonicalVersion(a) != canonicalVersion(b) {
		t.Errorf("versions differ across sandbox order: %s vs %s", canonicalVersion(a), canonicalVersion(b))
	}
}

func TestCanonicalVersionStableAcrossHostAndCIDROrder(t *testing.T) {
	a := types.EgressState{Sandboxes: []types.EgressSandboxState{{
		Name: "x", IP: "1.1.1.1",
		Policy: types.EgressPolicy{Mode: types.EgressWhitelist, Hosts: []string{"a", "b", "c"}, CIDRs: []string{"10.0.0.0/8", "1.2.3.4/32"}},
	}}}
	b := types.EgressState{Sandboxes: []types.EgressSandboxState{{
		Name: "x", IP: "1.1.1.1",
		Policy: types.EgressPolicy{Mode: types.EgressWhitelist, Hosts: []string{"c", "a", "b"}, CIDRs: []string{"1.2.3.4/32", "10.0.0.0/8"}},
	}}}
	if canonicalVersion(a) != canonicalVersion(b) {
		t.Errorf("versions differ across host/cidr order")
	}
}

func TestCanonicalVersionDifferentOnPolicyChange(t *testing.T) {
	a := types.EgressState{Sandboxes: []types.EgressSandboxState{{
		Name: "x", IP: "1.1.1.1",
		Policy: types.EgressPolicy{Mode: types.EgressWhitelist, Hosts: []string{"a"}},
	}}}
	b := types.EgressState{Sandboxes: []types.EgressSandboxState{{
		Name: "x", IP: "1.1.1.1",
		Policy: types.EgressPolicy{Mode: types.EgressWhitelist, Hosts: []string{"a", "b"}},
	}}}
	if canonicalVersion(a) == canonicalVersion(b) {
		t.Errorf("versions identical despite host change")
	}
}

func TestCanonicalVersionDifferentOnIPChange(t *testing.T) {
	a := types.EgressState{Sandboxes: []types.EgressSandboxState{{Name: "x", IP: "1.1.1.1", Policy: types.EgressPolicy{Mode: types.EgressOpen}}}}
	b := types.EgressState{Sandboxes: []types.EgressSandboxState{{Name: "x", IP: "1.1.1.2", Policy: types.EgressPolicy{Mode: types.EgressOpen}}}}
	if canonicalVersion(a) == canonicalVersion(b) {
		t.Errorf("versions identical despite IP change")
	}
}

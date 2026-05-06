package mappers

import (
	"encoding/json"
	"sort"
	"testing"

	"mantis/core/types"
	"mantis/infrastructure/models"
)

func TestGuardProfileToRowMarshalsEgress(t *testing.T) {
	p := types.GuardProfile{
		ID:   "p1",
		Name: "p",
		Egress: types.EgressPolicy{
			Mode:  types.EgressWhitelist,
			Hosts: []string{"a.example.com"},
			CIDRs: []string{"10.0.0.0/8"},
		},
	}
	row := GuardProfileToRow(p)
	var got types.EgressPolicy
	if err := json.Unmarshal(row.Egress, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got.Mode != types.EgressWhitelist || len(got.Hosts) != 1 || got.Hosts[0] != "a.example.com" || len(got.CIDRs) != 1 {
		t.Errorf("egress not preserved: %+v", got)
	}
}

func TestGuardProfileFromRowDefaultsEgressOpen(t *testing.T) {
	row := models.GuardProfileRow{ID: "p1", Name: "p"}
	p := GuardProfileFromRow(row)
	if p.Egress.Mode != types.EgressOpen {
		t.Errorf("missing egress -> mode %q, want open", p.Egress.Mode)
	}
	if p.Egress.Hosts == nil || p.Egress.CIDRs == nil {
		t.Error("nil arrays must be normalized to empty slices")
	}
}

func TestGuardProfileRoundTrip(t *testing.T) {
	original := types.GuardProfile{
		ID:           "p1",
		Name:         "Test",
		Description:  "rt",
		Builtin:      false,
		Capabilities: types.GuardCapabilities{NetworkOut: true},
		Commands:     []types.CommandRule{{Command: "ls"}},
		Egress: types.EgressPolicy{
			Mode:  types.EgressBlacklist,
			Hosts: []string{"evil.com", "*.tracker.io"},
			CIDRs: []string{"10.0.0.0/8"},
		},
	}
	restored := GuardProfileFromRow(GuardProfileToRow(original))
	if restored.ID != original.ID || restored.Name != original.Name {
		t.Fatal("basic fields")
	}
	if restored.Egress.Mode != types.EgressBlacklist {
		t.Fatalf("mode %q", restored.Egress.Mode)
	}
	gotHosts := append([]string{}, restored.Egress.Hosts...)
	sort.Strings(gotHosts)
	if len(gotHosts) != 2 || gotHosts[0] != "*.tracker.io" || gotHosts[1] != "evil.com" {
		t.Errorf("hosts %v", gotHosts)
	}
	if len(restored.Egress.CIDRs) != 1 || restored.Egress.CIDRs[0] != "10.0.0.0/8" {
		t.Errorf("cidrs %v", restored.Egress.CIDRs)
	}
}

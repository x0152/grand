package egress

import (
	"net"
	"testing"

	"mantis/core/types"
)

func newRules(mode types.EgressMode, hosts, cidrs []string) *SandboxRules {
	state := types.EgressState{
		Sandboxes: []types.EgressSandboxState{{
			Name: "test",
			IP:   "10.0.0.5",
			Policy: types.EgressPolicy{
				Mode:  mode,
				Hosts: hosts,
				CIDRs: cidrs,
			},
		}},
	}
	return CompileState(state).BySrcIP["10.0.0.5"]
}

func TestHostVerdictWhitelist(t *testing.T) {
	r := newRules(types.EgressWhitelist, []string{"api.openai.com", "*.github.com"}, nil)
	cases := []struct {
		host  string
		allow bool
	}{
		{"api.openai.com", true},
		{"API.OPENAI.COM.", true},
		{"raw.githubusercontent.com", false},
		{"foo.github.com", true},
		{"github.com", false},
		{"evil.com", false},
	}
	for _, c := range cases {
		got, _ := r.HostVerdict(c.host)
		if got != c.allow {
			t.Errorf("whitelist %q: got %v, want %v", c.host, got, c.allow)
		}
	}
}

func TestHostVerdictBlacklist(t *testing.T) {
	r := newRules(types.EgressBlacklist, []string{"evil.com", "*.tracker.io"}, nil)
	cases := []struct {
		host  string
		allow bool
	}{
		{"evil.com", false},
		{"sub.tracker.io", false},
		{"good.com", true},
		{"tracker.io", true},
	}
	for _, c := range cases {
		got, _ := r.HostVerdict(c.host)
		if got != c.allow {
			t.Errorf("blacklist %q: got %v, want %v", c.host, got, c.allow)
		}
	}
}

func TestHostVerdictOpenClosed(t *testing.T) {
	open := newRules(types.EgressOpen, nil, nil)
	if allow, _ := open.HostVerdict("anything.com"); !allow {
		t.Error("open mode must allow everything")
	}
	closed := newRules(types.EgressClosed, []string{"api.openai.com"}, nil)
	if allow, _ := closed.HostVerdict("api.openai.com"); allow {
		t.Error("closed mode must block everything regardless of list")
	}
}

func TestCIDRMatch(t *testing.T) {
	r := newRules(types.EgressWhitelist, nil, []string{"10.0.0.0/8", "1.2.3.4/32"})
	if !r.CIDRMatchesIP(net.ParseIP("10.20.30.40")) {
		t.Error("expected 10.20.30.40 to match 10.0.0.0/8")
	}
	if !r.CIDRMatchesIP(net.ParseIP("1.2.3.4")) {
		t.Error("expected 1.2.3.4/32 to match")
	}
	if r.CIDRMatchesIP(net.ParseIP("8.8.8.8")) {
		t.Error("did not expect 8.8.8.8 to match")
	}
}

func TestEmptyListWhitelistBlocksEverything(t *testing.T) {
	r := newRules(types.EgressWhitelist, nil, nil)
	if allow, _ := r.HostVerdict("anything.com"); allow {
		t.Error("whitelist with empty list must block everything (== closed)")
	}
}

func TestEmptyListBlacklistAllowsEverything(t *testing.T) {
	r := newRules(types.EgressBlacklist, nil, nil)
	if allow, _ := r.HostVerdict("anything.com"); !allow {
		t.Error("blacklist with empty list must allow everything (== open)")
	}
}

func TestCompileStateSkipsInvalidIPs(t *testing.T) {
	state := types.EgressState{Sandboxes: []types.EgressSandboxState{
		{Name: "good", IP: "10.0.0.5", Policy: types.EgressPolicy{Mode: types.EgressOpen}},
		{Name: "bad", IP: "not-an-ip", Policy: types.EgressPolicy{Mode: types.EgressOpen}},
		{Name: "v6", IP: "::1", Policy: types.EgressPolicy{Mode: types.EgressOpen}},
		{Name: "blank", IP: "", Policy: types.EgressPolicy{Mode: types.EgressOpen}},
	}}
	st := CompileState(state)
	if len(st.Sandbox) != 1 {
		t.Fatalf("got %d sandboxes, want 1", len(st.Sandbox))
	}
	if _, ok := st.BySrcIP["10.0.0.5"]; !ok {
		t.Error("good sandbox missing from BySrcIP")
	}
}

func TestCompileStateBareIPNormalizesTo32(t *testing.T) {
	r := newRules(types.EgressWhitelist, nil, []string{"1.2.3.4"})
	if !r.CIDRMatchesIP(net.ParseIP("1.2.3.4")) {
		t.Error("bare IP must be matched as /32")
	}
	if r.CIDRMatchesIP(net.ParseIP("1.2.3.5")) {
		t.Error("bare IP must not match neighbor")
	}
}

func TestCompileStateSkipsMalformedCIDR(t *testing.T) {
	r := newRules(types.EgressWhitelist, nil, []string{"not-cidr", "10.0.0.0/8"})
	if len(r.IPNets) != 1 {
		t.Errorf("got %d nets, want 1", len(r.IPNets))
	}
}

func TestHostNormalizationCaseAndTrailingDot(t *testing.T) {
	r := newRules(types.EgressWhitelist, []string{"Foo.Example.COM"}, nil)
	if allow, _ := r.HostVerdict("foo.example.com"); !allow {
		t.Error("hosts must be matched case-insensitively")
	}
	if allow, _ := r.HostVerdict("foo.example.com."); !allow {
		t.Error("trailing dot must be stripped")
	}
}

func TestHostSuffixDoesNotMatchUnrelated(t *testing.T) {
	r := newRules(types.EgressWhitelist, []string{"*.example.com"}, nil)
	if allow, _ := r.HostVerdict("evilexample.com"); allow {
		t.Error("suffix must require dot boundary")
	}
}

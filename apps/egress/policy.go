package egress

import (
	"net"
	"strings"

	"mantis/core/types"
)

type State struct {
	Version string
	BySrcIP map[string]*SandboxRules
	Sandbox []*SandboxRules
}

type SandboxRules struct {
	Name       string
	SrcIP      net.IP
	Mode       types.EgressMode
	HostExact  map[string]struct{}
	HostSuffix []string
	IPNets     []*net.IPNet
}

func CompileState(state types.EgressState) *State {
	out := &State{
		Version: state.Version,
		BySrcIP: make(map[string]*SandboxRules, len(state.Sandboxes)),
		Sandbox: make([]*SandboxRules, 0, len(state.Sandboxes)),
	}
	for _, sb := range state.Sandboxes {
		ip := net.ParseIP(strings.TrimSpace(sb.IP))
		if ip == nil {
			continue
		}
		ip = ip.To4()
		if ip == nil {
			continue
		}
		rules := &SandboxRules{
			Name:      sb.Name,
			SrcIP:     ip,
			Mode:      types.EgressMode(strings.ToLower(string(sb.Policy.Mode))),
			HostExact: make(map[string]struct{}, len(sb.Policy.Hosts)),
		}
		if rules.Mode == "" {
			rules.Mode = types.EgressOpen
		}
		for _, h := range sb.Policy.Hosts {
			h = normalizeHost(h)
			if h == "" {
				continue
			}
			if strings.HasPrefix(h, "*.") {
				rules.HostSuffix = append(rules.HostSuffix, h[1:])
			} else {
				rules.HostExact[h] = struct{}{}
			}
		}
		for _, c := range sb.Policy.CIDRs {
			c = strings.TrimSpace(c)
			if c == "" {
				continue
			}
			if !strings.Contains(c, "/") {
				c += "/32"
			}
			_, ipnet, err := net.ParseCIDR(c)
			if err != nil {
				continue
			}
			rules.IPNets = append(rules.IPNets, ipnet)
		}
		out.BySrcIP[ip.String()] = rules
		out.Sandbox = append(out.Sandbox, rules)
	}
	return out
}

func normalizeHost(h string) string {
	h = strings.TrimSpace(strings.ToLower(h))
	h = strings.TrimSuffix(h, ".")
	return h
}

func (r *SandboxRules) HostVerdict(host string) (allow bool, reason string) {
	host = normalizeHost(host)
	switch r.Mode {
	case types.EgressOpen:
		return true, "open"
	case types.EgressClosed:
		return false, "closed"
	case types.EgressWhitelist:
		if r.matchesHost(host) {
			return true, "whitelist-hit"
		}
		return false, "not-in-whitelist"
	case types.EgressBlacklist:
		if r.matchesHost(host) {
			return false, "blacklist-hit"
		}
		return true, "not-in-blacklist"
	}
	return true, "unknown-mode"
}

func (r *SandboxRules) matchesHost(host string) bool {
	if _, ok := r.HostExact[host]; ok {
		return true
	}
	for _, suf := range r.HostSuffix {
		if strings.HasSuffix(host, suf) {
			return true
		}
	}
	return false
}

func (r *SandboxRules) CIDRMatchesIP(ip net.IP) bool {
	for _, n := range r.IPNets {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

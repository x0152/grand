package types

import (
	"net"
	"strings"
)

type EgressMode string

const (
	EgressOpen      EgressMode = "open"
	EgressClosed    EgressMode = "closed"
	EgressWhitelist EgressMode = "whitelist"
	EgressBlacklist EgressMode = "blacklist"
)

type EgressPolicy struct {
	Mode  EgressMode `json:"mode"`
	Hosts []string   `json:"hosts"`
	CIDRs []string   `json:"cidrs"`
}

func (p EgressPolicy) IsOpen() bool {
	return p.Mode == "" || p.Mode == EgressOpen
}

func MergeEgressPolicies(policies []EgressPolicy) EgressPolicy {
	if len(policies) == 0 {
		return EgressPolicy{Mode: EgressOpen, Hosts: []string{}, CIDRs: []string{}}
	}
	mode := EgressMode("")
	hosts := map[string]struct{}{}
	cidrs := map[string]struct{}{}
	for _, p := range policies {
		p = p.Normalize()
		mode = combineEgressMode(mode, p.Mode)
		for _, h := range p.Hosts {
			hosts[h] = struct{}{}
		}
		for _, c := range p.CIDRs {
			cidrs[c] = struct{}{}
		}
	}
	if mode == "" {
		mode = EgressOpen
	}
	out := EgressPolicy{Mode: mode, Hosts: make([]string, 0, len(hosts)), CIDRs: make([]string, 0, len(cidrs))}
	for h := range hosts {
		out.Hosts = append(out.Hosts, h)
	}
	for c := range cidrs {
		out.CIDRs = append(out.CIDRs, c)
	}
	return out
}

func combineEgressMode(current, next EgressMode) EgressMode {
	if current == "" {
		return next
	}
	if current == next {
		return current
	}
	if current == EgressClosed || next == EgressClosed {
		return EgressClosed
	}
	if current == EgressWhitelist || next == EgressWhitelist {
		return EgressWhitelist
	}
	if current == EgressBlacklist || next == EgressBlacklist {
		return EgressBlacklist
	}
	return EgressOpen
}

func (p EgressPolicy) Normalize() EgressPolicy {
	mode := p.Mode
	switch mode {
	case EgressOpen, EgressClosed, EgressWhitelist, EgressBlacklist:
	default:
		mode = EgressOpen
	}
	hosts := p.Hosts
	if hosts == nil {
		hosts = []string{}
	}
	cidrs := p.CIDRs
	if cidrs == nil {
		cidrs = []string{}
	}
	return EgressPolicy{Mode: mode, Hosts: hosts, CIDRs: cidrs}
}

func (p EgressPolicy) Evaluate(target string) (bool, string) {
	target = strings.TrimSpace(target)
	if target == "" {
		return true, "empty"
	}
	mode := p.Mode
	if mode == "" {
		mode = EgressOpen
	}
	switch mode {
	case EgressOpen:
		return true, "open"
	case EgressClosed:
		return false, "closed"
	}
	hit, label := p.matches(target)
	switch mode {
	case EgressWhitelist:
		if hit {
			return true, "whitelist:" + label
		}
		return false, "not-in-whitelist"
	case EgressBlacklist:
		if hit {
			return false, "blacklist:" + label
		}
		return true, "not-in-blacklist"
	}
	return true, "unknown-mode"
}

func (p EgressPolicy) matches(target string) (bool, string) {
	if ip := net.ParseIP(target); ip != nil {
		for _, c := range p.CIDRs {
			c = strings.TrimSpace(c)
			if c == "" {
				continue
			}
			if !strings.Contains(c, "/") {
				if c == target {
					return true, "ip:" + c
				}
				continue
			}
			_, ipnet, err := net.ParseCIDR(c)
			if err != nil {
				continue
			}
			if ipnet.Contains(ip) {
				return true, "cidr:" + c
			}
		}
		return false, ""
	}
	host := strings.ToLower(strings.TrimSuffix(target, "."))
	for _, h := range p.Hosts {
		h = strings.ToLower(strings.TrimSpace(strings.TrimSuffix(h, ".")))
		if h == "" {
			continue
		}
		if strings.HasPrefix(h, "*.") {
			if strings.HasSuffix(host, h[1:]) {
				return true, "host:" + h
			}
			continue
		}
		if h == host {
			return true, "host:" + h
		}
	}
	return false, ""
}

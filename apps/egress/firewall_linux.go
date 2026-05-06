//go:build linux

package egress

import (
	"fmt"
	"log"
	"net"
	"sync"
	"time"

	"github.com/google/nftables"
	"github.com/google/nftables/expr"
	"golang.org/x/sys/unix"

	"mantis/core/types"
)

type Firewall struct {
	tableName string
	mu        sync.Mutex
	state     *State
	disabled  bool
}

const (
	tableName     = "mantis_egress"
	chainOutgoing = "outgoing"
)

func NewFirewall(dryRun bool) *Firewall {
	return &Firewall{
		tableName: tableName,
		disabled:  dryRun,
	}
}

func (f *Firewall) Apply(st *State) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.state = st
	if f.disabled {
		log.Printf("egress firewall: dry-run, skipping nftables apply (sandboxes=%d)", len(st.Sandbox))
		return nil
	}

	c, err := nftables.New()
	if err != nil {
		return fmt.Errorf("nftables.New: %w", err)
	}
	defer c.CloseLasting() //nolint:errcheck

	c.DelTable(&nftables.Table{Family: nftables.TableFamilyINet, Name: f.tableName})
	if err := c.Flush(); err != nil {
		log.Printf("egress firewall: pre-flush warning: %v", err)
	}

	tbl := c.AddTable(&nftables.Table{
		Family: nftables.TableFamilyINet,
		Name:   f.tableName,
	})

	setsBySandbox := make(map[string]*nftables.Set, len(st.Sandbox))
	for _, sb := range st.Sandbox {
		set := &nftables.Set{
			Table:      tbl,
			Name:       setNameFor(sb.Name),
			KeyType:    nftables.TypeIPAddr,
			HasTimeout: true,
		}
		if err := c.AddSet(set, nil); err != nil {
			return fmt.Errorf("AddSet %s: %w", set.Name, err)
		}
		setsBySandbox[sb.Name] = set
	}

	policy := nftables.ChainPolicyAccept
	chain := c.AddChain(&nftables.Chain{
		Name:     chainOutgoing,
		Table:    tbl,
		Type:     nftables.ChainTypeFilter,
		Hooknum:  nftables.ChainHookForward,
		Priority: nftables.ChainPriorityRef(-150),
		Policy:   &policy,
	})

	for _, sb := range st.Sandbox {
		f.addSandboxRules(c, tbl, chain, sb, setsBySandbox[sb.Name])
	}

	if err := c.Flush(); err != nil {
		return fmt.Errorf("flush ruleset: %w", err)
	}
	return nil
}

func (f *Firewall) addSandboxRules(c *nftables.Conn, tbl *nftables.Table, chain *nftables.Chain, sb *SandboxRules, allowSet *nftables.Set) {
	srcIP := sb.SrcIP.To4()
	if srcIP == nil {
		return
	}

	matchSrcIP := []expr.Any{
		&expr.Payload{
			DestRegister: 1,
			Base:         expr.PayloadBaseNetworkHeader,
			Offset:       12,
			Len:          4,
		},
		&expr.Cmp{
			Op:       expr.CmpOpEq,
			Register: 1,
			Data:     srcIP,
		},
	}

	matchDstIPInSet := func(set *nftables.Set) []expr.Any {
		return []expr.Any{
			&expr.Payload{
				DestRegister: 1,
				Base:         expr.PayloadBaseNetworkHeader,
				Offset:       16,
				Len:          4,
			},
			&expr.Lookup{
				SourceRegister: 1,
				SetName:        set.Name,
				SetID:          set.ID,
			},
		}
	}

	matchDstIPInCIDR := func(cidr *net.IPNet) []expr.Any {
		ip := cidr.IP.To4()
		if ip == nil {
			return nil
		}
		mask := net.IP(cidr.Mask).To4()
		from := make([]byte, 4)
		to := make([]byte, 4)
		for i := 0; i < 4; i++ {
			from[i] = ip[i] & mask[i]
			to[i] = from[i] | ^mask[i]
		}
		return []expr.Any{
			&expr.Payload{
				DestRegister: 1,
				Base:         expr.PayloadBaseNetworkHeader,
				Offset:       16,
				Len:          4,
			},
			&expr.Range{
				Op:       expr.CmpOpEq,
				Register: 1,
				FromData: from,
				ToData:   to,
			},
		}
	}

	verdictAccept := []expr.Any{
		&expr.Verdict{Kind: expr.VerdictAccept},
	}
	verdictDrop := []expr.Any{
		&expr.Log{
			Level: expr.LogLevelWarning,
			Data:  []byte(fmt.Sprintf("egress-block sb=%s ", sb.Name)),
			Key:   1 << unix.NFTA_LOG_PREFIX,
		},
		&expr.Verdict{Kind: expr.VerdictDrop},
	}

	mode := sb.Mode
	if mode == "" {
		mode = types.EgressOpen
	}

	switch mode {
	case types.EgressOpen:
		c.AddRule(&nftables.Rule{
			Table: tbl,
			Chain: chain,
			Exprs: append(append([]expr.Any{}, matchSrcIP...), verdictAccept...),
		})
	case types.EgressClosed:
		c.AddRule(&nftables.Rule{
			Table: tbl,
			Chain: chain,
			Exprs: append(append([]expr.Any{}, matchSrcIP...), verdictDrop...),
		})
	case types.EgressWhitelist:
		c.AddRule(&nftables.Rule{
			Table: tbl,
			Chain: chain,
			Exprs: concat(matchSrcIP, matchDstIPInSet(allowSet), verdictAccept),
		})
		for _, cidr := range sb.IPNets {
			if e := matchDstIPInCIDR(cidr); e != nil {
				c.AddRule(&nftables.Rule{
					Table: tbl,
					Chain: chain,
					Exprs: concat(matchSrcIP, e, verdictAccept),
				})
			}
		}
		c.AddRule(&nftables.Rule{
			Table: tbl,
			Chain: chain,
			Exprs: concat(matchSrcIP, verdictDrop),
		})
	case types.EgressBlacklist:
		for _, cidr := range sb.IPNets {
			if e := matchDstIPInCIDR(cidr); e != nil {
				c.AddRule(&nftables.Rule{
					Table: tbl,
					Chain: chain,
					Exprs: concat(matchSrcIP, e, verdictDrop),
				})
			}
		}
		c.AddRule(&nftables.Rule{
			Table: tbl,
			Chain: chain,
			Exprs: concat(matchSrcIP, verdictAccept),
		})
	}
}

func (f *Firewall) AddAllowedIP(sandbox string, ip net.IP, ttl time.Duration) {
	f.addToSet(setNameFor(sandbox), ip, ttl)
}

func (f *Firewall) AddBlockedIP(sandbox string, ip net.IP, ttl time.Duration) {}

func (f *Firewall) addToSet(setName string, ip net.IP, ttl time.Duration) {
	if f.disabled {
		return
	}
	ip4 := ip.To4()
	if ip4 == nil {
		return
	}
	c, err := nftables.New()
	if err != nil {
		log.Printf("egress firewall: dial: %v", err)
		return
	}
	defer c.CloseLasting() //nolint:errcheck

	tbl := &nftables.Table{Family: nftables.TableFamilyINet, Name: f.tableName}
	set, err := c.GetSetByName(tbl, setName)
	if err != nil {
		return
	}
	if err := c.SetAddElements(set, []nftables.SetElement{{
		Key:     ip4,
		Timeout: ttl,
	}}); err != nil {
		log.Printf("egress firewall: SetAddElements %s %s: %v", setName, ip4, err)
		return
	}
	if err := c.Flush(); err != nil {
		log.Printf("egress firewall: flush element %s %s: %v", setName, ip4, err)
	}
}

func setNameFor(sandbox string) string {
	out := make([]byte, 0, len(sandbox)+8)
	out = append(out, "sb_"...)
	for i := 0; i < len(sandbox); i++ {
		c := sandbox[i]
		switch {
		case c >= 'a' && c <= 'z', c >= '0' && c <= '9':
			out = append(out, c)
		case c >= 'A' && c <= 'Z':
			out = append(out, c+32)
		default:
			out = append(out, '_')
		}
	}
	return string(out) + "_allow"
}

func concat(parts ...[]expr.Any) []expr.Any {
	total := 0
	for _, p := range parts {
		total += len(p)
	}
	out := make([]expr.Any, 0, total)
	for _, p := range parts {
		out = append(out, p...)
	}
	return out
}

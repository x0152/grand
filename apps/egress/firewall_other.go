//go:build !linux

package egress

import (
	"log"
	"net"
	"sync"
	"time"
)

type Firewall struct {
	mu       sync.Mutex
	state    *State
	disabled bool
}

func NewFirewall(dryRun bool) *Firewall {
	return &Firewall{disabled: true}
}

func (f *Firewall) Apply(st *State) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.state = st
	log.Printf("egress firewall: non-linux stub, skipping nftables (sandboxes=%d)", len(st.Sandbox))
	return nil
}

func (f *Firewall) AddAllowedIP(sandbox string, ip net.IP, ttl time.Duration) {}
func (f *Firewall) AddBlockedIP(sandbox string, ip net.IP, ttl time.Duration) {}

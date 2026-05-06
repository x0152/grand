package egress

import (
	"context"
	"errors"
	"net"
	"strings"
	"sync/atomic"
	"time"

	"github.com/miekg/dns"

	"mantis/core/types"
)

type DNSServer struct {
	addr     string
	state    *atomic.Pointer[State]
	upstream []string
	resolver *net.Resolver
	timeout  time.Duration
	logger   *Logger
	firewall FirewallSets
}

type FirewallSets interface {
	AddAllowedIP(sandbox string, ip net.IP, ttl time.Duration)
	AddBlockedIP(sandbox string, ip net.IP, ttl time.Duration)
}

func NewDNSServer(addr string, state *atomic.Pointer[State], upstream []string, logger *Logger, firewall FirewallSets) *DNSServer {
	return &DNSServer{
		addr:     addr,
		state:    state,
		upstream: upstream,
		resolver: net.DefaultResolver,
		timeout:  5 * time.Second,
		logger:   logger,
		firewall: firewall,
	}
}

func (s *DNSServer) ListenAndServe(ctx context.Context) error {
	mux := dns.NewServeMux()
	mux.HandleFunc(".", s.handle)

	udpSrv := &dns.Server{Addr: s.addr, Net: "udp", Handler: mux, ReusePort: true}
	tcpSrv := &dns.Server{Addr: s.addr, Net: "tcp", Handler: mux, ReusePort: true}

	errCh := make(chan error, 2)
	go func() { errCh <- udpSrv.ListenAndServe() }()
	go func() { errCh <- tcpSrv.ListenAndServe() }()

	defer func() {
		_ = udpSrv.Shutdown()
		_ = tcpSrv.Shutdown()
	}()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-errCh:
		return err
	}
}

func (s *DNSServer) handle(w dns.ResponseWriter, r *dns.Msg) {
	srcIP := remoteIP(w.RemoteAddr())
	rules := s.lookupRules(srcIP)

	resp := new(dns.Msg)
	resp.SetReply(r)
	resp.Authoritative = false
	resp.RecursionAvailable = true

	if len(r.Question) == 0 {
		_ = w.WriteMsg(resp)
		return
	}
	q := r.Question[0]
	host := strings.TrimSuffix(strings.ToLower(q.Name), ".")

	allow, reason := true, "no-policy"
	if rules != nil {
		allow, reason = rules.HostVerdict(host)
	}
	sandbox := "unknown"
	if rules != nil {
		sandbox = rules.Name
	}

	if !allow {
		s.logger.Block(LogEntry{
			Layer:   "dns",
			Sandbox: sandbox,
			SrcIP:   srcIP.String(),
			Host:    host,
			QType:   dns.TypeToString[q.Qtype],
			Reason:  reason,
		})
		resp.Rcode = dns.RcodeNameError
		_ = w.WriteMsg(resp)
		return
	}

	answers, ttl, err := s.resolveUpstream(host, q.Qtype)
	if err != nil {
		s.logger.Allow(LogEntry{
			Layer:   "dns",
			Sandbox: sandbox,
			SrcIP:   srcIP.String(),
			Host:    host,
			QType:   dns.TypeToString[q.Qtype],
			Reason:  "upstream-error: " + err.Error(),
		})
		resp.Rcode = dns.RcodeServerFailure
		_ = w.WriteMsg(resp)
		return
	}

	for _, ans := range answers {
		resp.Answer = append(resp.Answer, ans)
	}

	if rules != nil {
		setTTL := ttl
		if setTTL < 60*time.Second {
			setTTL = 60 * time.Second
		}
		for _, ans := range resp.Answer {
			a, ok := ans.(*dns.A)
			if !ok {
				continue
			}
			ip := a.A.To4()
			if ip == nil {
				continue
			}
			if rules.Mode == types.EgressWhitelist {
				s.firewall.AddAllowedIP(rules.Name, ip, setTTL)
			}
		}
	}

	s.logger.Allow(LogEntry{
		Layer:   "dns",
		Sandbox: sandbox,
		SrcIP:   srcIP.String(),
		Host:    host,
		QType:   dns.TypeToString[q.Qtype],
		Reason:  reason,
	})
	_ = w.WriteMsg(resp)
}

func (s *DNSServer) lookupRules(srcIP net.IP) *SandboxRules {
	st := s.state.Load()
	if st == nil {
		return nil
	}
	return st.BySrcIP[srcIP.String()]
}

func (s *DNSServer) resolveUpstream(host string, qtype uint16) ([]dns.RR, time.Duration, error) {
	ctx, cancel := context.WithTimeout(context.Background(), s.timeout)
	defer cancel()

	switch qtype {
	case dns.TypeA:
		ips, err := s.resolver.LookupIP(ctx, "ip4", host)
		if err != nil {
			return nil, 0, err
		}
		if len(ips) == 0 {
			return nil, 0, errors.New("no A records")
		}
		out := make([]dns.RR, 0, len(ips))
		for _, ip := range ips {
			ip4 := ip.To4()
			if ip4 == nil {
				continue
			}
			out = append(out, &dns.A{
				Hdr: dns.RR_Header{Name: dns.Fqdn(host), Rrtype: dns.TypeA, Class: dns.ClassINET, Ttl: 300},
				A:   ip4,
			})
		}
		return out, 5 * time.Minute, nil
	case dns.TypeAAAA:
		return nil, 0, nil
	default:
		return nil, 0, nil
	}
}

func remoteIP(addr net.Addr) net.IP {
	switch a := addr.(type) {
	case *net.UDPAddr:
		return a.IP
	case *net.TCPAddr:
		return a.IP
	}
	return nil
}

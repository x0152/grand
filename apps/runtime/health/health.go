package health

import (
	"context"
	"fmt"
	"net"
	"time"

	"mantis/core/protocols"
	"mantis/core/types"
)

func WaitForReady(ctx context.Context, rt protocols.Runtime, name string, total time.Duration) (types.RuntimeContainer, error) {
	deadline := time.Now().Add(total)
	pollCtx, cancel := context.WithDeadline(ctx, deadline)
	defer cancel()
	var last types.RuntimeContainer
	delay := 250 * time.Millisecond
	for {
		c, err := rt.Inspect(pollCtx, name)
		if err == nil {
			last = c
			if c.Status == "running" && ProbeSSH(pollCtx, c, 1500*time.Millisecond) {
				return c, nil
			}
			if c.Status == "exited" || c.Status == "dead" {
				return last, fmt.Errorf("container %s exited before becoming ready (status=%s)", name, c.Status)
			}
		}
		if time.Now().After(deadline) {
			if last.Status == "" {
				if err != nil {
					return last, fmt.Errorf("readiness timeout: %w", err)
				}
				return last, fmt.Errorf("readiness timeout for %s", name)
			}
			return last, fmt.Errorf("readiness timeout for %s (last status=%s)", name, last.Status)
		}
		select {
		case <-pollCtx.Done():
			return last, pollCtx.Err()
		case <-time.After(delay):
		}
		if delay < 2*time.Second {
			delay *= 2
		}
	}
}

func ProbeSSH(ctx context.Context, c types.RuntimeContainer, timeout time.Duration) bool {
	addrs := make([]string, 0, 2)
	if c.IP != "" {
		addrs = append(addrs, net.JoinHostPort(c.IP, "22"))
	}
	if c.Host != "" {
		addrs = append(addrs, net.JoinHostPort(c.Host, "22"))
	}
	if len(addrs) == 0 {
		return false
	}
	for _, addr := range addrs {
		dctx, cancel := context.WithTimeout(ctx, timeout)
		var d net.Dialer
		conn, err := d.DialContext(dctx, "tcp", addr)
		cancel()
		if err == nil {
			conn.Close()
			return true
		}
	}
	return false
}

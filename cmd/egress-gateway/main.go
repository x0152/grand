package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync/atomic"
	"syscall"
	"time"

	"mantis/apps/egress"
)

func main() {
	log.SetFlags(0)

	runtimeURL := envOr("RUNTIME_STATE_URL", "http://app:8080/api/runtime/egress/state")
	runtimeToken := os.Getenv("RUNTIME_API_TOKEN")
	dnsAddr := envOr("DNS_LISTEN", ":53")
	httpAddr := envOr("HTTP_LISTEN", ":9999")
	pollEvery := envDuration("POLL_INTERVAL", 30*time.Second)

	logger := egress.NewLogger()
	if notifier := egress.NewGuardIngestNotifier(envOr("GUARD_INGEST_URL", ""), os.Getenv("GUARD_INGEST_TOKEN")); notifier != nil {
		logger.AddSink(notifier)
		log.Printf("egress: forwarding events to %s", envOr("GUARD_INGEST_URL", ""))
	}
	state := &atomic.Pointer[egress.State]{}
	firewall := egress.NewFirewall(envBool("EGRESS_DRY_RUN", false))
	client := egress.NewSnapshotClient(runtimeURL, runtimeToken, &http.Client{Timeout: 10 * time.Second})
	controller := egress.NewController(state, client, firewall, logger, pollEvery)
	dnsServer := egress.NewDNSServer(dnsAddr, state, nil, logger, firewall)

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	go func() {
		log.Printf("egress: HTTP control on %s", httpAddr)
		if err := http.ListenAndServe(httpAddr, controller.HTTPMux()); err != nil && err != http.ErrServerClosed {
			log.Fatalf("egress: HTTP listener: %v", err)
		}
	}()

	go func() {
		log.Printf("egress: DNS on %s", dnsAddr)
		if err := dnsServer.ListenAndServe(ctx); err != nil && err != context.Canceled {
			log.Fatalf("egress: DNS listener: %v", err)
		}
	}()

	log.Printf("egress: pulling state from %s every %s", runtimeURL, pollEvery)
	if err := controller.Run(ctx); err != nil && err != context.Canceled {
		log.Fatalf("egress: controller: %v", err)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envDuration(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil && d > 0 {
			return d
		}
	}
	return fallback
}

func envBool(key string, fallback bool) bool {
	switch v := os.Getenv(key); v {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	}
	return fallback
}

package egress

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"
)

type GuardIngestNotifier struct {
	url    string
	token  string
	client *http.Client
}

func NewGuardIngestNotifier(baseURL, token string) *GuardIngestNotifier {
	url := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if url == "" {
		return nil
	}
	return &GuardIngestNotifier{
		url:    url + "/api/guard/events/ingest",
		token:  strings.TrimSpace(token),
		client: &http.Client{Timeout: 1500 * time.Millisecond},
	}
}

type ingestPayload struct {
	Allowed bool      `json:"allowed"`
	Target  string    `json:"target"`
	Reason  string    `json:"reason"`
	Sandbox string    `json:"sandbox"`
	At      time.Time `json:"at"`
}

func (n *GuardIngestNotifier) Notify(verdict string, e LogEntry) {
	if n == nil {
		return
	}
	target := strings.TrimSpace(e.Host)
	if target == "" {
		target = strings.TrimSpace(e.DstIP)
	}
	if target == "" {
		return
	}
	payload := ingestPayload{
		Allowed: verdict == "allow",
		Target:  target,
		Reason:  e.Reason,
		Sandbox: e.Sandbox,
	}
	if t, err := time.Parse(time.RFC3339Nano, e.Time); err == nil {
		payload.At = t
	} else {
		payload.At = time.Now().UTC()
	}
	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("egress notifier: marshal: %v", err)
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 1500*time.Millisecond)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, n.url, bytes.NewReader(body))
	if err != nil {
		log.Printf("egress notifier: build request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	if n.token != "" {
		req.Header.Set("X-Guard-Ingest-Token", n.token)
	}
	resp, err := n.client.Do(req)
	if err != nil {
		log.Printf("egress notifier: send: %v", err)
		return
	}
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		log.Printf("egress notifier: %s -> %s", n.url, resp.Status)
	}
}

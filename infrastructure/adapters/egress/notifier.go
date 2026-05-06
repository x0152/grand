package egress

import (
	"context"
	"log"
	"net/http"
	"strings"
	"time"
)

type HTTPReloader struct {
	url    string
	client *http.Client
}

func NewHTTPReloader(gatewayURL string) *HTTPReloader {
	url := strings.TrimRight(strings.TrimSpace(gatewayURL), "/")
	return &HTTPReloader{
		url:    url,
		client: &http.Client{Timeout: 2 * time.Second},
	}
}

func (r *HTTPReloader) Reload(ctx context.Context) {
	if r.url == "" {
		return
	}
	go func() {
		c, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		req, err := http.NewRequestWithContext(c, http.MethodPost, r.url+"/reload", nil)
		if err != nil {
			log.Printf("egress notifier: build request: %v", err)
			return
		}
		resp, err := r.client.Do(req)
		if err != nil {
			log.Printf("egress notifier: reload %s: %v", r.url, err)
			return
		}
		resp.Body.Close()
	}()
}

package egress

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestHTTPReloaderPostsToReload(t *testing.T) {
	var hits int32
	done := make(chan struct{}, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/reload" {
			atomic.AddInt32(&hits, 1)
		}
		w.WriteHeader(http.StatusAccepted)
		select {
		case done <- struct{}{}:
		default:
		}
	}))
	defer srv.Close()

	r := NewHTTPReloader(srv.URL)
	r.Reload(context.Background())

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("reload request never reached the server")
	}
	if atomic.LoadInt32(&hits) != 1 {
		t.Errorf("hits=%d, want 1", hits)
	}
}

func TestHTTPReloaderEmptyURLNoop(t *testing.T) {
	r := NewHTTPReloader("")
	r.Reload(context.Background())
}

func TestHTTPReloaderTrimsTrailingSlash(t *testing.T) {
	got := make(chan string, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case got <- r.URL.Path:
		default:
		}
		w.WriteHeader(http.StatusAccepted)
	}))
	defer srv.Close()

	r := NewHTTPReloader(srv.URL + "/")
	r.Reload(context.Background())
	select {
	case p := <-got:
		if p != "/reload" {
			t.Errorf("path %q, want /reload", p)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("no request")
	}
}

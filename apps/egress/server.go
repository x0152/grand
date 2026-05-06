package egress

import (
	"context"
	"log"
	"net/http"
	"sync/atomic"
	"time"
)

type Controller struct {
	state    *atomic.Pointer[State]
	client   *SnapshotClient
	firewall *Firewall
	logger   *Logger
	interval time.Duration
	wake     chan struct{}
}

func NewController(state *atomic.Pointer[State], client *SnapshotClient, firewall *Firewall, logger *Logger, interval time.Duration) *Controller {
	if interval <= 0 {
		interval = 30 * time.Second
	}
	return &Controller{
		state:    state,
		client:   client,
		firewall: firewall,
		logger:   logger,
		interval: interval,
		wake:     make(chan struct{}, 1),
	}
}

func (c *Controller) Run(ctx context.Context) error {
	timer := time.NewTimer(c.interval)
	defer timer.Stop()

	for {
		c.refreshOnce(ctx)
		if !timer.Stop() {
			select {
			case <-timer.C:
			default:
			}
		}
		timer.Reset(c.interval)
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-timer.C:
		case <-c.wake:
		}
	}
}

func (c *Controller) Trigger() {
	select {
	case c.wake <- struct{}{}:
	default:
	}
}

func (c *Controller) refreshOnce(ctx context.Context) {
	rctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	snap, err := c.client.Fetch(rctx)
	if err != nil {
		log.Printf("egress controller: fetch state: %v", err)
		return
	}
	current := c.state.Load()
	if current != nil && current.Version == snap.Version {
		return
	}
	st := CompileState(snap)
	if err := c.firewall.Apply(st); err != nil {
		log.Printf("egress controller: apply firewall: %v", err)
		return
	}
	c.state.Store(st)
	log.Printf("egress controller: applied snapshot version=%s sandboxes=%d", snap.Version, len(st.Sandbox))
}

func (c *Controller) HTTPMux() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		st := c.state.Load()
		if st == nil {
			http.Error(w, "no policy loaded yet", http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(st.Version))
	})
	mux.HandleFunc("/reload", func(w http.ResponseWriter, r *http.Request) {
		c.Trigger()
		w.WriteHeader(http.StatusAccepted)
	})
	return mux
}

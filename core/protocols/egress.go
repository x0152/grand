package protocols

import "context"

type EgressReloader interface {
	Reload(ctx context.Context)
}

type NoopEgressReloader struct{}

func (NoopEgressReloader) Reload(context.Context) {}

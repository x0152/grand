package guardapp

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"

	"mantis/apps/guard/api"
	usecases "mantis/apps/guard/use_cases"
	"mantis/core/protocols"
	"mantis/core/types"
)

type App struct {
	endpoints       *api.Endpoints
	svc             *Service
	profiles        protocols.Store[string, types.GuardProfile]
	connections     protocols.Store[string, types.Connection]
	connectionPrefix string
}

type Options struct {
	Profiles         protocols.Store[string, types.GuardProfile]
	Events           protocols.Store[string, types.GuardEvent]
	Connections      protocols.Store[string, types.Connection]
	Reloader         protocols.EgressReloader
	IngestToken      string
	ConnectionPrefix string
}

func NewApp(opts Options) *App {
	if opts.Reloader == nil {
		opts.Reloader = protocols.NoopEgressReloader{}
	}
	if opts.ConnectionPrefix == "" {
		opts.ConnectionPrefix = "sb-"
	}
	svc := NewService(opts.Profiles, opts.Events)
	a := &App{
		svc:              svc,
		profiles:         opts.Profiles,
		connections:      opts.Connections,
		connectionPrefix: opts.ConnectionPrefix,
	}
	a.endpoints = api.NewEndpoints(api.UseCases{
		Create:  usecases.NewCreateGuardProfile(opts.Profiles, opts.Reloader),
		List:    usecases.NewListGuardProfiles(opts.Profiles),
		Update:  usecases.NewUpdateGuardProfile(opts.Profiles, opts.Reloader),
		Delete:  usecases.NewDeleteGuardProfile(opts.Profiles, opts.Reloader),
		Test:    usecases.NewTestGuardProfile(),
		SyncAtt: usecases.NewSyncGuardProfileAttachments(opts.Profiles, opts.Connections),
		Events:  usecases.NewListGuardEvents(opts.Events),
	}, a, opts.IngestToken)
	return a
}

func (a *App) Service() *Service { return a.svc }

func (a *App) Register(api huma.API) {
	a.endpoints.Register(api)
}

func (a *App) Handler() http.Handler {
	r := chi.NewMux()
	a.Register(humachi.New(r, huma.DefaultConfig("Mantis Guard API", "1.0.0")))
	return r
}

func (a *App) EvaluateCommand(ctx context.Context, profileIDs []string, connectionID, command string) (bool, string, string) {
	r := a.svc.EvaluateCommand(ctx, profileIDs, connectionID, command)
	return r.Allowed, r.Rule, r.Message
}

func (a *App) EvaluateHost(ctx context.Context, profileIDs []string, connectionID, target string) (bool, string) {
	r := a.svc.EvaluateHost(ctx, profileIDs, connectionID, target)
	return r.Allowed, r.Reason
}

func (a *App) Describe(ctx context.Context, profileIDs []string) string {
	return a.svc.Describe(ctx, profileIDs)
}

func (a *App) RecordHostEvent(ctx context.Context, ev types.GuardEvent) error {
	return a.svc.RecordHostEvent(ctx, ev)
}

func (a *App) RecentBlockedHosts(ctx context.Context, connectionID string, since time.Time, limit int) []protocols.HostBlock {
	return a.svc.RecentBlockedHosts(ctx, connectionID, since, limit)
}

func (a *App) ResolveConnectionBySandbox(ctx context.Context, sandbox string) (string, []string) {
	if a.connections == nil || sandbox == "" {
		return "", nil
	}
	conns, err := a.connections.List(ctx, types.ListQuery{})
	if err != nil {
		return "", nil
	}
	for _, c := range conns {
		stripped := strings.TrimPrefix(c.Name, a.connectionPrefix)
		if stripped == sandbox || c.Name == sandbox {
			return c.ID, append([]string{}, c.ProfileIDs...)
		}
	}
	return "", nil
}

package api

import (
	"context"
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	usecases "mantis/apps/guard/use_cases"
	"mantis/core/base"
	"mantis/core/types"
)

type ProfileService interface {
	EvaluateCommand(ctx context.Context, profileIDs []string, connectionID, command string) (allowed bool, rule, message string)
	EvaluateHost(ctx context.Context, profileIDs []string, connectionID, target string) (allowed bool, reason string)
	RecordHostEvent(ctx context.Context, ev types.GuardEvent) error
	ResolveConnectionBySandbox(ctx context.Context, sandbox string) (id string, profileIDs []string)
}

type UseCases struct {
	Create   *usecases.CreateGuardProfile
	List     *usecases.ListGuardProfiles
	Update   *usecases.UpdateGuardProfile
	Delete   *usecases.DeleteGuardProfile
	Test     *usecases.TestGuardProfile
	SyncAtt  *usecases.SyncGuardProfileAttachments
	Events   *usecases.ListGuardEvents
}

type Endpoints struct {
	uc          UseCases
	svc         ProfileService
	ingestToken string
}

func NewEndpoints(uc UseCases, svc ProfileService, ingestToken string) *Endpoints {
	return &Endpoints{uc: uc, svc: svc, ingestToken: ingestToken}
}

func (e *Endpoints) Register(api huma.API) {
	huma.Register(api, huma.Operation{OperationID: "create-guard-profile", Method: http.MethodPost, Path: "/api/guard-profiles", DefaultStatus: 201}, e.create)
	huma.Register(api, huma.Operation{OperationID: "list-guard-profiles", Method: http.MethodGet, Path: "/api/guard-profiles"}, e.list)
	huma.Register(api, huma.Operation{OperationID: "update-guard-profile", Method: http.MethodPut, Path: "/api/guard-profiles/{id}"}, e.update)
	huma.Register(api, huma.Operation{OperationID: "delete-guard-profile", Method: http.MethodDelete, Path: "/api/guard-profiles/{id}", DefaultStatus: 204}, e.delete)
	huma.Register(api, huma.Operation{OperationID: "test-guard-profile", Method: http.MethodPost, Path: "/api/guard-profiles/test"}, e.test)
	huma.Register(api, huma.Operation{OperationID: "sync-guard-profile-attachments", Method: http.MethodPut, Path: "/api/guard-profiles/{id}/attachments"}, e.syncAttachments)
	huma.Register(api, huma.Operation{OperationID: "list-guard-events", Method: http.MethodGet, Path: "/api/guard/events"}, e.listEvents)
	huma.Register(api, huma.Operation{OperationID: "ingest-guard-host-event", Method: http.MethodPost, Path: "/api/guard/events/ingest", DefaultStatus: 202}, e.ingestHostEvent)
}

func (e *Endpoints) create(ctx context.Context, in *CreateGuardProfileInput) (*GuardProfileOutput, error) {
	p, err := e.uc.Create.Execute(ctx, in.Body.Name, in.Body.Description, in.Body.Capabilities, types.CommandsMode(in.Body.CommandsMode), in.Body.Commands, in.Body.Egress)
	if err != nil {
		return nil, mapErr(err)
	}
	return &GuardProfileOutput{Body: p}, nil
}

func (e *Endpoints) list(ctx context.Context, _ *struct{}) (*GuardProfilesOutput, error) {
	items, err := e.uc.List.Execute(ctx)
	if err != nil {
		return nil, mapErr(err)
	}
	return &GuardProfilesOutput{Body: items}, nil
}

func (e *Endpoints) update(ctx context.Context, in *UpdateGuardProfileInput) (*GuardProfileOutput, error) {
	p, err := e.uc.Update.Execute(ctx, in.ID, in.Body.Name, in.Body.Description, in.Body.Capabilities, types.CommandsMode(in.Body.CommandsMode), in.Body.Commands, in.Body.Egress)
	if err != nil {
		return nil, mapErr(err)
	}
	return &GuardProfileOutput{Body: p}, nil
}

func (e *Endpoints) delete(ctx context.Context, in *GuardProfileIDInput) (*struct{}, error) {
	if err := e.uc.Delete.Execute(ctx, in.ID); err != nil {
		return nil, mapErr(err)
	}
	return nil, nil
}

func (e *Endpoints) test(_ context.Context, in *TestGuardProfileInput) (*GuardProfileTestOutput, error) {
	out := &GuardProfileTestOutput{}
	switch in.Body.Kind {
	case "command":
		r := e.uc.Test.Command(in.Body.Profile, in.Body.Target)
		out.Body.Allowed = r.Allowed
		out.Body.Rule = r.Rule
		out.Body.Message = r.Message
	case "host":
		r := e.uc.Test.Host(in.Body.Profile, in.Body.Target)
		out.Body.Allowed = r.Allowed
		out.Body.Reason = r.Reason
	default:
		return nil, huma.NewError(http.StatusBadRequest, "kind must be 'command' or 'host'")
	}
	return out, nil
}

func (e *Endpoints) syncAttachments(ctx context.Context, in *SyncGuardProfileAttachmentsInput) (*GuardProfileAttachmentsOutput, error) {
	conns, err := e.uc.SyncAtt.Execute(ctx, in.ID, in.Body.ConnectionIDs)
	if err != nil {
		return nil, mapErr(err)
	}
	return &GuardProfileAttachmentsOutput{Body: conns}, nil
}

func (e *Endpoints) listEvents(ctx context.Context, in *ListGuardEventsInput) (*GuardEventsOutput, error) {
	filter := usecases.ListGuardEventsFilter{
		Kind:         types.GuardEventKind(in.Kind),
		ProfileID:    in.ProfileID,
		ConnectionID: in.ConnectionID,
		Limit:        in.Limit,
	}
	switch in.Allowed {
	case "true":
		v := true
		filter.Allowed = &v
	case "false":
		v := false
		filter.Allowed = &v
	}
	items, err := e.uc.Events.Execute(ctx, filter)
	if err != nil {
		return nil, mapErr(err)
	}
	return &GuardEventsOutput{Body: items}, nil
}

func (e *Endpoints) ingestHostEvent(ctx context.Context, in *IngestGuardHostEventInput) (*IngestGuardHostEventOutput, error) {
	if e.ingestToken != "" && in.Authorization != e.ingestToken {
		return nil, huma.NewError(http.StatusUnauthorized, "invalid ingest token")
	}
	connectionID := in.Body.ConnectionID
	profileIDs := in.Body.ProfileIDs
	if connectionID == "" && in.Body.Sandbox != "" && e.svc != nil {
		id, ids := e.svc.ResolveConnectionBySandbox(ctx, in.Body.Sandbox)
		connectionID = id
		if len(profileIDs) == 0 {
			profileIDs = ids
		}
	}
	if profileIDs == nil {
		profileIDs = []string{}
	}
	at := in.Body.At
	if at.IsZero() {
		at = nowFunc()
	}
	ev := types.GuardEvent{
		Kind:         types.GuardEventHost,
		Target:       in.Body.Target,
		Allowed:      in.Body.Allowed,
		Rule:         in.Body.Reason,
		ProfileIDs:   profileIDs,
		ConnectionID: connectionID,
		CreatedAt:    at,
	}
	if err := e.svc.RecordHostEvent(ctx, ev); err != nil {
		return nil, huma.NewError(http.StatusInternalServerError, err.Error())
	}
	return &IngestGuardHostEventOutput{Body: struct {
		Recorded bool `json:"recorded"`
	}{Recorded: true}}, nil
}

func mapErr(err error) error {
	switch {
	case errors.Is(err, base.ErrNotFound):
		return huma.NewError(http.StatusNotFound, err.Error())
	case errors.Is(err, base.ErrValidation):
		return huma.NewError(http.StatusUnprocessableEntity, err.Error())
	default:
		return huma.NewError(http.StatusInternalServerError, err.Error())
	}
}

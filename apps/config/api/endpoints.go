package api

import (
	"context"
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	usecases "mantis/apps/config/use_cases"
	"mantis/core/base"
)

type UseCases struct {
	GetConfig    *usecases.GetConfig
	UpdateConfig *usecases.UpdateConfig
	ApplyConfig  *usecases.ApplyConfig
	ResetConfig  *usecases.ResetConfig
}

type Endpoints struct {
	uc UseCases
}

func NewEndpoints(uc UseCases) *Endpoints {
	return &Endpoints{uc: uc}
}

func (e *Endpoints) Register(api huma.API) {
	huma.Register(api, huma.Operation{OperationID: "get-config", Method: http.MethodGet, Path: "/api/config"}, e.getConfig)
	huma.Register(api, huma.Operation{OperationID: "update-config", Method: http.MethodPut, Path: "/api/config"}, e.updateConfig)
	huma.Register(api, huma.Operation{OperationID: "apply-config", Method: http.MethodPost, Path: "/api/config/apply"}, e.applyConfig)
	huma.Register(api, huma.Operation{OperationID: "reset-config", Method: http.MethodPost, Path: "/api/config/reset"}, e.resetConfig)
}

func (e *Endpoints) getConfig(ctx context.Context, _ *struct{}) (*ConfigOutput, error) {
	cfg, err := e.uc.GetConfig.Execute(ctx)
	if err != nil {
		return nil, mapErr(err)
	}
	return toConfigOutput(cfg), nil
}

func (e *Endpoints) updateConfig(ctx context.Context, input *UpdateConfigInput) (*ConfigOutput, error) {
	cfg, err := e.uc.UpdateConfig.Execute(ctx, draftFromUpdateInput(input))
	if err != nil {
		return nil, mapErr(err)
	}
	return toConfigOutput(cfg), nil
}

func (e *Endpoints) applyConfig(ctx context.Context, _ *struct{}) (*ApplyOutput, error) {
	if err := e.uc.ApplyConfig.Execute(ctx); err != nil {
		return nil, mapErr(err)
	}
	out := &ApplyOutput{}
	out.Body.OK = true
	return out, nil
}

func (e *Endpoints) resetConfig(ctx context.Context, _ *struct{}) (*ConfigOutput, error) {
	cfg, err := e.uc.ResetConfig.Execute(ctx)
	if err != nil {
		return nil, mapErr(err)
	}
	return toConfigOutput(cfg), nil
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

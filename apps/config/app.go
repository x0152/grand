package config

import (
	"github.com/danielgtaylor/huma/v2"

	"mantis/apps/config/api"
	usecases "mantis/apps/config/use_cases"
	"mantis/core/protocols"
	"mantis/core/types"
)

type App struct {
	endpoints *api.Endpoints
}

type Stores struct {
	AppConfig protocols.Store[string, types.AppConfig]
	LlmConn   protocols.Store[string, types.LlmConnection]
	Model     protocols.Store[string, types.Model]
	Preset    protocols.Store[string, types.Preset]
	Settings  protocols.Store[string, types.Settings]
	Channel   protocols.Store[string, types.Channel]
	Conn      protocols.Store[string, types.Connection]
	Skill     protocols.Store[string, types.Skill]
	Plan      protocols.Store[string, types.Plan]
}

func NewApp(stores Stores, env usecases.EnvSnapshot) *App {
	resolver := usecases.NewResolver(env)
	return &App{
		endpoints: api.NewEndpoints(api.UseCases{
			GetConfig:    usecases.NewGetConfig(stores.AppConfig, resolver),
			UpdateConfig: usecases.NewUpdateConfig(stores.AppConfig, resolver),
			ApplyConfig: usecases.NewApplyConfig(stores.AppConfig, resolver, usecases.ApplyDeps{
				LlmConnStore:  stores.LlmConn,
				ModelStore:    stores.Model,
				PresetStore:   stores.Preset,
				SettingsStore: stores.Settings,
				ChannelStore:  stores.Channel,
				ConnStore:     stores.Conn,
				SkillStore:    stores.Skill,
				PlanStore:     stores.Plan,
			}),
			ResetConfig: usecases.NewResetConfig(stores.AppConfig, resolver),
		}),
	}
}

func (a *App) Register(api huma.API) {
	a.endpoints.Register(api)
}

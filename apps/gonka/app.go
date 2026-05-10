package gonka

import (
	"github.com/danielgtaylor/huma/v2"

	"mantis/apps/gonka/api"
	"mantis/apps/gonka/inferenced"
	usecases "mantis/apps/gonka/use_cases"
)

const MinBalanceGNK = "0.1"

type Options struct {
	BinaryPath         string
	DefaultNodeURL     string
	PinEndpointEnabled bool
	PinBalanceNodeURL  string
}

type App struct {
	endpoints *api.Endpoints
	runner    *inferenced.Runner
}

func NewApp(opts Options) *App {
	runner := inferenced.NewRunner(opts.BinaryPath)
	return &App{
		runner: runner,
		endpoints: api.NewEndpoints(api.UseCases{
			CreateWallet:  usecases.NewCreateWallet(runner),
			ImportWallet:  usecases.NewImportWallet(runner),
			DeriveAddress: usecases.NewDeriveAddress(),
			GetBalance: usecases.NewGetBalance(usecases.GetBalanceOptions{
				PinEndpointEnabled: opts.PinEndpointEnabled,
				PinNodeURL:         opts.PinBalanceNodeURL,
			}),
			GetAccount: usecases.NewGetAccount(),
			GetConfig: usecases.NewGetConfig(runner, usecases.GetConfigOptions{
				DefaultNodeURL: opts.DefaultNodeURL,
				MinBalanceGNK:  MinBalanceGNK,
			}),
		}),
	}
}

func (a *App) Register(api huma.API) {
	a.endpoints.Register(api)
}

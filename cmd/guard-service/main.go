package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"

	guardapp "mantis/apps/guard"
	"mantis/core/types"
	egressadapter "mantis/infrastructure/adapters/egress"
	"mantis/infrastructure/adapters/store"
	"mantis/infrastructure/mappers"
	"mantis/infrastructure/models"
	"mantis/shared/httplog"
)

func main() {
	dsn := envOr("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/mantis?sslmode=disable")
	port := envOr("PORT", "8082")

	sqldb := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn)))
	db := bun.NewDB(sqldb, pgdialect.New())
	defer db.Close()

	profileStore := store.NewPostgres[string, types.GuardProfile, models.GuardProfileRow](
		db,
		func(p types.GuardProfile) string { return p.ID },
		mappers.GuardProfileToRow,
		mappers.GuardProfileFromRow,
	)
	eventStore := store.NewPostgres[string, types.GuardEvent, models.GuardEventRow](
		db,
		func(e types.GuardEvent) string { return e.ID },
		mappers.GuardEventToRow,
		mappers.GuardEventFromRow,
	)
	connStore := store.NewPostgres[string, types.Connection, models.ConnectionRow](
		db,
		func(c types.Connection) string { return c.ID },
		mappers.ConnectionToRow,
		mappers.ConnectionFromRow,
	)

	app := guardapp.NewApp(guardapp.Options{
		Profiles:    profileStore,
		Events:      eventStore,
		Connections: connStore,
		Reloader:    egressadapter.NewHTTPReloader(envOr("EGRESS_GATEWAY_URL", "")),
		IngestToken: os.Getenv("GUARD_INGEST_TOKEN"),
	})

	r := chi.NewMux()
	r.Use(httplog.Middleware)
	api := humachi.New(r, huma.DefaultConfig("Mantis Guard API", "1.0.0"))
	app.Register(api)

	log.Printf("guard-service: listening on :%s", port)
	log.Printf("guard-service: docs http://localhost:%s/docs", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", port), r))
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

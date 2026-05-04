-- +goose Up

CREATE TABLE app_config (
    id   TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO app_config (id, data) VALUES ('default', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- +goose Down

DROP TABLE app_config;

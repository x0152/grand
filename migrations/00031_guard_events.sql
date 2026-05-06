-- +goose Up

CREATE TABLE guard_events (
    id            UUID PRIMARY KEY,
    kind          TEXT NOT NULL,
    target        TEXT NOT NULL,
    allowed       BOOLEAN NOT NULL,
    rule          TEXT NOT NULL DEFAULT '',
    message       TEXT NOT NULL DEFAULT '',
    profile_ids   TEXT[] NOT NULL DEFAULT '{}',
    connection_id TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX guard_events_recent_idx
    ON guard_events (created_at DESC);

CREATE INDEX guard_events_kind_allowed_idx
    ON guard_events (kind, allowed, created_at DESC);

CREATE INDEX guard_events_connection_idx
    ON guard_events (connection_id, created_at DESC);

-- +goose Down

DROP TABLE guard_events;

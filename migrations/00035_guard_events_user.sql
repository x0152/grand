-- +goose Up

ALTER TABLE guard_events
    ADD COLUMN user_id TEXT NOT NULL DEFAULT '';

CREATE INDEX guard_events_user_idx
    ON guard_events (user_id, created_at DESC);

CREATE INDEX guard_events_conn_kind_allowed_recent_idx
    ON guard_events (connection_id, kind, allowed, created_at DESC);

-- +goose Down

DROP INDEX IF EXISTS guard_events_conn_kind_allowed_recent_idx;
DROP INDEX IF EXISTS guard_events_user_idx;

ALTER TABLE guard_events
    DROP COLUMN user_id;

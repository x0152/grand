-- +goose Up

ALTER TABLE guard_profiles
    ADD COLUMN commands_mode TEXT NOT NULL DEFAULT 'whitelist';

-- +goose Down

ALTER TABLE guard_profiles DROP COLUMN commands_mode;

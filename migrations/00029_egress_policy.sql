-- +goose Up

ALTER TABLE guard_profiles
    ADD COLUMN egress JSONB NOT NULL DEFAULT '{"mode":"open","hosts":[],"cidrs":[]}';

-- +goose Down

ALTER TABLE guard_profiles DROP COLUMN egress;

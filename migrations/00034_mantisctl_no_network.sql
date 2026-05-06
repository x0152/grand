-- +goose Up

-- mantisctl talks to the Mantis API on the internal docker network and
-- doesn't need open internet. Lock it down to closed egress to limit blast
-- radius if anything goes sideways inside the runtime sandbox.

UPDATE guard_profiles
SET
  capabilities = capabilities || '{"networkOut":false,"download":false}'::jsonb,
  egress = '{"mode":"closed","hosts":[],"cidrs":[]}'::jsonb,
  description = 'Runtime controller. Lets the agent build Docker images and run new sandboxes through mantisctl. No outbound internet.'
WHERE id = 'mantisctl' AND builtin = true;

-- +goose Down

UPDATE guard_profiles
SET
  capabilities = capabilities || '{"networkOut":true,"download":false}'::jsonb,
  egress = '{"mode":"open","hosts":[],"cidrs":[]}'::jsonb,
  description = 'Runtime controller. Lets the agent build Docker images and run new sandboxes through mantisctl (a thin curl/jq wrapper around Mantis /api/runtime).'
WHERE id = 'mantisctl' AND builtin = true;

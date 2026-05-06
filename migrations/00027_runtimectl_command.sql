-- +goose Up

UPDATE guard_profiles
SET
  description = 'Runtime controller. Lets the agent build Docker images and run new sandboxes through runtimectl (a thin curl/jq wrapper around the runtime API; docker-style commands: ps, status, logs, up, down, restart, inspect). `up` is async by default and returns ACCEPTED <name>; use `status`/`logs` to track progress, or `up --wait` to stream synchronously. Shell tools are limited to writing Dockerfiles, driving runtimectl, and grepping its output.',
  commands = '[
    {"command":"runtimectl"},
    {"command":"ssh"},{"command":"scp"},
    {"command":"curl"},{"command":"wget"},
    {"command":"jq"},{"command":"yq"},
    {"command":"cat"},{"command":"ls"},{"command":"head"},{"command":"tail"},
    {"command":"grep"},{"command":"find"},{"command":"wc"},{"command":"file"},
    {"command":"awk"},{"command":"sed"},{"command":"sort"},{"command":"uniq"},{"command":"cut"},{"command":"tr"},
    {"command":"mkdir"},{"command":"cp"},{"command":"mv"},{"command":"rm"},{"command":"touch"},
    {"command":"echo"},{"command":"printf"},{"command":"tee"},{"command":"xargs"},
    {"command":"timeout"},
    {"command":"less"},{"command":"more"}
  ]'::jsonb
WHERE id = 'runtimectl';

-- +goose Down

UPDATE guard_profiles
SET
  description = 'Runtime controller. Lets the agent build Docker images and run new sandboxes through mantisctl (a thin curl/jq wrapper around Mantis /api/runtime). Shell tools are limited to writing Dockerfiles, driving mantisctl, and grepping its output.',
  commands = '[
    {"command":"mantisctl"},
    {"command":"ssh"},{"command":"scp"},
    {"command":"curl"},{"command":"wget"},
    {"command":"jq"},{"command":"yq"},
    {"command":"cat"},{"command":"ls"},{"command":"head"},{"command":"tail"},
    {"command":"grep"},{"command":"find"},{"command":"wc"},{"command":"file"},
    {"command":"awk"},{"command":"sed"},{"command":"sort"},{"command":"uniq"},{"command":"cut"},{"command":"tr"},
    {"command":"mkdir"},{"command":"cp"},{"command":"mv"},{"command":"rm"},{"command":"touch"},
    {"command":"echo"},{"command":"printf"},{"command":"tee"},{"command":"xargs"},
    {"command":"timeout"},
    {"command":"less"},{"command":"more"}
  ]'::jsonb
WHERE id = 'runtimectl';

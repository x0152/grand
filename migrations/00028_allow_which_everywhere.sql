-- +goose Up

-- The default SSH agent prompt explicitly tells the model to verify with
-- `which`, but `which` was never on the allowed-command list of any builtin
-- profile, so every probe came back [BLOCKED]. Add it everywhere so the
-- guard layer stops fighting its own instructions.

UPDATE guard_profiles
SET commands = commands || '[{"command":"which"}]'::jsonb
WHERE builtin = true
  AND id <> 'unrestricted'
  AND NOT (commands @> '[{"command":"which"}]'::jsonb);

-- +goose Down

UPDATE guard_profiles
SET commands = (
  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
  FROM jsonb_array_elements(commands) elem
  WHERE elem->>'command' <> 'which'
)
WHERE builtin = true
  AND id <> 'unrestricted';

-- +goose Up

-- Built-in profiles that expose SQL clients (psql, mysql, sqlite3) must
-- block destructive top-level DDL by default. Without these blocks,
-- whitelisted clients accept DROP TABLE / DROP DATABASE / DROP SCHEMA
-- because they only check the command name, not the SQL payload.

-- +goose StatementBegin
DO $$
DECLARE
  blocks JSONB := '["DROP TABLE","DROP DATABASE","DROP SCHEMA"]'::jsonb;
  sql_clients TEXT[] := ARRAY['psql','mysql','sqlite3'];
BEGIN
  UPDATE guard_profiles AS gp
  SET commands = (
    SELECT jsonb_agg(
      CASE
        WHEN cmd->>'command' = ANY (sql_clients)
          THEN cmd || jsonb_build_object('blockedSql', blocks)
        ELSE cmd
      END
    )
    FROM jsonb_array_elements(gp.commands) cmd
  )
  WHERE builtin = true
    AND id <> 'unrestricted';
END $$;
-- +goose StatementEnd

-- +goose Down

-- +goose StatementBegin
DO $$
BEGIN
  UPDATE guard_profiles AS gp
  SET commands = (
    SELECT jsonb_agg(cmd - 'blockedSql')
    FROM jsonb_array_elements(gp.commands) cmd
  )
  WHERE builtin = true
    AND id <> 'unrestricted';
END $$;
-- +goose StatementEnd

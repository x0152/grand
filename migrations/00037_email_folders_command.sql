-- +goose Up
-- Adds the `email-folders` helper to the email sandbox guard whitelist.
-- The migration in 00036 was already applied on most local DBs without it,
-- so we re-emit the same row (UPSERT) to pick up the new command + any
-- other tweaks. Safe to re-run.

INSERT INTO guard_profiles
  (id, name, description, builtin, capabilities, commands_mode, commands, egress)
VALUES
('email', 'Email Sandbox',
 'Mailbox sandbox — IMAP read/search and SMTP send via the credentials saved in the wizard.',
 true,
 '{"pipes":true,"redirects":true,"cmdSubst":true,"background":false,"sudo":false,"codeExec":false,"download":false,"install":false,"writeFs":true,"networkOut":true,"cron":false,"unrestricted":false}',
 'whitelist',
 '[
   {"command":"email-status"},{"command":"email-folders"},
   {"command":"email-list"},{"command":"email-search"},
   {"command":"email-read"},{"command":"email-send"},
   {"command":"email-mark"},{"command":"email-move"},
   {"command":"email-folder-create"},{"command":"email-folder-rename"},
   {"command":"email-folder-delete"},
   {"command":"python3"},{"command":"jq"},
   {"command":"ls"},{"command":"cat"},{"command":"head"},{"command":"tail"},{"command":"grep"},
   {"command":"find"},{"command":"wc"},{"command":"file"},{"command":"stat"},
   {"command":"sort"},{"command":"uniq"},{"command":"awk"},{"command":"sed"},{"command":"cut"},{"command":"tr"},
   {"command":"echo"},{"command":"printf"},{"command":"tee"},{"command":"xargs"},
   {"command":"which"}
 ]',
 '{"mode":"open","hosts":[],"cidrs":[]}'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  capabilities = EXCLUDED.capabilities,
  commands_mode = EXCLUDED.commands_mode,
  commands = EXCLUDED.commands,
  egress = EXCLUDED.egress;

-- +goose Down

-- Revert to the pre-folders whitelist.
UPDATE guard_profiles SET commands = '[
   {"command":"email-status"},{"command":"email-list"},{"command":"email-search"},
   {"command":"email-read"},{"command":"email-send"},
   {"command":"python3"},{"command":"jq"},
   {"command":"ls"},{"command":"cat"},{"command":"head"},{"command":"tail"},{"command":"grep"},
   {"command":"find"},{"command":"wc"},{"command":"file"},{"command":"stat"},
   {"command":"sort"},{"command":"uniq"},{"command":"awk"},{"command":"sed"},{"command":"cut"},{"command":"tr"},
   {"command":"echo"},{"command":"printf"},{"command":"tee"},{"command":"xargs"},
   {"command":"which"}
 ]'::jsonb
WHERE id = 'email';

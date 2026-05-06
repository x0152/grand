-- +goose Up

-- Single source of truth for built-in guard profiles. Wipes every builtin
-- and reinserts a clean, intended set:
--   * networkOut + egress=open for every profile except `media`
--   * `media` (ffmpeg/imagemagick) has no network — closed egress
--   * blockedSql on psql/mysql/sqlite3 prevents DROP TABLE/DATABASE/SCHEMA
--   * commands_mode=whitelist for everyone (whitelist is conservative and
--     matches how the existing migrations have always behaved)
--   * `unrestricted` keeps its bypass-everything semantics

DELETE FROM guard_profiles WHERE builtin = true;

INSERT INTO guard_profiles
  (id, name, description, builtin, capabilities, commands_mode, commands, egress)
VALUES
('base', 'Base Sandbox',
 'Alpine Linux + Python 3.12 + DB clients — shell, files, networking, data analysis, database queries',
 true,
 '{"pipes":true,"redirects":true,"cmdSubst":true,"background":true,"sudo":false,"codeExec":true,"download":true,"install":true,"writeFs":true,"networkOut":true,"cron":false,"unrestricted":false}',
 'whitelist',
 '[
   {"command":"ls"},{"command":"cat"},{"command":"head"},{"command":"tail"},{"command":"find"},
   {"command":"grep"},{"command":"wc"},{"command":"cp"},{"command":"mv"},{"command":"rm"},
   {"command":"mkdir"},{"command":"chmod"},{"command":"chown"},{"command":"tar"},{"command":"gzip"},
   {"command":"unzip"},{"command":"xz"},{"command":"du"},{"command":"df"},{"command":"file"},
   {"command":"tree"},{"command":"stat"},{"command":"ln"},{"command":"touch"},{"command":"awk"},
   {"command":"sed"},{"command":"sort"},{"command":"uniq"},{"command":"cut"},{"command":"tr"},
   {"command":"jq"},{"command":"xargs"},{"command":"echo"},{"command":"printf"},{"command":"tee"},
   {"command":"ps"},{"command":"top"},{"command":"htop"},{"command":"uname"},{"command":"free"},
   {"command":"uptime"},{"command":"env"},{"command":"printenv"},{"command":"which"},
   {"command":"curl"},{"command":"wget"},{"command":"git"},{"command":"ssh"},{"command":"scp"},
   {"command":"rsync"},{"command":"ping"},{"command":"traceroute"},{"command":"ip"},{"command":"ss"},
   {"command":"dig"},{"command":"host"},{"command":"nslookup"},{"command":"whois"},
   {"command":"python3"},{"command":"ipython"},{"command":"pip"},{"command":"pip3"},
   {"command":"psql","blockedSql":["DROP TABLE","DROP DATABASE","DROP SCHEMA"]},
   {"command":"pg_dump"},{"command":"pg_restore"},{"command":"pg_isready"},
   {"command":"mysql","blockedSql":["DROP TABLE","DROP DATABASE","DROP SCHEMA"]},
   {"command":"mysqldump"},{"command":"redis-cli"},
   {"command":"sqlite3","blockedSql":["DROP TABLE","DROP DATABASE","DROP SCHEMA"]},
   {"command":"apk"}
 ]',
 '{"mode":"open","hosts":[],"cidrs":[]}'
),

('browser', 'Browser Sandbox',
 'Chromium + Playwright + Jina — web search, reading, screenshots, OCR, ASR',
 true,
 '{"pipes":true,"redirects":true,"cmdSubst":true,"background":false,"sudo":false,"codeExec":true,"download":true,"install":true,"writeFs":true,"networkOut":true,"cron":false,"unrestricted":false}',
 'whitelist',
 '[
   {"command":"web-search"},{"command":"jina-read"},{"command":"pw-screenshot"},
   {"command":"node"},{"command":"npx"},{"command":"npm"},
   {"command":"curl"},{"command":"wget"},{"command":"jq"},
   {"command":"ls"},{"command":"cat"},{"command":"head"},{"command":"tail"},{"command":"grep"},
   {"command":"find"},{"command":"mkdir"},{"command":"cp"},{"command":"mv"},{"command":"rm"},
   {"command":"echo"},{"command":"printf"},{"command":"wc"},{"command":"file"},{"command":"stat"},
   {"command":"which"}
 ]',
 '{"mode":"open","hosts":[],"cidrs":[]}'
),

('media', 'Media Sandbox',
 'FFmpeg + MediaInfo + ImageMagick — local-only video, audio, image processing. No outbound network.',
 true,
 '{"pipes":true,"redirects":true,"cmdSubst":true,"background":false,"sudo":false,"codeExec":false,"download":false,"install":false,"writeFs":true,"networkOut":false,"cron":false,"unrestricted":false}',
 'whitelist',
 '[
   {"command":"ffmpeg"},{"command":"ffprobe"},{"command":"mediainfo"},
   {"command":"convert"},{"command":"mogrify"},{"command":"identify"},
   {"command":"ls"},{"command":"cat"},{"command":"head"},{"command":"tail"},{"command":"grep"},
   {"command":"find"},{"command":"mkdir"},{"command":"cp"},{"command":"mv"},{"command":"rm"},
   {"command":"echo"},{"command":"printf"},{"command":"du"},{"command":"df"},
   {"command":"file"},{"command":"stat"},{"command":"wc"},{"command":"which"}
 ]',
 '{"mode":"closed","hosts":[],"cidrs":[]}'
),

('python', 'Python Sandbox',
 'Python 3.12 + numpy, pandas, matplotlib, scikit-learn, requests, beautifulsoup4',
 true,
 '{"pipes":true,"redirects":true,"cmdSubst":true,"background":false,"sudo":false,"codeExec":true,"download":true,"install":true,"writeFs":true,"networkOut":true,"cron":false,"unrestricted":false}',
 'whitelist',
 '[
   {"command":"python3"},{"command":"ipython"},{"command":"pip"},{"command":"pip3"},
   {"command":"ls"},{"command":"cat"},{"command":"head"},{"command":"tail"},{"command":"grep"},
   {"command":"find"},{"command":"mkdir"},{"command":"cp"},{"command":"mv"},{"command":"rm"},
   {"command":"echo"},{"command":"printf"},{"command":"curl"},{"command":"wget"},
   {"command":"wc"},{"command":"file"},{"command":"stat"},{"command":"which"}
 ]',
 '{"mode":"open","hosts":[],"cidrs":[]}'
),

('database', 'Database Sandbox',
 'PostgreSQL, MySQL, Redis, SQLite clients + jq. DROP TABLE/DATABASE/SCHEMA blocked.',
 true,
 '{"pipes":true,"redirects":true,"cmdSubst":false,"background":false,"sudo":false,"codeExec":false,"download":false,"install":false,"writeFs":true,"networkOut":true,"cron":false,"unrestricted":false}',
 'whitelist',
 '[
   {"command":"psql","blockedSql":["DROP TABLE","DROP DATABASE","DROP SCHEMA"]},
   {"command":"pg_dump"},{"command":"pg_restore"},{"command":"pg_isready"},
   {"command":"mysql","blockedSql":["DROP TABLE","DROP DATABASE","DROP SCHEMA"]},
   {"command":"mysqldump"},{"command":"redis-cli"},
   {"command":"sqlite3","blockedSql":["DROP TABLE","DROP DATABASE","DROP SCHEMA"]},
   {"command":"jq"},{"command":"curl"},
   {"command":"ls"},{"command":"cat"},{"command":"head"},{"command":"tail"},{"command":"grep"},
   {"command":"find"},{"command":"echo"},{"command":"printf"},{"command":"wc"},{"command":"which"}
 ]',
 '{"mode":"open","hosts":[],"cidrs":[]}'
),

('netsec', 'Netsec Sandbox',
 'Pentest/netsec toolkit — nmap, dig, whois, curl, openssl, nikto, sqlmap, ffuf, gobuster, whatweb, hashcat, john + net-* wrappers with hard timeouts. Use ONLY on targets you have explicit permission to test.',
 true,
 '{"pipes":true,"redirects":true,"cmdSubst":true,"background":false,"sudo":false,"codeExec":false,"download":true,"install":false,"writeFs":true,"networkOut":true,"cron":false,"unrestricted":false}',
 'whitelist',
 '[
   {"command":"net-port"},{"command":"net-http"},{"command":"net-headers"},{"command":"net-tls"},
   {"command":"net-dns"},{"command":"net-whois"},{"command":"net-dir"},{"command":"net-subs"},
   {"command":"net-whatweb"},{"command":"net-vuln"},{"command":"net-hash-id"},{"command":"net-hash-crack"},
   {"command":"net-banner"},{"command":"net-ping"},
   {"command":"nmap"},{"command":"dig"},{"command":"host"},{"command":"nslookup"},{"command":"whois"},
   {"command":"curl"},{"command":"wget"},{"command":"nc"},{"command":"ncat"},
   {"command":"openssl"},{"command":"testssl"},
   {"command":"nikto"},{"command":"sqlmap"},
   {"command":"ffuf"},{"command":"gobuster"},{"command":"dirb"},{"command":"wfuzz"},
   {"command":"whatweb"},{"command":"dnsrecon"},
   {"command":"hashcat"},{"command":"john"},{"command":"hashid"},
   {"command":"ping"},{"command":"traceroute"},{"command":"mtr"},
   {"command":"jq"},{"command":"timeout"},{"command":"which"},
   {"command":"ls"},{"command":"cat"},{"command":"head"},{"command":"tail"},{"command":"grep"},
   {"command":"find"},{"command":"wc"},{"command":"file"},{"command":"stat"},
   {"command":"sort"},{"command":"uniq"},{"command":"awk"},{"command":"sed"},{"command":"cut"},{"command":"tr"},
   {"command":"cp"},{"command":"mv"},{"command":"rm"},{"command":"mkdir"},{"command":"touch"},
   {"command":"echo"},{"command":"printf"},{"command":"tee"},{"command":"xargs"}
 ]',
 '{"mode":"open","hosts":[],"cidrs":[]}'
),

('mantisctl', 'Mantisctl Sandbox',
 'Runtime controller. Lets the agent build Docker images and run new sandboxes through mantisctl (a thin curl/jq wrapper around Mantis /api/runtime).',
 true,
 '{"pipes":true,"redirects":true,"cmdSubst":true,"background":false,"sudo":false,"codeExec":false,"download":false,"install":false,"writeFs":true,"networkOut":true,"cron":false,"unrestricted":false}',
 'whitelist',
 '[
   {"command":"mantisctl"},
   {"command":"ssh"},{"command":"scp"},
   {"command":"curl"},{"command":"wget"},
   {"command":"jq"},{"command":"yq"},
   {"command":"cat"},{"command":"ls"},{"command":"head"},{"command":"tail"},
   {"command":"grep"},{"command":"find"},{"command":"wc"},{"command":"file"},{"command":"which"},
   {"command":"awk"},{"command":"sed"},{"command":"sort"},{"command":"uniq"},{"command":"cut"},{"command":"tr"},
   {"command":"mkdir"},{"command":"cp"},{"command":"mv"},{"command":"rm"},{"command":"touch"},
   {"command":"echo"},{"command":"printf"},{"command":"tee"},{"command":"xargs"},
   {"command":"timeout"},
   {"command":"less"},{"command":"more"}
 ]',
 '{"mode":"open","hosts":[],"cidrs":[]}'
),

('unrestricted', 'Unrestricted',
 'No restrictions — all commands and capabilities, network reaches anywhere.',
 true,
 '{"pipes":true,"redirects":true,"cmdSubst":true,"background":true,"sudo":true,"codeExec":true,"download":true,"install":true,"writeFs":true,"networkOut":true,"cron":true,"unrestricted":true}',
 'open',
 '[]',
 '{"mode":"open","hosts":[],"cidrs":[]}'
);

-- +goose Down

-- Reverting this is destructive (built-in user customizations are gone).
-- Goose down only restores ids; commands/capabilities will diverge from
-- whatever the user last touched. Caveat emptor.
DELETE FROM guard_profiles WHERE builtin = true;

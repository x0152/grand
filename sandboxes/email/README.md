# Email Sandbox

Send mail (SMTP) and read/search any IMAP mailbox using credentials configured
in the wizard. The sandbox is **provider-agnostic** — Gmail, Yandex, Mail.ru,
Outlook, FastMail, custom servers all work as long as you give it SMTP+IMAP
hosts. SSL vs STARTTLS is auto-selected based on the port (`465`/`993` →
implicit TLS, `587`/`143`/`25` → STARTTLS).

> **Why custom Python scripts and not himalaya/notmuch/mu?**
> The agent only ever needs one-shot CLI commands driven by env vars; ready
> tools require persistent TOML/Maildir state and would each pull in a heavy
> stack (Rust toolchain or Maildir sync). Custom scripts use only
> `imap-tools` + Python stdlib, are <1000 lines total, easy to audit and
> fully under our control: every command speaks the same flag set, the same
> error format and a clean `--json` mode.

## Workflow

1. **Always start with `email-status`** — confirms credentials and prints
   how aliases (Inbox/Sent/Spam/Trash/Drafts) map to the actual folder
   names on the user's provider (e.g. `Sent → "Отправленные"` on Mail.ru).
2. If the folder you need isn't a standard alias (rare — most providers'
   special folders are auto-discovered), run `email-folders` to see every
   folder this account exposes with their SPECIAL-USE flags and counts.
3. Then list / search / read / send.

Errors that involve folders **always include the available list** so you
never have to guess twice.

## Configuration

All credentials come from environment variables that the host injects from
the saved configuration. To change them, open Setup → Re-run wizard → Email.

| Var | Purpose |
|---|---|
| `SANDBOX_EMAIL_ADDRESS` | Primary mailbox address (default username for SMTP/IMAP). |
| `SANDBOX_EMAIL_DISPLAY_NAME` | Optional display name used in the `From` header. |
| `SANDBOX_EMAIL_SMTP_HOST` | SMTP hostname (e.g. `smtp.gmail.com`). |
| `SANDBOX_EMAIL_SMTP_PORT` | SMTP port (`465` implicit TLS, `587` STARTTLS). |
| `SANDBOX_EMAIL_SMTP_USER` | SMTP username (defaults to `ADDRESS`). |
| `SANDBOX_EMAIL_SMTP_PASS` | SMTP password / app password. |
| `SANDBOX_EMAIL_IMAP_HOST` | IMAP hostname (e.g. `imap.gmail.com`). |
| `SANDBOX_EMAIL_IMAP_PORT` | IMAP port (`993` implicit TLS, `143` STARTTLS). |
| `SANDBOX_EMAIL_IMAP_USER` | IMAP username (defaults to `ADDRESS`). |
| `SANDBOX_EMAIL_IMAP_PASS` | IMAP password / app password. |
| `SANDBOX_EMAIL_SAVE_SENT` | `0`/`false` to skip auto-saving sent mail to IMAP `Sent`. Default: on. |
| `SANDBOX_EMAIL_SENT_FOLDER` | Override the IMAP "Sent" folder name. |
| `SANDBOX_EMAIL_DRAFTS_FOLDER` | Override drafts folder. |
| `SANDBOX_EMAIL_TRASH_FOLDER` | Override trash folder. |
| `SANDBOX_EMAIL_SPAM_FOLDER` | Override spam/junk folder. |
| `SANDBOX_EMAIL_TIMEOUT` | Network timeout in seconds (default `30`). |

If the user skipped the Email step the sandbox still launches — every helper
prints a friendly *"not configured — open Setup → Re-run wizard"* hint
instead of failing silently.

## Commands

Every command supports `--json` for JSON-Lines / single-object output;
the default is the same human-friendly tab-separated `key=value` rows that
were there before.

| Command | Description |
|---|---|
| `email-status [--json]` | Show config (address, hosts), probe SMTP/IMAP and list resolved special folders + every folder on the server. **Run this first.** |
| `email-folders [--no-counts] [--json]` | List every IMAP folder with SPECIAL-USE flags and message/unseen counts. The universal way to find non-standard folder names. |
| `email-list [--folder F] [--limit 20] [--since YYYY-MM-DD] [--before YYYY-MM-DD] [--unseen \| --seen] [--flagged] [--json]` | List messages: `uid`, `flags`, `date`, `from`, `to`, `subject`. Folder accepts aliases (`Inbox`/`Sent`/`Spam`/`Junk`/`Trash`/`Drafts`/`Archive`). |
| `email-search --from X --to Y --subject S --text T --since YYYY-MM-DD --before YYYY-MM-DD [--unseen \| --seen] [--flagged] [--folder F] [--limit N] [--json]` | Search a folder. All criteria optional and AND-combined. Non-ASCII queries automatically use IMAP `CHARSET UTF-8`. |
| `email-read --uid UID [--folder F] [--with-body] [--prefer-html] [--raw] [--save-attachments DIR] [--json]` | Read one message: full headers + Message-ID + flags + attachment list. `--with-body` shows the text body (HTML is auto-rendered to text; `--prefer-html` keeps raw HTML; `--raw` dumps full RFC822). UID must be a positive integer. |
| `email-send [--to A] [--cc B] [--bcc C] [--subject S] [--body \| --body-file F \| stdin] [--html-file F] [--attach FILE]... [--from-name N] [--in-reply-to MSG_ID \| --reply-to-uid UID [--reply-folder F]] [--no-save-sent] [--json]` | Send a new message or reply. With `--reply-to-uid` the `--to` and `--subject` are inherited from the source. After SMTP delivery the message is also IMAP-APPENDed to the resolved Sent folder so you can find it later. |
| `email-mark --uid N [--uid M ...] [--folder F] [--seen \| --unseen] [--flagged \| --unflagged] [--json]` | Toggle `\Seen` / `\Flagged` on one or more messages in batch. |
| `email-move --uid N [--uid M ...] [--folder SRC] --to-folder DST [--json]` | Move messages between folders. Uses IMAP `MOVE` when supported, falls back to `COPY+DELETE+EXPUNGE` otherwise. UIDs may change after the move. |
| `email-folder-create --name N [--subscribe] [--json]` | Create a new folder ("label" on Gmail). Idempotent — if the folder already exists this is a no-op. Validates the name (no IMAP wildcards / control chars). |
| `email-folder-rename --from A --to B [--json]` | Rename a folder. Refuses to rename special-use folders (INBOX, Sent, Spam, Trash, Drafts, Archive). |
| `email-folder-delete --name N [--yes-i-know] [--json]` | Delete a folder. Refuses INBOX and any special-use folder. Requires `--yes-i-know` if the folder still contains messages. |

### Folder aliases

You don't have to know the exact (often-localised) folder names. The
following aliases are auto-translated to whatever the server actually uses:

| Alias | Resolves to |
|---|---|
| `Inbox` | `INBOX` |
| `Sent`, `Outbox`, `Sent Items`, `Отправленные`, `[Gmail]/Sent Mail` | first folder with the `\Sent` flag, or any of those names |
| `Spam`, `Junk`, `Bulk`, `Спам` | first folder with the `\Junk` or `\Spam` flag |
| `Trash`, `Bin`, `Deleted`, `Корзина` | `\Trash` |
| `Drafts`, `Черновики` | `\Drafts` |
| `Archive`, `Архив`, `All`, `[Gmail]/All Mail` | `\Archive` / `\All` |

If your provider doesn't expose SPECIAL-USE flags and the alias isn't in the
table, run `email-folders`, then either pass the literal folder name to
`--folder` or set the matching `SANDBOX_EMAIL_*_FOLDER` env override.

## Examples

```bash
# 1. Verify everything works and see folder mapping for this provider.
email-status

# 2. List recent unseen messages in the inbox.
email-list --unseen --limit 10

# 3. Same, JSON output for piping into jq.
email-list --json --limit 5 | jq '{uid, from, subject}'

# 4. Search Cyrillic content (auto-uses CHARSET UTF-8).
email-search --text "доставлено" --since 2026-01-01

# 5. Read the spam folder regardless of how your provider names it.
email-list --folder Spam --limit 20
email-read --uid 999 --folder Spam --with-body

# 6. Read a message + save its attachments.
email-read --uid 12345 --with-body --save-attachments ./att

# 7. Send a multi-recipient message with a file attachment.
email-send --to "alice@x.com, bob@y.org" --cc carol@z.io \
           --subject "Status report" \
           --body "see attached" \
           --attach /tmp/report.pdf

# 8. Reply to UID 102671 in INBOX (subject becomes "Re: …" automatically,
#    In-Reply-To/References headers wired to the original Message-ID).
email-send --reply-to-uid 102671 --body "ack"

# 9. Sort messages by sender into custom folders (the "group emails by
#    folder" workflow). The agent typically does:
email-folder-create --name Receipts
for uid in $(email-search --from "billing@stripe.com" --json | jq -r .uid); do
    email-move --uid "$uid" --to-folder Receipts
done

# 10. Flag a message and mark as read in one go.
email-mark --uid 12345 --seen --flagged
```

## Security

* TLS always uses `ssl.create_default_context()` — server certs are verified.
* Credentials live in `/etc/sandbox/secrets/email/credentials.env` (mode
  0600, owned by group `emailsec`). The agent's `sandbox` user is **not**
  a member of `emailsec` — every helper is invoked through a sudoers stub
  that elevates to `emailsec` only for the explicitly-allowed binaries.
* IMAP SEARCH never builds raw IMAP commands from user input; everything
  goes through `imap_tools`'s parameterised builders.
* `--uid` is always validated as a positive integer before being plugged
  into IMAP commands — no injection through `UID 1 OR …`.
* `--save-attachments` writes only into the directory you pass and uses
  `basename` so a malicious filename can't escape it.
* `--attach`, `--body-file`, `--html-file` paths are realpath'd and
  rejected if they resolve into `/etc/sandbox/secrets`, `/etc/sudoers*`,
  or `/etc/shadow` — so the agent cannot smuggle credentials out as an
  attachment.
* All commands exit non-zero on failure and print a one-line error to
  stderr — safe to use in pipelines.

## Output format

Default (human / pipeline-friendly):

```
uid=102671  flags=U  date=2026-05-10 17:53  from=alice@x.com  to=bob@y.org  subject=Hello
```

`flags` is `U` for unseen, blank for seen — easy to filter with
`awk -F'\t' '$2 ~ /U/'`.

JSON Lines (`--json`):

```
{"uid":"102671","folder":"INBOX","date":"2026-05-10T17:53:00+03:00","from":"alice@x.com","to":["bob@y.org"],"cc":[],"subject":"Hello","flags":[],"seen":false,"size":2048,"message_id":"<…>"}
```

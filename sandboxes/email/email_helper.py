"""Helper module shared by every email-* CLI in this sandbox.

Goals:
* Universal — works against any provider (Gmail, Yandex, Mail.ru, Outlook,
  custom IMAP/SMTP servers) using only credentials injected by the wizard.
* Safe — TLS is verified, passwords are never echoed, IMAP SEARCH runs with
  UTF-8 charset so non-ASCII queries can't crash, attachments are written
  only into directories the caller passes explicitly.
* Reliable — many SMTP servers (mail.ru, Yandex, custom) do NOT auto-save
  outbound mail to the IMAP "Sent" folder; we IMAP APPEND it ourselves so
  the user actually sees their sent mail.
* Sandboxed — credentials live in a root/emailsec-only file. The agent's
  shell user (`sandbox`) cannot read them via `env`, `cat`, /proc, or by
  smuggling them out via --attach/--body-file because every user-supplied
  path is realpath()'d and rejected if it lands inside the secrets tree.
"""

import json
import os
import re
import smtplib
import ssl
import sys
import time
from contextlib import contextmanager
from email.message import EmailMessage
from email.utils import formataddr, getaddresses, make_msgid, parseaddr
from html.parser import HTMLParser

# Where the docker init script writes credentials at container boot.
# Mode 0600, owned by `emailsec` group; the agent's `sandbox` user is NOT
# in that group so it cannot open this file directly.
CREDENTIALS_FILE = "/etc/sandbox/secrets/email/credentials.env"

# Paths the agent must never be able to read/write through user-supplied args.
# Anything resolving (realpath) into one of these is refused.
PROTECTED_PATH_PREFIXES = (
    "/etc/sandbox/secrets",
    "/etc/sudoers",
    "/etc/sudoers.d",
    "/etc/shadow",
)

try:
    from imap_tools import MailBox, AND
    try:
        from imap_tools import MailBoxStartTls as MailBoxTls
    except ImportError:
        from imap_tools import MailBoxTls
except ImportError:  # pragma: no cover — sandbox is built with the dep installed.
    MailBox = None
    MailBoxTls = None
    AND = None

NOT_CONFIGURED_HINT = (
    "Email is not configured. Open Setup → Re-run wizard → Email step to add "
    "SMTP/IMAP credentials, or set SANDBOX_EMAIL_* environment variables."
)

DISCOVER_HINT = (
    "Run `email-status` to see resolved special folders, or `email-folders` "
    "to list every folder this account exposes — never guess folder names."
)


class FolderNotFound(RuntimeError):
    """Raised when the requested folder cannot be resolved on the server.

    The error message includes the full list of folders the server actually
    exposes, so the agent can self-correct in one round-trip instead of
    blindly retrying with another guess.
    """

    def __init__(self, requested, available):
        self.requested = requested
        self.available = list(available or ())
        if self.available:
            avail = ", ".join(self.available)
            msg = (
                f'folder "{requested}" not found. '
                f"Available folders: {avail}. {DISCOVER_HINT}"
            )
        else:
            msg = f'folder "{requested}" not found. {DISCOVER_HINT}'
        super().__init__(msg)


_UID_RE = re.compile(r"^[0-9]+$")

# IMAP folder names: refuse control bytes, IMAP wildcards (* %) and quotes,
# anything ridiculously long. We deliberately allow non-ASCII so users can
# create localized labels ("Чеки", "支出", etc.) — the server speaks UTF-7
# (RFC 3501) or UTF-8 (RFC 6855) and `imap-tools` handles the encoding.
_FORBIDDEN_FOLDER_CHARS = set("\r\n\0\t\"*%")
_MAX_FOLDER_NAME_LEN = 255

# Special-use folders that destructive ops must NEVER touch — they are the
# user's mailbox skeleton and the server itself relies on them. We block
# both the canonical English names and any folder the server tags with the
# corresponding SPECIAL-USE flag.
PROTECTED_ALIASES = ("inbox", "sent", "spam", "trash", "drafts", "archive")


def validate_uid(uid):
    """Reject anything that is not a positive integer.

    UIDs are always integers in IMAP. Letting an arbitrary string through
    would let a malicious agent construct an `UID 1 OR …` injection against
    the IMAP SEARCH/FETCH command. We refuse anything that isn't pure digits.
    """
    s = str(uid or "").strip()
    if not s or not _UID_RE.match(s):
        raise ValueError(
            f"invalid uid {uid!r}: must be a positive integer (e.g. 12345)"
        )
    return s


def validate_uid_list(uids):
    """Validate every UID in a list (e.g. for batch --uid options)."""
    if not uids:
        raise ValueError("no UIDs supplied (use --uid <N> at least once)")
    return [validate_uid(u) for u in uids]


def validate_folder_name(name):
    """Validate a user-supplied folder name for create/rename operations.

    We do not, however, block names that *resolve* to a protected folder —
    that is the caller's job (see `assert_not_protected`). This function
    only catches obviously malformed names that would corrupt IMAP wire
    protocol or trick the server.
    """
    if name is None:
        raise ValueError("folder name is required")
    if not isinstance(name, str):
        raise ValueError(f"folder name must be a string, got {type(name).__name__}")
    s = name.strip()
    if not s:
        raise ValueError("folder name cannot be empty or whitespace")
    if len(s) > _MAX_FOLDER_NAME_LEN:
        raise ValueError(f"folder name too long (>{_MAX_FOLDER_NAME_LEN} chars)")
    bad = sorted(set(s) & _FORBIDDEN_FOLDER_CHARS)
    if bad:
        rendered = ", ".join(repr(c) for c in bad)
        raise ValueError(
            f"folder name contains forbidden characters: {rendered}. "
            "IMAP wildcards (* %), quotes, control bytes are not allowed."
        )
    return s


def assert_not_protected(box, name, *, op):
    """Refuse a destructive op against a special-use / system folder.

    `op` is a short word for the error message ("delete", "rename"). We
    check both the literal name and what the requested name would resolve
    to via aliases / SPECIAL-USE flags, so an agent can't sneak past by
    asking to delete "Sent" / "Отправленные" / `[Gmail]/Sent Mail`.
    """
    requested = (name or "").strip()
    if not requested:
        raise ValueError("folder name is required")
    norm = _normalize_folder(requested)
    if norm == "inbox":
        raise PermissionError(f"refusing to {op} INBOX")
    folders = list_folders(box)
    if folders:
        for alias in PROTECTED_ALIASES:
            try:
                resolved = find_folder(box, alias)
            except Exception:
                continue
            if (resolved == requested or
                    _normalize_folder(resolved) == norm):
                raise PermissionError(
                    f"refusing to {op} special-use folder "
                    f"{requested!r} (it is the resolved {alias.upper()} folder). "
                    "Use SANDBOX_EMAIL_*_FOLDER env override if you really must."
                )
        for f in folders:
            if f.name == requested or _normalize_folder(f.name) == norm:
                flags = {str(v).lower() for v in (f.flags or ())}
                # Any of these flags marks the folder as a system one.
                for protected_flag in (
                    "\\inbox", "\\sent", "\\drafts", "\\junk", "\\spam",
                    "\\trash", "\\archive", "\\all", "\\important",
                ):
                    if protected_flag in flags:
                        raise PermissionError(
                            f"refusing to {op} folder {f.name!r}: it carries "
                            f"the {protected_flag} SPECIAL-USE flag and is "
                            "managed by the server."
                        )
                break

# IMAP SPECIAL-USE attributes (RFC 6154). All servers worth using support these
# and we rely on them as the primary way to discover localised folder names.
SPECIAL_FOLDER_FLAGS = {
    "inbox": "\\inbox",
    "sent": "\\sent",
    "drafts": "\\drafts",
    "spam": "\\junk",  # RFC says \Junk; many providers also expose \Spam.
    "trash": "\\trash",
    "archive": "\\archive",
    "all": "\\all",
    "important": "\\important",
    "flagged": "\\flagged",
}

# Provider-specific aliases that show up when SPECIAL-USE is missing.
SPECIAL_FOLDER_ALIASES = {
    "inbox": {"inbox", "входящие"},
    "sent": {
        "sent", "sent items", "sent mail", "sent messages", "sentbox", "outbox",
        "[gmail]/sent mail", "[google mail]/sent mail",
        "исходящие", "отправленные", "отправл",
    },
    "drafts": {
        "drafts", "draft", "[gmail]/drafts", "[google mail]/drafts",
        "черновики",
    },
    "spam": {
        "spam", "junk", "junk e-mail", "junk email", "bulk", "bulk mail",
        "[gmail]/spam", "[google mail]/spam",
        "спам",
    },
    "trash": {
        "trash", "bin", "deleted", "deleted items", "deleted messages",
        "[gmail]/trash", "[google mail]/trash",
        "корзина", "удалённые", "удаленные",
    },
    "archive": {"archive", "archives", "архив"},
    "all": {"all", "all mail", "[gmail]/all mail", "[google mail]/all mail"},
}

# Aliases for the spam alias key (so 'junk' also resolves to spam).
for k, v in list(SPECIAL_FOLDER_ALIASES.items()):
    v.add(k)

_FALSY = {"0", "false", "no", "off", "disable", "disabled"}

_credentials_loaded = False


def _load_credentials_file(path=CREDENTIALS_FILE):
    """Read KEY=VALUE lines from the secrets file into os.environ.

    The file is written at container boot (see apps/runtime/templates init
    script) with mode 0600 and group `emailsec`. We can read it only when
    the email-runner stub elevated us via sudo to the emailsec user. If the
    file doesn't exist or we can't read it (PermissionError), we silently
    fall back to whatever env vars are present — that path is taken in
    local dev / unit tests.
    """
    global _credentials_loaded
    if _credentials_loaded:
        return
    _credentials_loaded = True
    if not path or not os.path.isfile(path):
        return
    try:
        with open(path, encoding="utf-8") as fh:
            for raw in fh:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                if not key.startswith("SANDBOX_EMAIL_"):
                    continue
                value = value.strip()
                if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                    value = value[1:-1]
                # File wins over env so that an agent who manages to set
                # SANDBOX_EMAIL_SMTP_HOST=evil.com in their shell still
                # cannot redirect outbound mail.
                os.environ[key] = value
    except PermissionError:
        return  # not allowed to read it — running as the wrong user
    except OSError:
        return


def _env(key, default=""):
    return os.environ.get(key, "").strip() or default


def assert_safe_path(path, *, must_exist=False):
    """Reject paths that resolve into the secrets tree (or other protected
    spots). Use this for every user-supplied --attach / --body-file /
    --html-file / --save-attachments argument so a malicious agent cannot
    smuggle the credentials file out as an attachment, follow a symlink
    into /etc, or overwrite the credentials.

    Note: realpath() resolves all symlinks, so symlink-hop attacks are
    foiled even if the agent created the symlink themselves.
    """
    if not path:
        return
    real = os.path.realpath(path)
    for prefix in PROTECTED_PATH_PREFIXES:
        if real == prefix or real.startswith(prefix + os.sep):
            raise PermissionError(
                f"refusing to access protected path {path!r} (resolves to {real!r})"
            )
    if must_exist and not os.path.exists(real):
        raise FileNotFoundError(path)


def _env_bool(key, default=True):
    raw = os.environ.get(key, "").strip().lower()
    if not raw:
        return default
    return raw not in _FALSY


def _normalize_folder(name):
    if not name:
        return ""
    return " ".join(name.strip().lower().replace("_", " ").replace("-", " ").split())


def _folder_alias_key(name):
    normalized = _normalize_folder(name)
    if not normalized:
        return ""
    for key, aliases in SPECIAL_FOLDER_ALIASES.items():
        if normalized in aliases:
            return key
    return ""


class Config:
    def __init__(self):
        _load_credentials_file()
        self.address = _env("SANDBOX_EMAIL_ADDRESS")
        self.display_name = _env("SANDBOX_EMAIL_DISPLAY_NAME")

        self.smtp_host = _env("SANDBOX_EMAIL_SMTP_HOST")
        self.smtp_port = _env("SANDBOX_EMAIL_SMTP_PORT")
        self.smtp_user = _env("SANDBOX_EMAIL_SMTP_USER", self.address)
        self.smtp_pass = _env("SANDBOX_EMAIL_SMTP_PASS")

        self.imap_host = _env("SANDBOX_EMAIL_IMAP_HOST")
        self.imap_port = _env("SANDBOX_EMAIL_IMAP_PORT")
        self.imap_user = _env("SANDBOX_EMAIL_IMAP_USER", self.address)
        self.imap_pass = _env("SANDBOX_EMAIL_IMAP_PASS")

        self.save_sent = _env_bool("SANDBOX_EMAIL_SAVE_SENT", True)
        self.sent_folder_override = _env("SANDBOX_EMAIL_SENT_FOLDER")
        self.drafts_folder_override = _env("SANDBOX_EMAIL_DRAFTS_FOLDER")
        self.trash_folder_override = _env("SANDBOX_EMAIL_TRASH_FOLDER")
        self.spam_folder_override = _env("SANDBOX_EMAIL_SPAM_FOLDER")
        self.timeout = int(_env("SANDBOX_EMAIL_TIMEOUT", "30"))

    def smtp_ready(self):
        return all([self.smtp_host, self.smtp_user, self.smtp_pass])

    def imap_ready(self):
        return all([self.imap_host, self.imap_user, self.imap_pass])

    def smtp_port_int(self):
        return int(self.smtp_port) if self.smtp_port else 587

    def imap_port_int(self):
        return int(self.imap_port) if self.imap_port else 993

    def from_header(self):
        addr = self.address or self.smtp_user
        if self.display_name:
            return formataddr((self.display_name, addr))
        return addr


def load_config():
    return Config()


def require_smtp(cfg):
    if not cfg.smtp_ready():
        print(NOT_CONFIGURED_HINT)
        return False
    return True


def require_imap(cfg):
    if not cfg.imap_ready():
        print(NOT_CONFIGURED_HINT)
        return False
    return True


# ---------------------------------------------------------------------------
# Folder discovery
# ---------------------------------------------------------------------------

def list_folders(box):
    try:
        return list(box.folder.list())
    except Exception:
        return []


def available_folder_names(box):
    return [f.name for f in list_folders(box)]


def find_folder(box, requested, *, alias_override="", strict=False):
    """Resolve a user-supplied folder name to an existing IMAP folder name.

    Resolution order:
      1. Exact name match
      2. Case-insensitive normalized match
      3. SPECIAL-USE flag (\\Sent, \\Junk, etc.) when the requested name
         is a known alias (Sent, Spam, Trash, Drafts, Archive, All, ...)
      4. Provider alias table (e.g. "Sent" -> "Отправленные", "[Gmail]/Sent Mail")
      5. Caller-supplied env override (e.g. SANDBOX_EMAIL_SENT_FOLDER)
      6. If strict=True: raise FolderNotFound with the full server-side list
         so the caller (and ultimately the LLM) sees what's actually there.
         If strict=False: fall back to the requested string verbatim.
    """
    target = (requested or "").strip() or "INBOX"
    folders = list_folders(box)
    if not folders:
        return target

    names = [f.name for f in folders]
    if target in names:
        return target

    target_norm = _normalize_folder(target)
    for f in folders:
        if _normalize_folder(f.name) == target_norm:
            return f.name

    alias_key = alias_override or _folder_alias_key(target)
    if alias_key:
        flag = SPECIAL_FOLDER_FLAGS.get(alias_key, "").lower()
        if flag:
            for f in folders:
                flags = [str(v).lower() for v in (f.flags or ())]
                if flag in flags:
                    return f.name
            # Some servers tag spam with \Spam instead of \Junk; handle it.
            if alias_key == "spam":
                for f in folders:
                    flags = [str(v).lower() for v in (f.flags or ())]
                    if "\\spam" in flags:
                        return f.name
        for f in folders:
            if _folder_alias_key(f.name) == alias_key:
                return f.name

    if strict:
        raise FolderNotFound(requested, names)
    return target


def resolve_folder_name(box, requested):  # back-compat wrapper
    return find_folder(box, requested)


def set_folder(box, requested):
    """Resolve `requested` and SELECT it on the server.

    Always validates the folder exists first (strict resolution) so the
    caller gets a single, actionable error with the full folder list
    instead of an IMAP "no such mailbox" wall of bytes.
    """
    chosen = find_folder(box, requested, strict=True)
    try:
        box.folder.set(chosen)
        return chosen
    except Exception as e:
        names = available_folder_names(box)
        raise FolderNotFound(requested, names) from e


def find_sent_folder(box, cfg):
    if cfg.sent_folder_override:
        return find_folder(box, cfg.sent_folder_override, alias_override="sent")
    return find_folder(box, "Sent", alias_override="sent")


# ---------------------------------------------------------------------------
# Output helpers (TSV by default, JSON Lines when --json is passed)
# ---------------------------------------------------------------------------

def message_record(m, *, folder=""):
    """Convert an imap_tools Message into a stable JSON-friendly dict."""
    flags = list(m.flags or ())
    return {
        "uid": m.uid,
        "folder": folder,
        "date": m.date.isoformat() if m.date else None,
        "from": m.from_ or "",
        "to": list(m.to or []),
        "cc": list(m.cc or []),
        "subject": (m.subject or ""),
        "flags": flags,
        "seen": "\\Seen" in flags,
        "size": getattr(m, "size", None),
        "message_id": (m.headers.get("message-id", [None])[0]
                       if getattr(m, "headers", None) else None),
    }


def _flatten(value, max_len=None):
    s = str(value or "").replace("\n", " ").replace("\t", " ")
    if max_len:
        return s[:max_len]
    return s


def print_message_row_tsv(m, *, folder=""):
    """Single tab-separated KEY=VALUE row, matching the historic format."""
    date = m.date.strftime("%Y-%m-%d %H:%M") if m.date else "—"
    subj = _flatten(m.subject, 80)
    frm = _flatten(m.from_, 48)
    to = _flatten(", ".join(m.to or []), 72)
    marker = " " if "\\Seen" in (m.flags or ()) else "U"
    print(f"uid={m.uid}\tflags={marker}\tdate={date}\tfrom={frm}"
          f"\tto={to}\tsubject={subj}")


def print_messages(messages, *, folder="", as_json=False, empty_hint=""):
    """Pretty-print a list of messages in either TSV or JSONL form."""
    if not messages:
        if as_json:
            return
        if empty_hint:
            print(empty_hint)
        return
    if as_json:
        for m in messages:
            print(json.dumps(message_record(m, folder=folder),
                              ensure_ascii=False))
    else:
        for m in messages:
            print_message_row_tsv(m, folder=folder)


def print_kv(pairs, *, as_json=False):
    """Print either `key: value` (human) or a single JSON object."""
    if as_json:
        print(json.dumps(dict(pairs), ensure_ascii=False))
        return
    width = max((len(k) for k, _ in pairs), default=0)
    for k, v in pairs:
        print(f"{k.ljust(width)}  {v}")


def die(prog, exc, *, exit_code=1):
    """Print a one-line error to stderr and return the exit code.

    Used by every script's top-level try/except so the wrapper looks the
    same everywhere and the LLM has a single error format to grep.
    """
    print(f"{prog}: {exc}", file=sys.stderr)
    return exit_code


# ---------------------------------------------------------------------------
# Connections
# ---------------------------------------------------------------------------

@contextmanager
def open_smtp(cfg):
    if not require_smtp(cfg):
        raise RuntimeError("email_not_configured")
    port = cfg.smtp_port_int()
    ctx = ssl.create_default_context()
    if port == 465:
        client = smtplib.SMTP_SSL(cfg.smtp_host, port, context=ctx, timeout=cfg.timeout)
    else:
        client = smtplib.SMTP(cfg.smtp_host, port, timeout=cfg.timeout)
        client.ehlo()
        try:
            client.starttls(context=ctx)
            client.ehlo()
        except smtplib.SMTPNotSupportedError:
            # Plain SMTP — caller still has to authenticate, the server should
            # at least support PLAIN or LOGIN. Don't raise pre-emptively.
            pass
    try:
        client.login(cfg.smtp_user, cfg.smtp_pass)
        yield client
    finally:
        try:
            client.quit()
        except Exception:
            pass


@contextmanager
def open_imap(cfg):
    if not require_imap(cfg):
        raise RuntimeError("email_not_configured")
    if MailBox is None:
        raise RuntimeError("imap-tools is missing — rebuild this sandbox.")
    port = cfg.imap_port_int()
    if port == 143:
        box = MailBoxTls(cfg.imap_host, port=port, timeout=cfg.timeout)
    else:
        box = MailBox(cfg.imap_host, port=port, timeout=cfg.timeout)
    box.login(cfg.imap_user, cfg.imap_pass)
    try:
        yield box
    finally:
        try:
            box.logout()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def imap_criteria(args):
    """Build an imap_tools criteria object from common CLI args.

    Returns a tuple (criteria, charset) where charset is "UTF-8" if any of
    the criteria contain non-ASCII characters and the empty string otherwise
    (some servers reject CHARSET on pure-ASCII queries).
    """
    crits = []
    needs_utf8 = False

    def _maybe_utf8(value):
        nonlocal needs_utf8
        if value and any(ord(c) > 127 for c in value):
            needs_utf8 = True

    if getattr(args, "from_addr", None):
        _maybe_utf8(args.from_addr)
        crits.append(AND(from_=args.from_addr))
    if getattr(args, "to_addr", None):
        _maybe_utf8(args.to_addr)
        crits.append(AND(to=args.to_addr))
    if getattr(args, "subject", None):
        _maybe_utf8(args.subject)
        crits.append(AND(subject=args.subject))
    if getattr(args, "since", None):
        if not _DATE_RE.match(args.since):
            raise ValueError(f"--since expects YYYY-MM-DD, got {args.since!r}")
        from datetime import date
        y, m, d = args.since.split("-")
        crits.append(AND(date_gte=date(int(y), int(m), int(d))))
    if getattr(args, "before", None):
        if not _DATE_RE.match(args.before):
            raise ValueError(f"--before expects YYYY-MM-DD, got {args.before!r}")
        from datetime import date
        y, m, d = args.before.split("-")
        crits.append(AND(date_lt=date(int(y), int(m), int(d))))
    if getattr(args, "text", None):
        _maybe_utf8(args.text)
        crits.append(AND(text=args.text))
    if getattr(args, "unseen", False):
        crits.append(AND(seen=False))
    if getattr(args, "seen", False):
        crits.append(AND(seen=True))
    if getattr(args, "flagged", False):
        crits.append(AND(flagged=True))

    if not crits:
        crit = "ALL"
    elif len(crits) == 1:
        crit = crits[0]
    else:
        crit = AND(*crits)

    return crit, ("UTF-8" if needs_utf8 else "")


def fetch_messages(box, crit, *, charset="", limit=20, headers_only=True):
    """Wrapper around box.fetch that retries without CHARSET if the server
    rejects the option (some IMAP servers don't honour SEARCH CHARSET on
    pure-ASCII text). Always uses mark_seen=False.
    """
    kwargs = dict(limit=limit, reverse=True, mark_seen=False, headers_only=headers_only)
    if charset:
        try:
            return list(box.fetch(crit, charset=charset, **kwargs))
        except Exception:
            # Some servers refuse CHARSET when the criteria are ASCII; fall back.
            return list(box.fetch(crit, **kwargs))
    return list(box.fetch(crit, **kwargs))


# ---------------------------------------------------------------------------
# Send / append
# ---------------------------------------------------------------------------

def parse_address_list(raw):
    if not raw:
        return []
    addrs = [a for _, a in getaddresses([raw]) if a]
    return addrs


def build_message(cfg, *, to, subject, body, cc=None, bcc=None,
                  in_reply_to=None, references=None, html_body=None,
                  attachments=(), from_name=None):
    msg = EmailMessage()

    if from_name:
        msg["From"] = formataddr((from_name, cfg.address or cfg.smtp_user))
    else:
        msg["From"] = cfg.from_header()

    to_list = parse_address_list(to)
    cc_list = parse_address_list(cc) if cc else []
    bcc_list = parse_address_list(bcc) if bcc else []
    if not to_list:
        raise ValueError("--to is required and must contain at least one address")

    msg["To"] = ", ".join(to_list)
    if cc_list:
        msg["Cc"] = ", ".join(cc_list)
    # NB: BCC is intentionally NOT added as a header (it'd leak recipients).
    msg["Subject"] = subject or ""
    msg["Date"] = _rfc2822_date()
    msg["Message-ID"] = make_msgid(domain=_message_id_domain(cfg))
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
        msg["References"] = (references + " " if references else "") + in_reply_to

    msg.set_content(body or "")
    if html_body:
        msg.add_alternative(html_body, subtype="html")

    for path in attachments or ():
        _attach_file(msg, path)

    msg._mantis_envelope = {
        "from": cfg.address or cfg.smtp_user,
        "to": to_list,
        "cc": cc_list,
        "bcc": bcc_list,
        "all": to_list + cc_list + bcc_list,
    }
    return msg


def _attach_file(msg, path):
    import mimetypes
    assert_safe_path(path)
    if not os.path.isfile(path):
        raise FileNotFoundError(f"attachment not found: {path}")
    ctype, encoding = mimetypes.guess_type(path)
    if ctype is None or encoding is not None:
        ctype = "application/octet-stream"
    maintype, subtype = ctype.split("/", 1)
    with open(path, "rb") as fh:
        data = fh.read()
    msg.add_attachment(data, maintype=maintype, subtype=subtype,
                        filename=os.path.basename(path))


def _rfc2822_date():
    from email.utils import formatdate
    return formatdate(localtime=True)


def _message_id_domain(cfg):
    addr = cfg.address or cfg.smtp_user or ""
    if "@" in addr:
        return addr.split("@", 1)[1]
    return None


def smtp_send(cfg, msg):
    """Send an EmailMessage and return the list of recipients delivered to."""
    envelope = getattr(msg, "_mantis_envelope", None) or {}
    recipients = envelope.get("all") or parse_address_list(msg["To"]) or []
    if not recipients:
        raise ValueError("no recipients to send to")
    with open_smtp(cfg) as client:
        # send_message respects To/Cc but skips Bcc; we pass to_addrs explicitly
        # so BCC actually gets the mail without leaking the header.
        client.send_message(msg, from_addr=cfg.address or cfg.smtp_user,
                             to_addrs=recipients)
    return recipients


def append_to_sent(cfg, msg, *, attempts=2):
    """Append a sent message into the IMAP Sent folder so the user can see it.

    Many providers (Mail.ru, Yandex, Outlook in some configs, custom servers)
    do not auto-save SMTP traffic to the IMAP "Sent" folder. We do it
    ourselves; failures are non-fatal — the email was already sent.
    Returns (folder_name, ok, detail).
    """
    if not cfg.imap_ready():
        return ("", False, "imap not configured")
    raw = msg.as_bytes()
    last_err = None
    for attempt in range(attempts):
        try:
            with open_imap(cfg) as box:
                folder = find_sent_folder(box, cfg)
                # imap-tools >=1.8 supports box.append(msg, folder, ...)
                box.append(raw, folder, dt=None, flag_set=("\\Seen",))
                return (folder, True, "saved")
        except Exception as e:
            last_err = e
            time.sleep(0.5 * (attempt + 1))
    return ("", False, f"append failed: {last_err}")


# ---------------------------------------------------------------------------
# Body extraction (for email-read)
# ---------------------------------------------------------------------------

class _HTMLToText(HTMLParser):
    BLOCK_TAGS = {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6"}
    SKIP_TAGS = {"style", "script", "head"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP_TAGS:
            self.skip_depth += 1
        if tag in self.BLOCK_TAGS:
            self.parts.append("\n")
        elif tag == "a":
            for k, v in attrs:
                if k == "href" and v:
                    self.parts.append(" ")

    def handle_endtag(self, tag):
        if tag in self.SKIP_TAGS and self.skip_depth > 0:
            self.skip_depth -= 1
        if tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data):
        if self.skip_depth:
            return
        self.parts.append(data)

    def text(self):
        out = "".join(self.parts)
        out = re.sub(r"[ \t\f\v]+", " ", out)
        out = re.sub(r"\n{3,}", "\n\n", out)
        return out.strip()


def html_to_text(html):
    if not html:
        return ""
    parser = _HTMLToText()
    try:
        parser.feed(html)
        parser.close()
    except Exception:
        return html
    return parser.text()


def extract_body(msg, prefer_html=False):
    """Return (body_text, kind) where kind ∈ {'text', 'html→text', 'html', ''}."""
    text = (msg.text or "").strip() if hasattr(msg, "text") else ""
    html = (msg.html or "").strip() if hasattr(msg, "html") else ""
    if prefer_html and html:
        return html, "html"
    if text:
        return text, "text"
    if html:
        return html_to_text(html), "html→text"
    return "", ""

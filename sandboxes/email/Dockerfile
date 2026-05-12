FROM python:3.12-alpine

# `sudo` lets us run the python helpers as a separate `emailsec` user that
# (alone) can read the credentials file. Everything the agent does runs
# as `sandbox`, which has no path to that file: not via cat, not via env,
# not via /proc — only via the explicitly-allowed sudo wrapper commands.
RUN apk add --no-cache \
        bash openssh-server openssh-client ca-certificates \
        coreutils findutils grep sed gawk less jq \
        tzdata sudo \
    && adduser -D -s /bin/bash sandbox \
    && addgroup -S emailsec \
    && adduser -S -D -H -G emailsec -s /sbin/nologin emailsec

RUN pip install --no-cache-dir --root-user-action=ignore --only-binary :all: \
        'imap-tools>=1.5,<2.0'

# Helpers live under /usr/local/libexec/email so /usr/local/bin/ contains
# only thin sudo stubs the agent invokes. The agent CAN read these source
# files (they're 0755), but the credentials are never embedded in them.
COPY email_helper.py /usr/local/libexec/email/email_helper.py
COPY bin/ /usr/local/libexec/email/

# Set up the secrets dir + sudoers + wrapper stubs. Done in one RUN to
# keep the layer small and to fail loudly if visudo doesn't accept the
# rule (mistake here would either lock everyone out or allow too much).
# /etc/sandbox/secrets/email is just a marker the init script looks for
# at boot. The actual credentials.env lives under /run/sandbox-secrets/
# at runtime because the rootfs is mounted read-only.
RUN mkdir -p /etc/sandbox/secrets/email \
    && chmod 0755 /etc/sandbox/secrets/email \
    && chmod 0755 /usr/local/libexec/email \
    && chmod 0755 /usr/local/libexec/email/email-* \
    && chmod 0644 /usr/local/libexec/email/email_helper.py \
    && printf '%s\n' \
        'Defaults:sandbox !requiretty' \
        'Defaults:sandbox env_reset' \
        'Defaults:sandbox secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"' \
        'sandbox ALL=(emailsec) NOPASSWD: /usr/local/libexec/email/email-list, /usr/local/libexec/email/email-search, /usr/local/libexec/email/email-read, /usr/local/libexec/email/email-send, /usr/local/libexec/email/email-status, /usr/local/libexec/email/email-folders, /usr/local/libexec/email/email-mark, /usr/local/libexec/email/email-move, /usr/local/libexec/email/email-folder-create, /usr/local/libexec/email/email-folder-rename, /usr/local/libexec/email/email-folder-delete' \
        > /etc/sudoers.d/email-sandbox \
    && chmod 0440 /etc/sudoers.d/email-sandbox \
    && visudo -c -f /etc/sudoers.d/email-sandbox \
    && for cmd in email-list email-search email-read email-send email-status email-folders email-mark email-move email-folder-create email-folder-rename email-folder-delete; do \
        printf '#!/bin/sh\nexec sudo -n -u emailsec /usr/local/libexec/email/%s "$@"\n' "$cmd" > /usr/local/bin/$cmd \
        && chmod 0755 /usr/local/bin/$cmd; \
       done

COPY README.md /etc/sandbox/README.md

EXPOSE 22

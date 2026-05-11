package templates

import (
	"encoding/base64"
	"fmt"
	"io/fs"
	"path"
	"strings"

	"mantis/sandboxes"
)

type Template struct {
	Name        string
	Description string
	ProfileID   string
	Dockerfile  string
	CapAdd      []string
}

type BuiltinMeta struct {
	Name        string
	Description string
	ProfileID   string
	CapAdd      []string
}

var builtinMeta = []BuiltinMeta{
	{Name: "base", ProfileID: "base", Description: "General-purpose workhorse sandbox — Python 3.12 + scientific stack, DB clients (psql, mysql, redis, sqlite), shell and networking utilities."},
	{Name: "browser", ProfileID: "browser", Description: "Headless Chromium + Playwright — web navigation, screenshots, PDF, parsing.", CapAdd: []string{"SYS_ADMIN"}},
	{Name: "email", ProfileID: "email", Description: "Mailbox sandbox — read/search the user's IMAP inbox, send via SMTP, mark/move messages, and create/rename/delete custom folders. Credentials are injected from the saved wizard configuration. ALWAYS start with `email-status` (verifies SMTP/IMAP and shows which server folder names map to Inbox/Sent/Spam/Trash/Drafts on this provider) and run `email-folders` whenever you need a folder that isn't a standard alias — never guess folder names. Folder management: `email-folder-create --name X` (then `email-move --uid N --to-folder X` to organize) and `email-mark --uid N --seen/--flagged` to flag messages. Special-use folders (Inbox/Sent/Spam/Trash/Drafts/Archive) are protected from rename/delete. All tools support a `--json` flag. If the user skipped the Email step every helper prints a friendly \"not configured — re-run wizard\" hint instead of failing."},
	{Name: "ffmpeg", ProfileID: "media", Description: "FFmpeg + MediaInfo + ImageMagick — video, audio, image processing. IMPORTANT: ffmpeg/ffprobe/imagemagick cannot read chat artifacts directly — before EVERY invocation you MUST upload the input file into this sandbox via ssh_upload_<sandbox_name>, and re-upload it on every run (do NOT assume a previous upload is still there: tmpfs is wiped on restart and the artifact may have been overwritten or expired)."},
	{Name: "netsec", ProfileID: "netsec", Description: "Network / pentest toolkit — nmap, dig, nikto, ffuf, hashcat + net-* wrappers with hard timeouts."},
	{Name: "runtimectl", ProfileID: "runtimectl", Description: "Runtime controller. Ask it in plain language to provision a new sandbox (e.g. \"need rust + cargo + curl\"); it builds, runs and registers the container."},
}

var baseImageMeta = []BuiltinMeta{
	{Name: "sandbox-base", Description: "Alpine + sshd + bash + sandbox user. Used by runtimectl as the FROM base for agent-built sandboxes."},
}

func Builtin() ([]Template, error) {
	out := make([]Template, 0, len(builtinMeta))
	for _, m := range builtinMeta {
		df, err := Render(m.Name)
		if err != nil {
			return nil, fmt.Errorf("render %s: %w", m.Name, err)
		}
		out = append(out, Template{
			Name:        m.Name,
			Description: m.Description,
			ProfileID:   m.ProfileID,
			Dockerfile:  df,
			CapAdd:      m.CapAdd,
		})
	}
	return out, nil
}

func Bases() ([]Template, error) {
	out := make([]Template, 0, len(baseImageMeta))
	for _, m := range baseImageMeta {
		df, err := RenderRaw(m.Name)
		if err != nil {
			return nil, fmt.Errorf("render base %s: %w", m.Name, err)
		}
		out = append(out, Template{
			Name:        m.Name,
			Description: m.Description,
			Dockerfile:  df,
		})
	}
	return out, nil
}

func Lookup(name string) (BuiltinMeta, bool) {
	for _, m := range builtinMeta {
		if m.Name == name {
			return m, true
		}
	}
	return BuiltinMeta{}, false
}

func Render(name string) (string, error) {
	expanded, err := RenderRaw(name)
	if err != nil {
		return "", err
	}
	return Harden(expanded), nil
}

func RenderRaw(name string) (string, error) {
	dockerfile, err := fs.ReadFile(sandboxes.FS, path.Join(name, "Dockerfile"))
	if err != nil {
		return "", err
	}
	return inlineCopies(sandboxes.FS, name, string(dockerfile))
}

const initScript = `#!/bin/sh
set -eu
mkdir -p /run/sshd
chown sandbox:sandbox /home/sandbox
chmod 755 /home/sandbox
mkdir -p /home/sandbox/.ssh
if [ -f /etc/sandbox/README.md ]; then
    cp /etc/sandbox/README.md /home/sandbox/README.md
    chown sandbox:sandbox /home/sandbox/README.md
fi
if [ -n "${SANDBOX_SSH_PUBLIC_KEY:-}" ]; then
    printf '%s\n' "$SANDBOX_SSH_PUBLIC_KEY" > /home/sandbox/.ssh/authorized_keys
    chmod 600 /home/sandbox/.ssh/authorized_keys
fi
: > /home/sandbox/.ssh/environment
# Per-sandbox secret diversion. Sandboxes that opt in by creating an empty
# marker directory /etc/sandbox/secrets/<name>/ at build time get their
# SANDBOX_<NAME>_* env vars written to a root/group-only file instead of
# the agent-readable .ssh/environment, so the agent's shell (and therefore
# the LLM context) never sees raw credentials.
#
# The actual credentials file lives under /run (tmpfs, writable) because
# the rest of the rootfs is mounted read-only by the runtime. The marker
# dir under /etc just signals "this sandbox wants email credentials".
if [ -d /etc/sandbox/secrets/email ]; then
    cred_dir=/run/sandbox-secrets/email
    cred="$cred_dir/credentials.env"
    mkdir -p "$cred_dir"
    chmod 0755 /run/sandbox-secrets
    if id -u emailsec >/dev/null 2>&1; then
        chown root:emailsec "$cred_dir"
        chmod 0750 "$cred_dir"
    else
        chmod 0700 "$cred_dir"
    fi
    : > "$cred"
    chmod 0600 "$cred"
    if id -u emailsec >/dev/null 2>&1; then
        chown emailsec:emailsec "$cred"
    fi
    env | grep -E '^SANDBOX_EMAIL_[A-Z_]+=' >> "$cred" || true
fi
env | sed -n 's/^\(SANDBOX_[A-Z_]*\)=\(.*\)$/\1=\2/p' | grep -vE '^(SANDBOX_SSH_PUBLIC_KEY|SANDBOX_EMAIL_)=' >> /home/sandbox/.ssh/environment || true
env | sed -n 's/^\(RUNTIMECTL_[A-Z_]*\)=\(.*\)$/\1=\2/p' >> /home/sandbox/.ssh/environment || true
chmod 600 /home/sandbox/.ssh/environment
chmod 700 /home/sandbox/.ssh
chown -R sandbox:sandbox /home/sandbox/.ssh
exec /usr/sbin/sshd -D -e \
    -o PasswordAuthentication=no \
    -o PermitRootLogin=no \
    -o KbdInteractiveAuthentication=no \
    -o UsePAM=no \
    -o PermitUserEnvironment=yes
`

func Harden(dockerfile string) string {
	var out strings.Builder
	for _, line := range strings.Split(dockerfile, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "CMD ") || strings.HasPrefix(trimmed, "ENTRYPOINT ") {
			continue
		}
		out.WriteString(line)
		out.WriteByte('\n')
	}
	out.WriteString("RUN echo 'sandbox:*' | chpasswd -e\n")
	out.WriteString("RUN mkdir -p /usr/local/sbin && ssh-keygen -A\n")
	encoded := base64.StdEncoding.EncodeToString([]byte(initScript))
	fmt.Fprintf(&out, "RUN printf %%s %q | base64 -d > /usr/local/sbin/sandbox-init && chmod 755 /usr/local/sbin/sandbox-init\n", encoded)
	out.WriteString(`CMD ["/usr/local/sbin/sandbox-init"]` + "\n")
	return out.String()
}

func inlineCopies(root fs.FS, sandbox, dockerfile string) (string, error) {
	var out strings.Builder
	for _, line := range strings.Split(dockerfile, "\n") {
		trimmed := strings.TrimSpace(line)
		if !strings.HasPrefix(trimmed, "COPY ") {
			out.WriteString(line)
			out.WriteByte('\n')
			continue
		}
		fields := strings.Fields(trimmed)
		if len(fields) != 3 {
			out.WriteString(line)
			out.WriteByte('\n')
			continue
		}
		src, dst := fields[1], fields[2]
		if strings.HasPrefix(src, "/") || strings.Contains(src, "..") {
			out.WriteString(line)
			out.WriteByte('\n')
			continue
		}

		src = strings.TrimPrefix(src, "./")
		srcPath := path.Join(sandbox, src)

		entry, err := fs.Stat(root, srcPath)
		if err != nil {
			return "", fmt.Errorf("COPY %s: %w", src, err)
		}
		if entry.IsDir() {
			if err := emitDirectoryCopy(&out, root, srcPath, dst); err != nil {
				return "", err
			}
		} else {
			content, err := fs.ReadFile(root, srcPath)
			if err != nil {
				return "", err
			}
			emitFileCopy(&out, dst, content)
		}
	}
	return out.String(), nil
}

func emitDirectoryCopy(out *strings.Builder, root fs.FS, srcDir, dstDir string) error {
	entries, err := fs.ReadDir(root, srcDir)
	if err != nil {
		return err
	}
	dstDir = strings.TrimSuffix(dstDir, "/")
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		content, err := fs.ReadFile(root, path.Join(srcDir, e.Name()))
		if err != nil {
			return err
		}
		emitFileCopy(out, path.Join(dstDir, e.Name()), content)
	}
	return nil
}

func emitFileCopy(out *strings.Builder, dst string, content []byte) {
	encoded := base64.StdEncoding.EncodeToString(content)
	fmt.Fprintf(out, "RUN mkdir -p %q && printf %%s %q | base64 -d > %q && chmod a+rx %q\n",
		path.Dir(dst), encoded, dst, dst)
}

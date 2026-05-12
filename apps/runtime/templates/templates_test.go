package templates

import (
	"strings"
	"testing"
	"testing/fstest"
)

func TestHardenStripsCMDAndEntrypoint(t *testing.T) {
	in := "FROM alpine\nRUN echo hi\nCMD [\"sh\"]\nENTRYPOINT [\"/bin/x\"]\n"
	out := Harden(in)
	if strings.Contains(out, "ENTRYPOINT [\"/bin/x\"]") {
		t.Error("ENTRYPOINT must be stripped from user dockerfile")
	}
	for _, line := range strings.Split(out, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "CMD ") && trimmed != `CMD ["/usr/local/sbin/sandbox-init"]` {
			t.Errorf("unexpected user CMD survived: %q", line)
		}
	}
}

func TestHardenAlwaysAppendsSandboxInit(t *testing.T) {
	out := Harden("FROM alpine\nRUN true\n")
	if !strings.Contains(out, `CMD ["/usr/local/sbin/sandbox-init"]`) {
		t.Errorf("hardened output must end with sandbox-init CMD, got: %s", out)
	}
	if !strings.Contains(out, "ssh-keygen -A") {
		t.Error("hardened output must generate host keys")
	}
	if !strings.Contains(out, "/usr/local/sbin/sandbox-init") {
		t.Error("hardened output must install /usr/local/sbin/sandbox-init")
	}
}

func TestHardenPreservesNonCMDLines(t *testing.T) {
	in := "FROM alpine\nRUN apk add bash\nWORKDIR /app\n"
	out := Harden(in)
	for _, want := range []string{"FROM alpine", "RUN apk add bash", "WORKDIR /app"} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q from hardened output", want)
		}
	}
}

func TestRenderRunsHardenAndReadsEmbedFS(t *testing.T) {
	got, err := Render("base")
	if err != nil {
		t.Fatalf("Render(base): %v", err)
	}
	if !strings.Contains(got, `CMD ["/usr/local/sbin/sandbox-init"]`) {
		t.Error("Render must produce hardened output for builtin sandbox")
	}
}

func TestLookupReturnsKnownBuiltin(t *testing.T) {
	m, ok := Lookup("browser")
	if !ok {
		t.Fatal("browser must be in builtinMeta")
	}
	if len(m.CapAdd) == 0 {
		t.Error("browser must declare CapAdd")
	}
	if _, ok := Lookup("__not-real__"); ok {
		t.Error("Lookup for unknown name must return ok=false")
	}
}

func TestEmailTemplateAllowsPrivilegeEscalation(t *testing.T) {
	m, ok := Lookup("email")
	if !ok {
		t.Fatal("email must be in builtinMeta")
	}
	if !m.AllowPrivilegeEscalation {
		t.Error("email metadata must declare AllowPrivilegeEscalation so sudo -> emailsec works under no-new-privileges")
	}
	out, err := Builtin()
	if err != nil {
		t.Fatalf("Builtin: %v", err)
	}
	for _, tpl := range out {
		if tpl.Name == "email" && !tpl.AllowPrivilegeEscalation {
			t.Error("email Template must propagate AllowPrivilegeEscalation from metadata")
		}
		if tpl.Name != "email" && tpl.AllowPrivilegeEscalation {
			t.Errorf("%s template must keep AllowPrivilegeEscalation=false", tpl.Name)
		}
	}
}

func TestBuiltinRendersAllConfigured(t *testing.T) {
	out, err := Builtin()
	if err != nil {
		t.Fatalf("Builtin: %v", err)
	}
	if len(out) != len(builtinMeta) {
		t.Fatalf("got %d, want %d builtin templates", len(out), len(builtinMeta))
	}
	for _, tpl := range out {
		if tpl.Dockerfile == "" {
			t.Errorf("template %s has empty Dockerfile", tpl.Name)
		}
		if !strings.Contains(tpl.Dockerfile, "sandbox-init") {
			t.Errorf("template %s not hardened", tpl.Name)
		}
	}
}

func TestInlineCopiesEmbedsFileContents(t *testing.T) {
	fs := fstest.MapFS{
		"my/Dockerfile":   {Data: []byte("FROM alpine\nCOPY bin/tool /usr/local/bin/tool\n")},
		"my/bin/tool":     {Data: []byte("#!/bin/sh\necho hi\n")},
	}
	out, err := inlineCopies(fs, "my", string(fs["my/Dockerfile"].Data))
	if err != nil {
		t.Fatalf("inlineCopies: %v", err)
	}
	if strings.Contains(out, "COPY bin/tool /usr/local/bin/tool") {
		t.Error("COPY directive must be replaced with inlined RUN")
	}
	if !strings.Contains(out, "/usr/local/bin/tool") {
		t.Error("destination path must appear in emitted RUN")
	}
	if !strings.Contains(out, "base64 -d") {
		t.Error("expected base64-decoded inline write")
	}
}

func TestInlineCopiesLeavesAbsoluteAndUnsafeCopiesAlone(t *testing.T) {
	fs := fstest.MapFS{
		"my/Dockerfile": {Data: []byte("COPY /etc/passwd /tmp/x\nCOPY ../escape /tmp/y\n")},
	}
	out, err := inlineCopies(fs, "my", string(fs["my/Dockerfile"].Data))
	if err != nil {
		t.Fatalf("inlineCopies: %v", err)
	}
	if !strings.Contains(out, "COPY /etc/passwd") {
		t.Error("absolute COPY must be preserved verbatim")
	}
	if !strings.Contains(out, "COPY ../escape") {
		t.Error("COPY with parent traversal must be preserved verbatim")
	}
}

func TestInlineCopiesDirectoryEmitsAllRegularFiles(t *testing.T) {
	fs := fstest.MapFS{
		"my/Dockerfile":   {Data: []byte("COPY scripts /opt/scripts\n")},
		"my/scripts/a.sh": {Data: []byte("a")},
		"my/scripts/b.sh": {Data: []byte("b")},
	}
	out, err := inlineCopies(fs, "my", string(fs["my/Dockerfile"].Data))
	if err != nil {
		t.Fatalf("inlineCopies: %v", err)
	}
	if !strings.Contains(out, "/opt/scripts/a.sh") || !strings.Contains(out, "/opt/scripts/b.sh") {
		t.Errorf("each file in directory must be emitted, got: %s", out)
	}
}

func TestInlineCopiesMissingSourceErrors(t *testing.T) {
	fs := fstest.MapFS{
		"my/Dockerfile": {Data: []byte("COPY missing /tmp/x\n")},
	}
	if _, err := inlineCopies(fs, "my", string(fs["my/Dockerfile"].Data)); err == nil {
		t.Fatal("missing COPY source must produce an error")
	}
}

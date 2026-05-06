package agents

import (
	"regexp"
	"strings"
	"testing"
	"time"

	"mantis/core/protocols"
)

var guardBlockTagRe = regexp.MustCompile(`<guard-block kind="(network|command)"(?: profiles="([^"]*)")?>([^<]+)</guard-block>`)

func TestEgressFooterEmpty(t *testing.T) {
	if got := egressFooter(nil); got != "" {
		t.Fatalf("expected empty footer, got %q", got)
	}
	if got := egressFooter([]protocols.HostBlock{}); got != "" {
		t.Fatalf("expected empty footer for empty slice, got %q", got)
	}
}

func TestEgressFooterFormatsBlocks(t *testing.T) {
	blocks := []protocols.HostBlock{
		{Host: "evil.com", Reason: "egress whitelist", Count: 3, LastAt: time.Now(), ProfileIDs: []string{"prof-a", "prof-b"}},
		{Host: "tracker.io", Count: 1, ProfileIDs: []string{"prof-a"}},
	}
	got := egressFooter(blocks)

	m := guardBlockTagRe.FindStringSubmatch(got)
	if m == nil {
		t.Fatalf("output is not wrapped in <guard-block> tag: %q", got)
	}
	if m[1] != "network" {
		t.Errorf("expected kind=network, got %q", m[1])
	}
	if m[2] != "prof-a,prof-b" {
		t.Errorf("expected profiles=prof-a,prof-b, got %q", m[2])
	}
	body := m[3]
	if !strings.Contains(body, "policy block") {
		t.Errorf("missing 'policy block' phrasing: %q", body)
	}
	if !strings.Contains(body, "not network/DNS") {
		t.Errorf("missing not-a-network-error hint: %q", body)
	}
	if !strings.Contains(body, "/guard-profiles") {
		t.Errorf("missing pointer to profile editor: %q", body)
	}
	if !strings.Contains(body, "evil.com:egress whitelist x3") {
		t.Errorf("missing aggregated entry: %q", body)
	}
	if !strings.Contains(body, "tracker.io") {
		t.Errorf("missing single entry: %q", body)
	}
	if strings.Contains(body, "tracker.io:") {
		t.Errorf("expected no colon for empty reason: %q", body)
	}
}

func TestCommandBlockTagFormat(t *testing.T) {
	got := commandBlockTag("ssh-keygen -R example.com", "capability", "shell capability disabled", []string{"prof-x"})
	m := guardBlockTagRe.FindStringSubmatch(got)
	if m == nil {
		t.Fatalf("not a valid <guard-block> envelope: %q", got)
	}
	if m[1] != "command" {
		t.Errorf("expected kind=command, got %q", m[1])
	}
	if m[2] != "prof-x" {
		t.Errorf("expected profiles=prof-x, got %q", m[2])
	}
	body := m[3]
	if !strings.Contains(body, "policy block") {
		t.Errorf("missing policy block wording: %q", body)
	}
	if !strings.Contains(body, "ssh-keygen -R example.com") {
		t.Errorf("missing original command: %q", body)
	}
	if !strings.Contains(body, "shell capability disabled") {
		t.Errorf("missing rule message: %q", body)
	}
	if !strings.Contains(body, "/guard-profiles") {
		t.Errorf("missing /guard-profiles hint: %q", body)
	}
}

func TestSanitizeTagPayloadStripsAngles(t *testing.T) {
	out := commandBlockTag("echo <script>", "rule", "msg with > inside", nil)
	// The inner payload may still contain the unicode look-alikes, but the only
	// raw `<`/`>` allowed in the string must be from our envelope itself.
	matches := guardBlockTagRe.FindAllString(out, -1)
	if len(matches) != 1 {
		t.Fatalf("expected exactly one matching envelope, got %d in %q", len(matches), out)
	}
	if strings.Contains(matches[0], "<script>") {
		t.Errorf("payload not sanitized: %q", out)
	}
}

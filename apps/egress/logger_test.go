package egress

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func newTestLogger() (*Logger, *bytes.Buffer) {
	buf := &bytes.Buffer{}
	return &Logger{out: buf}, buf
}

func TestLoggerAllowAndBlockEmitNDJSON(t *testing.T) {
	l, buf := newTestLogger()
	l.Allow(LogEntry{Layer: "dns", Sandbox: "netsec", SrcIP: "10.0.0.1", Host: "api.openai.com", QType: "A", Reason: "whitelist-hit"})
	l.Block(LogEntry{Layer: "dns", Sandbox: "netsec", SrcIP: "10.0.0.1", Host: "evil.com", QType: "A", Reason: "not-in-whitelist"})

	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	if len(lines) != 2 {
		t.Fatalf("got %d lines, want 2", len(lines))
	}
	var allow LogEntry
	if err := json.Unmarshal([]byte(lines[0]), &allow); err != nil {
		t.Fatalf("allow line not JSON: %v", err)
	}
	if allow.Verdict != "allow" || allow.Sandbox != "netsec" || allow.Host != "api.openai.com" {
		t.Errorf("allow entry malformed: %+v", allow)
	}
	if allow.Time == "" {
		t.Error("Time must be populated")
	}
	var block LogEntry
	if err := json.Unmarshal([]byte(lines[1]), &block); err != nil {
		t.Fatalf("block line not JSON: %v", err)
	}
	if block.Verdict != "block" {
		t.Errorf("block verdict %q", block.Verdict)
	}
}

func TestLoggerOmitsEmptyOptionalFields(t *testing.T) {
	l, buf := newTestLogger()
	l.Allow(LogEntry{Layer: "dns", Sandbox: "x", SrcIP: "1.1.1.1"})
	out := buf.String()
	if strings.Contains(out, "host") {
		t.Errorf("empty host must be omitted, got %s", out)
	}
	if strings.Contains(out, "qtype") {
		t.Errorf("empty qtype must be omitted")
	}
	if strings.Contains(out, "dst_ip") {
		t.Errorf("empty dst_ip must be omitted")
	}
}

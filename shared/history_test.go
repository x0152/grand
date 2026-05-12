package shared

import (
	"encoding/json"
	"testing"
)

func TestReplayToolCallsRebuildsStructured(t *testing.T) {
	steps := []map[string]any{
		{"id": "step-1", "tool": "ssh_email", "args": `{"command":"email-status"}`, "result": "OK: connected as user@example.com"},
		{"id": "step-2", "tool": "ssh_email", "args": `{"command":"email-read --uid 1"}`, "result": "Subject: Hello"},
	}
	raw, _ := json.Marshal(steps)

	msgs, ok := replayToolCalls(raw, "Hi! Here's what I found.")
	if !ok {
		t.Fatal("replayToolCalls returned ok=false for valid steps")
	}
	if len(msgs) != 3 {
		t.Fatalf("expected 1 assistant + 2 tool messages, got %d", len(msgs))
	}
	if msgs[0].Role != "assistant" {
		t.Errorf("msgs[0].Role = %q, want assistant", msgs[0].Role)
	}
	if msgs[0].Content != "Hi! Here's what I found." {
		t.Errorf("assistant content not preserved: %q", msgs[0].Content)
	}
	if len(msgs[0].ToolCalls) != 2 {
		t.Fatalf("assistant ToolCalls len = %d, want 2", len(msgs[0].ToolCalls))
	}
	if msgs[0].ToolCalls[0].ID != "step-1" || msgs[0].ToolCalls[0].Name != "ssh_email" {
		t.Errorf("tool_call[0] = %+v", msgs[0].ToolCalls[0])
	}
	if msgs[1].Role != "tool" || msgs[1].ToolCallID != "step-1" || msgs[1].Content == "" {
		t.Errorf("tool result[0] malformed: %+v", msgs[1])
	}
	if msgs[2].Role != "tool" || msgs[2].ToolCallID != "step-2" {
		t.Errorf("tool result[1] malformed: %+v", msgs[2])
	}
}

func TestReplayToolCallsFillsMissingArgsAndResult(t *testing.T) {
	steps := []map[string]any{
		{"id": "x", "tool": "noop", "args": "", "result": ""},
	}
	raw, _ := json.Marshal(steps)
	msgs, ok := replayToolCalls(raw, "")
	if !ok || len(msgs) != 2 {
		t.Fatalf("ok=%v len=%d", ok, len(msgs))
	}
	if msgs[0].ToolCalls[0].Arguments != "{}" {
		t.Errorf("empty args should be normalized to {}, got %q", msgs[0].ToolCalls[0].Arguments)
	}
	if msgs[1].Content == "" {
		t.Errorf("empty tool result should be replaced with placeholder")
	}
}

func TestReplayToolCallsFallbackOnUnparseable(t *testing.T) {
	if _, ok := replayToolCalls(nil, ""); ok {
		t.Error("nil steps should not produce replay")
	}
	if _, ok := replayToolCalls(json.RawMessage(`{"not":"an array"}`), ""); ok {
		t.Error("non-array json should not produce replay")
	}
	if _, ok := replayToolCalls(json.RawMessage(`[{"id":"a","args":"{}"}]`), ""); ok {
		t.Error("step without tool name should not produce replay")
	}
}

func TestReplayToolCallsGeneratesFallbackIDs(t *testing.T) {
	steps := []map[string]any{
		{"tool": "t1", "args": "{}", "result": "r1"},
		{"tool": "t2", "args": "{}", "result": "r2"},
	}
	raw, _ := json.Marshal(steps)
	msgs, ok := replayToolCalls(raw, "")
	if !ok {
		t.Fatal("expected ok=true")
	}
	if msgs[0].ToolCalls[0].ID == msgs[0].ToolCalls[1].ID {
		t.Errorf("fallback IDs collided: %s == %s", msgs[0].ToolCalls[0].ID, msgs[0].ToolCalls[1].ID)
	}
	if msgs[1].ToolCallID != msgs[0].ToolCalls[0].ID || msgs[2].ToolCallID != msgs[0].ToolCalls[1].ID {
		t.Errorf("tool messages must reference matching call IDs")
	}
}

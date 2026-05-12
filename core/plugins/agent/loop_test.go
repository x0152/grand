package agent

import (
	"context"
	"errors"
	"strings"
	"testing"

	"mantis/core/protocols"
	"mantis/core/types"
)

type scriptedLLM struct {
	streams [][]types.StreamEvent
	calls   int
}

func (s *scriptedLLM) ChatStream(_ context.Context, _ string, _ string, _ string, _ []protocols.LLMMessage, _ string, _ []types.Tool, _ string) (<-chan types.StreamEvent, error) {
	ch := make(chan types.StreamEvent, 8)
	idx := s.calls
	s.calls++
	go func() {
		if idx < len(s.streams) {
			for _, ev := range s.streams[idx] {
				ch <- ev
			}
		}
		close(ch)
	}()
	return ch, nil
}

func collect(ch <-chan types.StreamEvent) []types.StreamEvent {
	var out []types.StreamEvent
	for ev := range ch {
		out = append(out, ev)
	}
	return out
}

func TestAgentLoop_ExecutesToolAndStopsWithoutError(t *testing.T) {
	llm := &scriptedLLM{
		streams: [][]types.StreamEvent{
			{
				{Type: "text", Delta: "run"},
				{Type: "tool_calls", ToolCalls: []types.ToolCall{{ID: "1", Name: "sum", Arguments: "1+1"}}},
			},
			{
				{Type: "text", Delta: "done"},
			},
		},
	}

	var gotArgs string
	loop := NewAgentLoop(NewAgentAction(llm))
	ch, err := loop.Execute(context.Background(), LoopInput{
		ActionInput: ActionInput{
			Messages: []protocols.LLMMessage{{Role: "user", Content: "x"}},
			Tools: []types.Tool{
				{
					Name: "sum",
					Execute: func(_ context.Context, args string) (string, error) {
						gotArgs = args
						return "2", nil
					},
				},
			},
		},
		MaxIterations: 2,
	})
	if err != nil {
		t.Fatal(err)
	}

	events := collect(ch)
	if gotArgs != "1+1" {
		t.Fatalf("unexpected tool args: %q", gotArgs)
	}

	hasStart := false
	hasEnd := false
	for _, ev := range events {
		if ev.Type == "tool_start" {
			hasStart = true
		}
		if ev.Type == "tool_end" && ev.Delta == "2" {
			hasEnd = true
		}
		if ev.Type == "error" {
			t.Fatalf("unexpected error event: %q", ev.Delta)
		}
	}
	if !hasStart || !hasEnd {
		t.Fatalf("missing tool events start=%v end=%v", hasStart, hasEnd)
	}
}

func TestAgentLoop_MaxIterationsReached(t *testing.T) {
	llm := &scriptedLLM{
		streams: [][]types.StreamEvent{
			{
				{Type: "tool_calls", ToolCalls: []types.ToolCall{{ID: "1", Name: "sum", Arguments: "1+1"}}},
			},
		},
	}

	loop := NewAgentLoop(NewAgentAction(llm))
	ch, err := loop.Execute(context.Background(), LoopInput{
		ActionInput: ActionInput{
			Tools: []types.Tool{
				{
					Name: "sum",
					Execute: func(_ context.Context, _ string) (string, error) {
						return "2", nil
					},
				},
			},
		},
		MaxIterations: 1,
	})
	if err != nil {
		t.Fatal(err)
	}

	events := collect(ch)
	found := false
	for _, ev := range events {
		if ev.Type == "error" && strings.Contains(ev.Delta, "max iterations reached") {
			found = true
		}
	}
	if !found {
		t.Fatal("expected max iterations error")
	}
}

func TestNormalizeToolExecutionResult_EmptyOutputGetsStatusFallback(t *testing.T) {
	got := normalizeToolExecutionResult("execute_command", "", nil)
	if !strings.Contains(got, "status: success") || !strings.Contains(got, "execute_command") {
		t.Fatalf("unexpected fallback message: %q", got)
	}
}

func TestNormalizeToolExecutionResult_NonEmptyOutputPreserved(t *testing.T) {
	raw := "file1\nfile2\n"
	got := normalizeToolExecutionResult("execute_command", raw, nil)
	if got != raw {
		t.Fatalf("expected raw output unchanged, got %q", got)
	}
}

func TestNormalizeToolExecutionResult_ErrorTakesPriority(t *testing.T) {
	got := normalizeToolExecutionResult("execute_command", "", errors.New("boom"))
	if got != "error: boom" {
		t.Fatalf("unexpected error normalization: %q", got)
	}
}

func TestAgentLoop_RequiredToolRetriesAndSuppressesUngroundedText(t *testing.T) {
	llm := &scriptedLLM{
		streams: [][]types.StreamEvent{
			{
				{Type: "text", Delta: "да, подключение работает"},
			},
			{
				{Type: "text", Delta: "проверяю"},
				{Type: "tool_calls", ToolCalls: []types.ToolCall{{ID: "1", Name: "ssh_email", Arguments: `{"task":"email-status"}`}}},
			},
			{
				{Type: "text", Delta: "готово"},
			},
		},
	}

	loop := NewAgentLoop(NewAgentAction(llm))
	ch, err := loop.Execute(context.Background(), LoopInput{
		ActionInput: ActionInput{
			Messages: []protocols.LLMMessage{{Role: "user", Content: "проверь почту"}},
			Tools: []types.Tool{
				{
					Name: "ssh_email",
					Execute: func(_ context.Context, _ string) (string, error) {
						return "ok", nil
					},
				},
			},
		},
		MaxIterations:     4,
		RequiredToolNames: []string{"ssh_email"},
	})
	if err != nil {
		t.Fatal(err)
	}

	events := collect(ch)
	if llm.calls != 3 {
		t.Fatalf("expected 3 llm calls (retry + tool + final), got %d", llm.calls)
	}

	allText := ""
	hasStart := false
	hasEnd := false
	for _, ev := range events {
		if ev.Type == "text" {
			allText += ev.Delta
		}
		if ev.Type == "tool_start" {
			hasStart = true
		}
		if ev.Type == "tool_end" {
			hasEnd = true
		}
		if ev.Type == "error" {
			t.Fatalf("unexpected error event: %q", ev.Delta)
		}
	}
	if strings.Contains(allText, "да, подключение работает") {
		t.Fatalf("ungrounded first-pass text leaked into output: %q", allText)
	}
	if !strings.Contains(allText, "проверяю") || !strings.Contains(allText, "готово") {
		t.Fatalf("expected accepted turns text, got %q", allText)
	}
	if !hasStart || !hasEnd {
		t.Fatalf("expected tool events after required-tool retry start=%v end=%v", hasStart, hasEnd)
	}
}

func TestAgentLoop_RequiredToolMissingEmitsError(t *testing.T) {
	llm := &scriptedLLM{
		streams: [][]types.StreamEvent{
			{{Type: "text", Delta: "без проверки 1"}},
			{{Type: "text", Delta: "без проверки 2"}},
		},
	}
	loop := NewAgentLoop(NewAgentAction(llm))
	ch, err := loop.Execute(context.Background(), LoopInput{
		ActionInput: ActionInput{
			Messages: []protocols.LLMMessage{{Role: "user", Content: "проверь почту"}},
			Tools:    []types.Tool{{Name: "ssh_email", Execute: func(_ context.Context, _ string) (string, error) { return "ok", nil }}},
		},
		MaxIterations:     2,
		RequiredToolNames: []string{"ssh_email"},
	})
	if err != nil {
		t.Fatal(err)
	}
	events := collect(ch)
	found := false
	for _, ev := range events {
		if ev.Type == "error" && strings.Contains(ev.Delta, "required tool call missing") {
			found = true
		}
		if ev.Type == "text" {
			t.Fatalf("unexpected text leaked while required tool call was missing: %q", ev.Delta)
		}
	}
	if !found {
		t.Fatal("expected required-tool-missing error")
	}
}

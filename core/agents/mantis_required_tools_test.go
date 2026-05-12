package agents

import (
	"testing"

	"mantis/core/protocols"
	"mantis/core/types"
)

func TestRequiredToolsForTurn_EmailCheckInCurrentRequest(t *testing.T) {
	tools := []types.Tool{{Name: "ssh_email"}}
	got := requiredToolsForTurn("проверь статус почты", nil, tools)
	if len(got) != 1 || got[0] != "ssh_email" {
		t.Fatalf("expected ssh_email requirement, got %#v", got)
	}
}

func TestRequiredToolsForTurn_CheckCueUsesRecentEmailContext(t *testing.T) {
	tools := []types.Tool{{Name: "ssh_email"}}
	history := []protocols.LLMMessage{
		{Role: "user", Content: "я поменял пароль от почты"},
		{Role: "assistant", Content: "Принял, могу перепроверить доступ."},
	}
	got := requiredToolsForTurn("проверь еще раз сейчас", history, tools)
	if len(got) != 1 || got[0] != "ssh_email" {
		t.Fatalf("expected ssh_email requirement from history context, got %#v", got)
	}
}

func TestRequiredToolsForTurn_CheckCueWithoutEmailContext(t *testing.T) {
	tools := []types.Tool{{Name: "ssh_email"}}
	history := []protocols.LLMMessage{
		{Role: "user", Content: "проверь логи nginx"},
	}
	got := requiredToolsForTurn("проверь еще раз", history, tools)
	if len(got) != 0 {
		t.Fatalf("expected no requirement, got %#v", got)
	}
}

func TestRequiredToolsForTurn_NoEmailToolRegistered(t *testing.T) {
	tools := []types.Tool{{Name: "ssh_netsec"}}
	got := requiredToolsForTurn("проверь статус почты", nil, tools)
	if len(got) != 0 {
		t.Fatalf("expected no requirement without ssh_email tool, got %#v", got)
	}
}


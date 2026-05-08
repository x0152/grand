package agents

import (
	"errors"
	"strings"
	"testing"
)

func TestFormatCommandToolResult_SuccessWithOutput(t *testing.T) {
	got := formatCommandToolResult("Linux host\n", nil)
	if !strings.Contains(got, "status: exit 0 (success)") {
		t.Fatalf("missing success status: %q", got)
	}
	if !strings.Contains(got, "output:\nLinux host\n") {
		t.Fatalf("missing output section: %q", got)
	}
}

func TestFormatCommandToolResult_SuccessWithEmptyOutput(t *testing.T) {
	got := formatCommandToolResult("", nil)
	if !strings.Contains(got, "status: exit 0 (success)") {
		t.Fatalf("missing success status: %q", got)
	}
	if !strings.Contains(got, "output:\n(no output)") {
		t.Fatalf("missing no-output marker: %q", got)
	}
}

func TestFormatCommandToolResult_GenericErrorStillShowsOutput(t *testing.T) {
	got := formatCommandToolResult("permission denied\n", errors.New("ssh transport closed"))
	if !strings.Contains(got, "status: error (ssh transport closed)") {
		t.Fatalf("missing error status: %q", got)
	}
	if !strings.Contains(got, "output:\npermission denied\n") {
		t.Fatalf("missing output section: %q", got)
	}
}

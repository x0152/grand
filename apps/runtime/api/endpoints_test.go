package api

import (
	"net/http/httptest"
	"strings"
	"testing"

	"mantis/core/types"
)

func TestValidateSandboxName(t *testing.T) {
	cases := []struct {
		name string
		ok   bool
	}{
		{"netsec", true},
		{"my-sandbox-1", true},
		{"a", true},
		{"", false},
		{"Sandbox", false},
		{"with_underscore", false},
		{"has space", false},
		{strings.Repeat("a", 48), true},
		{strings.Repeat("a", 49), false},
	}
	for _, c := range cases {
		err := validateSandboxName(c.name)
		if (err == nil) != c.ok {
			t.Errorf("validateSandboxName(%q): err=%v, wantOK=%v", c.name, err, c.ok)
		}
	}
}

func TestValidateDockerfileAcceptsBaseImage(t *testing.T) {
	in := "FROM sandbox/sandbox-base:latest\nRUN echo hi\n"
	if err := validateDockerfile(in); err != nil {
		t.Errorf("FROM sandbox-base must be accepted, got %v", err)
	}
}

func TestValidateDockerfileAcceptsExplicitOpenSSHInstall(t *testing.T) {
	in := "FROM debian:slim\nRUN apt-get install -y openssh-server bash\n"
	if err := validateDockerfile(in); err != nil {
		t.Errorf("explicit openssh-server install must be accepted, got %v", err)
	}
}

func TestValidateDockerfileRejectsMissingSSHD(t *testing.T) {
	in := "FROM alpine\nRUN apk add curl\n"
	if err := validateDockerfile(in); err == nil {
		t.Error("dockerfile without sshd must be rejected")
	}
}

func TestValidateDockerfileIsCaseInsensitive(t *testing.T) {
	in := "FROM sandbox/sandbox-base:latest"
	if err := validateDockerfile(strings.ToUpper(in)); err != nil {
		t.Errorf("validation must be case-insensitive, got %v", err)
	}
}

func TestImageNameFromConnStripsPrefix(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{registeredConnectionPrefix + "netsec", "netsec"},
		{"netsec", "netsec"},
		{"", ""},
	}
	for _, c := range cases {
		got := imageNameFromConn(types.Connection{Name: c.in})
		if got != c.want {
			t.Errorf("imageNameFromConn(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestIsWaitRequested(t *testing.T) {
	cases := []struct {
		query string
		want  bool
	}{
		{"", false},
		{"wait=1", true},
		{"wait=true", true},
		{"wait=YES", true},
		{"wait=0", false},
		{"wait=no", false},
		{"wait=%201%20", true},
		{"foo=bar", false},
	}
	for _, c := range cases {
		req := httptest.NewRequest("GET", "/?"+c.query, nil)
		if got := isWaitRequested(req); got != c.want {
			t.Errorf("isWaitRequested(%q) = %v, want %v", c.query, got, c.want)
		}
	}
}

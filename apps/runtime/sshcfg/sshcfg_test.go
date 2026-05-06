package sshcfg

import (
	"encoding/json"
	"testing"
)

func TestHostForPrefersIP(t *testing.T) {
	if got := HostFor("netsec", "10.0.0.5"); got != "10.0.0.5" {
		t.Errorf("HostFor(name, ip) = %q, want %q", got, "10.0.0.5")
	}
}

func TestHostForFallsBackToContainerHostname(t *testing.T) {
	got := HostFor("netsec", "")
	if got != ContainerHostPrefix+"netsec" {
		t.Errorf("HostFor(name, \"\") = %q, want %q", got, ContainerHostPrefix+"netsec")
	}
}

func TestBuildProducesExpectedFields(t *testing.T) {
	raw, err := Build("netsec", "10.0.0.5", "PRIVATE-KEY")
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	var got map[string]any
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatalf("not valid JSON: %v", err)
	}
	if got["host"] != "10.0.0.5" {
		t.Errorf("host = %v, want 10.0.0.5", got["host"])
	}
	if got["port"].(float64) != 22 {
		t.Errorf("port = %v, want 22", got["port"])
	}
	if got["username"] != SandboxUser {
		t.Errorf("username = %v, want %s", got["username"], SandboxUser)
	}
	if got["privateKey"] != "PRIVATE-KEY" {
		t.Errorf("privateKey = %v, want PRIVATE-KEY", got["privateKey"])
	}
}

func TestBuildHostFallbackUsesPrefix(t *testing.T) {
	raw, err := Build("netsec", "", "K")
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	var got map[string]any
	_ = json.Unmarshal(raw, &got)
	if got["host"] != ContainerHostPrefix+"netsec" {
		t.Errorf("host = %v, want %s", got["host"], ContainerHostPrefix+"netsec")
	}
}

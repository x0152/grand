package protocols

import (
	"context"
	"time"
)

type GuardEvaluator interface {
	EvaluateCommand(ctx context.Context, profileIDs []string, connectionID, command string) (allowed bool, rule, message string)
	EvaluateHost(ctx context.Context, profileIDs []string, connectionID, target string) (allowed bool, reason string)
	Describe(ctx context.Context, profileIDs []string) string
	// RecentBlockedHosts returns deduplicated host blocks recorded for a
	// connection since `since`. Used by agent tools to surface egress denials
	// that occurred while a shell command was running. `limit` caps the number
	// of distinct host/reason pairs returned (most recent first).
	RecentBlockedHosts(ctx context.Context, connectionID string, since time.Time, limit int) []HostBlock
}

type HostBlock struct {
	Host       string
	Reason     string
	Count      int
	LastAt     time.Time
	FirstAt    time.Time
	ProfileIDs []string
}

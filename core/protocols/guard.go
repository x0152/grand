package protocols

import "context"

type GuardEvaluator interface {
	EvaluateCommand(ctx context.Context, profileIDs []string, connectionID, command string) (allowed bool, rule, message string)
	EvaluateHost(ctx context.Context, profileIDs []string, connectionID, target string) (allowed bool, reason string)
	Describe(ctx context.Context, profileIDs []string) string
}

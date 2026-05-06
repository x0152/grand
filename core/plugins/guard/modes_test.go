package guard

import (
	"context"
	"testing"

	"mantis/core/types"
)

func TestCommandsMode_Whitelist(t *testing.T) {
	p := types.GuardProfile{
		ID:           "wl",
		CommandsMode: types.CommandsWhitelist,
		Commands:     []types.CommandRule{{Command: "ls"}},
	}
	g := newTestGuard(p)
	ctx := context.Background()
	if v := g.Execute(ctx, []string{"wl"}, "ls -la"); v != nil {
		t.Fatalf("ls must be allowed: %s %s", v.Rule, v.Message)
	}
	v := g.Execute(ctx, []string{"wl"}, "rm -rf /")
	if v == nil || v.Rule != "command-not-allowed" {
		t.Fatalf("rm must be blocked, got %+v", v)
	}
}

func TestCommandsMode_Blacklist(t *testing.T) {
	p := types.GuardProfile{
		ID:           "bl",
		CommandsMode: types.CommandsBlacklist,
		Commands:     []types.CommandRule{{Command: "rm"}, {Command: "dd"}},
	}
	g := newTestGuard(p)
	ctx := context.Background()
	if v := g.Execute(ctx, []string{"bl"}, "ls -la"); v != nil {
		t.Fatalf("ls must pass blacklist: %s %s", v.Rule, v.Message)
	}
	v := g.Execute(ctx, []string{"bl"}, "rm -rf /")
	if v == nil || v.Rule != "command-blacklisted" {
		t.Fatalf("rm must be blacklisted, got %+v", v)
	}
}

func TestCommandsMode_Open(t *testing.T) {
	p := types.GuardProfile{ID: "open", CommandsMode: types.CommandsOpen}
	g := newTestGuard(p)
	if v := g.Execute(context.Background(), []string{"open"}, "rm -rf / && dd if=/dev/zero"); v != nil {
		t.Fatalf("open must allow anything, got %+v", v)
	}
}

func TestCommandsMode_Closed(t *testing.T) {
	p := types.GuardProfile{ID: "closed", CommandsMode: types.CommandsClosed}
	g := newTestGuard(p)
	v := g.Execute(context.Background(), []string{"closed"}, "ls")
	if v == nil || v.Rule != "commands-closed" {
		t.Fatalf("closed must block ls, got %+v", v)
	}
}

func TestCommandsMode_DefaultIsWhitelist(t *testing.T) {
	p := types.GuardProfile{
		ID:       "default",
		Commands: []types.CommandRule{{Command: "ls"}},
	}
	g := newTestGuard(p)
	if v := g.Execute(context.Background(), []string{"default"}, "ls"); v != nil {
		t.Fatalf("ls must be allowed in default whitelist mode: %+v", v)
	}
	v := g.Execute(context.Background(), []string{"default"}, "rm")
	if v == nil || v.Rule != "command-not-allowed" {
		t.Fatalf("rm must be blocked in default whitelist mode, got %+v", v)
	}
}

func TestBlockedSQL_DropTable(t *testing.T) {
	p := types.GuardProfile{
		ID:           "db",
		CommandsMode: types.CommandsWhitelist,
		Commands: []types.CommandRule{
			{Command: "psql", BlockedSQL: []string{"DROP TABLE", "DROP DATABASE", "DROP SCHEMA"}},
		},
	}
	g := newTestGuard(p)
	ctx := context.Background()
	if v := g.Execute(ctx, []string{"db"}, `psql -c "SELECT 1"`); v != nil {
		t.Fatalf("SELECT must pass: %s %s", v.Rule, v.Message)
	}
	if v := g.Execute(ctx, []string{"db"}, `psql -c "DROP INDEX idx_x"`); v != nil {
		t.Fatalf("DROP INDEX must pass: %s %s", v.Rule, v.Message)
	}
	v := g.Execute(ctx, []string{"db"}, `psql -c "drop table users"`)
	if v == nil || v.Rule != "sql-blocked" {
		t.Fatalf("drop table must be blocked, got %+v", v)
	}
	v = g.Execute(ctx, []string{"db"}, `psql -c "DROP DATABASE prod;"`)
	if v == nil || v.Rule != "sql-blocked" {
		t.Fatalf("DROP DATABASE must be blocked, got %+v", v)
	}
	v = g.Execute(ctx, []string{"db"}, `psql -c "DROP SCHEMA public CASCADE"`)
	if v == nil || v.Rule != "sql-blocked" {
		t.Fatalf("DROP SCHEMA must be blocked, got %+v", v)
	}
}

func TestBlockedArgs(t *testing.T) {
	p := types.GuardProfile{
		ID:           "fs",
		CommandsMode: types.CommandsWhitelist,
		Commands: []types.CommandRule{
			{Command: "rm", BlockedArgs: []string{"-rf"}},
		},
	}
	g := newTestGuard(p)
	if v := g.Execute(context.Background(), []string{"fs"}, "rm /tmp/x"); v != nil {
		t.Fatalf("rm /tmp/x must pass: %+v", v)
	}
	v := g.Execute(context.Background(), []string{"fs"}, "rm -rf /tmp")
	if v == nil || v.Rule != "arg-blocked" {
		t.Fatalf("rm -rf must be arg-blocked, got %+v", v)
	}
}

func TestCommandsMode_BlacklistIgnoresArgs(t *testing.T) {
	p := types.GuardProfile{
		ID:           "bl",
		CommandsMode: types.CommandsBlacklist,
		Commands:     []types.CommandRule{{Command: "psql", AllowedSQL: []string{"SELECT"}}},
	}
	g := newTestGuard(p)
	v := g.Execute(context.Background(), []string{"bl"}, `psql -c "SELECT 1"`)
	if v == nil || v.Rule != "command-blacklisted" {
		t.Fatalf("blacklist matches by name regardless of args, got %+v", v)
	}
}

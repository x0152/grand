package models

import (
	"encoding/json"

	"github.com/uptrace/bun"
)

type GuardProfileRow struct {
	bun.BaseModel `bun:"table:guard_profiles"`
	ID            string          `bun:"id,pk"`
	Name          string          `bun:"name"`
	Description   string          `bun:"description"`
	Builtin       bool            `bun:"builtin"`
	CommandsMode  string          `bun:"commands_mode"`
	Capabilities  json.RawMessage `bun:"capabilities,type:jsonb"`
	Commands      json.RawMessage `bun:"commands,type:jsonb"`
	Egress        json.RawMessage `bun:"egress,type:jsonb"`
}

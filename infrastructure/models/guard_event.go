package models

import (
	"time"

	"github.com/uptrace/bun"
)

type GuardEventRow struct {
	bun.BaseModel `bun:"table:guard_events"`
	ID            string    `bun:"id,pk"`
	Kind          string    `bun:"kind"`
	Target        string    `bun:"target"`
	Allowed       bool      `bun:"allowed"`
	Rule          string    `bun:"rule"`
	Message       string    `bun:"message"`
	ProfileIDs    []string  `bun:"profile_ids,array"`
	ConnectionID  string    `bun:"connection_id"`
	UserID        string    `bun:"user_id"`
	CreatedAt     time.Time `bun:"created_at,nullzero,notnull,default:current_timestamp"`
}

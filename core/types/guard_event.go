package types

import "time"

type GuardEventKind string

const (
	GuardEventCommand GuardEventKind = "command"
	GuardEventHost    GuardEventKind = "host"
)

type GuardEvent struct {
	ID           string         `json:"id"`
	Kind         GuardEventKind `json:"kind"`
	Target       string         `json:"target"`
	Allowed      bool           `json:"allowed"`
	Rule         string         `json:"rule"`
	Message      string         `json:"message"`
	ProfileIDs   []string       `json:"profileIds"`
	ConnectionID string         `json:"connectionId"`
	UserID       string         `json:"userId,omitempty"`
	CreatedAt    time.Time      `json:"createdAt"`
}

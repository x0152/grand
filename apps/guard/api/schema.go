package api

import (
	"time"

	"mantis/core/types"
)

type GuardProfileOutput struct {
	Body types.GuardProfile
}

type GuardProfilesOutput struct {
	Body []types.GuardProfile
}

type GuardProfileIDInput struct {
	ID string `path:"id"`
}

type CreateGuardProfileInput struct {
	Body struct {
		Name         string                  `json:"name" required:"true" minLength:"1"`
		Description  string                  `json:"description"`
		Capabilities types.GuardCapabilities `json:"capabilities"`
		CommandsMode string                  `json:"commandsMode"`
		Commands     []types.CommandRule     `json:"commands"`
		Egress       types.EgressPolicy      `json:"egress"`
	}
}

type UpdateGuardProfileInput struct {
	ID   string `path:"id"`
	Body struct {
		Name         string                  `json:"name" required:"true" minLength:"1"`
		Description  string                  `json:"description"`
		Capabilities types.GuardCapabilities `json:"capabilities"`
		CommandsMode string                  `json:"commandsMode"`
		Commands     []types.CommandRule     `json:"commands"`
		Egress       types.EgressPolicy      `json:"egress"`
	}
}

type TestGuardProfileInput struct {
	Body struct {
		Profile types.GuardProfile `json:"profile"`
		Kind    string             `json:"kind" enum:"command,host" required:"true"`
		Target  string             `json:"target" required:"true" minLength:"1"`
	}
}

type GuardProfileTestOutput struct {
	Body struct {
		Allowed bool   `json:"allowed"`
		Rule    string `json:"rule,omitempty"`
		Message string `json:"message,omitempty"`
		Reason  string `json:"reason,omitempty"`
	}
}

type SyncGuardProfileAttachmentsInput struct {
	ID   string `path:"id"`
	Body struct {
		ConnectionIDs []string `json:"connectionIds"`
	}
}

type GuardProfileAttachmentsOutput struct {
	Body []types.Connection
}

type ListGuardEventsInput struct {
	Kind         string `query:"kind"`
	Allowed      string `query:"allowed"`
	ProfileID    string `query:"profileId"`
	ConnectionID string `query:"connectionId"`
	Limit        int    `query:"limit"`
}

type GuardEventsOutput struct {
	Body []types.GuardEvent
}

type IngestGuardHostEventInput struct {
	Authorization string `header:"X-Guard-Ingest-Token"`
	Body          struct {
		Allowed      bool      `json:"allowed"`
		Target       string    `json:"target" required:"true" minLength:"1"`
		Reason       string    `json:"reason,omitempty"`
		Sandbox      string    `json:"sandbox,omitempty"`
		ConnectionID string    `json:"connectionId,omitempty" required:"false"`
		ProfileIDs   []string  `json:"profileIds,omitempty" required:"false"`
		At           time.Time `json:"at,omitempty"`
	}
}

type IngestGuardHostEventOutput struct {
	Body struct {
		Recorded bool `json:"recorded"`
	}
}

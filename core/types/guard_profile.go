package types

type GuardCapabilities struct {
	Pipes        bool `json:"pipes"`
	Redirects    bool `json:"redirects"`
	CmdSubst     bool `json:"cmdSubst"`
	Background   bool `json:"background"`
	Sudo         bool `json:"sudo"`
	CodeExec     bool `json:"codeExec"`
	Download     bool `json:"download"`
	Install      bool `json:"install"`
	WriteFS      bool `json:"writeFs"`
	NetworkOut   bool `json:"networkOut"`
	Cron         bool `json:"cron"`
	Unrestricted bool `json:"unrestricted"`
}

type CommandRule struct {
	Command     string   `json:"command"`
	AllowedArgs []string `json:"allowedArgs,omitempty"`
	AllowedSQL  []string `json:"allowedSql,omitempty"`
	BlockedArgs []string `json:"blockedArgs,omitempty"`
	BlockedSQL  []string `json:"blockedSql,omitempty"`
}

type CommandsMode string

const (
	CommandsOpen      CommandsMode = "open"
	CommandsClosed    CommandsMode = "closed"
	CommandsWhitelist CommandsMode = "whitelist"
	CommandsBlacklist CommandsMode = "blacklist"
)

type GuardProfile struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	Description  string            `json:"description"`
	Builtin      bool              `json:"builtin"`
	Capabilities GuardCapabilities `json:"capabilities"`
	CommandsMode CommandsMode      `json:"commandsMode"`
	Commands     []CommandRule     `json:"commands"`
	Egress       EgressPolicy      `json:"egress"`
}

func (m CommandsMode) Normalize() CommandsMode {
	switch m {
	case CommandsOpen, CommandsClosed, CommandsWhitelist, CommandsBlacklist:
		return m
	default:
		return CommandsWhitelist
	}
}

package types

type EgressSandboxState struct {
	Name   string       `json:"name"`
	IP     string       `json:"ip"`
	Policy EgressPolicy `json:"policy"`
}

type EgressState struct {
	Version   string               `json:"version"`
	Sandboxes []EgressSandboxState `json:"sandboxes"`
}

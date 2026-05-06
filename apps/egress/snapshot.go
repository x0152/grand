package egress

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"

	"mantis/core/types"
)

type SnapshotClient struct {
	url    string
	token  string
	client *http.Client
}

func NewSnapshotClient(url, token string, client *http.Client) *SnapshotClient {
	if client == nil {
		client = http.DefaultClient
	}
	return &SnapshotClient{url: url, token: token, client: client}
}

func (c *SnapshotClient) Fetch(ctx context.Context) (types.EgressState, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.url, nil)
	if err != nil {
		return types.EgressState{}, err
	}
	if c.token != "" {
		req.Header.Set("X-Runtime-Token", c.token)
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return types.EgressState{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return types.EgressState{}, fmt.Errorf("egress snapshot: %s", resp.Status)
	}
	var state types.EgressState
	if err := json.NewDecoder(resp.Body).Decode(&state); err != nil {
		return types.EgressState{}, err
	}
	state.Version = canonicalVersion(state)
	return state, nil
}

func canonicalVersion(state types.EgressState) string {
	sandboxes := append([]types.EgressSandboxState{}, state.Sandboxes...)
	sort.Slice(sandboxes, func(i, j int) bool { return sandboxes[i].Name < sandboxes[j].Name })
	for i := range sandboxes {
		sort.Strings(sandboxes[i].Policy.Hosts)
		sort.Strings(sandboxes[i].Policy.CIDRs)
	}
	raw, _ := json.Marshal(sandboxes)
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:8])
}

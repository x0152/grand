package agents

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"

	agent "mantis/core/plugins/agent"
	"mantis/core/protocols"
	"mantis/core/types"
	"mantis/shared"
)

const sshBasePrompt = `You are an SSH agent. All actions go through execute_command tool calls only.

Rules:
- Be concise: short answers, no filler, keep full info. Verbose only if user asks.
- One command per call. Explain briefly before each call.
- Verify before acting (which, cat, ls).
- Summarize the result at the end.
- Plain text only, no Markdown/HTML.
- If a command is blocked, do not retry it — use an alternative or inform the user.

execute_command(command: string) — run a shell command on the remote server via SSH.`

type SSHConfig struct {
	Host       string `json:"host"`
	Port       int    `json:"port"`
	Username   string `json:"username"`
	Password   string `json:"password"`
	PrivateKey string `json:"privateKey"`
}

type SSHInput struct {
	Model      types.Model
	SSHConfig  SSHConfig
	Connection types.Connection
	Task       string
}

type SSHAgent struct {
	llmConnStore  protocols.Store[string, types.LlmConnection]
	agent         *agent.Agent
	guard         protocols.GuardEvaluator
	sessionLogger *shared.SessionLogger
	limits        shared.Limits
}

func NewSSHAgent(llmConnStore protocols.Store[string, types.LlmConnection], llm protocols.LLM, g protocols.GuardEvaluator, sessionLogger *shared.SessionLogger, limits shared.Limits) *SSHAgent {
	return &SSHAgent{
		llmConnStore:  llmConnStore,
		agent:         agent.New(llm),
		guard:         g,
		sessionLogger: sessionLogger,
		limits:        limits,
	}
}

func (a *SSHAgent) Limits() shared.Limits { return a.limits }

func (a *SSHAgent) Execute(ctx context.Context, in SSHInput) (<-chan types.StreamEvent, error) {
	conn, err := shared.ResolveConnection(ctx, a.llmConnStore, in.Model.ConnectionID)
	if err != nil {
		return nil, err
	}

	hostReadme, err := a.probeHost(in.SSHConfig)
	if err != nil {
		return nil, fmt.Errorf("ssh probe %s:%d: %w", in.SSHConfig.Host, in.SSHConfig.Port, err)
	}

	prompt := a.buildPrompt(ctx, in.Connection, hostReadme)
	tools := sshTools(in.SSHConfig, a.guard, in.Connection.ID, in.Connection.ProfileIDs)

	messages := []protocols.LLMMessage{
		{Role: "system", Content: prompt},
		{Role: "user", Content: in.Task},
	}

	ch, err := a.agent.Execute(ctx, agent.AgentInput{
		LoopInput: agent.LoopInput{
			ActionInput: agent.ActionInput{
				Provider:     conn.Provider,
				BaseURL:      conn.BaseURL,
				APIKey:       conn.APIKey,
				Model:        in.Model.Name,
				Messages:     messages,
				Tools:        tools,
				ThinkingMode: in.Model.ThinkingMode,
			},
			MaxIterations: a.limits.ServerMaxIterations,
		},
	})
	if err != nil {
		return nil, err
	}

	if a.sessionLogger != nil {
		ch = a.sessionLogger.Wrap(ctx, in.Connection.ID, "ssh", sshDisplayHost(in.SSHConfig), in.Task, ch)
	}

	return ch, nil
}

func sshDisplayHost(cfg SSHConfig) string {
	host := strings.TrimSpace(cfg.Host)
	user := strings.TrimSpace(cfg.Username)
	if host == "" && user == "" {
		return ""
	}
	if user == "" {
		return host
	}
	if host == "" {
		return user
	}
	return user + "@" + host
}

func (a *SSHAgent) probeHost(cfg SSHConfig) (string, error) {
	client, err := dialSSH(cfg, 10*time.Second)
	if err != nil {
		return "", err
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		return "", fmt.Errorf("ssh session: %w", err)
	}
	defer session.Close()

	var stdout bytes.Buffer
	session.Stdout = &stdout
	_ = session.Run("cat ~/README.md 2>/dev/null || cat /etc/sandbox/README.md 2>/dev/null")

	return strings.TrimSpace(stdout.String()), nil
}

func (a *SSHAgent) buildPrompt(ctx context.Context, c types.Connection, hostReadme string) string {
	var sb strings.Builder
	sb.WriteString(sshBasePrompt)
	sb.WriteString(fmt.Sprintf("\n\nCurrent date/time: %s", time.Now().UTC().Format("Monday, 2006-01-02 15:04:05 UTC")))

	if c.Description != "" {
		sb.WriteString(fmt.Sprintf("\n\nServer: %s\nDescription: %s", c.Name, c.Description))
	}

	if hostReadme != "" {
		sb.WriteString("\n\n--- Host instruction (README.md) ---\n")
		sb.WriteString(hostReadme)
		sb.WriteString("\n--- End of instruction ---")
	}

	if len(c.Memories) > 0 {
		sb.WriteString("\n\nYou already know about this server:")
		for _, m := range c.Memories {
			sb.WriteString(fmt.Sprintf("\n- %s", m.Content))
		}
	}

	if desc := a.guard.Describe(ctx, c.ProfileIDs); desc != "" {
		sb.WriteString("\n\n")
		sb.WriteString(desc)
	}

	return sb.String()
}

func sshTools(cfg SSHConfig, g protocols.GuardEvaluator, connectionID string, profileIDs []string) []types.Tool {
	return []types.Tool{
		{
			Name:        "execute_command",
			Description: "Execute a shell command on the remote server via SSH",
			Icon:        "terminal",
			Label: func(args string) string {
				var input struct {
					Command string `json:"command"`
				}
				json.Unmarshal([]byte(args), &input)
				if input.Command != "" {
					return "$ " + input.Command
				}
				return "SSH command"
			},
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"command": map[string]any{
						"type":        "string",
						"description": "Shell command to execute",
					},
				},
				"required": []string{"command"},
			},
			Execute: func(ctx context.Context, args string) (string, error) {
				var input struct {
					Command string `json:"command"`
				}
				if err := json.Unmarshal([]byte(args), &input); err != nil {
					return "", err
				}
				if g != nil {
					if allowed, rule, message := g.EvaluateCommand(ctx, profileIDs, connectionID, input.Command); !allowed {
						return commandBlockTag(input.Command, rule, message, profileIDs), nil
					}
				}
				start := time.Now().UTC().Add(-200 * time.Millisecond)
				out, err := execSSH(cfg, input.Command)
				if g != nil && connectionID != "" {
					if footer := egressFooter(g.RecentBlockedHosts(ctx, connectionID, start, 25)); footer != "" {
						if out != "" && !strings.HasSuffix(out, "\n") {
							out += "\n"
						}
						out += footer
					}
				}
				return formatCommandToolResult(out, err), nil
			},
		},
	}
}

func dialSSH(cfg SSHConfig, timeout time.Duration) (*ssh.Client, error) {
	authMethods := []ssh.AuthMethod{}
	if cfg.Password != "" {
		authMethods = append(authMethods, ssh.Password(cfg.Password))
	}
	if cfg.PrivateKey != "" {
		signer, err := ssh.ParsePrivateKey([]byte(cfg.PrivateKey))
		if err != nil {
			return nil, fmt.Errorf("parse private key: %w", err)
		}
		authMethods = append(authMethods, ssh.PublicKeys(signer))
	}

	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	sshConfig := &ssh.ClientConfig{
		User:            cfg.Username,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         timeout,
	}

	port := cfg.Port
	if port == 0 {
		port = 22
	}
	addr := net.JoinHostPort(cfg.Host, fmt.Sprintf("%d", port))

	client, err := ssh.Dial("tcp", addr, sshConfig)
	if err != nil {
		return nil, fmt.Errorf("ssh connect %s: %w", addr, err)
	}
	return client, nil
}

const maxOutputBytes = 32768

// egressFooter renders a single-line, machine-parseable marker that the agent
// loop appends to tool output for network blocks recorded by the egress
// gateway. The frontend lifts it into a colored chip via the
// `<guard-block kind="network">...</guard-block>` regex; the LLM reads the
// inner sentence and learns this is a policy block (not a network/DNS error)
// without any extra system-prompt overhead.
//
// Format: `<guard-block kind="network" profiles="id1,id2">policy block (not
// network/DNS). edit /guard-profiles. hosts: host[:reason][ xN], ...</guard-block>`
func egressFooter(blocks []protocols.HostBlock) string {
	if len(blocks) == 0 {
		return ""
	}
	parts := make([]string, 0, len(blocks))
	profiles := make([]string, 0)
	seen := make(map[string]bool)
	for _, h := range blocks {
		entry := sanitizeTagPayload(h.Host)
		if h.Reason != "" {
			entry += ":" + sanitizeTagPayload(h.Reason)
		}
		if h.Count > 1 {
			entry += fmt.Sprintf(" x%d", h.Count)
		}
		parts = append(parts, entry)
		for _, pid := range h.ProfileIDs {
			if pid == "" || seen[pid] {
				continue
			}
			seen[pid] = true
			profiles = append(profiles, pid)
		}
	}
	return "\n<guard-block kind=\"network\"" + profilesAttr(profiles) +
		">policy block (not network/DNS). edit /guard-profiles. hosts: " +
		strings.Join(parts, ", ") + "</guard-block>"
}

// commandBlockTag is the command-side counterpart to egressFooter: it replaces
// the (now-removed) `[BLOCKED] msg` string with the same XML envelope so the
// frontend renders one consistent badge and the LLM sees the same directive.
func commandBlockTag(command, rule, message string, profileIDs []string) string {
	rule = strings.TrimSpace(rule)
	message = strings.TrimSpace(message)
	cmd := sanitizeTagPayload(strings.TrimSpace(command))
	if cmd == "" {
		cmd = "(empty)"
	}
	detail := sanitizeTagPayload(message)
	if detail == "" {
		detail = sanitizeTagPayload(rule)
	}
	body := "policy block (not a server error). edit /guard-profiles. cmd: " + cmd
	if detail != "" {
		body += " — " + detail
	}
	return "<guard-block kind=\"command\"" + profilesAttr(profileIDs) + ">" + body + "</guard-block>"
}

// profilesAttr renders the optional `profiles="id1,id2"` attribute. We sanitise
// IDs the same way as payloads so a malformed profile id can't break the
// envelope. Empty list yields no attribute (keeps the marker compact).
func profilesAttr(ids []string) string {
	if len(ids) == 0 {
		return ""
	}
	clean := make([]string, 0, len(ids))
	seen := make(map[string]bool)
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		clean = append(clean, sanitizeAttrValue(id))
	}
	if len(clean) == 0 {
		return ""
	}
	return ` profiles="` + strings.Join(clean, ",") + `"`
}

func sanitizeAttrValue(s string) string {
	s = strings.ReplaceAll(s, `"`, "")
	s = strings.ReplaceAll(s, `,`, "")
	s = strings.ReplaceAll(s, `<`, "")
	s = strings.ReplaceAll(s, `>`, "")
	return s
}

// sanitizeTagPayload neutralises angle brackets so a target/host/message that
// happens to contain `<` or `>` cannot break the XML envelope and confuse the
// frontend regex.
func sanitizeTagPayload(s string) string {
	s = strings.ReplaceAll(s, "<", "‹")
	s = strings.ReplaceAll(s, ">", "›")
	return s
}

func execSSH(cfg SSHConfig, command string) (string, error) {
	client, err := dialSSH(cfg, 10*time.Second)
	if err != nil {
		return "", err
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		return "", fmt.Errorf("ssh session: %w", err)
	}
	defer session.Close()

	var stdout, stderr bytes.Buffer
	session.Stdout = &stdout
	session.Stderr = &stderr

	err = session.Run(command)
	output := stdout.String()
	if stderr.Len() > 0 {
		output += stderr.String()
	}
	if len(output) > maxOutputBytes {
		total := len(output)
		output = output[:maxOutputBytes] + fmt.Sprintf(
			"\n\n[TRUNCATED: %d/%d bytes shown. Redirect to file and use grep/head/tail.]",
			maxOutputBytes, total)
	}
	return output, err
}

func formatCommandToolResult(output string, runErr error) string {
	status := "status: exit 0 (success)"
	if runErr != nil {
		var exitErr *ssh.ExitError
		if errors.As(runErr, &exitErr) {
			status = fmt.Sprintf("status: exit %d (error)", exitErr.ExitStatus())
		} else {
			status = "status: error (" + strings.TrimSpace(runErr.Error()) + ")"
		}
	}

	body := output
	if strings.TrimSpace(body) == "" {
		body = "(no output)"
	}
	return status + "\noutput:\n" + body
}

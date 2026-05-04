package usecases

import (
	"encoding/json"

	"mantis/core/types"
)

type seedSkill struct {
	Name        string
	Description string
	Parameters  json.RawMessage
	Script      string
}

func seedSkills() map[string][]seedSkill {
	return map[string][]seedSkill{
		"base": {
			{
				Name:        "http_health_check",
				Description: "Check if a URL is reachable. Returns HTTP status code and response time.",
				Parameters: json.RawMessage(`{"type":"object","properties":{` +
					`"url":{"type":"string","description":"URL to check"},` +
					`"expected_status":{"type":"integer","description":"Expected HTTP status code (default 200)"}},` +
					`"required":["url"]}`),
				Script: `curl -sS -o /dev/null -w "status=%{http_code} time=%{time_total}s" --connect-timeout 10 --max-time 30 "{{.url}}"`,
			},
			{
				Name:        "system_health",
				Description: "Server health snapshot: CPU load, memory, disk usage, top processes.",
				Parameters:  json.RawMessage(`{"type":"object","properties":{}}`),
				Script:      `echo "=== Uptime ===" && uptime && echo "\n=== Memory ===" && free -h && echo "\n=== Disk ===" && df -h / && echo "\n=== Top processes ===" && ps aux --sort=-%mem | head -6`,
			},
			{
				Name:        "find_large_files",
				Description: "Find files larger than a given size in a directory.",
				Parameters: json.RawMessage(`{"type":"object","properties":{` +
					`"path":{"type":"string","description":"Directory to search in"},` +
					`"min_size_mb":{"type":"integer","description":"Minimum file size in MB (default 100)"}},` +
					`"required":["path"]}`),
				Script: `find "{{.path}}" -type f -size +{{if .min_size_mb}}{{.min_size_mb}}{{else}}100{{end}}M -exec ls -lh {} \; 2>/dev/null | sort -k5 -hr | head -20`,
			},
		},
		"browser": {
			{
				Name:        "web_search",
				Description: "Search the web via DuckDuckGo. Returns titles, URLs, and snippets.",
				Parameters: json.RawMessage(`{"type":"object","properties":{` +
					`"query":{"type":"string","description":"Search query"}},` +
					`"required":["query"]}`),
				Script: `web-search '{{.query}}'`,
			},
			{
				Name:        "screenshot",
				Description: "Take a screenshot of a web page using Playwright.",
				Parameters: json.RawMessage(`{"type":"object","properties":{` +
					`"url":{"type":"string","description":"Page URL to screenshot"},` +
					`"full_page":{"type":"boolean","description":"Capture full scrollable page"}},` +
					`"required":["url"]}`),
				Script: `pw-screenshot {{if .full_page}}--full-page {{end}}"{{.url}}" /tmp/screenshot.png && echo "Screenshot saved to /tmp/screenshot.png" && echo "NEXT: call ssh_download_browser with remotePath /tmp/screenshot.png, then call send_file with the artifactId from the download result."`,
			},
			{
				Name:        "read_webpage",
				Description: "Extract clean text from a URL as Markdown. Use ONLY for reading a specific known URL, NOT for general searching — let the agent handle research tasks.",
				Parameters: json.RawMessage(`{"type":"object","properties":{` +
					`"url":{"type":"string","description":"Page URL to read"}},` +
					`"required":["url"]}`),
				Script: `jina-read "{{.url}}"`,
			},
		},
	}
}

func seedPlans() []types.Plan {
	pos := func(x, y int) json.RawMessage {
		v, _ := json.Marshal(map[string]int{"x": x, "y": y})
		return v
	}
	return []types.Plan{
		{
			Name:        "Screenshot",
			Description: "Take a screenshot of a web page and send it to the chat.",
			Schedule:    "",
			Enabled:     true,
			Parameters:  json.RawMessage(`{"type":"object","properties":{"url":{"type":"string","description":"Full URL of the page to screenshot (e.g. https://example.com)"}}}`),
			Graph: types.PlanGraph{
				Nodes: []types.PlanNode{
					{ID: "n1", Type: types.PlanNodeAction, Label: "Screenshot", Prompt: `Use the screenshot skill on the browser connection to take a screenshot of "{{.url}}".`, Position: pos(250, 0)},
					{ID: "n2", Type: types.PlanNodeAction, Label: "Download", Prompt: `Download the screenshot file from the browser server. The file was saved to /tmp/screenshot.png — use ssh_download_browser with remotePath "/tmp/screenshot.png".`, Position: pos(250, 150)},
					{ID: "n3", Type: types.PlanNodeAction, Label: "Send", Prompt: `Send the downloaded screenshot artifact to the chat using send_file. Use the artifact ID from the previous step.`, Position: pos(250, 300)},
				},
				Edges: []types.PlanEdge{
					{ID: "e1", Source: "n1", Target: "n2"},
					{ID: "e2", Source: "n2", Target: "n3"},
				},
			},
		},
		{
			Name:        "Morning Server Report",
			Description: "Check server health and send a notification with the status.",
			Schedule:    "",
			Enabled:     false,
			Parameters:  json.RawMessage(`{}`),
			Graph: types.PlanGraph{
				Nodes: []types.PlanNode{
					{ID: "n1", Type: types.PlanNodeAction, Label: "Check health", Prompt: `Run the system_health skill on the base connection. Analyze the output: note CPU load average, memory usage percentage, and disk usage percentage.`, Position: pos(250, 0)},
					{ID: "n2", Type: types.PlanNodeDecision, Label: "Any issues?", Prompt: `Based on the health check results, are there any problems? Answer YES if: load average > 2.0, memory usage > 80%, or disk usage > 85%. Answer NO otherwise.`, Position: pos(250, 150)},
					{ID: "n3", Type: types.PlanNodeAction, Label: "Alert", Prompt: `Send a notification via send_notification describing the problems found: which metrics are above thresholds and their current values.`, Position: pos(50, 300)},
					{ID: "n4", Type: types.PlanNodeAction, Label: "All OK", Prompt: `Send a short notification via send_notification saying all systems are running normally.`, Position: pos(450, 300)},
				},
				Edges: []types.PlanEdge{
					{ID: "e1", Source: "n1", Target: "n2"},
					{ID: "e2", Source: "n2", Target: "n3", Label: "yes"},
					{ID: "e3", Source: "n2", Target: "n4", Label: "no"},
				},
			},
		},
		{
			Name:        "Research Assistant",
			Description: "Search the web for a given topic, read top articles, and send a summary digest.",
			Schedule:    "",
			Enabled:     false,
			Parameters:  json.RawMessage(`{"type":"object","properties":{"topic":{"type":"string","description":"The topic to research (e.g. \"latest Kubernetes news\")"}}}`),
			Graph: types.PlanGraph{
				Nodes: []types.PlanNode{
					{ID: "n1", Type: types.PlanNodeAction, Label: "Search", Prompt: `Use the web_search skill on the browser connection to search for "{{.topic}}". Return the top 5 results with titles and URLs.`, Position: pos(250, 0)},
					{ID: "n2", Type: types.PlanNodeAction, Label: "Read articles", Prompt: `Take the first 2 URLs from the search results. Use the read_webpage skill to get the content. Summarize the key points about "{{.topic}}".`, ClearContext: true, Position: pos(250, 150)},
					{ID: "n3", Type: types.PlanNodeAction, Label: "Send digest", Prompt: `Compile a brief digest from the article summaries about "{{.topic}}". Send it via send_notification.`, Position: pos(250, 300)},
				},
				Edges: []types.PlanEdge{
					{ID: "e1", Source: "n1", Target: "n2"},
					{ID: "e2", Source: "n2", Target: "n3"},
				},
			},
		},
		{
			Name:        "Restart Service",
			Description: "Restart a system service, verify it is running, and send an alert with the result.",
			Schedule:    "",
			Enabled:     false,
			Parameters:  json.RawMessage(`{"type":"object","properties":{"service_name":{"type":"string","description":"Name of the systemd service (e.g. nginx, docker)"}}}`),
			Graph: types.PlanGraph{
				Nodes: []types.PlanNode{
					{ID: "n1", Type: types.PlanNodeAction, Label: "Restart", Prompt: `On the base server, restart the "{{.service_name}}" service and then check if it is active.`, Position: pos(250, 0)},
					{ID: "n2", Type: types.PlanNodeDecision, Label: "Is active?", Prompt: `Based on the output, is the {{.service_name}} service active and running? Answer YES or NO.`, Position: pos(250, 150)},
					{ID: "n3", Type: types.PlanNodeAction, Label: "Success", Prompt: `Send a notification via send_notification saying that {{.service_name}} was successfully restarted and is running.`, Position: pos(50, 300)},
					{ID: "n4", Type: types.PlanNodeAction, Label: "Failure", Prompt: `Send an URGENT notification via send_notification saying that {{.service_name}} failed to restart and needs manual intervention.`, Position: pos(450, 300)},
				},
				Edges: []types.PlanEdge{
					{ID: "e1", Source: "n1", Target: "n2"},
					{ID: "e2", Source: "n2", Target: "n3", Label: "yes"},
					{ID: "e3", Source: "n2", Target: "n4", Label: "no"},
				},
			},
		},
	}
}

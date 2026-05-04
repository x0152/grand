package usecases

import (
	"fmt"
	"net/url"
	"regexp"
	"strings"
)

const llmConnectionIDFallback = "llm-primary"

func normalizeBaseURL(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	u, err := url.Parse(trimmed)
	if err != nil || u.Host == "" {
		return strings.ToLower(strings.TrimRight(trimmed, "/"))
	}
	out := fmt.Sprintf("%s://%s%s", u.Scheme, u.Host, u.Path)
	return strings.ToLower(strings.TrimRight(out, "/"))
}

var nonSlugRE = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(input string) string {
	out := nonSlugRE.ReplaceAllString(strings.ToLower(input), "-")
	out = strings.Trim(out, "-")
	if out == "" {
		return llmConnectionIDFallback
	}
	return out
}

func suggestEndpointID(baseURL, provider string) string {
	if provider == "gonka" {
		return "gonka-primary"
	}
	u, err := url.Parse(strings.TrimSpace(baseURL))
	if err != nil || u.Host == "" {
		return llmConnectionIDFallback
	}
	host := u.Hostname()
	if u.Port() != "" {
		host = host + "-" + u.Port()
	}
	hostSlug := slugify(host)
	switch {
	case strings.Contains(hostSlug, "openai"):
		return "openai-primary"
	case strings.Contains(hostSlug, "localhost"), strings.HasPrefix(hostSlug, "127-"):
		return "local-llm"
	default:
		return clip("llm-"+hostSlug, 48)
	}
}

func makeUniqueID(base string, existing map[string]struct{}) string {
	if _, ok := existing[base]; !ok {
		return base
	}
	for i := 2; i < 1000; i++ {
		candidate := clip(fmt.Sprintf("%s-%d", base, i), 48)
		if _, ok := existing[candidate]; !ok {
			return candidate
		}
	}
	return clip(fmt.Sprintf("%s-%d", base, 0), 48)
}

func clip(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

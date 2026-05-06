# Egress Gateway

A small Go service that filters outbound traffic of sandbox containers
according to the `EgressPolicy` of their guard profiles.

## Components

- `policy.go` — compiled per-sandbox rules (mode, host suffix matcher, CIDRs).
- `dns.go` — DNS server (UDP/TCP) that resolves only allowed domains and
  pushes resolved IPs into firewall sets.
- `firewall_linux.go` / `firewall_other.go` — Linux nftables driver for
  L3 enforcement. No-op stub on non-Linux for compile-time portability.
- `snapshot.go` — pulls compiled state from the runtime
  (`GET /api/runtime/egress/state`).
- `server.go` — controller that orchestrates polling, push reloads
  (HTTP `/reload`), and ruleset application.
- `logger.go` — structured JSON logger for allow/block decisions.

## Modes

The gateway supports four egress modes per sandbox:

| Mode | Behavior |
| --- | --- |
| `open` | All destinations allowed |
| `closed` | All destinations blocked |
| `whitelist` | Only listed hosts/CIDRs allowed |
| `blacklist` | Listed hosts/CIDRs blocked, rest allowed |

`hosts` accepts exact names (`api.openai.com`) and wildcards (`*.github.com`).
`cidrs` accepts CIDR ranges (`10.0.0.0/8`) or single IPs (`1.2.3.4` is
treated as `/32`).

## Identification

Each sandbox is identified by its source IP on the per-sandbox bridge.
The runtime computes the snapshot from registered guard profiles attached
to the sandbox connection. Multiple profiles on the same connection are
merged (mode collapses to the most restrictive: `closed` > `whitelist` >
`blacklist` > `open`; host/CIDR sets are unioned).

## Operation

- Snapshot pull every `POLL_INTERVAL` (default 30s) provides resilience
  against missed push events.
- `POST /reload` triggers an immediate refresh; metadata use-cases call
  this on every guard profile change.
- DNS answers carry a 5 minute TTL by default; resolved IPs are added
  to nftables sets with a TTL ≥ 60s for whitelist mode.

## Limitations

- DNS-only filtering on the dev/macOS path — direct IP egress that
  bypasses DNS is **not** blocked unless nftables enforcement is enabled.
- nftables enforcement requires the gateway to share a network
  namespace with the bridges it filters. In docker-compose this means
  running the gateway with the host's docker daemon (the default in our
  compose files); in k8s with DinD the gateway has to be spawned as a
  container managed by the same DinD daemon as sandboxes (not yet
  automated — manual setup required).
- L3 enforcement is opt-in via `EGRESS_DRY_RUN=false`. On dev
  (Docker Desktop on macOS) keep `EGRESS_DRY_RUN=true`.

## Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `RUNTIME_STATE_URL` | `http://app:8080/api/runtime/egress/state` | Snapshot endpoint |
| `RUNTIME_API_TOKEN` | _empty_ | Token for `X-Runtime-Token` header |
| `DNS_LISTEN` | `:53` | DNS bind address |
| `HTTP_LISTEN` | `:9999` | Control plane bind address |
| `POLL_INTERVAL` | `30s` | Snapshot pull interval |
| `EGRESS_DRY_RUN` | `false` | Skip nftables ruleset application |

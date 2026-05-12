<h1>
  <img src="docs/logo.svg" alt="" width="48" height="48" align="left" />
  &nbsp;GRAND
</h1>

[![Website](https://img.shields.io/badge/website-x0152.github.io%2Fgrand-1d9c92?style=flat-square)](https://x0152.github.io/grand/)
[![License: MIT](https://img.shields.io/badge/license-MIT-1d9c92?style=flat-square)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/docs-%2Fdocs-1d9c92?style=flat-square)](docs/)

Multi-agent system where an LLM orchestrates a pool of isolated agents, each running on a dedicated SSH sandbox container with specialized tools. Designed for managing large server infrastructure — from quick one-off tasks to complex multi-step workflows. You interact via Telegram or Web UI — the LLM routes tasks to the right agent, commands pass through a guard layer before execution.

> Early development — works end-to-end but expect rough edges.

![Chat interface showing the agent browsing Hacker News and summarizing the top stories](docs/screenshot-chat.png)

![Modern web UI — single chat on Kimi K2.6 producing two artifacts back-to-back: a Hacker News homepage screenshot from the `browser` sandbox (Playwright + Chromium) and a 30-day Bitcoin price chart from the `base` sandbox (Python + matplotlib), each attached back to the conversation as a PNG](docs/screenshot-modern.png)

![Windows XP shell — three chats running on Kimi K2.6, each in its own sandbox: Bitcoin chart (`base`), Hacker News screenshot (`browser`), DNS lookup (`netsec`), plus a `cmd.exe` window showing one tool step in detail](docs/screenshot-winxp.png)

## What it does

- **Chat** — write a message, the LLM picks which server to use and what commands to run
- **Guard** — every command goes through a security layer (profiles with capabilities + command whitelists) before execution
- **Any LLM** — works with any OpenAI-compatible API: cloud or local (Ollama, LM Studio, etc.)
- **Sandboxes** — each server is a Docker container with SSH and pre-installed tools
- **Skills** — reusable SSH scripts exposed as LLM tools with typed parameters and Go template injection
- **Plans** — agentic workflows: visual graph editor (React Flow) with action/decision nodes, branching, retries, clear context, cancel, scheduled execution via cron
  - **Parameters** — plans support typed input parameters (JSON Schema); node prompts use Go templates (`{{.param}}`) for dynamic values
  - **Agent-created plans** — the LLM agent can create multi-step plans from chat using a simple DSL (steps with actions and decisions), including scheduled tasks
- **Presets** — named model configurations (chat model, fallback model, image model) assignable per connection or globally
- **Memory** — long-term memory: remembers facts about you and each server across conversations
- **Notifications** — the agent can send proactive alerts and reports to Telegram via `send_notification`
- **Telegram** — bot with voice messages, files, model switching
- **ASR / OCR / TTS** — optional speech-to-text, OCR, text-to-speech integrations

## Architecture

```
                                                ┌──────────────────┐
┌───────────┐  ┌───────────┐                    │  LLM provider    │
│ Telegram  │  │ Web Chat  │                    │  (OpenAI / local)│
└─────┬─────┘  └─────┬─────┘                    └────────┬─────────┘
      │               │                                  │ API
      ▼               ▼                                  │
┌────────────────────────────────────────────────────────┼────────┐
│  GRAND                           docker-compose / k8s  │        │
│                                                        │        │
│  ┌─────────────┐   ┌──────────────────┐          ┌─────┴──────┐ │
│  │  Web Panel  │   │   Agent Loop     │◀────────▶│ LLM client │ │
│  │   (React)   │   │                  │          └────────────┘ │
│  └─────────────┘   └────────┬─────────┘                         │
│                          tool calls                             │
│  ┌────────────┐         ┌───┴────┐                              │
│  │ PostgreSQL │         │ Guard  │──── deny ───▶ x blocked      │
│  └────────────┘         └───┬────┘                              │
│                           allow                                 │
│                    ┌────────┼────────┐                           │
│                    ▼        ▼        ▼                           │
│               ┌────────┬────────┬────────┬────────┐             │
│               │ agent  │ agent  │ agent  │ agent  │  ...        │
│               └───┬────┘───┬────┘───┬────┘───┬────┘             │
└───────────────────┼────────┼────────┼────────┼──────────────────┘
                    │        │        │        │ SSH
                    ▼        ▼        ▼        ▼
              ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
              │  base  │ │browser │ │ ffmpeg │ │ python │ │   db   │
              │  :2222 │ │ :2223  │ │ :2224  │ │ :2225  │ │  :2226 │
              └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
                    isolated SSH sandboxes with pre-installed tools
```

## Web Panel

| Page | Description |
|------|-------------|
| Chat | Conversations with the agent, session management |
| Plans | Visual workflow editor (React Flow), run history, parameters, scheduled execution |
| Skills | Reusable SSH scripts with parameter editor, exposed as agent tools |
| Servers | SSH connection management |
| LLMs & Models | LLM provider connections and model registry |
| Presets | Named model configurations (chat / fallback / image) |
| Channels | Telegram bot configuration |
| Guard Profiles | Security profiles with capability and command whitelists |
| Logs | Session logs with tool call details |

## Quick Start

### Option A: Local Docker Compose (fastest)

```bash
git clone https://github.com/x0152/grand.git
cd grand
./quickstart.sh
```

That's it. `quickstart.sh` checks Docker, creates `.env` from
`.env.example`, generates a random `AUTH_TOKEN` / `RUNTIME_API_TOKEN`,
builds service images, prebuilds all sandbox images up front, then runs
`docker compose up -d` and prints the URL + login token at the end.
Everything else (LLM provider, models, Telegram, email/SMTP) is configured
from the in-app setup wizard — no `.env` editing required for the first
run.

Prefer to do it by hand:

```bash
cp .env.example .env
# edit AUTH_TOKEN and RUNTIME_API_TOKEN to long random strings
docker compose build
docker compose run --rm --no-deps -e SANDBOX_PREBUILD_MODE=build sandbox-prebuild
docker compose up -d
```

Then open http://localhost:27173 and sign in with `AUTH_TOKEN`.

#### What to expect on the first boot

| Run | Wall time | Why |
|---|---|---|
| First boot | ~3–6 min | Pulls Alpine/Python base layers and builds **7 sandbox images** — `sandbox-base` plus 6 builtins (`base`, `browser`, `email`, `ffmpeg`, `netsec`, `runtimectl`) |
| Subsequent boots | <30 s | Each Dockerfile is hashed; unchanged sandboxes are skipped |

`quickstart.sh` runs the full sandbox image prebuild before starting the
stack. During `docker compose up`, the `sandbox-prebuild` service only
verifies that images are already cached, then exits. Watch the progress
live — it prints one line per image:

```bash
docker compose logs -f sandbox-prebuild
# sandbox-prebuild: base         up-to-date (sha=…)
# sandbox-prebuild: browser      up-to-date (sha=…)
# …
# sandbox-prebuild: all 7 sandbox images are prebuilt
```

Useful commands:

```bash
docker compose logs -f app             # backend logs
docker compose logs -f sandbox-prebuild # prebuild verification logs
docker compose down                    # stop everything
```

### Option B: Kubernetes (Helm)

#### 1) Build and push images

```bash
export TAG=$(git rev-parse --short HEAD)
export REGISTRY=ghcr.io/<your-org>

docker build -f Dockerfile.prod -t ${REGISTRY}/mantis:${TAG} .
docker build -f frontend/Dockerfile.prod -t ${REGISTRY}/mantis-frontend:${TAG} frontend

docker push ${REGISTRY}/mantis:${TAG}
docker push ${REGISTRY}/mantis-frontend:${TAG}
```

Sandbox Dockerfiles are embedded inside the app image, so no extra push
step is needed. The backend bootstraps them on first start (in the
runtime mode that owns Docker — DIND sidecar or host-socket): each
Dockerfile is hashed and built once, then cached. Plan for **~3–6 min on
the first pod start**, and <30 s on subsequent ones. Follow progress with:

```bash
kubectl -n mantis logs -f deploy/app | grep -E 'runtime bootstrap|sandbox'
# runtime bootstrap: building base image base
# runtime bootstrap: base image base ready
# runtime bootstrap: building browser
# …
```

#### 2) Deploy with Helm

```bash
helm upgrade --install mantis ./helm/mantis \
  --namespace mantis --create-namespace \
  --set apps.global.image.repository=${REGISTRY}/mantis \
  --set apps.global.image.tag=${TAG} \
  --set frontend.image.repository=${REGISTRY}/mantis-frontend \
  --set frontend.image.tag=${TAG} \
  --set ingress.enabled=false
```

By default the chart uses `secrets.authToken=mantis-dev-token` for a quick
first boot. Override it in real environments.

#### 3) Access without Ingress (recommended for first run)

```bash
kubectl -n mantis port-forward svc/frontend 27173:80
```

Then open http://localhost:27173.

#### 4) Access with Ingress (optional)

If your cluster has an ingress controller:

```bash
helm upgrade --install mantis ./helm/mantis \
  --namespace mantis --create-namespace \
  --set apps.global.image.repository=${REGISTRY}/mantis \
  --set apps.global.image.tag=${TAG} \
  --set frontend.image.repository=${REGISTRY}/mantis-frontend \
  --set frontend.image.tag=${TAG} \
  --set secrets.authToken='change-me-to-a-long-random-string' \
  --set ingress.enabled=true \
  --set ingress.host=mantis.local
```

Point `mantis.local` to your ingress controller address (for local clusters this is often `127.0.0.1`) and open `http://mantis.local`.

For production TLS, cert-manager, external secrets, and runtime mode details, see [`helm/mantis/README.md`](helm/mantis/README.md).

## Required env

Drop these into `.env` before anything else:

```bash
AUTH_TOKEN=long-random-string                   # your sign-in token
MANTIS_LLM_BASE_URL=https://api.openai.com/v1   # or local Ollama / LM Studio
MANTIS_LLM_API_KEY=sk-...                       # "dummy" for local
MANTIS_LLM_MODEL=gpt-4o-mini                    # comma-separated for multiple
```

`MANTIS_LLM_*` values prefill setup wizard fields via backend config resolution and are re-read after a configuration reset.

On first start the backend creates a single admin user tied to `AUTH_TOKEN` (change `AUTH_USER_NAME` if you want something other than `admin`). The login endpoint is rate-limited — defaults to 5 failed attempts per 15 minutes per IP; tune with `AUTH_RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_WINDOW`.

Optional: `MANTIS_TG_BOT_TOKEN` + `MANTIS_TG_USER_IDS` (Telegram), `ASR_API_URL` / `OCR_API_URL` / `TTS_API_URL` (speech/OCR services), `MANTIS_BACKEND_PORT` / `MANTIS_FRONTEND_PORT` / `MANTIS_PORT` (host ports). Full list in `.env.example`.

## Setup wizard

The first sign-in opens a step-by-step wizard that connects an LLM provider, picks chat / summary / vision models, and (optionally) a Telegram bot. Every value lands in a single `app_config` row on the backend; environment variables (`MANTIS_LLM_*`, `MANTIS_TG_*`, `GONKA_*`) act as prefill only.

The same wizard lives under **Setup** in the sidebar:

- **Continue** — resume the wizard from the first unfinished step.
- **Re-run wizard** — walk every step again with current values prefilled.
- **Reset** — clear `app_config` and reopen the wizard. Existing AI engine, hosts, and channels stay; you can still edit them on their pages.

## Generation limits

Caps on how long generation can run and how many tool calls it can make. When a limit kicks in, the assistant message is marked `cancelled` and its content gets a human-readable marker naming the env var to tweak (e.g. `[stopped: supervisor timeout 15m0s exceeded — raise MANTIS_SUPERVISOR_TIMEOUT in .env to increase]`). Partial text and completed tool steps are preserved; unfinished steps get marked `cancelled`. A user-triggered Stop gives `[stopped by user]`.

| Variable | Default | What it caps |
|---|---|---|
| `MANTIS_SUPERVISOR_TIMEOUT` | `15m` | Wall time for one user-message generation by the main agent |
| `MANTIS_SUPERVISOR_MAX_ITERATIONS` | `30` | LLM tool-call rounds the main agent may do per message |
| `MANTIS_SERVER_TIMEOUT` | `15m` | Wall time for one SSH sub-agent call (per `ssh_*` tool invocation) |
| `MANTIS_SERVER_MAX_ITERATIONS` | `30` | LLM tool-call rounds inside one SSH sub-agent call |
| `MANTIS_PLAN_STEP_TIMEOUT` | `15m` | Wall time for a single plan node execution |

Values accept any Go duration (`30s`, `15m`, `1h`). On startup the app logs the active values, e.g. `limits: supervisor=15m0s/30, server=15m0s/30, plan_step=15m0s`. Server-level hits (timeout / iterations) surface as the tool result to the supervisor, so it can read the limit message and adapt instead of failing the whole reply.

## Dev

```bash
./dev.sh
```

Hot reload everywhere — `air` for Go, Vite HMR for the frontend. Frontend on `:27173`, backend on `:27480`, Postgres on `:5432`.

## Prod (single host)

```bash
./prod.sh
```

Multi-stage builds, frontend served by nginx, single port `:${MANTIS_PORT:-8080}` exposed, `restart: unless-stopped`.

## ASR, OCR & TTS (optional)

| Service | Env var | Repo |
|---------|---------|------|
| Speech-to-text | `ASR_API_URL` | [russian-asr](https://github.com/x0152/russian-asr) / [whisper.cpp](https://github.com/ggerganov/whisper.cpp) / OpenAI Whisper |
| OCR | `OCR_API_URL` | [easy-ocr-api](https://github.com/x0152/easy-ocr-api) |
| Text-to-speech | `TTS_API_URL` | [cosyvoice-tts-api](https://github.com/x0152/cosyvoice-tts-api) |

```bash
docker run -p 8016:8016 ghcr.io/x0152/russian-asr        # --gpus all for CUDA
docker run -p 8017:8017 ghcr.io/x0152/easy-ocr-api
docker run -p 8020:8020 ghcr.io/x0152/cosyvoice-tts-api
```

Set the URLs in `.env` (see `.env.example`). Since the ASR integration uses an OpenAI Whisper-compatible interface, you can use standard Whisper endpoints, `whisper.cpp` server, or other compatible services for `ASR_API_URL`.

## License

MIT

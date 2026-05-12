#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

log() { printf '[quickstart] %s\n' "$*"; }
die() { printf '[quickstart] %s\n' "$*" >&2; exit 1; }

if ! command -v docker >/dev/null 2>&1; then
  die "docker not found — install Docker Desktop or Docker Engine first"
fi
if ! docker info >/dev/null 2>&1; then
  die "docker daemon is not running — start Docker and re-run this script"
fi
if ! docker compose version >/dev/null 2>&1; then
  die "docker compose plugin not found — install Docker Compose v2"
fi

gen_token() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

set_env() {
  local key="$1" value="$2"
  if grep -qE "^${key}=" .env; then
    sed -i.bak -e "s|^${key}=.*|${key}=${value}|" .env && rm -f .env.bak
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

read_env() {
  local key="$1"
  grep -E "^${key}=" .env | head -n1 | cut -d= -f2- || true
}

if [ ! -f .env ]; then
  cp .env.example .env
  log "created .env from .env.example"
fi

auth_token="$(read_env AUTH_TOKEN)"
if [ -z "$auth_token" ] || [[ "$auth_token" == change-me* ]]; then
  auth_token="$(gen_token)"
  set_env AUTH_TOKEN "$auth_token"
  log "generated AUTH_TOKEN"
else
  log "using existing AUTH_TOKEN from .env"
fi

runtime_token="$(read_env RUNTIME_API_TOKEN)"
if [ -z "$runtime_token" ] || [[ "$runtime_token" == change-me* ]]; then
  set_env RUNTIME_API_TOKEN "$(gen_token)"
  log "generated RUNTIME_API_TOKEN"
fi

fe_port="$(read_env MANTIS_FRONTEND_PORT)"
fe_port="${fe_port:-27173}"

log "building docker compose images"
docker compose build

log "prebuilding sandbox images upfront (first run takes ~3-6 min; cached afterwards)"
docker compose run --rm --no-deps -e SANDBOX_PREBUILD_MODE=build sandbox-prebuild

log "booting docker compose (sandbox-prebuild now verifies cache only)"
docker compose up -d

cat <<EOF

============================================================
  Mantis is starting.

  UI         http://localhost:${fe_port}
  Login      AUTH_TOKEN=${auth_token}

  Progress   docker compose logs -f sandbox-prebuild
  Backend    docker compose logs -f app
  Stop       docker compose down

  LLM provider, models, Telegram and email/SMTP are configured
  from the in-app setup wizard — no extra .env editing needed.
============================================================
EOF

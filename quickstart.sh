#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
  echo "[quickstart] error: this script must be run with bash, not sh/dash. Try: bash ./quickstart.sh" >&2
  exit 1
fi

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

log() { printf '[quickstart] %s\n' "$*"; }
die() { printf '[quickstart] %s\n' "$*" >&2; exit 1; }

case "$(uname -m 2>/dev/null || echo unknown)" in
  x86_64|amd64|aarch64|arm64) : ;;
  *) die "unsupported CPU architecture '$(uname -m)' — only amd64 and arm64 are supported (cmd/inferenced ships for those only)" ;;
esac

case "$(uname -s 2>/dev/null || echo unknown)" in
  Linux|Darwin) : ;;
  *) die "unsupported OS '$(uname -s)' — only Linux and macOS hosts are supported" ;;
esac

if ! command -v docker >/dev/null 2>&1; then
  die "docker not found — install Docker Desktop or Docker Engine first: https://docs.docker.com/engine/install/"
fi

docker_info_out=""
if ! docker_info_out=$(docker info 2>&1); then
  if printf '%s' "$docker_info_out" | grep -qi 'permission denied'; then
    die "docker socket permission denied — add your user to the docker group and re-login: sudo usermod -aG docker \$USER && newgrp docker"
  fi
  if printf '%s' "$docker_info_out" | grep -qi 'cannot connect'; then
    die "docker daemon is not running — start Docker (e.g. 'sudo systemctl start docker' or open Docker Desktop) and re-run this script"
  fi
  die "docker info failed: $(printf '%s' "$docker_info_out" | head -n3)"
fi

if ! docker compose version >/dev/null 2>&1; then
  die "docker compose plugin not found — install Docker Compose v2 (https://docs.docker.com/compose/install/) or upgrade Docker"
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
  [ -f .env.example ] || die ".env.example missing — please re-clone the repository"
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

log "building docker compose service images"
docker compose build --progress=plain

render_dir="$SCRIPT_DIR/.sandbox-build"
host_uid="$(id -u)"
host_gid="$(id -g)"

log "rendering sandbox Dockerfiles to ${render_dir}"
if [ -d "$render_dir" ] && ! rm -rf "$render_dir" 2>/dev/null; then
  log "cleaning ${render_dir} via docker (previous run left root-owned files)"
  docker run --rm -v "$render_dir:/clean" alpine:3.20 \
    sh -c 'rm -rf /clean/..?* /clean/.[!.]* /clean/* 2>/dev/null || true'
  rm -rf "$render_dir" 2>/dev/null || true
fi
mkdir -p "$render_dir"
docker compose run --rm --no-deps \
  -v "$render_dir:/output" \
  -e RENDER_CHOWN_UID="$host_uid" \
  -e RENDER_CHOWN_GID="$host_gid" \
  --entrypoint sh \
  sandbox-prebuild -c 'go run ./cmd/sandbox-render -output /output && chown -R "${RENDER_CHOWN_UID}:${RENDER_CHOWN_GID}" /output'

manifest="$render_dir/manifest.txt"
[ -f "$manifest" ] || die "render manifest missing at $manifest"

log "building sandbox images"
while IFS=$'\t' read -r sb_name sb_hash; do
  [ -z "${sb_name:-}" ] && continue
  log "  -> sandbox/${sb_name}:latest (sha=${sb_hash})"
  docker build \
    --progress=plain \
    --label "sandbox=1" \
    --label "sandbox.name=${sb_name}" \
    --label "sandbox.dockerfile_hash=${sb_hash}" \
    -t "sandbox/${sb_name}:latest" \
    "$render_dir/${sb_name}"
done < "$manifest"

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

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

CLUSTER_NAME="${CLUSTER_NAME:-mantis-local}"
RELEASE_NAME="${RELEASE_NAME:-mantis}"
NAMESPACE="${NAMESPACE:-default}"
CHART_PATH="${CHART_PATH:-./helm/mantis}"
BACKEND_IMAGE="${BACKEND_IMAGE:-mantis}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-mantis-frontend}"
IMAGE_TAG="${IMAGE_TAG:-local}"
INGRESS_ENABLED="${INGRESS_ENABLED:-false}"

for cmd in k3d kubectl helm docker; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
done

if ! k3d cluster list | awk 'NR>1 {print $1}' | grep -qx "$CLUSTER_NAME"; then
  k3d cluster create "$CLUSTER_NAME"
fi

kubectl config use-context "k3d-${CLUSTER_NAME}"

docker build -t "${BACKEND_IMAGE}:${IMAGE_TAG}" -f Dockerfile.prod .
docker build -t "${FRONTEND_IMAGE}:${IMAGE_TAG}" -f frontend/Dockerfile.prod ./frontend

k3d image import "${BACKEND_IMAGE}:${IMAGE_TAG}" "${FRONTEND_IMAGE}:${IMAGE_TAG}" -c "$CLUSTER_NAME"

if kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
  kubectl -n "$NAMESPACE" delete job \
    -l "app.kubernetes.io/instance=${RELEASE_NAME},app.kubernetes.io/component=migrate" \
    --ignore-not-found=true >/dev/null 2>&1 || true
fi

helm upgrade --install "$RELEASE_NAME" "$CHART_PATH" \
  --namespace "$NAMESPACE" \
  --create-namespace \
  --set "apps.global.image.repository=${BACKEND_IMAGE}" \
  --set "apps.global.image.tag=${IMAGE_TAG}" \
  --set "apps.global.image.pullPolicy=Never" \
  --set "frontend.image.repository=${FRONTEND_IMAGE}" \
  --set "frontend.image.tag=${IMAGE_TAG}" \
  --set "frontend.image.pullPolicy=Never" \
  --set "ingress.enabled=${INGRESS_ENABLED}"

mapfile -t DEPLOYS < <(kubectl -n "$NAMESPACE" get deploy -l "app.kubernetes.io/instance=${RELEASE_NAME}" -o name)
if [ "${#DEPLOYS[@]}" -eq 0 ]; then
  echo "No deployments found for release ${RELEASE_NAME} in namespace ${NAMESPACE}" >&2
  exit 1
fi

for dep in "${DEPLOYS[@]}"; do
  kubectl -n "$NAMESPACE" rollout status "$dep" --timeout=300s
done

kubectl -n "$NAMESPACE" get deploy,pod,svc

echo
echo "Port forwarding:"
echo "kubectl -n ${NAMESPACE} port-forward svc/frontend 27173:80"
echo "kubectl -n ${NAMESPACE} port-forward svc/app 27480:8080"

#!/usr/bin/env bash
# lynx-update.sh — Pull the latest Lynx image and recreate prod + demo containers.
#
# This script is bundled inside the Docker image at /app/lynx-update.sh.
# It self-installs and self-updates from the image on every run.
#
# First-time install (run once on the server):
#   docker run --rm paueron/lynx:latest cat /app/lynx-update.sh \
#     > /usr/local/bin/lynx-update && chmod +x /usr/local/bin/lynx-update
#
# After that, just run:
#   lynx-update
#   lynx-update --logs

set -Eeuo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
IMAGE="paueron/lynx:latest"

PROD_NAME="lynx"
DEMO_NAME="lynx-demo"

PROD_VOL="lynx-data-prod"
DEMO_VOL="lynx-data-demo"

PROD_HTTP_PORT=9006
PROD_HTTPS_PORT=9007
DEMO_HTTP_PORT=9005

PROD_BASE_PATH="/lynx"
DEMO_BASE_PATH="/lynx-demo"

BACKUP_DIR="/root/docker-run-backups"
INSTALL_PATH="/usr/local/bin/lynx-update"

# ── Helpers ───────────────────────────────────────────────────────────────────
log() { printf '[%s] %s\n' "$(date -u +'%Y-%m-%d %H:%M:%S UTC')" "$*"; }

container_exists() { docker inspect "$1" >/dev/null 2>&1; }

get_env() {
  local container="$1" key="$2"
  docker inspect "$container" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null \
    | awk -F= -v k="$key" '$1==k {print substr($0, length(k)+2)}' \
    | tail -n1
}

get_or_create_secret() {
  local container="$1" secret=""
  if container_exists "$container"; then
    secret="$(get_env "$container" JWT_SECRET || true)"
  fi
  if [[ -z "$secret" || "$secret" == "***" ]]; then
    secret="$(openssl rand -hex 32)"
  fi
  printf '%s' "$secret"
}

probe() {
  local label="$1" url="$2" expected="${3:-200 302}" code="000"
  for i in {1..30}; do
    code=$(curl -k -sS -o /tmp/lynx-probe.out -w '%{http_code}' "$url" 2>/dev/null || true)
    if [[ " $expected " == *" $code "* ]]; then
      log "$label => HTTP $code"
      return 0
    fi
    sleep 1
  done
  log "ERROR: $label failed for $url => HTTP $code"
  cat /tmp/lynx-probe.out 2>/dev/null || true
  return 1
}

self_update() {
  local tmp
  tmp="$(mktemp)"
  trap 'rm -f "$tmp"' RETURN
  # Extract the bundled script from the new image (already pulled at this point)
  if docker run --rm "$IMAGE" cat /app/lynx-update.sh > "$tmp" 2>/dev/null; then
    if ! diff -q "$tmp" "$0" >/dev/null 2>&1; then
      log "Self-updating $INSTALL_PATH from image..."
      cp "$tmp" "$INSTALL_PATH"
      chmod +x "$INSTALL_PATH"
      log "Self-update complete — re-executing updated script"
      exec "$INSTALL_PATH" --skip-self-update "$@"
    fi
  fi
}

# ── Container definitions ─────────────────────────────────────────────────────
recreate_prod() {
  local secret="$1"
  log "Recreate PROD container: $PROD_NAME"
  docker rm -f "$PROD_NAME" >/dev/null 2>&1 || true
  docker run -d \
    --name "$PROD_NAME" \
    --restart always \
    -p ${PROD_HTTP_PORT}:8080 \
    -p ${PROD_HTTPS_PORT}:8443 \
    -e JWT_SECRET="$secret" \
    -e ENABLE_HTTPS=true \
    -e SSL_PORT=8443 \
    -e PORT=8080 \
    -e DATA_DIR=/app/data \
    -e BASE_PATH="$PROD_BASE_PATH" \
    -v "$PROD_VOL":/app/data \
    "$IMAGE" >/dev/null
}

recreate_demo() {
  local secret="$1"
  log "Recreate DEMO container: $DEMO_NAME"
  docker rm -f "$DEMO_NAME" >/dev/null 2>&1 || true
  docker run -d \
    --name "$DEMO_NAME" \
    --restart always \
    -p ${DEMO_HTTP_PORT}:8080 \
    -e JWT_SECRET="$secret" \
    -e DEMO_MODE=true \
    -e PORT=8080 \
    -e DATA_DIR=/app/data \
    -e BASE_PATH="$DEMO_BASE_PATH" \
    -v "$DEMO_VOL":/app/data \
    "$IMAGE" >/dev/null
}

# ── Main ──────────────────────────────────────────────────────────────────────
show_logs=false
skip_self_update=false

for arg in "$@"; do
  case "$arg" in
    --logs)             show_logs=true ;;
    --skip-self-update) skip_self_update=true ;;
  esac
done

mkdir -p "$BACKUP_DIR"

# Backup current container configs
for c in "$PROD_NAME" "$DEMO_NAME"; do
  if container_exists "$c"; then
    docker inspect "$c" > "$BACKUP_DIR/${c}-$(date +%Y%m%d-%H%M%S).inspect.json"
  fi
done

# Preserve JWT secrets
PROD_SECRET="$(get_or_create_secret "$PROD_NAME")"
DEMO_SECRET="$(get_or_create_secret "$DEMO_NAME")"

log "Pulling latest image: $IMAGE"
docker pull "$IMAGE"

# Self-update this script from the freshly pulled image
if [[ "$skip_self_update" == false && -w "$INSTALL_PATH" ]]; then
  self_update "$@"
fi

LATEST_IMAGE_ID="$(docker image inspect "$IMAGE" --format '{{.Id}}')"
LATEST_DIGEST="$(docker image inspect "$IMAGE" --format '{{index .RepoDigests 0}}' 2>/dev/null || true)"
log "Latest image id: $LATEST_IMAGE_ID"
[[ -n "$LATEST_DIGEST" ]] && log "Latest digest: $LATEST_DIGEST"

recreate_prod "$PROD_SECRET"
recreate_demo "$DEMO_SECRET"

# Verify containers
log "Verifying containers"
docker ps --filter "name=^/${PROD_NAME}$" --format 'PROD  {{.Names}}  {{.Status}}  {{.Ports}}'
docker ps --filter "name=^/${DEMO_NAME}$" --format 'DEMO  {{.Names}}  {{.Status}}  {{.Ports}}'

PROD_IMAGE_ID="$(docker inspect "$PROD_NAME" --format '{{.Image}}')"
DEMO_IMAGE_ID="$(docker inspect "$DEMO_NAME" --format '{{.Image}}')"
log "PROD image id:   $PROD_IMAGE_ID"
log "DEMO image id:   $DEMO_IMAGE_ID"
log "LATEST image id: $LATEST_IMAGE_ID"

if [[ "$PROD_IMAGE_ID" != "$LATEST_IMAGE_ID" || "$DEMO_IMAGE_ID" != "$LATEST_IMAGE_ID" ]]; then
  log "ERROR: one or more containers are not using the latest image"
  exit 1
fi

PROD_VERSION="$(docker exec "$PROD_NAME" node -e "console.log(require('./package.json').version)" 2>/dev/null || true)"
DEMO_VERSION="$(docker exec "$DEMO_NAME" node -e "console.log(require('./package.json').version)" 2>/dev/null || true)"
[[ -n "$PROD_VERSION" ]] && log "PROD version: $PROD_VERSION"
[[ -n "$DEMO_VERSION" ]] && log "DEMO version: $DEMO_VERSION"

if $show_logs; then
  log "Tail logs (prod)";  docker logs --tail 30 "$PROD_NAME" || true
  log "Tail logs (demo)"; docker logs --tail 30 "$DEMO_NAME" || true
fi

# Health probes
probe "PROD HTTP root"       "http://127.0.0.1:${PROD_HTTP_PORT}/"
probe "PROD HTTP base path"  "http://127.0.0.1:${PROD_HTTP_PORT}${PROD_BASE_PATH}"
probe "PROD HTTPS base path" "https://127.0.0.1:${PROD_HTTPS_PORT}${PROD_BASE_PATH}"
probe "DEMO HTTP root"       "http://127.0.0.1:${DEMO_HTTP_PORT}/"
probe "DEMO HTTP base path"  "http://127.0.0.1:${DEMO_HTTP_PORT}${DEMO_BASE_PATH}"

# Demo protection check
log "Checking demo reset protection"
cat >/tmp/lynx-demo-reset-check.json <<'JSON'
{"token":"invalid-test-token","newPassword":"Demo123!"}
JSON
DEMO_RESET_CODE=$(curl -sS -o /tmp/lynx-demo-reset-check.out -w '%{http_code}' \
  -X POST "http://127.0.0.1:${DEMO_HTTP_PORT}/api/auth/reset-via-token" \
  -H 'Content-Type: application/json' \
  --data @/tmp/lynx-demo-reset-check.json 2>/dev/null || true)
log "DEMO reset-via-token => HTTP $DEMO_RESET_CODE"
if [[ "$DEMO_RESET_CODE" != "403" && "$DEMO_RESET_CODE" != "404" ]]; then
  log "ERROR: demo protection check failed"
  cat /tmp/lynx-demo-reset-check.out || true
  exit 1
fi

log "SUCCESS: Lynx prod + demo updated successfully"

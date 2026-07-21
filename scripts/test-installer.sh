#!/usr/bin/env bash

set -Eeuo pipefail

readonly INSTALL_DIR="/opt/orbitpage"
readonly CONFIG_DIR="/etc/orbitpage"
readonly DATA_DIR="/var/lib/orbitpage-installer-test"
readonly BACKUP_DIR="/var/backups/orbitpage"
readonly CLI_PATH="/usr/local/bin/orbitpage"
readonly DOCKER_STATE="/tmp/orbitpage-installer-docker-state"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_DIR="$(mktemp -d)"
FAKE_BIN="${TEST_DIR}/bin"

fail() {
  printf 'Installer test failed: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  rm -rf -- "$INSTALL_DIR" "$CONFIG_DIR" "$DATA_DIR" "$BACKUP_DIR" "$TEST_DIR"
  rm -f -- "$CLI_PATH" "$DOCKER_STATE"
}

[[ ${EUID} -eq 0 ]] || fail "run this test as root"

for path in "$INSTALL_DIR" "$CONFIG_DIR" "$DATA_DIR" "$BACKUP_DIR" "$CLI_PATH"; do
  [[ ! -e "$path" ]] || fail "test path already exists: ${path}"
done

trap cleanup EXIT
mkdir -p "$FAKE_BIN"

cat > "${FAKE_BIN}/docker" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail

state_file="/tmp/orbitpage-installer-docker-state"
arguments=" $* "

if [[ "$arguments" == " compose version " || "$arguments" == " info " ]]; then
  exit 0
fi

if [[ "${1:-}" == "inspect" ]]; then
  [[ -f "$state_file" ]] || exit 1
  if [[ "$arguments" == *"com.docker.compose.project"* ]]; then
    printf 'orbitpage\n'
  elif [[ "$arguments" == *".State.Health"* ]]; then
    printf 'healthy\n'
  elif [[ "$arguments" == *".State.Running"* ]]; then
    printf 'true\n'
  fi
  exit 0
fi

if [[ "${1:-}" == "compose" ]]; then
  if [[ "$arguments" == *" up "* || "$arguments" == *" start "* || "$arguments" == *" restart "* ]]; then
    touch "$state_file"
  elif [[ "$arguments" == *" down "* ]]; then
    rm -f "$state_file"
  fi
  exit 0
fi

if [[ "${1:-}" == "logs" ]]; then
  exit 0
fi

printf 'Unexpected docker invocation: %s\n' "$*" >&2
exit 1
EOF
chmod 0755 "${FAKE_BIN}/docker"

PATH="${FAKE_BIN}:${PATH}" \
ORBITPAGE_HTTP_PORT=18080 \
ORBITPAGE_BIND_ADDRESS=127.0.0.1 \
ORBITPAGE_DATA_DIR="$DATA_DIR" \
ORBITPAGE_PUBLIC_SITE_URL=https://links.example.test \
bash "${REPO_ROOT}/install.sh"

[[ -x "$CLI_PATH" ]] || fail "management command was not installed"
[[ -f "${INSTALL_DIR}/compose.yaml" ]] || fail "Compose definition was not created"
[[ -f "${INSTALL_DIR}/.env" ]] || fail "installer settings were not persisted"
[[ -f "${CONFIG_DIR}/orbitpage.env" ]] || fail "application environment was not created"
[[ -d "$DATA_DIR" ]] || fail "persistent data directory was not created"
[[ "$(stat -c '%a' "${CONFIG_DIR}/orbitpage.env")" == "600" ]] || fail "secret file permissions are not 0600"
grep -Eq '^JWT_SECRET=[a-f0-9]{64}$' "${CONFIG_DIR}/orbitpage.env" || fail "JWT secret is missing or invalid"
grep -Fq 'PUBLIC_SITE_URL=https://links.example.test' "${CONFIG_DIR}/orbitpage.env" || fail "public URL was not stored"
grep -Fq 'no-new-privileges:true' "${INSTALL_DIR}/compose.yaml" || fail "container hardening is missing"
! grep -Fq 'JWT_SECRET=' "${INSTALL_DIR}/compose.yaml" || fail "secret leaked into Compose definition"
if [[ -x /usr/bin/docker ]] && /usr/bin/docker compose version >/dev/null 2>&1; then
  /usr/bin/docker compose --project-directory "$INSTALL_DIR" --file "${INSTALL_DIR}/compose.yaml" config --quiet
fi

secret_before="$(grep '^JWT_SECRET=' "${CONFIG_DIR}/orbitpage.env")"
PATH="${FAKE_BIN}:${PATH}" \
ORBITPAGE_PUBLIC_SITE_URL=https://updated.example.test \
bash "${REPO_ROOT}/install.sh"
secret_after="$(grep '^JWT_SECRET=' "${CONFIG_DIR}/orbitpage.env")"
[[ "$secret_before" == "$secret_after" ]] || fail "idempotent install replaced the JWT secret"
grep -Fq 'PUBLIC_SITE_URL=https://updated.example.test' "${CONFIG_DIR}/orbitpage.env" || fail "idempotent install did not update the public URL"

config_output="$(PATH="${FAKE_BIN}:${PATH}" "$CLI_PATH" config)"
grep -Fq '127.0.0.1:18080' <<< "$config_output" || fail "management command did not load persisted network settings"
grep -Fq "$DATA_DIR" <<< "$config_output" || fail "management command did not load the persisted data path"

PATH="${FAKE_BIN}:${PATH}" "$CLI_PATH" backup
compgen -G "${BACKUP_DIR}/orbitpage-*.tar.gz" >/dev/null || fail "backup archive was not created"
[[ "$(find "$BACKUP_DIR" -maxdepth 1 -name 'orbitpage-*.tar.gz' | wc -l)" -ge 2 ]] || fail "backup names collided"

PATH="${FAKE_BIN}:${PATH}" "$CLI_PATH" uninstall
[[ ! -e "$INSTALL_DIR" && ! -e "$CLI_PATH" ]] || fail "uninstall did not remove application files"
[[ -d "$DATA_DIR" && -f "${CONFIG_DIR}/orbitpage.env" ]] || fail "non-purge uninstall removed persistent data"

printf 'OrbitPage installer integration test passed.\n'

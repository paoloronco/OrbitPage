#!/usr/bin/env bash

set -Eeuo pipefail

readonly INSTALL_DIR="/opt/orbitpage"
readonly CONFIG_DIR="/etc/orbitpage"
readonly DATA_DIR="/var/lib/orbitpage-installer-test"
readonly BACKUP_DIR="/var/backups/orbitpage"
readonly CLI_PATH="/usr/local/bin/orbitpage"
readonly UPDATE_CLI_PATH="/usr/local/bin/orbitpage-update"
readonly UPDATE_HELPER_PATH="/usr/local/lib/orbitpage/orbitpage-update.py"
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
  rm -f -- "$CLI_PATH" "$UPDATE_CLI_PATH" "$UPDATE_HELPER_PATH" "$DOCKER_STATE"
}

[[ ${EUID} -eq 0 ]] || fail "run this test as root"

for path in "$INSTALL_DIR" "$CONFIG_DIR" "$DATA_DIR" "$BACKUP_DIR" "$CLI_PATH" "$UPDATE_CLI_PATH" "$UPDATE_HELPER_PATH"; do
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
    printf '%s\n' "${ORBITPAGE_TEST_PROJECT:-orbitpage}"
  elif [[ "$arguments" == *".State.Health"* ]]; then
    printf '%s\n' "${ORBITPAGE_TEST_HEALTH:-healthy}"
  elif [[ "$arguments" == *".State.Running"* ]]; then
    printf 'true\n'
  fi
  exit 0
fi

if [[ "${1:-}" == "compose" ]]; then
  [[ "${ORBITPAGE_TEST_PULL_FAIL:-0}" != 1 || "$arguments" != *" pull "* ]] || exit 1
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

cat > "${FAKE_BIN}/python3" <<EOF
#!/usr/bin/env bash
if [[ \${2:-} == --enable-web-updates ]]; then
  printf '%s\\n' "\$*" > "$TEST_DIR/web-updates-command"
else
  exec /usr/bin/python3 "\$@"
fi
EOF
chmod 0755 "${FAKE_BIN}/python3"
cat > "${FAKE_BIN}/sleep" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod 0755 "${FAKE_BIN}/sleep"

expect_failure() {
  local message="$1"
  shift
  if env PATH="${FAKE_BIN}:${PATH}" "$@" bash "${REPO_ROOT}/install.sh" > "$TEST_DIR/result" 2>&1; then
    fail "invalid installation succeeded: $*"
  fi
  grep -Fq "$message" "$TEST_DIR/result" || { cat "$TEST_DIR/result"; fail "missing validation: $message"; }
}

for port in 0 65536 invalid 999999999999999999999999; do
  expect_failure ORBITPAGE_HTTP_PORT ORBITPAGE_HTTP_PORT="$port"
done
expect_failure 'IPv4 address' ORBITPAGE_BIND_ADDRESS=256.0.0.1
expect_failure 'invalid characters' ORBITPAGE_CONTAINER_NAME=-orbitpage
expect_failure 'ORBITPAGE_REQUIRE_SETUP_TOKEN' ORBITPAGE_REQUIRE_SETUP_TOKEN=typo
expect_failure 'HTTP(S)' ORBITPAGE_PUBLIC_SITE_URL=javascript:alert
expect_failure 'absolute single-line' ORBITPAGE_DATA_DIR=relative/orbitpage
expect_failure 'resolved ORBITPAGE_DATA_DIR' ORBITPAGE_DATA_DIR=/tmp/orbitpage/..
expect_failure 'unsupported by Compose' "ORBITPAGE_DATA_DIR=/tmp/orbitpage\$EXPAND"
ln -s /tmp "$TEST_DIR/orbitpage-link"
expect_failure 'resolved ORBITPAGE_DATA_DIR' ORBITPAGE_DATA_DIR="$TEST_DIR/orbitpage-link"
[[ ! -e "$INSTALL_DIR" && ! -e "${CONFIG_DIR}/orbitpage.env" ]] || fail 'validation failures wrote application configuration'
cp "${REPO_ROOT}/install.sh" "$TEST_DIR/install.sh"
if PATH="${FAKE_BIN}:${PATH}" bash "$TEST_DIR/install.sh" > "$TEST_DIR/result" 2>&1; then
  fail 'incomplete checkout installed the application'
fi
grep -Fq 'must include scripts/orbitpage-update.py' "$TEST_DIR/result" || fail 'incomplete checkout lost its prerequisite message'
[[ ! -e "$INSTALL_DIR" ]] || fail 'incomplete checkout wrote application configuration'

PATH="${FAKE_BIN}:${PATH}" bash "${REPO_ROOT}/install.sh" web-updates orbitpage-existing
grep -Fq -- '--enable-web-updates orbitpage-existing' "$TEST_DIR/web-updates-command" || fail "standalone service activation did not target the existing container"
[[ ! -e "${INSTALL_DIR}/compose.yaml" && ! -e "${CONFIG_DIR}/orbitpage.env" ]] || fail "standalone service activation installed the application"
rm -f "$TEST_DIR/web-updates-command"

PATH="${FAKE_BIN}:${PATH}" \
ORBITPAGE_HTTP_PORT=018080 \
ORBITPAGE_DATA_DIR="$DATA_DIR" \
ORBITPAGE_PUBLIC_SITE_URL=https://links.example.test \
bash "${REPO_ROOT}/install.sh"

[[ -x "$CLI_PATH" ]] || fail "management command was not installed"
[[ -x "$UPDATE_CLI_PATH" ]] || fail "update command was not installed"
grep -Fq 'exec /usr/local/bin/orbitpage update "$@"' "$UPDATE_CLI_PATH" || fail "update command does not delegate to the installer"
[[ -f "$UPDATE_HELPER_PATH" ]] || fail "dashboard update helper was not installed"
[[ "$(stat -c '%a' "$UPDATE_HELPER_PATH")" == "644" ]] || fail "dashboard update helper permissions are not 0644"
if [[ -d /run/systemd/system ]]; then
  grep -Fq -- '--enable-web-updates orbitpage' "$TEST_DIR/web-updates-command" || fail "latest installation did not automatically enable dashboard updates"
fi
[[ -f "${INSTALL_DIR}/compose.yaml" ]] || fail "Compose definition was not created"
[[ -f "${INSTALL_DIR}/.env" ]] || fail "installer settings were not persisted"
grep -Fxq 'ORBITPAGE_BIND_ADDRESS=127.0.0.1' "${INSTALL_DIR}/.env" || fail "default HTTP bind is not loopback"
grep -Fxq 'ORBITPAGE_HTTP_PORT=18080' "${INSTALL_DIR}/.env" || fail 'leading-zero port was not normalized to decimal'
[[ -f "${CONFIG_DIR}/orbitpage.env" ]] || fail "application environment was not created"
grep -Fxq 'REQUIRE_SETUP_TOKEN=false' "${CONFIG_DIR}/orbitpage.env" || fail 'fresh installation requires a setup token'
[[ -d "$DATA_DIR" ]] || fail "persistent data directory was not created"
[[ "$(stat -c '%a' "${CONFIG_DIR}/orbitpage.env")" == "600" ]] || fail "secret file permissions are not 0600"
[[ "$(stat -c '%a' "$DATA_DIR")" == "700" ]] || fail "persistent data directory permissions are not 0700"
[[ "$(stat -c '%a' "$BACKUP_DIR")" == "700" ]] || fail "backup directory permissions are not 0700"
grep -Eq '^JWT_SECRET=[a-f0-9]{64}$' "${CONFIG_DIR}/orbitpage.env" || fail "JWT secret is missing or invalid"
grep -Fq 'PUBLIC_SITE_URL=https://links.example.test' "${CONFIG_DIR}/orbitpage.env" || fail "public URL was not stored"
grep -Fq 'no-new-privileges:true' "${INSTALL_DIR}/compose.yaml" || fail "container hardening is missing"
! grep -Fq 'JWT_SECRET=' "${INSTALL_DIR}/compose.yaml" || fail "secret leaked into Compose definition"
if [[ -x /usr/bin/docker ]] && /usr/bin/docker compose version >/dev/null 2>&1; then
  /usr/bin/docker compose --project-directory "$INSTALL_DIR" --file "${INSTALL_DIR}/compose.yaml" config --quiet
fi

secret_before="$(grep '^JWT_SECRET=' "${CONFIG_DIR}/orbitpage.env")"
PATH="${FAKE_BIN}:${PATH}" bash "${REPO_ROOT}/install.sh" --require-setup-token > "$TEST_DIR/result"
grep -Fxq 'REQUIRE_SETUP_TOKEN=true' "${CONFIG_DIR}/orbitpage.env" || fail 'setup token flag was not persisted'
grep -Fq '.setup-token' "$TEST_DIR/result" || fail 'protected setup has no token instructions'
PATH="${FAKE_BIN}:${PATH}" \
ORBITPAGE_PUBLIC_SITE_URL=https://updated.example.test \
bash "${REPO_ROOT}/install.sh"
secret_after="$(grep '^JWT_SECRET=' "${CONFIG_DIR}/orbitpage.env")"
[[ "$secret_before" == "$secret_after" ]] || fail "idempotent install replaced the JWT secret"
grep -Fxq 'REQUIRE_SETUP_TOKEN=true' "${CONFIG_DIR}/orbitpage.env" || fail 'reinstall disabled explicit setup protection'
PATH="${FAKE_BIN}:${PATH}" ORBITPAGE_REQUIRE_SETUP_TOKEN=false bash "${REPO_ROOT}/install.sh" > "$TEST_DIR/result"
grep -Fxq 'REQUIRE_SETUP_TOKEN=false' "${CONFIG_DIR}/orbitpage.env" || fail 'explicit disable was not persisted'
! grep -Fq '.setup-token' "$TEST_DIR/result" || fail 'direct setup still prints token instructions'
grep -Fq 'PUBLIC_SITE_URL=https://updated.example.test' "${CONFIG_DIR}/orbitpage.env" || fail "idempotent install did not update the public URL"

expect_failure 'manual data migration' ORBITPAGE_DATA_DIR=/var/lib/orbitpage-moved
expect_failure 'not supported' ORBITPAGE_CONTAINER_NAME=orbitpage-moved
expect_failure 'not managed by this installer' ORBITPAGE_TEST_PROJECT=other-project
mv "${INSTALL_DIR}/.env" "$TEST_DIR/settings.saved"
expect_failure 'incomplete installer configuration'
mv "$TEST_DIR/settings.saved" "${INSTALL_DIR}/.env"
[[ "$secret_before" == "$(grep '^JWT_SECRET=' "${CONFIG_DIR}/orbitpage.env")" ]] || fail 'incomplete configuration recovery changed the secret'
for health in unhealthy exited dead starting; do
  expect_failure 'did not become healthy' ORBITPAGE_TEST_HEALTH="$health"
done
expect_failure 'command failed' ORBITPAGE_TEST_PULL_FAIL=1
[[ "$secret_before" == "$(grep '^JWT_SECRET=' "${CONFIG_DIR}/orbitpage.env")" ]] || fail 'failed repair changed the secret'

compose_before="$(sha256sum "${INSTALL_DIR}/compose.yaml")"
PATH="${FAKE_BIN}:${PATH}" "$CLI_PATH" web-updates orbitpage-existing
grep -Fq -- '--enable-web-updates orbitpage-existing' "$TEST_DIR/web-updates-command" || fail "web updates did not attach to the requested container"
[[ "$compose_before" == "$(sha256sum "${INSTALL_DIR}/compose.yaml")" ]] || fail "web update activation rewrote the Compose definition"
[[ "$secret_before" == "$(grep '^JWT_SECRET=' "${CONFIG_DIR}/orbitpage.env")" ]] || fail "web update activation replaced the JWT secret"

config_output="$(PATH="${FAKE_BIN}:${PATH}" "$CLI_PATH" config)"
grep -Fq '127.0.0.1:18080' <<< "$config_output" || fail "management command did not load persisted network settings"
grep -Fq "$DATA_DIR" <<< "$config_output" || fail "management command did not load the persisted data path"

sed -i 's|^ORBITPAGE_IMAGE=.*|ORBITPAGE_IMAGE=docker.io/paueron/orbitpage:latest|' "${INSTALL_DIR}/.env"
PATH="${FAKE_BIN}:${PATH}" "$CLI_PATH" _update
grep -Fxq 'ORBITPAGE_IMAGE=paoloronco/orbitpage:latest' "${INSTALL_DIR}/.env" \
  || fail "update did not migrate the legacy latest image"

sed -i 's|^ORBITPAGE_IMAGE=.*|ORBITPAGE_IMAGE=paueron/orbitpage:4.18.5|' "${INSTALL_DIR}/.env"
PATH="${FAKE_BIN}:${PATH}" "$CLI_PATH" _update
grep -Fxq 'ORBITPAGE_IMAGE=paueron/orbitpage:4.18.5' "${INSTALL_DIR}/.env" \
  || fail "update changed an explicitly pinned legacy image"

PATH="${FAKE_BIN}:${PATH}" "$CLI_PATH" backup
compgen -G "${BACKUP_DIR}/orbitpage-*.tar.gz" >/dev/null || fail "backup archive was not created"
[[ "$(find "$BACKUP_DIR" -maxdepth 1 -name 'orbitpage-*.tar.gz' | wc -l)" -ge 2 ]] || fail "backup names collided"
[[ "$(find "$BACKUP_DIR" -maxdepth 1 -name 'orbitpage-*.tar.gz' ! -perm 0600 | wc -l)" == 0 ]] || fail 'backup archive permissions are not private'
if PATH="${FAKE_BIN}:${PATH}" "$CLI_PATH" backup "$DATA_DIR/../$(basename "$DATA_DIR")/bad.tar.gz" > "$TEST_DIR/result" 2>&1; then
  fail 'backup was written inside the data directory through a traversal'
fi
grep -Fq 'Store backups outside' "$TEST_DIR/result" || fail 'backup traversal failed for the wrong reason'

# Exercise dependency installation without apt or Docker touching the host.
sed '/^main "\$@"$/d' "${REPO_ROOT}/install.sh" > "$TEST_DIR/functions.sh"
sed "s|/etc/os-release|$TEST_DIR/os-release|g" "$TEST_DIR/functions.sh" > "$TEST_DIR/platform-functions.sh"
for platform in debian:bookworm debian:trixie ubuntu:jammy ubuntu:noble fedora:unknown ubuntu:unknown ubuntu:; do
  printf 'ID=%s\nVERSION_CODENAME=%s\n' "${platform%:*}" "${platform#*:}" > "$TEST_DIR/os-release"
  if env PATH="${FAKE_BIN}:${PATH}" bash -s "$TEST_DIR/platform-functions.sh" > "$TEST_DIR/platform-result" 2>&1 <<'EOF'
source "$1"
detect_platform
EOF
  then
    [[ "$platform" == debian:* || "$platform" == ubuntu:jammy || "$platform" == ubuntu:noble ]] || fail "unsupported $platform was accepted"
  else
    [[ "$platform" == fedora:* || "$platform" == ubuntu:unknown || "$platform" == ubuntu: ]] || { cat "$TEST_DIR/platform-result"; fail "supported $platform was rejected"; }
  fi
done
printf 'ID=ubuntu\nVERSION_CODENAME=noble\n' > "$TEST_DIR/os-release"
if env PATH="${FAKE_BIN}:${PATH}" bash -s "$TEST_DIR/platform-functions.sh" > "$TEST_DIR/platform-result" 2>&1 <<'EOF'
source "$1"
dpkg() { printf 'arm64\n'; }
detect_platform
EOF
then fail 'arm64 was accepted by the x86-64 Linux installer'; fi
grep -Fq 'use the Docker guide for arm64' "$TEST_DIR/platform-result" || fail 'arm64 rejection suggested an unsupported image architecture'
cat > "${FAKE_BIN}/apt-get" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$ORBITPAGE_TEST_APT_CALLS"
touch "$ORBITPAGE_TEST_PACKAGES_INSTALLED"
EOF
chmod 0755 "${FAKE_BIN}/apt-get"
for missing in openssl python3 docker compose; do
  rm -f "$TEST_DIR/packages-installed" "$TEST_DIR/apt-calls"
  env PATH="${FAKE_BIN}:${PATH}" ORBITPAGE_TEST_MISSING="$missing" \
    ORBITPAGE_TEST_PACKAGES_INSTALLED="$TEST_DIR/packages-installed" \
    ORBITPAGE_TEST_APT_CALLS="$TEST_DIR/apt-calls" \
    bash -s "$TEST_DIR/functions.sh" <<'EOF'
source "$1"
command() {
  if [[ ${1:-} == -v && ${2:-} == "$ORBITPAGE_TEST_MISSING" && ! -f "$ORBITPAGE_TEST_PACKAGES_INSTALLED" ]]; then return 1; fi
  builtin command "$@"
}
docker() {
  if [[ ${1:-} == compose && ${2:-} == version && "$ORBITPAGE_TEST_MISSING" == compose && ! -f "$ORBITPAGE_TEST_PACKAGES_INSTALLED" ]]; then return 1; fi
  command docker "$@"
}
setup_docker_repository() { :; }
ensure_docker
EOF
  case "$missing" in
    docker) package=docker-ce ;;
    compose) package=docker-compose-plugin ;;
    *) package="$missing" ;;
  esac
  grep -Fq "$package" "$TEST_DIR/apt-calls" || fail "missing $missing was not installed"
done

if PATH="${FAKE_BIN}:${PATH}" "$CLI_PATH" uninstall --purge < /dev/null > "$TEST_DIR/result" 2>&1; then
  fail 'noninteractive purge without confirmation succeeded'
fi
[[ -f "$DOCKER_STATE" && -f "${CONFIG_DIR}/orbitpage.env" ]] || fail 'cancelled purge stopped or deleted the app'

PATH="${FAKE_BIN}:${PATH}" "$CLI_PATH" uninstall
[[ ! -e "$INSTALL_DIR" && ! -e "$CLI_PATH" && ! -e "$UPDATE_CLI_PATH" ]] || fail "uninstall did not remove application files"
[[ -d "$DATA_DIR" && -f "${CONFIG_DIR}/orbitpage.env" ]] || fail "non-purge uninstall removed persistent data"

printf 'OrbitPage installer integration test passed.\n'

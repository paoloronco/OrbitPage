#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly SCRIPT_VERSION="4.21.68"

INSTALL_DIR="/opt/orbitpage"
CONFIG_DIR="/etc/orbitpage"
BACKUP_DIR="/var/backups/orbitpage"
CLI_PATH="/usr/local/bin/orbitpage"
UPDATE_CLI_PATH="/usr/local/bin/orbitpage-update"
UPDATE_HELPER_PATH="/usr/local/lib/orbitpage/orbitpage-update.py"
COMPOSE_FILE="${INSTALL_DIR}/compose.yaml"
COMPOSE_ENV_FILE="${INSTALL_DIR}/.env"
APP_ENV_FILE="${CONFIG_DIR}/orbitpage.env"
CONTAINER_NAME="${ORBITPAGE_CONTAINER_NAME:-}"
IMAGE="${ORBITPAGE_IMAGE:-}"
HTTP_PORT="${ORBITPAGE_HTTP_PORT:-}"
BIND_ADDRESS="${ORBITPAGE_BIND_ADDRESS:-}"
DATA_DIR="${ORBITPAGE_DATA_DIR:-}"
PUBLIC_SITE_URL="${ORBITPAGE_PUBLIC_SITE_URL:-}"
REQUIRE_SETUP_TOKEN="${ORBITPAGE_REQUIRE_SETUP_TOKEN:-}"
REQUESTED_CONTAINER_NAME="$CONTAINER_NAME"
REQUESTED_DATA_DIR="$DATA_DIR"

persisted_setting() {
  local key=$1
  [[ -f "$COMPOSE_ENV_FILE" ]] || return 0
  awk -F= -v key="$key" '$1 == key { print substr($0, length(key) + 2); exit }' "$COMPOSE_ENV_FILE"
}

PERSISTED_CONTAINER_NAME="$(persisted_setting ORBITPAGE_CONTAINER_NAME)"
PERSISTED_DATA_DIR="$(persisted_setting ORBITPAGE_DATA_DIR)"
IMAGE="${IMAGE:-$(persisted_setting ORBITPAGE_IMAGE)}"
HTTP_PORT="${HTTP_PORT:-$(persisted_setting ORBITPAGE_HTTP_PORT)}"
BIND_ADDRESS="${BIND_ADDRESS:-$(persisted_setting ORBITPAGE_BIND_ADDRESS)}"
CONTAINER_NAME="${CONTAINER_NAME:-$PERSISTED_CONTAINER_NAME}"
DATA_DIR="${DATA_DIR:-$PERSISTED_DATA_DIR}"
IMAGE="${IMAGE:-ghcr.io/paoloronco/orbitpage:latest}"
HTTP_PORT="${HTTP_PORT:-8080}"
BIND_ADDRESS="${BIND_ADDRESS:-127.0.0.1}"
CONTAINER_NAME="${CONTAINER_NAME:-orbitpage}"
DATA_DIR="${DATA_DIR:-/var/lib/orbitpage}"

log() {
  printf '[OrbitPage] %s\n' "$*"
}

die() {
  printf '[OrbitPage] ERROR: %s\n' "$*" >&2
  exit 1
}

on_error() {
  local exit_code=$?
  local line_number=$1
  printf '[OrbitPage] ERROR: command failed on line %s (exit %s).\n' "$line_number" "$exit_code" >&2
  if command -v docker >/dev/null 2>&1 && docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
    docker logs --tail 80 "$CONTAINER_NAME" >&2 || true
  fi
  exit "$exit_code"
}

trap 'on_error "$LINENO"' ERR

require_root() {
  [[ ${EUID} -eq 0 ]] || die "Run this command as root or with sudo."
}

validate_settings() {
  local octet
  local -a address_parts
  [[ -z "$REQUIRE_SETUP_TOKEN" || "$REQUIRE_SETUP_TOKEN" == true || "$REQUIRE_SETUP_TOKEN" == false ]] \
    || die 'ORBITPAGE_REQUIRE_SETUP_TOKEN must be true or false.'

  [[ "$HTTP_PORT" =~ ^[0-9]{1,9}$ ]] || die "ORBITPAGE_HTTP_PORT must be a number."
  HTTP_PORT=$((10#$HTTP_PORT))
  ((HTTP_PORT >= 1 && HTTP_PORT <= 65535)) || die "ORBITPAGE_HTTP_PORT must be between 1 and 65535."
  [[ "$BIND_ADDRESS" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || die "ORBITPAGE_BIND_ADDRESS must be an IPv4 address."
  IFS=. read -r -a address_parts <<< "$BIND_ADDRESS"
  for octet in "${address_parts[@]}"; do
    ((10#$octet <= 255)) || die "ORBITPAGE_BIND_ADDRESS is not a valid IPv4 address."
  done
  [[ "$CONTAINER_NAME" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || die "ORBITPAGE_CONTAINER_NAME contains invalid characters."
  [[ "$IMAGE" =~ ^[A-Za-z0-9][A-Za-z0-9._/:@-]*$ ]] || die "ORBITPAGE_IMAGE contains invalid characters."

  if [[ -n "$PERSISTED_DATA_DIR" && -n "$REQUESTED_DATA_DIR" && "$REQUESTED_DATA_DIR" != "$PERSISTED_DATA_DIR" ]]; then
    die "Changing ORBITPAGE_DATA_DIR on an existing installation requires a manual data migration."
  fi
  if [[ -n "$PERSISTED_CONTAINER_NAME" && -n "$REQUESTED_CONTAINER_NAME" && "$REQUESTED_CONTAINER_NAME" != "$PERSISTED_CONTAINER_NAME" ]]; then
    die "Changing ORBITPAGE_CONTAINER_NAME on an existing installation is not supported."
  fi

  for path in "$INSTALL_DIR" "$CONFIG_DIR" "$DATA_DIR" "$BACKUP_DIR" "$CLI_PATH" "$UPDATE_CLI_PATH"; do
    [[ "$path" == /* && "$path" != *$'\n'* && "$path" != *$'\r'* ]] || die "Installation paths must be absolute single-line paths."
  done
  DATA_DIR="$(realpath -m -- "$DATA_DIR")"
  case "$DATA_DIR" in
    *'$'* | *'#'* | *':'* | *'"'* | *"'"* | *\\*) die "ORBITPAGE_DATA_DIR contains characters unsupported by Compose." ;;
  esac
  [[ "${DATA_DIR,,}" == *orbitpage* ]] || die "The resolved ORBITPAGE_DATA_DIR must contain 'orbitpage' to protect against unsafe deletion."

  if [[ -n "$PUBLIC_SITE_URL" ]]; then
    [[ "$PUBLIC_SITE_URL" =~ ^https?://[^[:space:]]+$ ]] || die "ORBITPAGE_PUBLIC_SITE_URL must be an HTTP(S) URL without spaces."
    [[ "$PUBLIC_SITE_URL" != *$'\n'* && "$PUBLIC_SITE_URL" != *$'\r'* ]] || die "ORBITPAGE_PUBLIC_SITE_URL must be a single-line value."
  fi
}

detect_platform() {
  [[ -r /etc/os-release ]] || die "A supported Debian or Ubuntu system is required."
  # shellcheck disable=SC1091
  source /etc/os-release

  case "${ID:-}" in
    debian | ubuntu) ;;
    *) die "Unsupported operating system: ${ID:-unknown}. Use Debian 12/13 or Ubuntu 22.04/24.04." ;;
  esac

  [[ -n "${VERSION_CODENAME:-}" ]] || die "The operating-system codename could not be detected."
  [[ "${VERSION_CODENAME}" =~ ^[a-z0-9.-]+$ ]] || die "The operating-system codename is invalid."
  case "${ID}:${VERSION_CODENAME}" in
    debian:bookworm | debian:trixie | ubuntu:jammy | ubuntu:noble) ;;
    *) die "Unsupported release: ${ID} ${VERSION_CODENAME}. Use Debian 12/13 or Ubuntu 22.04/24.04." ;;
  esac

  case "$(dpkg --print-architecture 2>/dev/null || uname -m)" in
    amd64 | x86_64) ;;
    *) die "The Linux installer currently supports x86-64/amd64 only; use the Docker guide for arm64." ;;
  esac

  if command -v pveversion >/dev/null 2>&1 || [[ -d /etc/pve ]]; then
    die "Do not install OrbitPage on the Proxmox VE host. Create a Debian LXC/VM first, then run this installer inside it."
  fi
}

setup_docker_repository() {
  local docker_os

  # shellcheck disable=SC1091
  source /etc/os-release
  docker_os="$ID"

  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg openssl
  install -m 0755 -d /etc/apt/keyrings
  curl --fail --silent --show-error --location "https://download.docker.com/linux/${docker_os}/gpg" \
    --output /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/${docker_os}
Suites: ${VERSION_CODENAME}
Components: stable
Architectures: amd64
Signed-By: /etc/apt/keyrings/docker.asc
EOF

  apt-get update -qq
}

ensure_docker() {
  local dependency
  local -a missing_packages=()
  if ! command -v docker >/dev/null 2>&1; then
    log "Installing Docker Engine from Docker's official repository..."
    setup_docker_repository
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  elif ! docker compose version >/dev/null 2>&1; then
    log "Installing the Docker Compose v2 plugin..."
    setup_docker_repository
    apt-get install -y -qq docker-compose-plugin
  fi

  if ! docker info >/dev/null 2>&1; then
    if [[ -d /run/systemd/system ]]; then
      systemctl enable --now docker
    elif command -v service >/dev/null 2>&1; then
      service docker start || true
    fi
  fi

  docker info >/dev/null 2>&1 || die "Docker is installed but unavailable. In an LXC, enable nesting/keyctl or use a VM."
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required."
  for dependency in openssl python3; do
    command -v "$dependency" >/dev/null 2>&1 || missing_packages+=("$dependency")
  done
  if ((${#missing_packages[@]})); then
    apt-get update -qq
    apt-get install -y -qq "${missing_packages[@]}"
  fi
}

compose() {
  docker compose --project-name orbitpage --project-directory "$INSTALL_DIR" --file "$COMPOSE_FILE" "$@"
}

is_installed() {
  [[ -f "$COMPOSE_FILE" && -f "$APP_ENV_FILE" && -f "$COMPOSE_ENV_FILE" ]]
}

require_installed() {
  is_installed || die "OrbitPage is not installed. Run: sudo orbitpage install"
}

migrate_legacy_latest_image() {
  local compose_env_tmp

  case "${IMAGE#docker.io/}" in
    paueron/orbitpage | paueron/orbitpage:latest)
      IMAGE="paoloronco/orbitpage:latest"
      compose_env_tmp="$(mktemp "${INSTALL_DIR}/.env.XXXXXX")"
      awk -F= -v image="$IMAGE" '
        $1 == "ORBITPAGE_IMAGE" {
          print "ORBITPAGE_IMAGE=" image
          updated = 1
          next
        }
        { print }
        END {
          if (!updated) print "ORBITPAGE_IMAGE=" image
        }
      ' "$COMPOSE_ENV_FILE" > "$compose_env_tmp"
      chmod 0600 "$compose_env_tmp"
      mv "$compose_env_tmp" "$COMPOSE_ENV_FILE"
      log "Migrated the retired paueron/orbitpage compatibility feed to ${IMAGE}."
      ;;
  esac
}

write_configuration() {
  local existing_secret
  local jwt_secret
  local env_tmp
  local compose_tmp

  install -d -m 0755 "$INSTALL_DIR"
  install -d -m 0700 "$DATA_DIR" "$BACKUP_DIR"
  install -d -m 0700 "$CONFIG_DIR"

  if [[ ! -f "$APP_ENV_FILE" ]]; then
    jwt_secret="$(openssl rand -hex 32)"
    env_tmp="$(mktemp "${CONFIG_DIR}/orbitpage.env.XXXXXX")"
    {
      printf 'NODE_ENV=production\n'
      printf 'PORT=8080\n'
      printf 'DATA_DIR=/app/data\n'
      printf 'REQUIRE_SETUP_TOKEN=%s\n' "${REQUIRE_SETUP_TOKEN:-false}"
      printf 'JWT_SECRET=%s\n' "$jwt_secret"
      if [[ -n "$PUBLIC_SITE_URL" ]]; then
        printf 'PUBLIC_SITE_URL=%s\n' "$PUBLIC_SITE_URL"
      fi
    } > "$env_tmp"
    chmod 0600 "$env_tmp"
    mv "$env_tmp" "$APP_ENV_FILE"
  else
    log "Preserving the existing application secret and configuration."
    existing_secret="$(awk -F= '$1 == "JWT_SECRET" { print substr($0, 12); exit }' "$APP_ENV_FILE")"
    [[ -n "$existing_secret" ]] || die "The existing configuration has no JWT_SECRET. Restore it from backup before continuing."
    chmod 0600 "$APP_ENV_FILE"
    if [[ -n "$PUBLIC_SITE_URL" ]]; then
      env_tmp="$(mktemp "${CONFIG_DIR}/orbitpage.env.XXXXXX")"
      awk '$0 !~ /^PUBLIC_SITE_URL=/' "$APP_ENV_FILE" > "$env_tmp"
      printf 'PUBLIC_SITE_URL=%s\n' "$PUBLIC_SITE_URL" >> "$env_tmp"
      chmod 0600 "$env_tmp"
      mv "$env_tmp" "$APP_ENV_FILE"
    fi
  fi

  if [[ -n "$REQUIRE_SETUP_TOKEN" ]]; then
    env_tmp="$(mktemp "${CONFIG_DIR}/orbitpage.env.XXXXXX")"
    awk '$0 !~ /^REQUIRE_SETUP_TOKEN=/' "$APP_ENV_FILE" > "$env_tmp"
    printf 'REQUIRE_SETUP_TOKEN=%s\n' "$REQUIRE_SETUP_TOKEN" >> "$env_tmp"
    chmod 0600 "$env_tmp"
    mv "$env_tmp" "$APP_ENV_FILE"
  fi

  cat > "$COMPOSE_ENV_FILE" <<EOF
ORBITPAGE_IMAGE=${IMAGE}
ORBITPAGE_HTTP_PORT=${HTTP_PORT}
ORBITPAGE_BIND_ADDRESS=${BIND_ADDRESS}
ORBITPAGE_CONTAINER_NAME=${CONTAINER_NAME}
ORBITPAGE_DATA_DIR=${DATA_DIR}
EOF
  chmod 0600 "$COMPOSE_ENV_FILE"

  compose_tmp="$(mktemp "${INSTALL_DIR}/compose.yaml.XXXXXX")"
  cat > "$compose_tmp" <<'EOF'
services:
  orbitpage:
    image: "${ORBITPAGE_IMAGE}"
    container_name: "${ORBITPAGE_CONTAINER_NAME}"
    restart: unless-stopped
    env_file:
      - /etc/orbitpage/orbitpage.env
    ports:
      - "${ORBITPAGE_BIND_ADDRESS}:${ORBITPAGE_HTTP_PORT}:8080"
    volumes:
      - "${ORBITPAGE_DATA_DIR}:/app/data"
    security_opt:
      - no-new-privileges:true
    healthcheck:
      test:
        - CMD
        - node
        - -e
        - "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 20s
EOF
  chmod 0644 "$compose_tmp"
  mv "$compose_tmp" "$COMPOSE_FILE"
}

install_cli() {
  local source_path="${BASH_SOURCE[0]:-}"
  local cli_tmp

  cli_tmp="$(mktemp)"
  if [[ -n "$source_path" && -f "$source_path" && -r "$source_path" ]]; then
    cp "$source_path" "$cli_tmp"
  else
    rm -f "$cli_tmp"
    die 'Run install.sh from a trusted local checkout so the installed root command matches the reviewed script.'
  fi
  bash -n "$cli_tmp"
  install -m 0755 "$cli_tmp" "$CLI_PATH"
  rm -f "$cli_tmp"
  cat > "$UPDATE_CLI_PATH" <<'EOF'
#!/usr/bin/env bash
exec /usr/local/bin/orbitpage update "$@"
EOF
  chmod 0755 "$UPDATE_CLI_PATH"
  install_update_helper
}

install_update_helper() {
  local script_path="${BASH_SOURCE[0]:-}"
  local source_path
  [[ -n "$script_path" && -f "$script_path" ]] || die 'Run install.sh from a trusted local checkout to install the dashboard update service.'
  source_path="$(dirname "$(readlink -f "$script_path")")/scripts/orbitpage-update.py"
  if [[ -f "$source_path" ]]; then
    command -v python3 >/dev/null 2>&1 || die 'Python 3 is required for dashboard updates. Install python3 on the host first.'
    python3 -c 'import ast, sys; ast.parse(open(sys.argv[1]).read())' "$source_path"
    install -d -m 0755 "$(dirname "$UPDATE_HELPER_PATH")"
    install -m 0644 "$source_path" "$UPDATE_HELPER_PATH"
  elif [[ ! -f "$UPDATE_HELPER_PATH" ]]; then
    die 'Run install.sh from a trusted local checkout to install the dashboard update service.'
  fi
}

enable_web_updates() {
  local target="${1:-$CONTAINER_NAME}"
  require_root
  # This mode only attaches the host service; it does not install or recreate the app.
  install_update_helper
  python3 "$UPDATE_HELPER_PATH" --enable-web-updates "$target"
}

wait_for_health() {
  local status="starting"

  for _ in {1..60}; do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$CONTAINER_NAME" 2>/dev/null || true)"
    if [[ "$status" == "healthy" ]]; then
      log "Health check passed."
      return 0
    fi
    if [[ "$status" == "unhealthy" || "$status" == "exited" || "$status" == "dead" ]]; then
      break
    fi
    sleep 2
  done

  docker logs --tail 100 "$CONTAINER_NAME" >&2 || true
  die "OrbitPage did not become healthy (status: ${status:-unknown})."
}

check_container_ownership() {
  local project_label

  if ! docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
    return 0
  fi

  project_label="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$CONTAINER_NAME" 2>/dev/null || true)"
  [[ "$project_label" == "orbitpage" ]] || die "A container named '${CONTAINER_NAME}' already exists and is not managed by this installer."
  is_installed || die 'The existing container has incomplete installer configuration. Restore the Compose files and application environment before reinstalling.'
}

print_access_details() {
  local address

  address="$BIND_ADDRESS"
  [[ "$address" == "0.0.0.0" ]] && address="$(hostname -I 2>/dev/null | awk '{print $1}')"
  [[ -n "$address" ]] || address="localhost"
  printf '\nOrbitPage is ready.\n'
  printf 'Public page:     http://%s:%s/\n' "$address" "$HTTP_PORT"
  printf 'Admin workspace: http://%s:%s/dashboard/profile\n' "$address" "$HTTP_PORT"
  printf 'Health check:    http://%s:%s/health\n' "$address" "$HTTP_PORT"
  if grep -Eq '^REQUIRE_SETUP_TOKEN=(true|1)$' "$APP_ENV_FILE"; then
    printf '\nRead the local setup token with: sudo cat %s/.setup-token\n' "$DATA_DIR"
  fi
  printf 'Complete first setup from a local browser or a trusted HTTPS reverse proxy.\n'
  printf 'Manage the installation with: orbitpage status|logs|backup|restart or sudo orbitpage-update\n\n'
}

install_app() {
  require_root
  detect_platform
  ensure_docker
  check_container_ownership
  if is_installed; then
    backup_app
  fi
  write_configuration
  install_cli

  log "Pulling ${IMAGE}..."
  compose pull
  compose up -d --remove-orphans
  wait_for_health
  case "${IMAGE#docker.io/}" in
    paoloronco/orbitpage | paoloronco/orbitpage:latest | ghcr.io/paoloronco/orbitpage | ghcr.io/paoloronco/orbitpage:latest)
      if [[ -d /run/systemd/system ]] && command -v systemctl >/dev/null 2>&1; then
        enable_web_updates "$CONTAINER_NAME"
      else
        log 'Dashboard updates require systemd; use the Docker update commands on this host.'
      fi
      ;;
  esac
  print_access_details
}

backup_app() {
  local destination="${1:-${BACKUP_DIR}/orbitpage-$(date -u +%Y%m%d-%H%M%S-%N).tar.gz}"
  local was_running=false

  require_root
  require_installed
  [[ "$destination" == /* ]] || destination="$(pwd)/$destination"
  destination="$(realpath -m -- "$destination")"
  [[ "$destination" != "$DATA_DIR"/* && "$destination" != "$CONFIG_DIR"/* && "$destination" != "$INSTALL_DIR"/* ]] || die "Store backups outside the application, configuration and data directories."
  [[ ! -e "$destination" && ! -L "$destination" ]] || die "The backup destination already exists: ${destination}"
  install -d -m 0750 "$(dirname "$destination")"

  if [[ "$(docker inspect --format '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || true)" == "true" ]]; then
    was_running=true
    compose stop
  fi

  if ! tar --numeric-owner --create --gzip --file "$destination" --directory / \
    "${DATA_DIR#/}" "${CONFIG_DIR#/}" "${INSTALL_DIR#/}"; then
    [[ "$was_running" == true ]] && compose start
    die "Backup creation failed."
  fi

  [[ "$was_running" == true ]] && compose start
  chmod 0600 "$destination"
  log "Backup created: ${destination}"
}

update_app() {
  require_root
  require_installed
  perform_update
}

perform_update() {
  require_root
  require_installed
  backup_app
  migrate_legacy_latest_image
  log "Pulling the configured OrbitPage image..."
  compose pull
  compose up -d --remove-orphans
  wait_for_health
  log "OrbitPage update completed."
}

uninstall_app() {
  local purge="${1:-}"
  local confirmation=""

  require_root
  require_installed
  if [[ "$purge" == "--purge" && "${ORBITPAGE_CONFIRM_PURGE:-}" != "YES" ]]; then
    [[ -t 0 ]] || die "Set ORBITPAGE_CONFIRM_PURGE=YES to purge data non-interactively."
    read -r -p "Delete all OrbitPage data, configuration and backups? Type DELETE: " confirmation
    [[ "$confirmation" == "DELETE" ]] || die "Purge cancelled."
  fi
  if [[ -f "/etc/systemd/system/orbitpage-updates-${CONTAINER_NAME}.service" ]]; then
    systemctl disable --now "orbitpage-updates-${CONTAINER_NAME}.service"
    rm -f -- "/etc/systemd/system/orbitpage-updates-${CONTAINER_NAME}.service"
    systemctl daemon-reload
  fi
  compose down

  if [[ "$purge" == "--purge" ]]; then
    [[ "${DATA_DIR,,}" == *orbitpage* && "$DATA_DIR" != "/" ]] || die "Refusing to purge an unsafe data path: ${DATA_DIR}"
    rm -rf -- "$DATA_DIR" "$CONFIG_DIR" "$BACKUP_DIR"
    log "Application data and configuration removed."
  else
    log "Application data was preserved in ${DATA_DIR}."
    log "Use 'orbitpage uninstall --purge' only when you intend to delete it permanently."
  fi

  rm -rf -- "$INSTALL_DIR"
  rm -f -- "$CLI_PATH"
  rm -f -- "$UPDATE_CLI_PATH"
}

show_config() {
  require_installed
  printf 'Installer version: %s\n' "$SCRIPT_VERSION"
  printf 'Compose file:     %s\n' "$COMPOSE_FILE"
  printf 'Configuration:    %s\n' "$APP_ENV_FILE"
  printf 'Persistent data:  %s\n' "$DATA_DIR"
  printf 'Backups:          %s\n' "$BACKUP_DIR"
  printf 'Container:        %s\n' "$CONTAINER_NAME"
  printf 'Image:            %s\n' "$IMAGE"
  printf 'HTTP endpoint:    %s:%s\n' "$BIND_ADDRESS" "$HTTP_PORT"
}

show_help() {
  cat <<'EOF'
OrbitPage self-hosted installer and management command

Usage:
  orbitpage install [--require-setup-token]  Install or repair OrbitPage
  orbitpage status               Show container and health status
  orbitpage logs                 Follow application logs
  orbitpage start|stop|restart   Control the application
  orbitpage update               Backup and update OrbitPage
  orbitpage web-updates [NAME]   Enable dashboard updates for an existing container
  orbitpage backup [FILE]        Create a consistent backup
  orbitpage config               Show installation paths and settings
  orbitpage uninstall            Remove the app but preserve its data
  orbitpage uninstall --purge    Permanently remove app, data and backups

Installation overrides:
  ORBITPAGE_HTTP_PORT=8080
  ORBITPAGE_BIND_ADDRESS=127.0.0.1
  ORBITPAGE_PUBLIC_SITE_URL=https://links.example.com
  ORBITPAGE_IMAGE=ghcr.io/paoloronco/orbitpage:latest
  ORBITPAGE_REQUIRE_SETUP_TOKEN=true  Require the local token for first setup
EOF
}

main() {
  local command="${1:-install}"
  shift || true

  if [[ "$command" == --require-setup-token ]]; then
    command=install
    REQUIRE_SETUP_TOKEN=true
  elif [[ "$command" == install && "${1:-}" == --require-setup-token ]]; then
    REQUIRE_SETUP_TOKEN=true
    shift
  fi
  if [[ "$command" == install && $# -gt 0 ]]; then
    die 'Unknown installation option. Use --require-setup-token or help.'
  fi

  if [[ "$command" == install && ! -f "${BASH_SOURCE[0]:-}" ]]; then
    die 'Run install.sh from a trusted local checkout; streaming it into bash cannot install a reviewed management command.'
  fi
  if [[ "$command" == install ]]; then
    [[ -f "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/scripts/orbitpage-update.py" || -f "$UPDATE_HELPER_PATH" ]] \
      || die 'The trusted checkout must include scripts/orbitpage-update.py for dashboard updates.'
  fi
  case "$command" in
    help | --help | -h) ;;
    *) validate_settings ;;
  esac

  case "$command" in
    install) install_app "$@" ;;
    update) update_app "$@" ;;
    _update) perform_update "$@" ;;
    web-updates) enable_web_updates "$@" ;;
    backup) backup_app "$@" ;;
    status) require_root; require_installed; compose ps ;;
    logs) require_root; require_installed; compose logs --follow --tail 100 ;;
    start) require_root; require_installed; compose start; wait_for_health ;;
    stop) require_root; require_installed; compose stop ;;
    restart) require_root; require_installed; compose restart; wait_for_health ;;
    config) show_config ;;
    uninstall) uninstall_app "$@" ;;
    help | --help | -h) show_help ;;
    *) show_help; die "Unknown command: ${command}" ;;
  esac
}

main "$@"

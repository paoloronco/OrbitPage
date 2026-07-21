#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

readonly SCRIPT_VERSION="4.13.0"
readonly GUEST_INSTALLER_URL="https://raw.githubusercontent.com/paoloronco/OrbitPage/main/install.sh"

CTID="${ORBITPAGE_PVE_CTID:-}"
HOSTNAME="${ORBITPAGE_PVE_HOSTNAME:-orbitpage}"
BRIDGE="${ORBITPAGE_PVE_BRIDGE:-vmbr0}"
IP_ADDRESS="${ORBITPAGE_PVE_IP:-dhcp}"
GATEWAY="${ORBITPAGE_PVE_GATEWAY:-}"
VLAN_TAG="${ORBITPAGE_PVE_VLAN:-}"
CORES="${ORBITPAGE_PVE_CORES:-2}"
MEMORY="${ORBITPAGE_PVE_MEMORY:-2048}"
SWAP="${ORBITPAGE_PVE_SWAP:-512}"
DISK_GB="${ORBITPAGE_PVE_DISK_GB:-12}"
ROOTFS_STORAGE="${ORBITPAGE_PVE_ROOTFS_STORAGE:-}"
TEMPLATE_STORAGE="${ORBITPAGE_PVE_TEMPLATE_STORAGE:-}"
TEMPLATE="${ORBITPAGE_PVE_TEMPLATE:-}"
FIREWALL="${ORBITPAGE_PVE_FIREWALL:-1}"
SSH_PUBLIC_KEY="${ORBITPAGE_PVE_SSH_PUBLIC_KEY:-}"
HTTP_PORT="${ORBITPAGE_HTTP_PORT:-8080}"
PUBLIC_SITE_URL="${ORBITPAGE_PUBLIC_SITE_URL:-}"
IMAGE="${ORBITPAGE_IMAGE:-ghcr.io/paoloronco/orbitpage:latest}"
WAIT_ATTEMPTS="${ORBITPAGE_PVE_WAIT_ATTEMPTS:-90}"
WAIT_SECONDS="${ORBITPAGE_PVE_WAIT_SECONDS:-2}"
CT_CREATED=0

info() {
  printf '\033[1;34m[OrbitPage PVE]\033[0m %s\n' "$*"
}

success() {
  printf '\033[1;32m[OrbitPage PVE]\033[0m %s\n' "$*"
}

die() {
  printf '\033[1;31m[OrbitPage PVE]\033[0m %s\n' "$*" >&2
  exit 1
}

on_error() {
  local exit_code=$?
  local line_number="${1:-unknown}"

  printf '\033[1;31m[OrbitPage PVE]\033[0m Installation failed at line %s.\n' "$line_number" >&2
  if [[ "$CT_CREATED" == "1" ]]; then
    printf 'The incomplete container %s was kept for diagnostics.\n' "$CTID" >&2
    printf 'Inspect it with: pct config %s && pct console %s\n' "$CTID" "$CTID" >&2
    printf 'Remove it after inspection with: pct stop %s 2>/dev/null || true; pct destroy %s --purge\n' "$CTID" "$CTID" >&2
  fi
  exit "$exit_code"
}

trap 'on_error $LINENO' ERR

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required Proxmox command not found: $1"
}

require_integer() {
  local name="$1"
  local value="$2"
  local minimum="$3"
  local maximum="$4"

  [[ "$value" =~ ^[0-9]+$ ]] || die "$name must be an integer."
  (( value >= minimum && value <= maximum )) || die "$name must be between $minimum and $maximum."
}

validate_inputs() {
  [[ ${EUID} -eq 0 ]] || die "Run this installer as root on the Proxmox VE host."

  for command in pveversion pvesh pvesm pveam pct ip awk grep sed sort tail; do
    require_command "$command"
  done

  [[ -d /etc/pve || "${ORBITPAGE_PVE_TEST_MODE:-0}" == "1" ]] \
    || die "This does not look like a Proxmox VE host."
  [[ "$(uname -m)" == "x86_64" ]] || die "Only x86-64 Proxmox VE hosts are currently supported."

  local pve_major
  pve_major="$(pveversion | sed -nE 's#^pve-manager/([0-9]+).*#\1#p' | head -n 1)"
  [[ "$pve_major" =~ ^[0-9]+$ ]] || die "Could not determine the Proxmox VE version."
  (( pve_major >= 8 )) || die "Proxmox VE 8 or newer is required."

  [[ "$HOSTNAME" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$ ]] || die "Invalid container hostname: $HOSTNAME"
  [[ "$BRIDGE" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]] || die "Invalid bridge name: $BRIDGE"
  ip link show "$BRIDGE" >/dev/null 2>&1 || die "Network bridge $BRIDGE does not exist."

  if [[ "$IP_ADDRESS" != "dhcp" ]]; then
    [[ "$IP_ADDRESS" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}/([0-9]|[12][0-9]|3[0-2])$ ]] || die "ORBITPAGE_PVE_IP must be 'dhcp' or an IPv4 CIDR."
  fi
  if [[ -n "$GATEWAY" ]]; then
    [[ "$GATEWAY" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || die "ORBITPAGE_PVE_GATEWAY must be an IPv4 address."
    [[ "$IP_ADDRESS" != "dhcp" ]] || die "A gateway can only be set with a static IP."
  fi
  if [[ -n "$VLAN_TAG" ]]; then
    require_integer "ORBITPAGE_PVE_VLAN" "$VLAN_TAG" 1 4094
  fi

  require_integer "ORBITPAGE_PVE_CORES" "$CORES" 1 128
  require_integer "ORBITPAGE_PVE_MEMORY" "$MEMORY" 512 1048576
  require_integer "ORBITPAGE_PVE_SWAP" "$SWAP" 0 1048576
  require_integer "ORBITPAGE_PVE_DISK_GB" "$DISK_GB" 8 65536
  require_integer "ORBITPAGE_HTTP_PORT" "$HTTP_PORT" 1 65535
  require_integer "ORBITPAGE_PVE_WAIT_ATTEMPTS" "$WAIT_ATTEMPTS" 1 600
  require_integer "ORBITPAGE_PVE_WAIT_SECONDS" "$WAIT_SECONDS" 0 30
  [[ "$FIREWALL" == "0" || "$FIREWALL" == "1" ]] || die "ORBITPAGE_PVE_FIREWALL must be 0 or 1."

  if [[ -n "$SSH_PUBLIC_KEY" ]]; then
    [[ -f "$SSH_PUBLIC_KEY" ]] || die "SSH public key not found: $SSH_PUBLIC_KEY"
  fi
  if [[ -n "$PUBLIC_SITE_URL" ]]; then
    [[ "$PUBLIC_SITE_URL" =~ ^https?://[^[:space:]]+$ ]] || die "ORBITPAGE_PUBLIC_SITE_URL must be an HTTP(S) URL."
  fi
  [[ "$IMAGE" =~ ^[a-zA-Z0-9][a-zA-Z0-9._/:@-]+$ ]] || die "Invalid ORBITPAGE_IMAGE value."
}

active_storage_for() {
  local content_type="$1"
  pvesm status --content "$content_type" | awk 'NR > 1 && $3 == "active" { print $1; exit }'
}

validate_storage() {
  local storage="$1"
  local content_type="$2"

  pvesm status --content "$content_type" | awk -v storage="$storage" 'NR > 1 && $1 == storage && $3 == "active" { found=1 } END { exit found ? 0 : 1 }' \
    || die "Storage '$storage' is not active or does not support $content_type content."
}

select_resources() {
  if [[ -z "$CTID" ]]; then
    CTID="$(pvesh get /cluster/nextid --output-format json | tr -dc '0-9')"
  fi
  require_integer "ORBITPAGE_PVE_CTID" "$CTID" 100 999999999
  if pct status "$CTID" >/dev/null 2>&1; then
    die "Container ID $CTID is already in use. Choose another ORBITPAGE_PVE_CTID."
  fi

  ROOTFS_STORAGE="${ROOTFS_STORAGE:-$(active_storage_for rootdir)}"
  TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-$(active_storage_for vztmpl)}"
  [[ -n "$ROOTFS_STORAGE" ]] || die "No active storage supporting rootdir was found."
  [[ -n "$TEMPLATE_STORAGE" ]] || die "No active storage supporting vztmpl was found."
  [[ "$ROOTFS_STORAGE" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]] || die "Invalid rootfs storage name."
  [[ "$TEMPLATE_STORAGE" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]] || die "Invalid template storage name."
  validate_storage "$ROOTFS_STORAGE" rootdir
  validate_storage "$TEMPLATE_STORAGE" vztmpl
}

prepare_template() {
  pveam update >/dev/null
  if [[ -z "$TEMPLATE" ]]; then
    TEMPLATE="$(pveam available --section system \
      | awk '$2 ~ /^debian-12-standard_.*_amd64\.tar\.(zst|gz|xz)$/ { print $2 }' \
      | sort -V \
      | tail -n 1)"
  fi

  [[ "$TEMPLATE" =~ ^debian-12-standard_[a-zA-Z0-9._+~-]+_amd64\.tar\.(zst|gz|xz)$ ]] \
    || die "Could not select a supported Debian 12 amd64 LXC template."

  if ! pveam list "$TEMPLATE_STORAGE" | awk -v volume="${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE}" 'NR > 1 && $1 == volume { found=1 } END { exit found ? 0 : 1 }'; then
    info "Downloading LXC template $TEMPLATE..."
    pveam download "$TEMPLATE_STORAGE" "$TEMPLATE"
  else
    info "Using cached LXC template $TEMPLATE."
  fi
}

create_container() {
  local net0="name=eth0,bridge=${BRIDGE},ip=${IP_ADDRESS},ip6=auto,firewall=${FIREWALL}"
  if [[ -n "$GATEWAY" ]]; then
    net0+=",gw=${GATEWAY}"
  fi
  if [[ -n "$VLAN_TAG" ]]; then
    net0+=",tag=${VLAN_TAG}"
  fi

  local -a create_args=(
    create "$CTID" "${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE}"
    --hostname "$HOSTNAME"
    --cores "$CORES"
    --memory "$MEMORY"
    --swap "$SWAP"
    --rootfs "${ROOTFS_STORAGE}:${DISK_GB}"
    --net0 "$net0"
    --unprivileged 1
    --features "nesting=1,keyctl=1"
    --onboot 1
    --ostype debian
    --startup "order=30,up=30,down=60"
    --tags "orbitpage;oss"
    --description "OrbitPage OSS v${SCRIPT_VERSION}. Managed by install-pve.sh."
  )

  if [[ -n "$SSH_PUBLIC_KEY" ]]; then
    create_args+=(--ssh-public-keys "$SSH_PUBLIC_KEY")
  fi

  info "Creating unprivileged LXC $CTID ($HOSTNAME)..."
  pct "${create_args[@]}"
  CT_CREATED=1
  pct start "$CTID"
}

wait_for_container() {
  local attempt
  for (( attempt=1; attempt<=WAIT_ATTEMPTS; attempt++ )); do
    if pct exec "$CTID" -- true >/dev/null 2>&1; then
      return 0
    fi
    sleep "$WAIT_SECONDS"
  done
  die "Container $CTID did not become ready in time."
}

container_ipv4() {
  pct exec "$CTID" -- ip -4 -o addr show dev eth0 scope global 2>/dev/null \
    | awk '{ split($4, address, "/"); print address[1]; exit }'
}

wait_for_network() {
  local attempt
  local address
  for (( attempt=1; attempt<=WAIT_ATTEMPTS; attempt++ )); do
    address="$(container_ipv4 || true)"
    if [[ -n "$address" ]] && pct exec "$CTID" -- getent hosts raw.githubusercontent.com >/dev/null 2>&1; then
      printf '%s\n' "$address"
      return 0
    fi
    sleep "$WAIT_SECONDS"
  done
  die "Container $CTID did not obtain working IPv4 and DNS connectivity."
}

install_orbitpage() {
  local -a guest_env=(
    "ORBITPAGE_IMAGE=${IMAGE}"
    "ORBITPAGE_HTTP_PORT=${HTTP_PORT}"
  )
  if [[ -n "$PUBLIC_SITE_URL" ]]; then
    guest_env+=("ORBITPAGE_PUBLIC_SITE_URL=${PUBLIC_SITE_URL}")
  fi

  info "Installing prerequisites inside LXC $CTID..."
  pct exec "$CTID" -- bash -lc \
    'apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ca-certificates curl'

  info "Installing OrbitPage inside LXC $CTID..."
  pct exec "$CTID" -- env "${guest_env[@]}" bash -lc \
    "curl -fsSL '${GUEST_INSTALLER_URL}' | bash"
}

main() {
  printf '\nOrbitPage Proxmox VE installer v%s\n\n' "$SCRIPT_VERSION"
  validate_inputs
  select_resources

  info "Plan: CT $CTID, ${CORES} cores, ${MEMORY} MB RAM, ${DISK_GB} GB on $ROOTFS_STORAGE."
  info "Network: $BRIDGE, $IP_ADDRESS, firewall=$FIREWALL."
  prepare_template
  create_container
  wait_for_container

  local address
  address="$(wait_for_network)"
  install_orbitpage

  success "OrbitPage is ready in unprivileged LXC $CTID."
  printf '\nPublic page:  http://%s:%s\n' "$address" "$HTTP_PORT"
  printf 'First setup:  http://%s:%s/dashboard/profile\n\n' "$address" "$HTTP_PORT"
  printf 'The public page shows Under construction until the first-run wizard is completed.\n\n'
  printf 'Manage from the PVE host:\n'
  printf '  pct exec %s -- orbitpage status\n' "$CTID"
  printf '  pct exec %s -- orbitpage logs\n' "$CTID"
  printf '  pct enter %s\n\n' "$CTID"
}

main "$@"

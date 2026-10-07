#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

readonly SCRIPT_VERSION="4.21.73"

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
BIND_ADDRESS="${ORBITPAGE_BIND_ADDRESS:-0.0.0.0}"
PUBLIC_SITE_URL="${ORBITPAGE_PUBLIC_SITE_URL:-}"
IMAGE="${ORBITPAGE_IMAGE:-ghcr.io/paoloronco/orbitpage:latest}"
REQUIRE_SETUP_TOKEN="${ORBITPAGE_REQUIRE_SETUP_TOKEN:-false}"
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
  exit "$exit_code"
}

report_incomplete_container() {
  if [[ "$1" != "0" && "$CT_CREATED" == "1" ]]; then
    printf 'The incomplete container %s was kept for diagnostics.\n' "$CTID" >&2
    printf 'Inspect it with: pct config %s && pct console %s\n' "$CTID" "$CTID" >&2
    printf 'Remove it after inspection with: pct stop %s 2>/dev/null || true; pct destroy %s --purge\n' "$CTID" "$CTID" >&2
  fi
}

trap 'on_error $LINENO' ERR
trap 'report_incomplete_container $?' EXIT

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required Proxmox command not found: $1"
}

require_integer() {
  local name="$1"
  local value="$2"
  local minimum="$3"
  local maximum="$4"

  [[ "$value" =~ ^[0-9]{1,9}$ ]] || die "$name must be an integer."
  (( 10#$value >= minimum && 10#$value <= maximum )) || die "$name must be between $minimum and $maximum."
}

validate_ipv4() {
  local address="$1"
  local octet
  local -a parts
  [[ "$address" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || die "Invalid IPv4 address: $address"
  IFS=. read -r -a parts <<< "$address"
  for octet in "${parts[@]}"; do
    (( 10#$octet <= 255 )) || die "Invalid IPv4 address: $address"
  done
}

validate_inputs() {
  [[ "$REQUIRE_SETUP_TOKEN" == true || "$REQUIRE_SETUP_TOKEN" == false ]] \
    || die 'ORBITPAGE_REQUIRE_SETUP_TOKEN must be true or false.'
  [[ ${EUID} -eq 0 ]] || die "Run this installer as root on the Proxmox VE host."
  [[ -f "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/install.sh" ]] \
    || die 'Run install-pve.sh alongside install.sh in a trusted local checkout.'
  [[ -f "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/scripts/orbitpage-update.py" ]] \
    || die 'The trusted checkout must include scripts/orbitpage-update.py for dashboard updates.'

  for command in pveversion pvesh pvesm pveam pct ip awk grep sed sort tail dpkg dpkg-query; do
    require_command "$command"
  done

  [[ -d /etc/pve || "${ORBITPAGE_PVE_TEST_MODE:-0}" == "1" ]] \
    || die "This does not look like a Proxmox VE host."
  [[ "$(uname -m)" == "x86_64" ]] || die "Only x86-64 Proxmox VE hosts are currently supported."

  local pve_major
  pve_major="$(pveversion | sed -nE 's#^pve-manager/([0-9]+).*#\1#p' | head -n 1)"
  [[ "$pve_major" =~ ^[0-9]+$ ]] || die "Could not determine the Proxmox VE version."
  (( pve_major >= 8 )) || die "Proxmox VE 8 or newer is required."
  local lxc_version lxc_minimum=6.0.5-2
  (( pve_major == 8 )) && lxc_minimum=6.0.0-2
  lxc_version="$(dpkg-query -W -f='${Version}' lxc-pve)"
  dpkg --compare-versions "$lxc_version" ge "$lxc_minimum" \
    || die "Update the Proxmox host's lxc-pve package to $lxc_minimum or newer before nesting Docker (installed: $lxc_version)."

  [[ "$HOSTNAME" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$ ]] || die "Invalid container hostname: $HOSTNAME"
  [[ "$BRIDGE" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]] || die "Invalid bridge name: $BRIDGE"
  ip link show "$BRIDGE" >/dev/null 2>&1 || die "Network bridge $BRIDGE does not exist."

  validate_ipv4 "$BIND_ADDRESS"
  if [[ "$IP_ADDRESS" != "dhcp" ]]; then
    [[ "$IP_ADDRESS" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}/([0-9]|[12][0-9]|3[0-2])$ ]] || die "ORBITPAGE_PVE_IP must be 'dhcp' or an IPv4 CIDR."
    validate_ipv4 "${IP_ADDRESS%/*}"
  fi
  if [[ -n "$GATEWAY" ]]; then
    [[ "$GATEWAY" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || die "ORBITPAGE_PVE_GATEWAY must be an IPv4 address."
    validate_ipv4 "$GATEWAY"
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
  local setting
  for setting in CORES MEMORY SWAP DISK_GB HTTP_PORT WAIT_ATTEMPTS WAIT_SECONDS; do
    printf -v "$setting" '%d' "$((10#${!setting}))"
  done
  [[ -z "$VLAN_TAG" ]] || VLAN_TAG=$((10#$VLAN_TAG))
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
  CTID=$((10#$CTID))
  if pct status "$CTID" >/dev/null 2>&1; then
    die "Container ID $CTID is already in use. Choose another ORBITPAGE_PVE_CTID."
  fi
  pvesh get /cluster/nextid --vmid "$CTID" >/dev/null \
    || die "Guest ID $CTID is already in use in the cluster. Choose another ORBITPAGE_PVE_CTID."

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
  local registry="${IMAGE%%/*}"
  if [[ "$IMAGE" != */* || ( "$registry" != *.* && "$registry" != *:* && "$registry" != localhost ) ]]; then
    registry="registry-1.docker.io"
  fi
  registry="${registry%%:*}"
  for (( attempt=1; attempt<=WAIT_ATTEMPTS; attempt++ )); do
    address="$(container_ipv4 || true)"
    if [[ -n "$address" ]] && pct exec "$CTID" -- getent hosts download.docker.com "$registry" >/dev/null 2>&1; then
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
    "ORBITPAGE_BIND_ADDRESS=${BIND_ADDRESS}"
    "ORBITPAGE_REQUIRE_SETUP_TOKEN=${REQUIRE_SETUP_TOKEN}"
  )
  if [[ -n "$PUBLIC_SITE_URL" ]]; then
    guest_env+=("ORBITPAGE_PUBLIC_SITE_URL=${PUBLIC_SITE_URL}")
  fi

  local installer_path
  installer_path="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/install.sh"
  [[ -f "$installer_path" ]] || die 'Run install-pve.sh alongside install.sh in a trusted local checkout.'
  info "Installing prerequisites inside LXC $CTID..."
  pct exec "$CTID" -- bash -lc \
    'apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ca-certificates curl'

  if [[ -n "$SSH_PUBLIC_KEY" ]]; then
    pct exec "$CTID" -- bash -lc \
      'DEBIAN_FRONTEND=noninteractive apt-get install -y -qq openssh-server && systemctl enable --now ssh'
  fi

  info "Installing OrbitPage inside LXC $CTID..."
  pct exec "$CTID" -- install -d -m 0700 /root/orbitpage-installer/scripts
  pct push "$CTID" "$installer_path" /root/orbitpage-installer/install.sh
  pct push "$CTID" "$(dirname "$installer_path")/scripts/orbitpage-update.py" /root/orbitpage-installer/scripts/orbitpage-update.py
  pct exec "$CTID" -- env "${guest_env[@]}" bash -lc \
    'bash /root/orbitpage-installer/install.sh'
}

main() {
  local guest_ip health_address access_address
  if [[ "${1:-}" == --require-setup-token ]]; then
    REQUIRE_SETUP_TOKEN=true
    shift
  fi
  [[ $# -eq 0 ]] || die 'Unknown option. Use --require-setup-token to protect first setup.'
  printf '\nOrbitPage Proxmox VE installer v%s\n\n' "$SCRIPT_VERSION"
  validate_inputs
  select_resources

  info "Plan: CT $CTID, ${CORES} cores, ${MEMORY} MB RAM, ${DISK_GB} GB on $ROOTFS_STORAGE."
  info "Network: $BRIDGE, $IP_ADDRESS, firewall=$FIREWALL."
  prepare_template
  create_container
  wait_for_container

  guest_ip="$(wait_for_network)"
  install_orbitpage
  health_address="$BIND_ADDRESS"
  [[ "$health_address" != 0.0.0.0 ]] || health_address=127.0.0.1
  pct exec "$CTID" -- curl --fail --silent --show-error "http://${health_address}:${HTTP_PORT}/health" >/dev/null

  success "OrbitPage is ready in unprivileged LXC $CTID."
  access_address="$BIND_ADDRESS"
  [[ "$access_address" != 0.0.0.0 ]] || access_address="$guest_ip"
  printf '\nPublic page: http://%s:%s/\n' "$access_address" "$HTTP_PORT"
  printf 'Dashboard:   http://%s:%s/dashboard/profile\n' "$access_address" "$HTTP_PORT"
  printf 'Local health check: pct exec %s -- curl -fsS http://%s:%s/health\n' "$CTID" "$health_address" "$HTTP_PORT"
  if [[ "$REQUIRE_SETUP_TOKEN" == true ]]; then
    printf 'Local setup token: pct exec %s -- cat /var/lib/orbitpage/.setup-token\n' "$CTID"
  fi
  if [[ "$BIND_ADDRESS" == 127.0.0.1 ]]; then
    printf 'Loopback access is limited to processes inside LXC %s.\n' "$CTID"
  fi
  printf 'The public page shows Under construction until the first-run wizard is completed.\n\n'
  printf 'Manage from the PVE host:\n'
  printf '  pct exec %s -- orbitpage status\n' "$CTID"
  printf '  pct exec %s -- orbitpage logs\n' "$CTID"
  printf '  pct enter %s\n\n' "$CTID"
}

main "$@"

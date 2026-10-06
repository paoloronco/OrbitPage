#!/usr/bin/env bash

set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_DIR="$(mktemp -d)"
FAKE_BIN="${TEST_DIR}/bin"
CALLS="${TEST_DIR}/calls.log"
CT_STATE="${TEST_DIR}/ct-created"
TEMPLATE_STATE="${TEST_DIR}/template-downloaded"

fail() {
  printf 'PVE installer test failed: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  rm -rf -- "$TEST_DIR"
}

[[ ${EUID} -eq 0 ]] || fail "run this test as root"
trap cleanup EXIT
mkdir -p "$FAKE_BIN"

cat > "${FAKE_BIN}/pveversion" <<'EOF'
#!/usr/bin/env bash
printf 'pve-manager/%s.4.1/fixture (running kernel: fixture)\n' "${ORBITPAGE_TEST_PVE_MAJOR:-8}"
EOF

cat > "${FAKE_BIN}/dpkg-query" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "${ORBITPAGE_TEST_LXC_VERSION:-6.0.0-2}"
EOF

cat > "${FAKE_BIN}/pvesh" <<'EOF'
#!/usr/bin/env bash
if [[ "$*" == "get /cluster/nextid --vmid "* ]]; then
  [[ "${ORBITPAGE_TEST_CLUSTER_ID_USED:-0}" != 1 ]] || exit 1
elif [[ "$*" != "get /cluster/nextid --output-format json" ]]; then
  exit 1
fi
printf '123\n'
EOF

cat > "${FAKE_BIN}/pvesm" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "$*" == "status --content rootdir" ]]; then
  printf 'Name Type Status Total Used Available %%\nlocal-lvm lvmthin %s 1 1 1 1\n' "${ORBITPAGE_TEST_STORAGE_STATUS:-active}"
elif [[ "$*" == "status --content vztmpl" ]]; then
  printf 'Name Type Status Total Used Available %%\nlocal dir active 1 1 1 1\n'
else
  exit 1
fi
EOF

cat > "${FAKE_BIN}/pveam" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'pveam %s\n' "$*" >> "$ORBITPAGE_TEST_CALLS"
case "${1:-}" in
  update)
    exit 0
    ;;
  available)
    printf 'system debian-12-standard_12.7-1_amd64.tar.zst\n'
    ;;
  list)
    printf 'VOLID\n'
    if [[ -f "$ORBITPAGE_TEST_TEMPLATE_STATE" || "${ORBITPAGE_TEST_TEMPLATE_CACHED:-0}" == 1 ]]; then
      printf 'local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst\n'
    fi
    ;;
  download)
    touch "$ORBITPAGE_TEST_TEMPLATE_STATE"
    ;;
  *)
    exit 1
    ;;
esac
EOF

cat > "${FAKE_BIN}/pct" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'pct' >> "$ORBITPAGE_TEST_CALLS"
printf ' <%s>' "$@" >> "$ORBITPAGE_TEST_CALLS"
printf '\n' >> "$ORBITPAGE_TEST_CALLS"

case "${1:-}" in
  status)
    [[ -f "$ORBITPAGE_TEST_CT_STATE" ]]
    ;;
  create)
    [[ "${ORBITPAGE_TEST_FAIL:-}" != create ]] || exit 1
    touch "$ORBITPAGE_TEST_CT_STATE"
    ;;
  start)
    [[ "${ORBITPAGE_TEST_FAIL:-}" != start ]]
    ;;
  push)
    [[ "${ORBITPAGE_TEST_FAIL:-}" != push ]]
    ;;
  exec)
    arguments=" $* "
    [[ "${ORBITPAGE_TEST_FAIL:-}" != ready || "$arguments" != *" -- true "* ]] || exit 1
    [[ "${ORBITPAGE_TEST_FAIL:-}" != dns || "$arguments" != *" getent hosts "* ]] || exit 1
    [[ "${ORBITPAGE_TEST_FAIL:-}" != install || "$arguments" != *"bash /root/orbitpage-installer/install.sh"* ]] || exit 1
    [[ "${ORBITPAGE_TEST_FAIL:-}" != health || "$arguments" != *" curl "* ]] || exit 1
    if [[ "$arguments" == *" ip -4 -o addr show dev eth0 scope global "* ]]; then
      [[ "${ORBITPAGE_TEST_FAIL:-}" != ip ]] && printf '2: eth0 inet 192.0.2.25/24 brd 192.0.2.255 scope global eth0\n'
    fi
    exit 0
    ;;
  *)
    exit 1
    ;;
esac
EOF

cat > "${FAKE_BIN}/ip" <<'EOF'
#!/usr/bin/env bash
[[ "$*" == "link show vmbr0" && "${ORBITPAGE_TEST_BRIDGE_MISSING:-0}" != 1 ]]
EOF

chmod 0755 "${FAKE_BIN}/dpkg-query" "${FAKE_BIN}/pveversion" "${FAKE_BIN}/pvesh" "${FAKE_BIN}/pvesm" \
  "${FAKE_BIN}/pveam" "${FAKE_BIN}/pct" "${FAKE_BIN}/ip"

PATH="${FAKE_BIN}:${PATH}" \
ORBITPAGE_TEST_CALLS="$CALLS" \
ORBITPAGE_TEST_CT_STATE="$CT_STATE" \
ORBITPAGE_TEST_TEMPLATE_STATE="$TEMPLATE_STATE" \
ORBITPAGE_PVE_TEST_MODE=1 \
ORBITPAGE_PVE_WAIT_SECONDS=0 \
ORBITPAGE_IMAGE=ghcr.io/paoloronco/orbitpage:4.18.5 \
ORBITPAGE_HTTP_PORT=18080 \
ORBITPAGE_PUBLIC_SITE_URL=https://page.example.test \
bash "${REPO_ROOT}/install-pve.sh"

[[ -f "$TEMPLATE_STATE" ]] || fail "Debian template was not downloaded"
grep -Fq 'pct <create> <123> <local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst>' "$CALLS" \
  || fail "container create command is missing"
grep -Fq '<--unprivileged> <1>' "$CALLS" || fail "container is not unprivileged"
grep -Fq '<--features> <nesting=1,keyctl=1>' "$CALLS" || fail "Docker LXC features are missing"
grep -Fq '<--onboot> <1>' "$CALLS" || fail "container does not start on boot"
grep -Fq '<--rootfs> <local-lvm:12>' "$CALLS" || fail "rootfs storage was not selected"
grep -Fq '<--net0> <name=eth0,bridge=vmbr0,ip=dhcp,ip6=auto,firewall=1>' "$CALLS" \
  || fail "safe default network was not configured"
grep -Fq '<ORBITPAGE_IMAGE=ghcr.io/paoloronco/orbitpage:4.18.5>' "$CALLS" \
  || fail "pinned image was not forwarded"
grep -Fq '<ORBITPAGE_HTTP_PORT=18080>' "$CALLS" || fail "HTTP port was not forwarded"
grep -Fq '<ORBITPAGE_BIND_ADDRESS=127.0.0.1>' "$CALLS" || fail "guest HTTP listener is not loopback-only"
grep -Fq '<ORBITPAGE_PUBLIC_SITE_URL=https://page.example.test>' "$CALLS" \
  || fail "public URL was not forwarded"
grep -Fq '<push> <123>' "$CALLS" || fail "local guest installer was not copied"
grep -Fq '<bash /root/orbitpage-installer/install.sh>' "$CALLS" || fail "local guest installer was not invoked"
grep -Fq '</root/orbitpage-installer/scripts/orbitpage-update.py>' "$CALLS" || fail "dashboard update helper was not copied into the guest"
grep -Fq '<curl> <--fail> <--silent> <--show-error> <http://127.0.0.1:18080/health>' "$CALLS" || fail "guest health endpoint was not verified"
awk '
  /pct <create>/ { created=1 }
  /pct <start>/ { if (!created) exit 1; started=1 }
  /pct <push>/ { if (!started) exit 1; copied=1 }
  /bash \/root\/orbitpage-installer\/install.sh/ { if (!copied) exit 1; installed=1 }
  /<curl>/ { if (!installed) exit 1; healthy=1 }
  END { if (!healthy) exit 1 }
' "$CALLS" || fail 'guest creation, copy, installation and health checks ran in the wrong order'

run_case() {
  rm -f "$CT_STATE" "$TEMPLATE_STATE" "$CALLS"
  env PATH="${FAKE_BIN}:${PATH}" ORBITPAGE_TEST_CALLS="$CALLS" \
    ORBITPAGE_TEST_CT_STATE="$CT_STATE" ORBITPAGE_TEST_TEMPLATE_STATE="$TEMPLATE_STATE" \
    ORBITPAGE_PVE_TEST_MODE=1 ORBITPAGE_PVE_WAIT_SECONDS=0 ORBITPAGE_PVE_WAIT_ATTEMPTS=2 \
    "$@" bash "${REPO_ROOT}/install-pve.sh" > "$TEST_DIR/result" 2>&1
}

expect_rejected() {
  local message="$1"
  shift
  if run_case "$@"; then fail "invalid configuration was accepted: $*"; fi
  grep -Fq "$message" "$TEST_DIR/result" || { cat "$TEST_DIR/result"; fail "missing validation: $message"; }
  [[ ! -f "$CT_STATE" ]] || fail "invalid configuration created a guest"
}

expect_rejected 'Invalid IPv4' ORBITPAGE_PVE_IP=999.2.3.4/24
expect_rejected 'Invalid IPv4' ORBITPAGE_PVE_IP=192.0.2.25/24 ORBITPAGE_PVE_GATEWAY=192.0.2.999
expect_rejected 'IPv4 CIDR' ORBITPAGE_PVE_IP=192.0.2.25/33
expect_rejected 'static IP' ORBITPAGE_PVE_GATEWAY=192.0.2.1
expect_rejected 'ORBITPAGE_HTTP_PORT' ORBITPAGE_HTTP_PORT=65536
expect_rejected 'ORBITPAGE_PVE_MEMORY' ORBITPAGE_PVE_MEMORY=1
expect_rejected 'ORBITPAGE_PVE_VLAN' ORBITPAGE_PVE_VLAN=4095
expect_rejected 'ORBITPAGE_PVE_CORES' ORBITPAGE_PVE_CORES=999999999999999999999999
expect_rejected 'Network bridge' ORBITPAGE_TEST_BRIDGE_MISSING=1
expect_rejected 'not active' ORBITPAGE_TEST_STORAGE_STATUS=inactive ORBITPAGE_PVE_ROOTFS_STORAGE=local-lvm
expect_rejected 'already in use' ORBITPAGE_TEST_CLUSTER_ID_USED=1 ORBITPAGE_PVE_CTID=123
expect_rejected 'Update the Proxmox' ORBITPAGE_TEST_LXC_VERSION=6.0.0-1
expect_rejected 'Update the Proxmox' ORBITPAGE_TEST_PVE_MAJOR=9 ORBITPAGE_TEST_LXC_VERSION=6.0.5-1

run_case ORBITPAGE_TEST_PVE_MAJOR=9 ORBITPAGE_TEST_LXC_VERSION=6.0.5-2 \
  ORBITPAGE_TEST_TEMPLATE_CACHED=1 ORBITPAGE_PVE_CTID=250 ORBITPAGE_PVE_IP=192.0.2.25/24 \
  ORBITPAGE_PVE_GATEWAY=192.0.2.1 ORBITPAGE_PVE_VLAN=30 ORBITPAGE_PVE_DISK_GB=08
grep -Fq 'ip=192.0.2.25/24,ip6=auto,firewall=1,gw=192.0.2.1,tag=30' "$CALLS" || fail 'static network options were not passed'
grep -Fq '<--rootfs> <local-lvm:8>' "$CALLS" || fail 'leading-zero disk size was not normalized'
! grep -Fq 'pveam download' "$CALLS" || fail 'cached template was downloaded again'
run_case ORBITPAGE_IMAGE=paoloronco/orbitpage
grep -Fq '<getent> <hosts> <download.docker.com> <registry-1.docker.io>' "$CALLS" || fail 'Docker Hub registry DNS was not checked'

for stage in start ready ip dns push install health; do
  if run_case ORBITPAGE_TEST_FAIL="$stage"; then fail "failed $stage was reported as ready"; fi
  [[ -f "$CT_STATE" ]] || fail "failed $stage lost the guest fixture"
  grep -Fq 'was kept for diagnostics' "$TEST_DIR/result" || fail "failed $stage lost recovery instructions"
  ! grep -Fq 'OrbitPage is ready' "$TEST_DIR/result" || fail "failed $stage claimed success"
  ! grep -Fq '<destroy>' "$CALLS" || fail "failed $stage deleted the guest"
done
if run_case ORBITPAGE_TEST_FAIL=create; then fail 'failed create was reported as ready'; fi
[[ ! -f "$CT_STATE" ]] || fail 'failed create left a false created state'
! grep -Fq 'was kept for diagnostics' "$TEST_DIR/result" || fail 'failed create claimed ownership of an existing guest'

printf 'OrbitPage PVE installer integration test passed.\n'

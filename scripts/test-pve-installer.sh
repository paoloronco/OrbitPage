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
printf 'pve-manager/8.4.1/2a5fa54a8503f96d (running kernel: 6.8.12-10-pve)\n'
EOF

cat > "${FAKE_BIN}/pvesh" <<'EOF'
#!/usr/bin/env bash
[[ "$*" == "get /cluster/nextid --output-format json" ]] || exit 1
printf '123\n'
EOF

cat > "${FAKE_BIN}/pvesm" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "$*" == "status --content rootdir" ]]; then
  printf 'Name Type Status Total Used Available %%\nlocal-lvm lvmthin active 1 1 1 1\n'
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
    if [[ -f "$ORBITPAGE_TEST_TEMPLATE_STATE" ]]; then
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
    touch "$ORBITPAGE_TEST_CT_STATE"
    ;;
  start)
    exit 0
    ;;
  exec)
    arguments=" $* "
    if [[ "$arguments" == *" ip -4 -o addr show dev eth0 scope global "* ]]; then
      printf '2: eth0 inet 192.0.2.25/24 brd 192.0.2.255 scope global eth0\n'
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
[[ "$*" == "link show vmbr0" ]]
EOF

chmod 0755 "${FAKE_BIN}/pveversion" "${FAKE_BIN}/pvesh" "${FAKE_BIN}/pvesm" \
  "${FAKE_BIN}/pveam" "${FAKE_BIN}/pct" "${FAKE_BIN}/ip"

PATH="${FAKE_BIN}:${PATH}" \
ORBITPAGE_TEST_CALLS="$CALLS" \
ORBITPAGE_TEST_CT_STATE="$CT_STATE" \
ORBITPAGE_TEST_TEMPLATE_STATE="$TEMPLATE_STATE" \
ORBITPAGE_PVE_TEST_MODE=1 \
ORBITPAGE_PVE_WAIT_SECONDS=0 \
ORBITPAGE_IMAGE=ghcr.io/paoloronco/orbitpage:4.17.9 \
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
grep -Fq '<ORBITPAGE_IMAGE=ghcr.io/paoloronco/orbitpage:4.17.9>' "$CALLS" \
  || fail "pinned image was not forwarded"
grep -Fq '<ORBITPAGE_HTTP_PORT=18080>' "$CALLS" || fail "HTTP port was not forwarded"
grep -Fq '<ORBITPAGE_PUBLIC_SITE_URL=https://page.example.test>' "$CALLS" \
  || fail "public URL was not forwarded"
grep -Fq "curl -fsSL 'https://raw.githubusercontent.com/paoloronco/OrbitPage/main/install.sh' | bash" "$CALLS" \
  || fail "guest installer was not invoked"

printf 'OrbitPage PVE installer integration test passed.\n'

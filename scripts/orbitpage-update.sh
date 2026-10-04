#!/usr/bin/env bash
set -Eeuo pipefail

[[ ${EUID} -eq 0 ]] || { echo 'Run with sudo: sudo orbitpage-update' >&2; exit 1; }

# Accepted by the updater bundled before the generic host command.
args=()
for arg in "$@"; do
  case "$arg" in
    --skip-self-update | --logs) ;;
    *) args+=("$arg") ;;
  esac
done

# The official Linux and Proxmox installers already own backups and Compose state.
if [[ -x /usr/local/bin/orbitpage && -f /opt/orbitpage/compose.yaml && "${args[0]:-}" != --enable-web-updates && "${args[0]:-}" != --serve-web-updates ]]; then
  exec /usr/local/bin/orbitpage update "${args[@]}"
fi

helper=/usr/local/lib/orbitpage/orbitpage-update.py
if [[ ! -f "$helper" ]]; then
  printf 'The host updater helper is missing. Reinstall it from a trusted OrbitPage source checkout.\n' >&2
  exit 1
fi

exec python3 "$helper" "${args[@]}"

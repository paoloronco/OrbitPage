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
if [[ -x /usr/local/bin/orbitpage && -f /opt/orbitpage/compose.yaml ]]; then
  exec /usr/local/bin/orbitpage update "${args[@]}"
fi

helper=/usr/local/lib/orbitpage/orbitpage-update.py
if [[ ! -f "$helper" ]]; then
  install -d -m 0755 "$(dirname "$helper")"
  source_script="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/orbitpage-update.py"
  temp="$(mktemp)"
  trap 'rm -f "$temp"' EXIT
  if [[ -f "$source_script" ]]; then
    cp "$source_script" "$temp"
  else
    docker run --rm --entrypoint cat paoloronco/orbitpage:latest /app/orbitpage-update.py > "$temp"
  fi
  python3 -m py_compile "$temp"
  install -m 0644 "$temp" "$helper"
fi

exec python3 "$helper" "${args[@]}"

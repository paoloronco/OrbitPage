#!/usr/bin/env bash
set -Eeuo pipefail

[[ ${EUID} -eq 0 ]] || { echo 'Run this installer with sudo.' >&2; exit 1; }

cli=/usr/local/bin/orbitpage-update
helper=/usr/local/lib/orbitpage/orbitpage-update.py
source_root="${2:-}"
temp="$(mktemp -d)"
trap 'rm -rf -- "$temp"' EXIT

if [[ -x /usr/local/bin/orbitpage && -f /opt/orbitpage/compose.yaml ]]; then
  cat > "$temp/orbitpage-update" <<'EOF'
#!/usr/bin/env bash
exec /usr/local/bin/orbitpage update "$@"
EOF
  install -m 0755 "$temp/orbitpage-update" "$cli"
  echo "Installed $cli for the managed OrbitPage installation."
  exit 0
fi

local_scripts="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"
if [[ "${1:-}" == source ]]; then
  [[ -n "$source_root" && -f "$source_root/scripts/orbitpage-update.sh" && -f "$source_root/scripts/orbitpage-update.py" ]] \
    || { echo 'Pass the absolute OrbitPage source checkout path.' >&2; exit 1; }
  cp "$source_root/scripts/orbitpage-update.sh" "$temp/orbitpage-update.sh"
  cp "$source_root/scripts/orbitpage-update.py" "$temp/orbitpage-update.py"
elif [[ -f "$local_scripts/orbitpage-update.sh" && -f "$local_scripts/orbitpage-update.py" ]]; then
  cp "$local_scripts/orbitpage-update.sh" "$temp/orbitpage-update.sh"
  cp "$local_scripts/orbitpage-update.py" "$temp/orbitpage-update.py"
else
  base=https://raw.githubusercontent.com/paoloronco/OrbitPage/main/scripts
  curl -fsSL "$base/orbitpage-update.sh" -o "$temp/orbitpage-update.sh"
  curl -fsSL "$base/orbitpage-update.py" -o "$temp/orbitpage-update.py"
fi

bash -n "$temp/orbitpage-update.sh"
python3 -m py_compile "$temp/orbitpage-update.py"
install -d -m 0755 "$(dirname "$helper")"
install -m 0644 "$temp/orbitpage-update.py" "$helper"
install -m 0755 "$temp/orbitpage-update.sh" "$cli"

if [[ "${1:-}" == source ]]; then
  "$cli" --register-source "$source_root"
fi

echo "Installed $cli. Run: sudo orbitpage-update"

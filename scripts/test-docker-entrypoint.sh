#!/usr/bin/env bash

set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
entrypoint="${repo_root}/docker-entrypoint.sh"
test_dir="$(mktemp -d)"
trap 'rm -rf -- "$test_dir"' EXIT

if ! command -v node >/dev/null 2>&1 && command -v node.exe >/dev/null 2>&1; then
  ln -s "$(command -v node.exe)" "${test_dir}/node"
  export PATH="${test_dir}:${PATH}"
fi

fail() {
  printf 'Docker entrypoint test failed: %s\n' "$*" >&2
  exit 1
}

cmp -s "$entrypoint" "${repo_root}/app/docker-entrypoint.sh" || fail "entrypoint copies differ"

generated="$(env -u JWT_SECRET DATA_DIR="${test_dir}/generated" sh "$entrypoint" printenv JWT_SECRET)"
[[ "$generated" =~ ^[a-f0-9]{64}$ ]] || fail "generated secret is invalid"
[[ "$(cat "${test_dir}/generated/.jwt-secret")" == "$generated" ]] || fail "generated secret was not persisted"
[[ "$(stat -c '%a' "${test_dir}/generated/.jwt-secret")" == "600" ]] || fail "persisted secret permissions are not 0600"

reused="$(env -u JWT_SECRET DATA_DIR="${test_dir}/generated" sh "$entrypoint" printenv JWT_SECRET)"
[[ "$reused" == "$generated" ]] || fail "restart replaced the generated secret"

explicit="explicit-secret-that-is-at-least-thirty-two-characters"
configured="$(JWT_SECRET="$explicit" DATA_DIR="${test_dir}/explicit" sh "$entrypoint" printenv JWT_SECRET)"
[[ "$configured" == "$explicit" ]] || fail "explicit secret was not preserved"
[[ ! -e "${test_dir}/explicit/.jwt-secret" ]] || fail "explicit secret was copied into the data directory"

if JWT_SECRET=short DATA_DIR="${test_dir}/invalid" sh "$entrypoint" true 2>/dev/null; then
  fail "weak explicit secret was accepted"
fi

printf 'Docker entrypoint JWT secret test passed.\n'

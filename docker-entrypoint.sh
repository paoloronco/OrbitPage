#!/bin/sh
set -e
umask 077

# If the first argument is a built-in command we want to run directly
# (e.g. "cat" used to extract bundled scripts), skip the JWT check.
if [ "$1" = "cat" ] || [ "$1" = "sh" ] || [ "$1" = "bash" ]; then
  exec "$@"
fi

if [ -z "${JWT_SECRET:-}" ]; then
  data_dir="${DATA_DIR:-/app/data}"
  secret_file="${data_dir}/.jwt-secret"
  mkdir -p "$data_dir"

  if [ -s "$secret_file" ]; then
    JWT_SECRET="$(cat "$secret_file")"
  else
    JWT_SECRET="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")"
    printf '%s\n' "$JWT_SECRET" > "$secret_file"
    echo >&2 "[OrbitPage] Generated JWT_SECRET in ${secret_file}."
  fi

  chmod 600 "$secret_file"
  export JWT_SECRET
fi

# Reject explicitly configured or persisted weak secrets.
case "${JWT_SECRET:-}" in
  ""|change-me|change-me-to-a-long-random-string|replace-with-a-long-random-secret|secret|your-secret-key)
    echo >&2 "ERROR: JWT_SECRET uses a known placeholder."
    echo >&2 "Remove it to let OrbitPage generate one, or set at least 32 random characters."
    exit 1
    ;;
esac

if [ "${#JWT_SECRET}" -lt 32 ]; then
  echo >&2 "ERROR: JWT_SECRET must contain at least 32 characters."
  exit 1
fi

# If everything is ok, run the provided command (default: node server.js)
exec "$@"

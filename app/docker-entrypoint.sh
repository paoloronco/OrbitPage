#!/bin/sh
set -e
umask 077

if [ "$1" = "cat" ] || [ "$1" = "sh" ] || [ "$1" = "bash" ]; then
  exec "$@"
fi

case "${JWT_SECRET:-}" in
  ""|change-me|change-me-to-a-long-random-string|secret|your-secret-key)
    echo >&2 "ERROR: JWT_SECRET is missing or uses a known placeholder."
    echo >&2 "Set a stable random value with at least 32 characters (for example: openssl rand -hex 32)."
    exit 1
    ;;
esac

if [ "${#JWT_SECRET}" -lt 32 ]; then
  echo >&2 "ERROR: JWT_SECRET must contain at least 32 characters."
  exit 1
fi

exec "$@"

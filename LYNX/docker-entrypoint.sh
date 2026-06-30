#!/bin/sh
set -e

if [ "$1" = "cat" ] || [ "$1" = "sh" ] || [ "$1" = "bash" ]; then
  exec "$@"
fi

if [ -z "${JWT_SECRET:-}" ]; then
  echo >&2 "ERROR: The JWT_SECRET environment variable is not set."
  echo >&2 "Set JWT_SECRET before starting the container (e.g., -e JWT_SECRET=\"secret-value\")."
  exit 1
fi

exec "$@"

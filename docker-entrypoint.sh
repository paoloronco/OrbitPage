#!/bin/sh
set -e

# If the first argument is a built-in command we want to run directly
# (e.g. "cat" used to extract bundled scripts), skip the JWT check.
if [ "$1" = "cat" ] || [ "$1" = "sh" ] || [ "$1" = "bash" ]; then
  exec "$@"
fi

# Abort if JWT_SECRET is not provided
if [ -z "${JWT_SECRET:-}" ]; then
  echo >&2 "ERROR: The JWT_SECRET environment variable is not set."
  echo >&2 "Set JWT_SECRET before starting the container (e.g., -e JWT_SECRET=\"secret-value\")."
  exit 1
fi

# If everything is ok, run the provided command (default: node server.js)
exec "$@"

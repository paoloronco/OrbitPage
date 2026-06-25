#!/bin/sh
# Point Git at the tracked hooks in .githooks/ (works on Linux, macOS, Git Bash on Windows).
set -e

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

git config core.hooksPath .githooks

if [ -f ".githooks/pre-push" ]; then
  chmod +x .githooks/pre-push
fi

echo "Git hooks installed (core.hooksPath=.githooks)"
echo "Pre-push will run: build, lint, frontend unit tests, backend unit tests."

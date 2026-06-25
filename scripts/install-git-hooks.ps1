# Install tracked Git hooks on Windows (PowerShell).
$Root = git rev-parse --show-toplevel
Set-Location $Root

git config core.hooksPath .githooks

Write-Host "Git hooks installed (core.hooksPath=.githooks)"
Write-Host "Pre-push will run: build, lint, frontend unit tests, backend unit tests."

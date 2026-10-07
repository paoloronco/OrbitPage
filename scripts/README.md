# Repository scripts

These public helpers are part of the supported self-hosted installation and
maintenance path. Keep them in GitHub so Linux/PVE installs, host updates and CI
use the same reviewed version. Do not move their published paths casually.

## Host operations and contributor tools

- `install-git-hooks.sh` and `install-git-hooks.ps1`: point Git at the tracked `.githooks/` directory.
- `orbitpage-update.sh` and `orbitpage-update.py`: host update command for existing Docker, Compose, and source installations.
- The root `install.sh` also owns dashboard update service activation through
  `web-updates CONTAINER`; see [Web updates](../docs/wiki/administration/Deployment.md#web-updates).

## Isolated verification helpers

- `check-markdown-links.mjs`: validates repository-local documentation links;
  CI runs it before application checks.
- `check-tracked-runtime-data.mjs`: rejects tracked databases, sidecars and local
  credential/configuration files in CI, before push and before release. It
  checks the current Git index; it neither reads nor rewrites historical data.
- `test-installer.sh`: isolated Linux-installer checks, including dependency branches, supported OS detection, invalid input, failed pulls/health checks, repeat installs, backups and cancellation of a purge.
- `test-pve-installer.sh`: isolated Proxmox-installer checks with mocked host commands, including patched LXC versions, cluster ID collisions, storage/network validation, cached templates, static networking and failures throughout guest creation/start/install/health checks.
- `test-docker-entrypoint.sh`: verifies automatic JWT secret creation and reuse.
- `test-docker-context.mjs`: checks that runtime secrets and data stay outside the Docker build context.
- `test-updater.py`: exercises updater decisions against isolated mocked host commands.
- `test-updater-docker.py`: checks container recreation preserves mounts, ports and environment in the dedicated CI Docker fixture; never run against an ordinary installation.

The public installers themselves live at repository root as `install.sh` and `install-pve.sh`. Run them from a trusted local checkout; the PVE installer copies that checkout's guest installer into the new container.

Run the documentation link check from the repository root:

```bash
node scripts/check-markdown-links.mjs
```

## Safety rules

- Keep installer changes idempotent and preserve existing data, secrets, image pins, and operator configuration.
- Never test an installer against the developer's real Docker state, host configuration, or production paths.
- Use the dedicated test scripts and temporary directories.
- Quote paths and environment values, fail on errors, and verify resolved deletion targets before cleanup.
- Update [Deployment](../docs/wiki/administration/Deployment.md) whenever an installer option or management command changes.

CI invokes the applicable checks in [quality-checks.yml](../.github/workflows/quality-checks.yml).
Shell installer tests require a disposable Linux environment; the PVE test mocks
host commands and does not create a real guest. Run `python scripts/test-updater.py`
from the repository root for mocked updater tests; the container variant needs
its dedicated Docker fixture. The [npm advisory gates](../docs/wiki/development/github-automation.md)
run directly in the quality workflow.

# Repository scripts

These scripts support installation, updates, Git hooks, and installer verification. They are not application runtime modules.

## Tracked helpers

- `install-git-hooks.sh` and `install-git-hooks.ps1`: point Git at the tracked `.githooks/` directory.
- `orbitpage-update.sh`: update helper bundled into the canonical production image.
- `check-markdown-links.mjs`: validates repository-local documentation links;
  CI runs it before application checks.
- `test-installer.sh`: isolated Linux-installer checks.
- `test-pve-installer.sh`: isolated Proxmox-installer checks with mocked host commands.

The public installers themselves live at repository root as `install.sh` and `install-pve.sh` because users invoke them directly from raw GitHub URLs.

## Safety rules

- Keep installer changes idempotent and preserve existing data, secrets, image pins, and operator configuration.
- Never test an installer against the developer's real Docker state, host configuration, or production paths.
- Use the dedicated test scripts and temporary directories.
- Quote paths and environment values, fail on errors, and verify resolved deletion targets before cleanup.
- Update [Deployment](../docs/wiki/Deployment.md) whenever an installer option or management command changes.

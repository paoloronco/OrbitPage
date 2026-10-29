# Repository scripts

These public helpers support self-hosted updates and repository verification.
Keep them in GitHub so installations, contributors and CI use the same reviewed
version. Tests and contributor tools belong in the source repository even when
they are not needed by a running installation. The root Dockerfile bundles only
`orbitpage-update.sh` and `orbitpage-update.py` from this directory.

## Host operations

- `orbitpage-update.sh`: host command bundled in the Docker image for existing
  installations; delegates installer-managed updates to `orbitpage update` and
  otherwise invokes the Python helper. Its compatibility flags still support
  older installations; this is not an unused migration script.
- `orbitpage-update.py`: updates Docker, Compose and source installations and
  serves dashboard update requests. Both root installers also distribute this
  helper. Keep both updater filenames stable.
- The root `install.sh` also owns dashboard update service activation through
  `web-updates CONTAINER`; see [Web updates](../docs/wiki/administration/Deployment.md#web-updates).

## Contributor tools

- [`app/scripts/install-hooks.js`](../app/scripts/install-hooks.js): optional,
  cross-platform setup for the tracked `.githooks/` directory. Use the existing
  npm command instead of separate shell or PowerShell installers:

  ```bash
  npm --prefix app run install:hooks
  ```

  The pre-push hook checks tracked runtime data, lint, unit tests and the build.
- [`app/scripts/clean-e2e.js`](../app/scripts/clean-e2e.js): resets the isolated
  browser-test database before the `test:e2e:*` npm commands. It prevents tests
  from importing a developer's existing database.

## Isolated verification helpers

- [`app/scripts/check-mocker-security.mjs`](../app/scripts/check-mocker-security.mjs),
  run with `npm --prefix app run test:security:mocker`: exercises both installed
  Vitest mockers over loopback HTTP/WebSocket with synthetic modules and an
  outside-root canary. Checks literal escaping and file access on Linux and
  Windows without evaluating injected JavaScript.

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

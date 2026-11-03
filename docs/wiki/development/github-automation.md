# GitHub automation

| Workflow | Purpose |
| --- | --- |
| [quality-checks.yml](../../../.github/workflows/quality-checks.yml) | Push/PR quality gates plus weekly audits, tests, browser/Docker checks and supported-Node compatibility |
| [publish-release.yml](../../../.github/workflows/publish-release.yml) | Publish versioned images and a GitHub release after main checks pass |
| [sync-gitea-mirror.yml](../../../.github/workflows/sync-gitea-mirror.yml) | Copy Git branches and tags to the Gitea mirror |

## Weekly maintenance checks

The quality workflow also runs every Monday at 07:23 UTC, using the latest
`main` commit. This is 08:23 CET or 09:23 CEST in Rome. **Run workflow** on `main`
runs the same checks manually. Scheduled checks have a separate concurrency
group from push checks, so they cannot cancel the CI needed for a release.

The existing Node 22 quality, audit, Windows, browser and native Docker jobs are
reused. Weekly/manual runs also install the locked frontend/backend dependencies
and run types, build and unit tests on Node 24 and 26. Keep these matrix versions
aligned with the supported versions in both application manifests.

The **Maintenance report** job writes a GitHub Actions summary even when an
earlier check fails. Read individual job logs for details; failed browser jobs
retain their existing Playwright artifacts. Installation/build output stays in
the disposable runner. The quality workflow has only `contents: read`, does not
persist checkout credentials and never commits, pushes, creates issues, tags or
publishes a release. The existing Gitea mirror remains a separate workflow.

Review the [maintenance backlog](../../repository-maintenance.md) when a result
needs action. No-change runs require no repository update. GitHub may delay
scheduled runs and disables public-repository schedules after 60 days without
repository activity; check the Actions history and re-enable a disabled schedule
manually. See [GitHub's schedule contract](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## Release checks

The release workflow queries `Quality Gate`, `Mocker security (Windows)`, `E2E (browser)`, and `Build and smoke Docker (architecture)`; keep these job names aligned with the gate and repository protection.

Frontend and backend npm audits reject high/critical advisories. A release tag must match both application package versions. See [Contributing → Release notes](../../../CONTRIBUTING.md#release-notes).

Browser suites have a 25-minute execution budget inside a 30-minute job so
WebKit can complete the full suite and upload failure reports on slower runners.

Mocker security checks exercise both dependency graphs in the Linux quality
gate and a dedicated Windows job. They use temporary synthetic fixtures and
verify native path boundaries plus generated JavaScript escaping over real
local HTTP/WebSocket connections.

Publication reuses main CI's `rolling-amd64` and `rolling-arm64` build caches, verifies both architectures, and creates the release if it does not exist. Tag pushes and manual publication for the same tag share a concurrency group.

## Gitea mirror credential

The mirror runs from `main` and copies other refs as Git data, without building or executing their source. Main pushes, release completion, and ref deletion trigger it; an hourly schedule covers other ref changes.

Store `GITEA_TOKEN` only in the `gitea-mirror` GitHub environment. Its deployment branch policy must allow only `main`, with no tag rule. Remove repository/organization copies accessible to this repository: branch-authored workflows could otherwise use them.

Restrict the token to writing the mirror repository. After changing its placement, verify the environment policy and a mirror run. If exposed, rotate and revoke it at Gitea.

See [Scripts](../../../scripts/README.md) and [Security policy](../../../SECURITY.md).

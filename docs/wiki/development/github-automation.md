# GitHub automation

| Workflow | Purpose |
| --- | --- |
| [quality-checks.yml](../../../.github/workflows/quality-checks.yml) | Push/PR quality gates plus weekly audits, tests, browser/Docker checks and supported-Node compatibility |
| [publish-release.yml](../../../.github/workflows/publish-release.yml) | Publish versioned images and a GitHub release after main checks pass |
| [sync-gitea-mirror.yml](../../../.github/workflows/sync-gitea-mirror.yml) | Copy Git branches and tags to the Gitea mirror |
| [sync-blog-archive.yml](../../../.github/workflows/sync-blog-archive.yml) | Archive published public blog articles and completed translations under `docs/blog/` |

## Public blog archive

The archive workflow runs hourly at minute 43 UTC and supports **Run workflow**
on `main`. It reads the public manifest at
`https://orbitpage.com/api/blog/archive` and downloads changed Markdown exports
from `/api/blog/archive/{slug}?locale={language}`. The first run includes
existing published articles. Completed translations are added as they become
available; English fallbacks are never labelled as translations. Generation and
publication remain outside this repository.

[`sync-blog-archive.mjs`](../../../scripts/sync-blog-archive.mjs) accepts only
the fixed public origin, known languages and safe article slugs. It verifies
response types, language and SHA-256, bounds downloads and file sizes, rejects
symbolic links and writes only `docs/blog/`. It generates article and language
indexes and a deterministic manifest. Repeat runs without content changes make
no commit. Failed exports stop the run; earlier published copies are retained.
If Vercel reports `402 DEPLOYMENT_DISABLED` for the manifest, the run explicitly
skips synchronization without changing files, creating a token or committing.
Normal synchronization resumes when the public source is available again.
Images remain linked to their public hosts. This reading archive and its Git
history supplement the website's storage; they do not replace database backups.

n8n and the website have no GitHub write credential for this archive. The
dedicated **OrbitPage Blog Archive** GitHub App is installed only on this public
repository, with `contents: write` and mandatory read-only metadata. It has no
Actions, workflow, administration, pull-request, secret or private-repository
permissions. GitHub does not offer directory-level restrictions for content
writes: the script and commit step enforce the `docs/blog/` boundary.

The workflow's ordinary `GITHUB_TOKEN` has only `contents: read`. Store the App
private key as `BLOG_ARCHIVE_PRIVATE_KEY` and its public client ID as
`BLOG_ARCHIVE_CLIENT_ID` in the **blog-archive** environment, with deployment
branches restricted to `main`. Do not create repository/organization copies of
the key. Only after downloads, tests, link validation and change detection does
the official `actions/create-github-app-token` action mint a short-lived token,
restricted again to this repository and content writes. Checkout credentials
are not persisted. The token is passed only to the commit/push step and revoked
by the token action at job completion.

The commit step stages only the archive, checks its paths, rebases on public
`main` and pushes without force. No tenant records, drafts, AI responses or
private repository files are exported. Commits use the dedicated App's bot
identity and trigger ordinary push CI and the Gitea mirror. The archive workflow
itself has only scheduled/manual triggers, so it does not recurse on its commits.

Main's review/check ruleset retains the required pull request, resolved review
threads and strict **Quality Gate** check from GitHub Actions. Its bypass list
contains the dedicated App and the administrators who already had bypass
access. A separate safety ruleset prohibits force pushes and deletion without
granting the App that bypass. Other identities do not inherit the archive's
exception. To revoke publishing, suspend the App installation or remove its
environment secret and review/check bypass; retain the ordinary main safeguards.

Inspect **OSS - Archive published blog articles** in Actions after a publication.
Re-run after resolving an export, validation, permission or rebase failure;
unchanged article hashes prevent duplicate work. Disable that workflow to stop
repository updates without interrupting the website or n8n. GitHub may delay
scheduled runs; see its [schedule contract](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

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

Review the [maintenance backlog](../../maintainers/repository-maintenance.md) when a result
needs action. No-change runs require no repository update. GitHub may delay
scheduled runs and disables public-repository schedules after 60 days without
repository activity; check the Actions history and re-enable a disabled schedule
manually. See [GitHub's schedule contract](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## Release checks

The quality gate first runs the isolated documentation-checker tests and scans
all repository Markdown files. Local links, Linux-sensitive filename case,
section bookmarks and guide reachability must pass before dependency installation.
Run the same checks locally using [Scripts](../../../scripts/README.md).

The release workflow queries `Quality Gate`, `Mocker security (Windows)`, `E2E (browser)`, and `Build and smoke Docker (architecture)`; keep these job names aligned with the gate and repository protection.

Frontend and backend npm audits reject high/critical advisories. A release tag must match both application package versions. See [Contributing → Release notes](../../../CONTRIBUTING.md#release-notes).

Browser suites have a 25-minute execution budget inside a 30-minute job so
WebKit can complete the full suite and upload failure reports on slower runners.

Mocker security checks exercise both dependency graphs in the Linux quality
gate and a dedicated Windows job. They use temporary synthetic fixtures and
verify native path boundaries plus generated JavaScript escaping over active
local HTTP/WebSocket connections.

Publication reuses main CI's `rolling-amd64` and `rolling-arm64` build caches, verifies both architectures, and creates the release if it does not exist. Tag pushes and manual publication for the same tag share a concurrency group.

Images publish only to `paoloronco/orbitpage` and GHCR. The retired
`paueron/orbitpage` publisher and its credentials are no longer used; existing
installations follow the [migration guide](../administration/Deployment.md#older-docker-hub-images).

## Gitea mirror credential

The mirror runs from `main` and copies other refs as Git data, without building or executing their source. Main pushes, release completion, and ref deletion trigger it; an hourly schedule covers other ref changes.

Store `GITEA_TOKEN` only in the `gitea-mirror` GitHub environment. Its deployment branch policy must allow only `main`, with no tag rule. Remove repository/organization copies accessible to this repository: branch-authored workflows could otherwise use them.

Restrict the token to writing the mirror repository. After changing its placement, verify the environment policy and a mirror run. If exposed, rotate and revoke it at Gitea.

See [Scripts](../../../scripts/README.md) and [Security policy](../../../SECURITY.md).

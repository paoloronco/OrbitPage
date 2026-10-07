# GitHub automation

| Workflow | Purpose |
| --- | --- |
| [quality-checks.yml](../../../.github/workflows/quality-checks.yml) | Lint, types, unit tests, browser tests, and native amd64/arm64 Docker smoke checks |
| [publish-release.yml](../../../.github/workflows/publish-release.yml) | Publish versioned images and a GitHub release after main checks pass |
| [sync-gitea-mirror.yml](../../../.github/workflows/sync-gitea-mirror.yml) | Copy Git branches and tags to the Gitea mirror |

## Release checks

The release workflow queries `Quality Gate`, `E2E (browser)`, and `Build and smoke Docker (architecture)`; keep these job names aligned with the gate and repository protection.

Frontend and backend npm audits reject high/critical advisories. A release tag must match both application package versions. See [Contributing → Release notes](../../../CONTRIBUTING.md#release-notes).

Publication reuses main CI's `rolling-amd64` and `rolling-arm64` build caches, verifies both architectures, and creates the release if it does not exist. Tag pushes and manual publication for the same tag share a concurrency group.

## Gitea mirror credential

The mirror runs from `main` and copies other refs as Git data, without building or executing their source. Main pushes, release completion, and ref deletion trigger it; an hourly schedule covers other ref changes.

Store `GITEA_TOKEN` only in the `gitea-mirror` GitHub environment. Its deployment branch policy must allow only `main`, with no tag rule. Remove repository/organization copies accessible to this repository: branch-authored workflows could otherwise use them.

Restrict the token to writing the mirror repository. After changing its placement, verify the environment policy and a mirror run. If exposed, rotate and revoke it at Gitea.

See [Scripts](../../../scripts/README.md) and [Security policy](../../../SECURITY.md).

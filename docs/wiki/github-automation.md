# GitHub automation

| Workflow file | GitHub Actions name | Purpose |
| --- | --- | --- |
| [quality-checks.yml](../../.github/workflows/quality-checks.yml) | OSS - Quality checks | Main/PR quality gate, Chromium/Firefox/WebKit tests and native Docker smoke checks |
| [publish-release.yml](../../.github/workflows/publish-release.yml) | OSS - Publish release | Exact version tag, successful main checks, amd64/arm64 images and GitHub release |
| [sync-gitea-mirror.yml](../../.github/workflows/sync-gitea-mirror.yml) | OSS - Sync Gitea mirror | Copy Git refs using the protected environment credential |

Job check names remain `Quality Gate`, `E2E (browser)` and
`Build and smoke Docker (architecture)` because the release gate queries them.
These names are also relevant to repository protection rules.

Release publication reuses the `rolling-amd64` and `rolling-arm64` build caches
from the successful main CI. CI owns cache writes; releases avoid exporting a
duplicate tag-local cache. Images are still verified for both architectures.
The GitHub release is created idempotently in the image-publishing job, so it
does not need another hosted runner. Tag pushes and manual republishes of the
same tag share one concurrency group and do not cancel an active publication.

Frontend and backend npm audits reject all high/critical advisories without
exceptions. The former advisory-filter script was removed after updating the
toolchain and native-installation dependencies.

See [release procedure](../../CONTRIBUTING.md#release-notes),
[mirror credential rules](./Development.md#gitea-mirror-credential),
[repository scripts](../../scripts/README.md) and
[security policy](../../SECURITY.md).

# GitHub automation

| Workflow file | GitHub Actions name | Purpose |
| --- | --- | --- |
| [quality-checks.yml](./workflows/quality-checks.yml) | OSS - Quality checks | Main/PR quality gate, Chromium/Firefox/WebKit tests and native Docker smoke checks |
| [publish-release.yml](./workflows/publish-release.yml) | OSS - Publish release | Exact version tag, successful main checks, amd64/arm64 images and GitHub release |
| [sync-gitea-mirror.yml](./workflows/sync-gitea-mirror.yml) | OSS - Sync Gitea mirror | Copy Git refs using the protected environment credential |

Job check names remain `Quality Gate`, `E2E (browser)` and
`Build and smoke Docker (architecture)` because the release gate queries them.
These names are also relevant to repository protection rules.

Frontend and backend npm audits reject all high/critical advisories without
exceptions. The former advisory-filter script was removed after updating the
toolchain and native-installation dependencies.

See [release procedure](../CONTRIBUTING.md#release-notes),
[mirror credential rules](../docs/wiki/Development.md#gitea-mirror-credential),
[repository scripts](../scripts/README.md) and
[security policy](../SECURITY.md).

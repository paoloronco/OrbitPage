# OrbitPage documentation

This documentation covers the open-source, self-hosted OrbitPage application. For the managed service, plans, billing, and hosted automation API, use [orbitpage.com](https://orbitpage.com).

## Start or install OrbitPage

| Goal | Guide |
| --- | --- |
| Evaluate OrbitPage from source | [Getting started](./wiki/Getting-started.md) |
| Install on Linux, Proxmox, Docker, or a cloud host | [Deployment](./wiki/Deployment.md) |
| Configure runtime and build variables | [Configuration](./wiki/Configuration.md) |
| Solve startup, proxy, login, or indexing problems | [Troubleshooting](./wiki/Troubleshooting.md) |

## Use the dashboard

| Goal | Guide |
| --- | --- |
| Understand Page, Content, Theme, Publish, Backup, Analytics, Privacy, Team, and Account | [Dashboard guide](./user-guide/dashboard.md) |
| Configure the self-hosted AI assistant and review changes safely | [AI assistant](./user-guide/ai-assistant.md) |
| Understand built-in analytics, GA4, and consent | [Analytics and privacy](./user-guide/analytics-and-privacy.md) |
| Configure metadata, sitemap, robots, and discovery files | [SEO and indexing](./wiki/SEO-and-indexing.md) |

## Operate securely

- [Security model and deployment hardening](./wiki/Security.md)
- [Repository security policy and vulnerability reporting](../SECURITY.md)
- [Persistent data, backup, update, and reverse-proxy guidance](./wiki/Deployment.md)

## Develop and integrate

- [Development workflow](./wiki/Development.md)
- [Contributing](../CONTRIBUTING.md)
- [Application layout](../app/README.md)
- [Internal and managed API boundaries](./API.md)
- [Brand assets](./brand/README.md)

The self-hosted Express `/api` routes are the internal boundary used by the bundled dashboard. They are not the managed, versioned Automation REST API and should not be treated as a stable external SDK.

# OrbitPage documentation

This documentation covers the open-source, self-hosted OrbitPage application. For the managed service, plans, billing, and hosted automation API, use [orbitpage.com](https://orbitpage.com).

## Start or install OrbitPage

| Goal | Guide |
| --- | --- |
| Evaluate OrbitPage from source | [Getting started](./wiki/Getting-started.md) |
| Install on Linux, Proxmox, Docker, or a cloud host | [Deployment](./wiki/Deployment.md) |
| Configure runtime and build variables | [Configuration](./wiki/Configuration.md) |
| Solve startup, proxy, login, or indexing problems | [Troubleshooting](./wiki/Troubleshooting.md) |
| Use the legacy wiki entry point | [Wiki home](./wiki/Home.md) |

## Use the dashboard

| Goal | Guide |
| --- | --- |
| Navigate the dashboard, roles, and save boundaries | [Dashboard guide](./user-guide/dashboard.md) |
| Build Home blocks, menus, subpages, themes, and backgrounds | [Content and design](./user-guide/content-and-design.md) |
| Export or restore data, clean media, and understand demo mode | [Backups, media, and demo mode](./user-guide/backups-and-demo-mode.md) |
| Configure the self-hosted AI assistant and review changes safely | [AI assistant](./user-guide/ai-assistant.md) |
| Understand built-in analytics, GA4, and consent | [Analytics and privacy](./user-guide/analytics-and-privacy.md) |
| Configure metadata, sitemap, robots, and discovery files | [SEO and indexing](./wiki/SEO-and-indexing.md) |

## Operate securely

- [Security model and deployment hardening](./wiki/Security.md)
- [Repository security policy and vulnerability reporting](../SECURITY.md)
- [Verified backup, restore, update, rollback, removal, and reverse-proxy runbooks](./wiki/Deployment.md)

## Develop and integrate

- [Development workflow](./wiki/Development.md)
- [Contributing](../CONTRIBUTING.md)
- [Application layout](../app/README.md)
- [Self-hosted application API boundary](./API.md)
- [Repository scripts and installer checks](../scripts/README.md)
- [Brand assets](./brand/README.md)

The self-hosted Express `/api` routes are the internal boundary used by the bundled dashboard. They are not the managed, versioned Automation REST API and should not be treated as a stable external SDK.

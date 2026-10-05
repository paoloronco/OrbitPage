# OrbitPage documentation

This documentation covers the open-source, self-hosted OrbitPage application. For the managed service, plans, billing, and hosted automation API, use [orbitpage.com](https://orbitpage.com).

## Product and engineering contracts

| Question | Document |
| --- | --- |
| What problem does OSS solve and what behavior is required? | [Product requirements](./product-requirements.md) |
| Which visual rules and components are shared? | [Design system](./design-system.md) |
| How do the app, API and durable data fit together? | [Architecture](./architecture.md) |
| How should repository agents work? | [Root agent instructions](../../AGENTS.md) |

## Start or install OrbitPage

| Goal | Guide |
| --- | --- |
| Evaluate OrbitPage from source | [Getting started](./Getting-started.md) |
| Install on Linux, Proxmox, Docker, or a cloud host | [Deployment](./Deployment.md) |
| Move from the former Docker Hub namespace | [Docker Hub migration](./Docker-Hub-migration.md) |
| Configure runtime and build variables | [Configuration](./Configuration.md) |
| Solve startup, proxy, login, or indexing problems | [Troubleshooting](./Troubleshooting.md) |

## Use the dashboard

| Goal | Guide |
| --- | --- |
| Manage users, passwords, authenticators and personal tokens | [Account and team](./account-and-team.md) |
| Publish, share and print QR codes | [Publishing and QR](./publishing.md) |
| Navigate the dashboard, roles, and save boundaries | [Dashboard guide](./dashboard.md) |
| Build Home blocks, menus, subpages, themes, and backgrounds | [Content and design](./content-and-design.md) |
| Export or restore data, clean media, and understand demo mode | [Backups, media, and demo mode](./backups-and-demo-mode.md) |
| Configure the self-hosted AI assistant and review changes safely | [AI assistant](./ai-assistant.md) |
| Configure SMTP and send newsletters from your own server | [Newsletters](./newsletters.md) |
| Understand built-in analytics, GA4, and consent | [Analytics and privacy](./analytics-and-privacy.md) |
| Configure metadata, sitemap, robots, and discovery files | [SEO and indexing](./SEO-and-indexing.md) |

## Operate securely

- [Security model and deployment hardening](./Security.md)
- [Repository security policy and vulnerability reporting](../../SECURITY.md)
- [Verified backup, restore, update, rollback, removal, and reverse-proxy runbooks](./Deployment.md)

## Develop and integrate

- [Development workflow](./Development.md)
- [Contributing](../../CONTRIBUTING.md)
- [Application layout](../../app/README.md)
- [Self-hosted application API boundary](./api.md)
- [Repository scripts and installer checks](../../scripts/README.md)
- [Brand assets](./design-system.md#brand)

Personal API tokens use the self-hosted application API described above. It ships with the dashboard and server; it has no separate API-version compatibility contract. The managed Automation API is documented on orbitpage.com.

See [GitHub automation](../../.github/README.md) for quality checks, release publication, advisory policy and mirror ownership.

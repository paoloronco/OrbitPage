# OrbitPage Documentation

Welcome to the official documentation for **OrbitPage**.

Use this page as the main entry point for installing, configuring, using, maintaining, and developing the self-hosted edition of OrbitPage.

> Looking for the managed service? Visit [orbitpage.com](https://orbitpage.com).

---

## Documentation

### Install OrbitPage

| Task | Guide |
| --- | --- |
| Install OrbitPage | [Deployment](./wiki/administration/Deployment.md) |
| Install with Docker Run | [Docker Run](./wiki/administration/Deployment.md#docker-run-recommended) |
| Install with GHCR Docker Run | [GHCR](./wiki/administration/Deployment.md#ghcr) |
| Install with Docker Compose | [Docker Compose](./wiki/administration/Deployment.md#docker-compose) |
| Install with the Linux installer | [Linux installer](./wiki/administration/Deployment.md#linux-installer) |
| Install on Proxmox VE | [Proxmox VE](./wiki/administration/Deployment.md#proxmox-ve) |
| Set up a reverse proxy and HTTPS | [Reverse proxy and HTTPS](./wiki/administration/Deployment.md#reverse-proxy-and-https) |

### Update OrbitPage

| Task | Guide |
| --- | --- |
| Update guide | [Updating OrbitPage](./wiki/administration/Deployment.md#updating-orbitpage) |
| Web updates | [Web updates](./wiki/administration/Deployment.md#web-updates) |
| Update OrbitPage on Linux and Proxmox | [Linux and Proxmox](./wiki/administration/Deployment.md#linux-and-proxmox) |
| Update OrbitPage with Docker Compose | [Docker Compose updates](./wiki/administration/Deployment.md#docker-compose-updates) |
| Update OrbitPage with Docker Run or GHCR | [Docker Run updates](./wiki/administration/Deployment.md#docker-run-updates) |
| Verify the update | [Verification](./wiki/administration/Deployment.md#verify-the-update) |

---

If you encounter issues, see [Troubleshooting](./wiki/administration/Troubleshooting.md).

### Using OrbitPage

The [Dashboard guides](./wiki/dashboard/README.md) cover everyday administration and content management.

- [Dashboard](./wiki/dashboard/README.md) — main sections, URLs, save controls, and navigation.
- [Content and design](./wiki/dashboard/sections/content-and-design.md) — profiles, blocks, menus, pages, themes, and media.
- [Publishing and QR](./wiki/dashboard/sections/publishing.md) — publish pages and share them with QR codes.
- [SEO and indexing](./wiki/SEO-and-indexing.md) — metadata, discovery files, and search-engine visibility.
- [Analytics and privacy](./wiki/dashboard/sections/analytics-and-privacy.md) — analytics, privacy settings, and consent.
- [Newsletters](./wiki/dashboard/sections/newsletters.md) — SMTP setup and campaigns.
- [AI assistant](./wiki/ai-assistant.md) — AI configuration and suggested edits.
- [Account and team](./wiki/dashboard/sections/account-and-team.md) — users, passwords, TOTP, roles, teams, and API tokens.
- [Backups and demo mode](./wiki/dashboard/sections/backups-and-demo-mode.md) — exports, version history, restore options, and demo data.

### Administration

The [Administration guides](./wiki/administration/README.md) cover deployment, configuration, maintenance, and security.

- [Maintenance](./wiki/administration/maintenance.md) — updates, backups, restore, rollback, and uninstall procedures.
- [Administrator recovery](./wiki/administration/recovery.md) — recover access to the administrator account.
- [Security](./wiki/administration/Security.md) — deployment protections and security recommendations.
- [Security policy](../SECURITY.md) — supported versions and vulnerability reporting.

### Development and architecture

The [Development guides](./wiki/development/README.md) cover the application, architecture, code, and API.

- [Application](./wiki/development/application.md) — repository structure, application files, data, builds, and runtime details.
- [Architecture](./wiki/development/architecture.md) — main runtime flows and self-hosted/managed-service boundaries.
- [Development](./wiki/development/Development.md) — local development, testing, and contribution workflow.
- [Design system](./wiki/development/design-system.md) — UI components, styles, accessibility, and brand rules.
- [REST API](./wiki/development/api.md) — API authentication and automation.
- [GitHub automation](./wiki/development/github-automation.md) — CI, releases, publishing, and mirror automation.
- [Product requirements](./wiki/development/product-requirements.md) — expected open-source product behavior.
- [Scripts](../scripts/README.md) — installer, update, and repository-maintenance scripts.
- [Contributing](../CONTRIBUTING.md) — contribution guidelines.
- [AGENTS.md](../AGENTS.md) — repository instructions for coding agents.

---

## Common paths

### New installation

1. Read [Deployment](./wiki/administration/Deployment.md).
2. Complete the installation for your preferred platform.
3. Review [Configuration](./wiki/administration/Configuration.md).
4. Open the dashboard and continue with [Dashboard](./wiki/dashboard/README.md).

### Existing installation

For routine administration, start with:

- [Maintenance](./wiki/administration/maintenance.md)
- [Troubleshooting](./wiki/administration/Troubleshooting.md)
- [Backups and demo mode](./wiki/dashboard/sections/backups-and-demo-mode.md)
- [Security](./wiki/administration/Security.md)

### Contributor

If you want to work on OrbitPage itself:

1. Read [Development](./wiki/development/Development.md).
2. Review [Application](./wiki/development/application.md) and [Architecture](./wiki/development/architecture.md).
3. Follow [Contributing](../CONTRIBUTING.md).
4. Check the relevant design, API, or automation documentation before making changes.

---

## Additional resources

- [Main project README](../README.md) — product overview and quick start.
- [Complete documentation index](./wiki/README.md) — compact task-oriented index of all guides.
- [Screenshots](./screenshots/README.md) — screenshot sources used by the project.
- [Brand assets](./brand/) — documentation and project brand resources.
- [OrbitPage website](https://orbitpage.com) — managed service and product website.

---

## Need help?

If something is not working as expected, check [Troubleshooting](./wiki/administration/Troubleshooting.md) first.

For bugs, feature requests, or documentation improvements, use the repository's GitHub issues.

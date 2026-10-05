# OrbitPage - Open-source, self-hosted link-in-bio and public page builder

<p align="center">
  <img src="./app/public/brand/orbitpage-lockup.svg" alt="OrbitPage open-source self-hosted public page builder" width="420" />
</p>

<p align="center">
  Create a link-in-bio, digital business card, portfolio, venue page, or small-business microsite - and self-host it with Docker.
</p>

<p align="center">
  <a href="https://github.com/paoloronco/OrbitPage/actions/workflows/quality-checks.yml"><img src="https://github.com/paoloronco/OrbitPage/actions/workflows/quality-checks.yml/badge.svg?branch=main" alt="OrbitPage continuous integration status" /></a>
  <a href="https://github.com/paoloronco/OrbitPage/releases"><img src="https://img.shields.io/github/v/release/paoloronco/OrbitPage?label=version&amp;color=2563EB" alt="Latest OrbitPage version" /></a>
  <a href="./LICENSE.txt"><img src="https://img.shields.io/badge/license-MIT-111827" alt="MIT License" /></a>
  <a href="https://hub.docker.com/r/paoloronco/orbitpage"><img src="https://img.shields.io/docker/pulls/paoloronco/orbitpage?logo=docker&amp;label=Docker%20pulls" alt="OrbitPage Docker Hub pulls" /></a>
  <a href="https://github.com/paoloronco/OrbitPage/pkgs/container/orbitpage"><img src="https://img.shields.io/badge/GHCR-orbitpage-181717?logo=github&logoColor=white" alt="GitHub Container Registry" /></a>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#what-you-can-build">Features</a> ·
  <a href="./docs/README.md">Documentation</a> ·
  <a href="./CONTRIBUTING.md">Contributing</a> ·
  <a href="./SECURITY.md">Security</a>
</p>

OrbitPage is a free, MIT-licensed Linktree alternative for building link-in-bio pages, digital business cards, portfolios, creator profiles, venue menus, event pages, and small-business websites. It combines a visual editing dashboard with responsive public rendering, built-in SEO and analytics, an Express backend, SQLite, and local file storage. No external database is required.

This repository is the self-hosted edition. The optional managed service is available at [orbitpage.com](https://orbitpage.com), but its control plane, billing, managed storage, and hosted-only features are not part of this repository.

<p align="center">
  <img src="./docs/screenshots/orbitpage-product-loop.gif" alt="Illustrated OrbitPage product walkthrough" width="800" />
</p>

> **Docker Hub namespace migration:** the official image is now `paoloronco/orbitpage`. The former `paueron/orbitpage` path is a temporary compatibility feed and stops receiving updates on **October 9, 2026**. Existing volumes and data are unaffected; follow the [migration guide](./docs/wiki/Docker-Hub-migration.md).

## Why OrbitPage

- **Own the stack and the data.** Run one Docker container with SQLite and local storage, on your server or homelab.
- **Edit visually.** Manage content, design, menus, subpages, privacy, analytics, and publishing from the responsive dashboard.
- **Publish more than a list of links.** Combine profiles, media, contact details, events, maps, menus, calls to action, and focused subpages.
- **Ship a discoverable public page.** Configure canonical URLs, Open Graph and Twitter cards, Schema.org data, sitemaps, robots directives, QR codes, and consent-aware analytics.

## Contents

- [Why OrbitPage](#why-orbitpage)
- [Quick start](#quick-start)
- [Updates](#updates)
- [What you can build](#what-you-can-build)
- [Dashboard workspaces](#dashboard-workspaces)
- [First run](#first-run)
- [Configuration](#configuration)
- [Data and backups](#data-and-backups)
- [Production checklist](#production-checklist)
- [Documentation](#documentation)
- [Security and contributing](#security-and-contributing)

## Quick start

### Docker image (recommended)

OrbitPage publishes one multi-architecture Linux image for amd64 and arm64 on Docker Hub and GitHub Container Registry. Docker automatically selects the matching image for the host. The commands below use Docker Hub:

~~~bash
sudo install -d -m 0750 /var/lib/orbitpage

sudo docker pull paoloronco/orbitpage:latest
sudo docker run -d --name orbitpage \
  --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  -v /var/lib/orbitpage:/app/data \
  --security-opt no-new-privileges:true \
  paoloronco/orbitpage:latest

git clone https://github.com/paoloronco/OrbitPage.git
cd OrbitPage
sudo ./scripts/install-updater.sh
~~~

Open the public page at <http://localhost:8080>, the dashboard at <http://localhost:8080/dashboard/profile>, and the health check at <http://localhost:8080/health>. Read the first-run token with <code>sudo cat /var/lib/orbitpage/.setup-token</code> and enter it in the setup wizard. Place a trusted HTTPS reverse proxy in front before remote access. The last command installs the host updater; run <code>sudo orbitpage-update</code> for later updates. Python 3 is required on the host for manual Docker and Compose installations.

### Automatic JWT secret

Docker users do not need to configure <code>JWT_SECRET</code>. On first start, the image generates a private 256-bit value in <code>/app/data/.jwt-secret</code> with mode <code>0600</code> and reuses it across restarts and updates. Persist and back up <code>/app/data</code>: losing or changing the secret invalidates active sessions and can make encrypted TOTP and saved provider credentials unreadable. An explicit <code>JWT_SECRET</code> override is still supported, but it must contain at least 32 random characters and remain stable and private.

The same multi-architecture image is available as <code>ghcr.io/paoloronco/orbitpage:latest</code>. Registries contain only <code>latest</code> and complete release tags such as <code>4.21.29</code>; <code>latest</code> follows the newest stable release but remains mutable. For release integrity and deterministic rollback, review and pin an image digest. The <code>unless-stopped</code> policy restarts OrbitPage after failures and host reboots while respecting an explicit stop; use <code>always</code> only when an explicit stop must not survive a Docker daemon restart.

See the complete [Docker deployment procedure](./docs/wiki/Deployment.md#docker-image-recommended) for image selection, Compose, verification, updates, backups, and rollback.

### Docker Compose (local evaluation)

Clone the repository and start the local evaluation service:

~~~bash
git clone https://github.com/paoloronco/OrbitPage.git
cd OrbitPage
docker compose up -d
sudo ./scripts/install-updater.sh
~~~

The tracked Compose file binds only to <code>127.0.0.1:8080</code> and persists the database, uploads, and generated JWT secret in <code>./orbitpage-data</code>. For production, use the [Docker deployment procedure](./docs/wiki/Deployment.md#docker-image-recommended).

### Linux install

On a clean x86-64 Debian 12/13 or Ubuntu 22.04/24.04 server, VM, or LXC:

~~~bash
git clone https://github.com/paoloronco/OrbitPage.git
cd OrbitPage
sudo ./install.sh
~~~

The installer automates the same Docker deployment, generates a private JWT secret, persists application data, starts OrbitPage, and installs the <code>orbitpage</code> and <code>orbitpage-update</code> management commands.

For a Proxmox VE 8+ host, use the dedicated host-to-LXC installer instead:

~~~bash
git clone https://github.com/paoloronco/OrbitPage.git
cd OrbitPage
sudo ./install-pve.sh
~~~

Do not run the Linux guest installer directly on a Proxmox host. See [Deployment](./docs/wiki/Deployment.md) for supported options, static networking, image pinning, backups, updates, and removal.

### Run from source

Requirements:

- Node.js <code>^20.19.0</code> or <code>>=22.12.0</code>
- npm
- Git
- Python 3 (for <code>orbitpage-update</code> on a source checkout)

~~~bash
git clone https://github.com/paoloronco/OrbitPage.git
cd OrbitPage
sudo ./scripts/install-updater.sh source "$PWD"
cd app
npm ci
npm run install:server
export JWT_SECRET="$(openssl rand -hex 32)"
export DATA_DIR="$PWD/.orbitpage-data"
npm run start
~~~

The production-style source run is available at <http://localhost:3001>. Read <code>$DATA_DIR/.setup-token</code> on the host for first setup. Source mode makes SQLite storage owner-only on POSIX hosts; keep <code>DATA_DIR</code> on a private volume.
Run <code>sudo orbitpage-update</code> from any directory to pull a fast-forward release, reinstall dependencies, and rebuild. Restart a foreground <code>npm run start</code> process afterward; an active <code>orbitpage</code> systemd service is restarted automatically.

## Updates

The Linux and Proxmox installers install <code>orbitpage-update</code> automatically. For an existing manual Docker Run or Docker Compose installation on Linux, install the host command once, then update:

~~~bash
sudo ./scripts/install-updater.sh
sudo orbitpage-update
sudo docker exec orbitpage node -p "require('./package.json').version"
~~~

The version check applies to a container named <code>orbitpage</code>; use your own container name if different. The updater discovers existing official Docker containers and Compose projects, preserves their configuration and data mount, pulls the current <code>:latest</code> image, recreates the service, and checks its image ID and health. For an existing source checkout, run <code>sudo ./scripts/install-updater.sh source "$PWD"</code> from its root once; the updater then updates that registered directory. Restart a foreground source process afterward. A Compose file pinned to a numbered image tag must be changed and redeployed manually; the updater leaves it in place. See [update procedures](./docs/wiki/Deployment.md#update-safely) for unsupported container layouts and recovery steps.

## What you can build

### Public pages and content

- A main public page plus focused subpages with independent slugs, titles, descriptions, and blocks.
- Link, internal OrbitPage navigation, text, heading, separator, image, native video, social, contact, map, event, callout, and consent-aware embed blocks, with presets for media, scheduling, and forms.
- Venue menus with locale, sections, one-level subsections, products, variants, images, prices, and availability.
- Per-block visibility, ordering, scheduling, icons, cover media, calls to action, and layout controls.
- Responsive public rendering for mobile, laptop, and desktop layouts.

### Identity and design

- Creator, company, and studio profile structures.
- Profile image or logo, shape and size, favicon, social profiles, browser title, SEO description, and footer.
- Ready-made themes plus colors, typography, spacing, surfaces, borders, radius, shadow, blur, and per-card overrides.
- Live preview using the same public renderer.
- Dashboard localization in 14 languages with Arabic RTL layout.

### Publishing and discovery

- A unified Publish workspace for QR codes, sitemap state, and discovery files.
- Screen and print QR presets with PNG and SVG downloads.
- Stable smart campaign QR links whose destination can change by local time, including lunch/dinner menu-section presets.
- Canonical URL, Open Graph, Twitter Card, Schema.org, and <code>noindex</code> controls.
- Generated <code>sitemap.xml</code>.
- Editable <code>robots.txt</code>, <code>llms.txt</code>, <code>humans.txt</code>, <code>ai.txt</code>, <code>security.txt</code>, and safe custom text endpoints.

### Operations, privacy, and security

- Built-in self-hosted 7/30-day visit and content analytics, plus optional GA4 integration on the public page.
- Self-hosted newsletters with your own SMTP server, confirmed subscriptions, scheduled campaigns, and delivery reports ([guide](./docs/wiki/newsletters.md)).
- Consent controls, policy links, Google Consent Mode, and optional external CMP integration.
- Complete or selective JSON backup and restore, with optional portable image ZIP for OSS/SaaS transfers.
- Upload quotas, validated image and video uploads, and unused-media cleanup.
- Multiple dashboard users, scoped permissions, password management, and TOTP two-factor authentication.
- Health checks, persistent local data, Docker support, and additive SQLite migrations.

## Dashboard workspaces

The current dashboard keeps related work together:

| Workspace | Purpose |
| --- | --- |
| **Page** | Identity, profile image, role, browser presence, and profile-card settings |
| **Content** | Home blocks, venue menu, and public subpages |
| **AI Assistant** | Propose profile, content, and theme changes for explicit review and confirmation |
| **Theme** | Page-wide visual system and responsive live preview |
| **Publish** | QR downloads, sitemap, robots, and discovery text files |
| **Backup** | Portable exports, selective restore, and unused-media tools |
| **Analytics** | Built-in performance and optional GA4 settings |
| **Privacy** | Consent behavior, legal policies, and external CMP settings |
| **Newsletter** | Your SMTP server, subscribers, campaigns, scheduling, and delivery reports |
| **Team** | Additional users and permissions |
| **Account** | Password and two-factor authentication |

The visual editor changes URL with the active section: <code>/dashboard/editor/page</code>, <code>/dashboard/editor/content</code>, <code>/dashboard/editor/menu/content</code>, <code>/dashboard/editor/shop/products</code>, and <code>/dashboard/editor/pages</code>. Classic dashboard routes include <code>/dashboard/profile</code>, <code>/dashboard/content/link</code>, <code>/dashboard/content/menu</code>, <code>/dashboard/content/shop</code>, and <code>/dashboard/content/pages</code>. Dashboard URLs include the interface language, for example <code>/it-IT/dashboard/account/general</code>. Public pages use the installation root; menus, legal pages, newsletters, and subpages have no language prefix. Older localized and page-slug public URLs remain redirect aliases.

Read the [dashboard guide](./docs/wiki/dashboard.md) for the complete route map and editing workflow.

## First run

1. Open the public URL. A fresh instance shows **Under construction** and is excluded from indexing and analytics.
2. Open <code>/dashboard/profile</code>.
3. Review the runtime, SQLite, storage, frontend, and session checks.
4. Create the password for the fixed first username, <code>admin</code>.
5. Confirm the public URL, complete setup, and follow the dashboard guide.

The administrator and starter profile are created atomically. The canonical public URL is the installation root. Language prefixes apply to the dashboard; older localized and page-slug public URLs redirect to the unprefixed destination after an upgrade.

## Configuration

The essential production settings are:

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| <code>JWT_SECRET</code> | No in Docker; production source runs only | Generated and persisted in Docker | Optional explicit override for the session and encryption secret |
| <code>DATA_DIR</code> | Recommended | Server directory; <code>/app/data</code> in Docker | Stores SQLite and uploads |
| <code>PORT</code> | No | <code>3001</code>; <code>8080</code> in Docker | HTTP listener |
| <code>PUBLIC_SITE_URL</code> | Recommended; set for newsletters | Request origin | Public HTTPS URL for sharing, QR, sitemap, confirmation, unsubscribe, and tracking links |
| <code>NEWSLETTER_SECRET_KEY</code> | No | <code>JWT_SECRET</code> | Separate stable secret of at least 32 characters for SMTP encryption and email links |
| <code>PUBLIC_SITE_NAME</code> | No | <code>OrbitPage</code> | Site name in generated metadata |
| <code>SEO_INDEXING</code> | No | <code>true</code> | Set to <code>false</code> for staging or private deployments |
| <code>UPLOAD_STORAGE_QUOTA_MB</code> | No | <code>1024</code> | Total upload quota |
| <code>VIDEO_UPLOAD_LIMIT_MB</code> | No | <code>100</code> | Per-file video limit |

Set <code>PUBLIC_SITE_URL</code> to the externally reachable HTTPS origin in the protected environment file before starting a production container, especially when using newsletters. If you change a container's environment file later, recreate the container or Compose service; <code>docker restart</code> does not reload those values.

Configure your own SMTP host, port, credentials, and sender in **Dashboard > Newsletter**, then send a test message before a campaign. Copy the public signup link from that workspace; subscribers must confirm their address. Campaigns can be sent immediately or scheduled. Newsletter settings, subscribers, and delivery history live in <code>DATA_DIR/orbitpage.db</code>. The dashboard's selective JSON export excludes newsletter records and SMTP credentials, so include the SQLite database in infrastructure backups. See the [newsletter guide](./docs/wiki/newsletters.md) and the complete [Configuration reference](./docs/wiki/Configuration.md) for AI providers, cleanup, rate limiting, HTTPS, base paths, CORS, reset recovery, and other settings.

## Data and backups

Everything that must survive a restart belongs under <code>DATA_DIR</code>:

~~~text
orbitpage.db
uploads/
.jwt-secret (Docker-generated installations)
~~~

Persist and back up all of <code>/app/data</code> before upgrades or restores. Never commit a database, database backup or sidecar, uploads, generated secret, logs, environment file, or real user content.

The dashboard creates complete or selective JSON exports by default. When images are available, **Include images (ZIP)** creates an archive that can be restored by OrbitPage OSS or SaaS. These exports do not replace a consistent infrastructure backup. Follow the [verified backup and restore runbook](./docs/wiki/Deployment.md#create-and-verify-an-infrastructure-backup), copy recovery archives off-host, and test a restore periodically.

## Production checklist

1. Persist <code>DATA_DIR</code> so the Docker-generated <code>.jwt-secret</code> survives updates; if overriding <code>JWT_SECRET</code>, keep that value stable and private.
2. Put OrbitPage behind trusted HTTPS.
3. Set <code>PUBLIC_SITE_URL</code> to the final public origin.
4. Enable TOTP for privileged users under **Dashboard > Account**.
5. Create a verified off-host backup and complete a restore drill before relying on it.
6. Verify <code>/health</code> and the public, dashboard, login, edit, and upload paths after deployment.
7. Set <code>SEO_INDEXING=false</code> on staging and private instances.

Read [Deployment](./docs/wiki/Deployment.md) before configuring a reverse proxy, base path, cloud platform, update, or rollback.

## Documentation

Explore the [user guides](./docs/wiki/README.md) for installation, editing, publishing, backups and troubleshooting.

| Task | Guide |
| --- | --- |
| Install or evaluate | [Getting started](./docs/wiki/Getting-started.md) |
| Deploy, update, or use Proxmox | [Deployment](./docs/wiki/Deployment.md) |
| Configure environment variables | [Configuration](./docs/wiki/Configuration.md) |
| Navigate the editor | [Dashboard guide](./docs/wiki/dashboard.md) |
| Manage users, passwords and two-factor authentication | [Account and team](./docs/wiki/account-and-team.md) |
| Share or print a QR code | [Publishing and QR](./docs/wiki/publishing.md) |
| Build content, menus, subpages, and themes | [Content and design](./docs/wiki/content-and-design.md) |
| Export, restore, clean media, or evaluate demo mode | [Backups, media, and demo mode](./docs/wiki/backups-and-demo-mode.md) |
| Configure AI safely | [AI assistant](./docs/wiki/ai-assistant.md) |
| Configure analytics and consent | [Analytics and privacy](./docs/wiki/analytics-and-privacy.md) |
| Configure SMTP and send newsletters | [Newsletters](./docs/wiki/newsletters.md) |
| Configure search and discovery | [SEO and indexing](./docs/wiki/SEO-and-indexing.md) |
| Troubleshoot | [Troubleshooting](./docs/wiki/Troubleshooting.md) |

## Security and contributing

Report suspected vulnerabilities privately through a [GitHub Security Advisory](https://github.com/paoloronco/OrbitPage/security/advisories/new) or the contact in [SECURITY.md](./SECURITY.md). Do not open a public issue for an unpatched vulnerability.

Issues and focused pull requests are welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, checks, compatibility expectations, and the contribution workflow. Participation follows the [Code of Conduct](./CODE_OF_CONDUCT.md).

OrbitPage's open-source edition is available under the [MIT License](./LICENSE.txt).

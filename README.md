# OrbitPage - Open-source, self-hosted public page builder

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/paoloronco/OrbitPage/main/docs/brand/orbitpage-lockup-on-dark.svg" />
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/paoloronco/OrbitPage/main/app/public/brand/orbitpage-lockup.svg" />
    <img src="./app/public/brand/orbitpage-lockup.svg" alt="OrbitPage open-source self-hosted public page builder" width="420" />
  </picture>
</p>

<p align="center">
  <strong>Build your corner of the web. Make it unmistakably yours.</strong><br />
  Design visually. Publish on your domain. Keep control of your data.
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

**OrbitPage is an open-source visual page builder for creators, professionals, venues, and small businesses.** Create a portfolio, introduce your services, share a venue menu, or give an event its own home on the web. Combine images, video, links, contact details, maps, and calls to action; shape the layout, colors, and typography with a live preview.

Your page adapts to phones and desktops, with SEO, QR codes, analytics, and newsletters built in. The self-hosted edition is free, MIT-licensed, and runs in one Docker container, keeping your content and data on your own server.

Prefer managed hosting? Explore [orbitpage.com](https://orbitpage.com). This repository contains the self-hosted application.

<p align="center">
  <img src="./docs/screenshots/orbitpage-product-loop.gif" alt="OrbitPage dashboard walkthrough: profile, content blocks, themes and the public page" width="800" />
</p>

> **Docker Hub namespace migration:** the official image is now `paoloronco/orbitpage`. The former `paueron/orbitpage` path is a temporary compatibility feed and stops receiving updates on **October 9, 2026**. Existing volumes and data are unaffected; follow the [migration guide](./docs/wiki/Docker-Hub-migration.md).

## Why OrbitPage

- **Own the stack and the data.** Run one Docker container with SQLite and local storage, on your server or homelab.
- **Edit visually.** Manage content, design, menus, subpages, privacy, analytics, and publishing from the responsive dashboard.
- **Build your public page.** Combine profiles, media, contact details, events, maps, menus, calls to action, and focused subpages.
- **Ship a discoverable public page.** Configure canonical URLs, Open Graph and Twitter cards, Schema.org data, sitemaps, robots directives, QR codes, and consent-aware analytics.

## Contents

- [Why OrbitPage](#why-orbitpage)
- [Quick start](#quick-start)
- [Updates](#updates)
- [Optional host updater](#optional-host-updater)
- [What you can build](#what-you-can-build)
- [Dashboard workspaces](#dashboard-workspaces)
- [How it runs](#how-it-runs)
- [First run](#first-run)
- [Configuration](#configuration)
- [Data and backups](#data-and-backups)
- [Production checklist](#production-checklist)
- [Development](#development)
- [Documentation](#documentation)
- [Security and contributing](#security-and-contributing)

## Quick start

### Docker image (recommended)

With Docker installed, pull the image and start OrbitPage:

~~~bash
docker pull paoloronco/orbitpage
docker run -d --name orbitpage --restart unless-stopped -p 127.0.0.1:8080:8080 -v orbitpage-data:/app/data --security-opt no-new-privileges:true paoloronco/orbitpage
~~~

Docker automatically creates the persistent <code>orbitpage-data</code> volume. OrbitPage initializes the database, uploads, and private secret there; no host directory, environment file, or repository checkout is needed. The image works on amd64 and arm64. Use <code>sudo docker</code> on Linux if your account requires it.

Open the public page at <http://localhost:8080> or the dashboard at <http://localhost:8080/dashboard/profile>. Read the first-run token with <code>docker exec orbitpage cat /app/data/.setup-token</code> and enter it in the setup wizard. Place a trusted HTTPS reverse proxy in front before remote access.

Docker requires the restart policy, host port, data mount, and security option at container creation; an image cannot supply them. For a **startup without flags**, use [Docker Compose](#docker-compose-automatic-defaults) below. To customize Docker Run, change the host port to <code>127.0.0.1:8090:8080</code>, or replace <code>orbitpage-data</code> with your existing volume or an absolute host directory. Existing installations must keep their current data mount.

### Automatic JWT secret

Docker users do not need to configure <code>JWT_SECRET</code>. On first start, the image generates a private 256-bit value in <code>/app/data/.jwt-secret</code> with mode <code>0600</code> and reuses it across restarts and updates. Persist and back up <code>/app/data</code>: losing or changing the secret invalidates active sessions and can make encrypted TOTP and saved provider credentials unreadable. An explicit <code>JWT_SECRET</code> override is still supported, but it must contain at least 32 random characters and remain stable and private.

The same multi-architecture image is available as <code>ghcr.io/paoloronco/orbitpage:latest</code>. Registries contain only <code>latest</code> and complete release tags such as <code>4.21.29</code>; <code>latest</code> follows the newest stable release but remains mutable. For release integrity and deterministic rollback, review and pin an image digest. The <code>unless-stopped</code> policy restarts OrbitPage after failures and host reboots while respecting an explicit stop; use <code>always</code> only when an explicit stop must not survive a Docker daemon restart.

See the complete [Docker deployment procedure](./docs/wiki/Deployment.md#docker-image-recommended) for image selection, Compose, verification, updates, backups, and rollback.

### Docker Compose (automatic defaults)

For an automatic setup without Docker Run flags, use the included Compose file:

~~~bash
git clone https://github.com/paoloronco/OrbitPage.git
cd OrbitPage
docker compose up -d
~~~

This command pulls the image, starts OrbitPage on <code>localhost:8080</code>, creates <code>./orbitpage-data</code> automatically, and sets <code>restart: unless-stopped</code>. Read the setup token with <code>docker compose exec orbitpage cat /app/data/.setup-token</code>. Later, run <code>docker compose pull</code> followed by <code>docker compose up -d</code> to update while keeping the data. Keep this checkout and its data directory together; <code>docker compose down</code> stops and removes the container but leaves that directory in place.

Edit the port mapping or data mount in <code>docker-compose.yml</code> only if you need different settings. For production hardening, backups, and reverse proxies, use the [Docker deployment procedure](./docs/wiki/Deployment.md#docker-image-recommended).

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

~~~bash
git clone https://github.com/paoloronco/OrbitPage.git
cd OrbitPage
cd app
npm ci
npm run install:server
export JWT_SECRET="$(openssl rand -hex 32)"
export DATA_DIR="$PWD/.orbitpage-data"
npm run start
~~~

The production-style source run is available at <http://localhost:3001>. Read <code>$DATA_DIR/.setup-token</code> on the host for first setup. Source mode makes SQLite storage owner-only on POSIX hosts; keep <code>DATA_DIR</code> on a private volume.

## Updates

### Docker Run

Update with Docker directly; no updater or repository checkout is needed. Back up the persistent data before updating. The example below matches the [Docker quick start](#docker-image-recommended); if you customized the installation, reuse its original ports, mounts, environment variables, and other options when recreating the container.

~~~bash
docker pull paoloronco/orbitpage
docker stop orbitpage
docker rm orbitpage
docker run -d --name orbitpage --restart unless-stopped -p 127.0.0.1:8080:8080 -v orbitpage-data:/app/data --security-opt no-new-privileges:true paoloronco/orbitpage
curl -fsS http://localhost:8080/health
~~~

The same <code>orbitpage-data</code> volume keeps the database, uploads, and secret across container replacement. Keep your existing volume or host directory if it has a different name; do not remove it during the update. Wait for the new container to start before checking health. A plain <code>docker restart</code> does not load a newly pulled image.

### Docker Compose

From the directory containing your Compose file, after backing up the data:

~~~bash
docker compose pull
docker compose up -d
~~~

Compose recreates the service while retaining its configured data mount and settings. A pinned image tag or digest must be changed explicitly when you choose a new release.

### Source checkout

Stop a foreground OrbitPage process, then run these commands from the existing <code>app/</code> directory:

~~~bash
git pull --ff-only
npm ci
npm run install:server
npm run start
~~~

Keep the same <code>DATA_DIR</code> and <code>JWT_SECRET</code>. For a systemd-managed source installation, rebuild with <code>npm run build</code> and restart the owning service instead of starting another foreground process. See [update procedures](./docs/wiki/Deployment.md#update-safely) for backups, health checks, and rollback.

## Optional host updater

The Docker commands above are sufficient for normal updates. On Linux, <code>orbitpage-update</code> is an optional convenience: it preserves container settings, creates a protected pre-update data archive, and checks the replacement image and health. It requires Python 3. The Linux and Proxmox installers already install it automatically.

For a manual Docker installation, install it once from a trusted repository checkout if you want these additional checks:

~~~bash
git clone https://github.com/paoloronco/OrbitPage.git
cd OrbitPage
sudo ./scripts/install-updater.sh
sudo orbitpage-update
~~~

The helper discovers official Docker Run containers and Compose projects. For a source checkout, register its root once with <code>sudo ./scripts/install-updater.sh source "$PWD"</code>. Source updates restart an active <code>orbitpage</code> systemd service; restart a foreground process yourself. Pinned Compose releases stay under your control. See [update procedures](./docs/wiki/Deployment.md#update-safely) for supported layouts, and [web updates](./docs/wiki/Deployment.md#web-updates) if you want to enable installation from the dashboard.

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

## How it runs

~~~text
Browser
  ├─ public OrbitPage
  └─ /dashboard/* React workspace
           │
           ▼
      Express application
       ├─ internal dashboard API
       ├─ SQLite database
       └─ local uploads
~~~

Repository layout:

~~~text
app/
  src/                  React + TypeScript frontend
  server/               Express backend and SQLite
  packages/page-schema/ Shared page-data schemas
  e2e/                  Playwright browser tests
docs/                   User and operations guides
scripts/                Installer and repository helpers
.github/                CI, release, and image workflows
Dockerfile              Canonical production image
~~~

See [app/README.md](./app/README.md) for application development boundaries.

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

## Development

From <code>app/</code>:

~~~bash
npm ci
npm run install:server
~~~

Run the API and frontend in separate terminals:

~~~bash
npm run server:dev
npm run dev
~~~

Quality checks:

~~~bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e:chromium
~~~

See [Development](./docs/wiki/Development.md) and [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

## Documentation

Start from the task-oriented [documentation index](./docs/README.md). The
[product requirements](./docs/wiki/product-requirements.md),
[design system](./docs/wiki/design-system.md) and
[architecture](./docs/wiki/architecture.md) describe the shared OSS product;
repository-wide agent instructions remain in [AGENTS.md](./AGENTS.md).

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

The self-hosted Express API is an internal boundary used by the bundled dashboard, not a stable external SDK. Read the [self-hosted API boundary](./docs/wiki/api.md). The separate [OrbitPage community node for n8n](https://github.com/paoloronco/n8n-nodes-orbitpage) connects to the managed Automation API; it does not expose the bundled self-hosted API as a public contract.

## Security and contributing

Report suspected vulnerabilities privately through a [GitHub Security Advisory](https://github.com/paoloronco/OrbitPage/security/advisories/new) or the contact in [SECURITY.md](./SECURITY.md). Do not open a public issue for an unpatched vulnerability.

Issues and focused pull requests are welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, checks, compatibility expectations, and the contribution workflow. Participation follows the [Code of Conduct](./CODE_OF_CONDUCT.md).

OrbitPage's open-source edition is available under the [MIT License](./LICENSE.txt).

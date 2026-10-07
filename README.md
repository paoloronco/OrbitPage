# OrbitPage - Open-source, self-hosted public page builder

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/paoloronco/OrbitPage/main/docs/brand/orbitpage-lockup-on-dark.svg" />
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/paoloronco/OrbitPage/main/app/public/brand/orbitpage-lockup.svg" />
    <img src="./app/public/brand/orbitpage-lockup.svg" alt="OrbitPage open-source self-hosted public page builder" width="420" />
  </picture>
</p>

<p align="center">
  <strong>Create your page. Host it on your server.</strong><br />
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
  <a href="#dashboard-workspaces">Dashboard</a> ·
  <a href="./docs/README.md">Documentation</a> ·
  <a href="./CONTRIBUTING.md">Contributing</a> ·
  <a href="./SECURITY.md">Security</a>
</p>

**OrbitPage is an open-source visual page builder for anyone who wants a public page on their own server.** Create portfolios, service pages, venue menus, or event pages. Add images, video, links, contact details, maps, and calls to action. Edit the layout, colors, and typography with a live preview.

Your page adapts to phones and desktops, with SEO, QR codes, analytics, and newsletters built in. The self-hosted edition is free, MIT-licensed, and runs in one Docker container, keeping your content and data on your own server.

Prefer managed hosting? Explore [orbitpage.com](https://orbitpage.com). This repository contains the self-hosted application.

<p align="center">
  <img src="./docs/screenshots/orbitpage-product-loop.gif" alt="OrbitPage dashboard walkthrough: page, content, menu, additional pages, themes, newsletter, publishing and the public page" width="800" />
</p>

> **Docker Hub namespace migration:** the official image is now `paoloronco/orbitpage`. The former `paueron/orbitpage` path is a temporary compatibility feed and stops receiving updates on **October 9, 2026**. Existing volumes and data are unaffected; see [Deployment](./docs/wiki/Deployment.md#older-docker-hub-images).

## Contents

- [Why OrbitPage](#why-orbitpage)
- [Quick start](#quick-start)
- [Updates](#updates)
- [Dashboard workspaces](#dashboard-workspaces)
- [Configuration](#configuration)
- [Data and backups](#data-and-backups)
- [Documentation](#documentation)
- [Security and contributing](#security-and-contributing)

## Why OrbitPage

- **Self-hosted.** Run one Docker container with SQLite and local storage on your server or homelab.
- **Visual editing.** Manage content, design, menus, subpages, and publishing from the dashboard.
- **Flexible content.** Add images, video, links, contact details, events, maps, and venue menus.
- **Sharing and discovery.** Generate QR codes, set search and social metadata, and track visits with consent-aware analytics.

## Quick start

### Docker image (recommended)

~~~bash
docker pull paoloronco/orbitpage
docker run -d --name orbitpage --restart unless-stopped -p 127.0.0.1:8080:8080 -v orbitpage-data:/app/data --security-opt no-new-privileges:true paoloronco/orbitpage
~~~

The image supports amd64 and arm64.<br>
Open the [dashboard](http://localhost:8080/dashboard/profile) and choose a password for the admin.<br>
The public page is at [http://localhost:8080](http://localhost:8080).<br>
Change the port or data mount in the command if needed. See the [Docker deployment guide](./docs/wiki/Deployment.md#docker-image-recommended) for options.

### Docker Compose

~~~bash
git clone https://github.com/paoloronco/OrbitPage.git
cd OrbitPage
docker compose up -d
~~~

Edit <code>docker-compose.yml</code> to change the port or storage location.<br>
Open the [dashboard](http://localhost:8080/dashboard/profile) and choose a password for the admin.<br>
The public page is at [http://localhost:8080](http://localhost:8080).<br>
To update, run <code>docker compose pull</code>, then <code>docker compose up -d</code> from the same directory.

### Linux install

On a clean x86-64 Linux system:

~~~bash
sudo apt-get update
sudo apt-get install -y git
git clone https://github.com/paoloronco/OrbitPage.git
cd OrbitPage
sudo ./install.sh
~~~

The installer creates the Docker container and persistent data directory, starts OrbitPage, and installs the <code>orbitpage</code> management command. Supported distributions and options are in the [deployment guide](./docs/wiki/Deployment.md#linux-installer).

On a Proxmox VE 8+ host, run the dedicated host-to-LXC installer as root:

~~~bash
apt-get update
apt-get install -y git
git clone https://github.com/paoloronco/OrbitPage.git
cd OrbitPage
./install-pve.sh
~~~

Do not run the Linux guest installer directly on a Proxmox host. See [Deployment](./docs/wiki/Deployment.md) for supported options, static networking, image pinning, backups, updates, and removal.

### Run from source

~~~bash
git clone https://github.com/paoloronco/OrbitPage.git
cd OrbitPage/app
npm ci
npm run install:server
cp .env.example .env
chmod 600 .env
printf '\nJWT_SECRET=%s\n' "$(node -p "require('crypto').randomBytes(32).toString('hex')")" >> .env
npm run build
cd server
node --env-file=../.env server.js
~~~

Open the [dashboard](http://localhost:8080/dashboard/profile) and choose a password for the admin.<br>
The public page is at [http://localhost:8080](http://localhost:8080).<br>
Edit <code>app/.env</code> if needed.

## Updates

Open **Dashboard → Account → General → Instance details** and click **Check for updates**. When a release is available, click **Install update…** as an administrator. The dialog installs it through the host update service or shows terminal instructions if the service is unavailable.

### Terminal (optional)

For Docker installations with the host update command already installed, including legacy setups:

~~~bash
sudo orbitpage-update
sudo docker exec orbitpage node -p "require('./package.json').version"
~~~

Back up your data before updating. See the [update guide](./docs/wiki/Deployment.md#update-safely) for manual Docker, Compose, source installations, and rollback.

## Dashboard workspaces

| Workspace | Purpose | URL path |
| --- | --- | --- |
| **Page** | Profile, image, social links, browser metadata, and footer | <code>/dashboard/editor/page</code> |
| **Content** | Main-page blocks, ordering, visibility, and scheduling | <code>/dashboard/editor/content</code> |
| **Menu** | Venue menu settings, sections, products, and design | <code>/dashboard/editor/menu/content</code> |
| **Shop** | Catalog workspace; unavailable in the self-hosted edition | <code>/dashboard/editor/shop/products</code> |
| **Pages** | Additional public pages and their blocks | <code>/dashboard/editor/pages</code> |
| **AI Assistant** | Propose profile, content, and theme changes to review and confirm | <code>/dashboard/ai</code> |
| **Theme** | Colors, typography, cards, background, and live preview | <code>/dashboard/theme/page</code> |
| **Publish** | Static and scheduled QR links, sitemap, and discovery text files | <code>/dashboard/publish/QR</code> |
| **Backup** | JSON or image ZIP export, selective restore, and unused-media cleanup | <code>/dashboard/backup</code> |
| **Analytics** | Visit and content reports, plus optional GA4 | <code>/dashboard/analytics</code> |
| **Privacy** | Consent banner, legal policies, and external CMP settings | <code>/dashboard/privacy</code> |
| **Newsletter** | SMTP settings, subscribers, campaigns, scheduling, and reports | <code>/dashboard/newsletter/overview</code> |
| **Team** | Users, roles, permissions, and personal API tokens | <code>/dashboard/team</code> |
| **Account** | Instance details, updates, environment settings, password, TOTP, and admin audit log | <code>/dashboard/account/general</code> |
| **Edition** | Self-hosted features and server responsibilities | <code>/dashboard/plan</code> |

Dashboard URLs include the interface language, for example <code>/it-IT/dashboard/account/general</code>. The paths above omit that prefix for readability. Navigation shows only the tools your role can access.

See the [dashboard guide](./docs/wiki/dashboard.md) for tab URLs and editing instructions.

## Configuration

Common runtime settings:

| Variable | Default | Purpose |
| --- | --- | --- |
| <code>DATA_DIR</code> | <code>app/server</code> from source; <code>/app/data</code> in Docker | Database, uploads, and saved instance settings |
| <code>JWT_SECRET</code> | Generated and saved in Docker; required from source | Stable session and encryption secret; explicit values must be at least 32 characters |
| <code>NODE_ENV</code> | Unset from source; <code>production</code> in Docker | Use <code>production</code> for deployed source installations |
| <code>PORT</code> | <code>3001</code> from source; <code>8080</code> in Docker | HTTP port |
| <code>HOST</code> | <code>127.0.0.1</code> from source; <code>0.0.0.0</code> in Docker | Listener address |
| <code>PUBLIC_SITE_URL</code> | Request origin | Public URL for metadata, QR codes, sitemap, and newsletter links |
| <code>PUBLIC_SITE_NAME</code> | <code>OrbitPage</code> | Site name in generated metadata |
| <code>SEO_INDEXING</code> | <code>true</code> | Set to <code>false</code> for staging or private instances |
| <code>UPLOAD_STORAGE_QUOTA_MB</code> | <code>1024</code> | Total upload quota in MB |
| <code>VIDEO_UPLOAD_LIMIT_MB</code> | <code>100</code> | Per-file video limit in MB |
| <code>ORBITPAGE_BACKUP_MEDIA_LIMIT_MB</code> | <code>128</code> | Total decoded media limit per backup export or restore in MB |
| <code>MEDIA_CLEANUP_ENABLED</code> | <code>true</code> outside tests and demo mode | Automatic unused-upload cleanup |
| <code>MEDIA_CLEANUP_GRACE_HOURS</code> | <code>24</code> | Minimum age of an unused upload before cleanup |
| <code>TZ</code> | <code>UTC</code> | Fallback timezone for scheduled content |
| <code>OPENAI_API_KEY</code> | Unset | Optional AI key; a key saved in AI Assistant takes precedence |
| <code>ORBITPAGE_SECRET_ENCRYPTION_KEY</code> | <code>JWT_SECRET</code> | Optional separate stable secret of at least 32 characters for the saved AI key |
| <code>NEWSLETTER_SECRET_KEY</code> | <code>JWT_SECRET</code> | Optional separate stable secret of at least 32 characters for SMTP encryption and newsletter links |
| <code>ORBITPAGE_TRUST_PROXY</code> | Disabled | Trusted proxy IPs or CIDRs; see the configuration reference before enabling |
| <code>BASE_PATH</code> | Empty | Mount path when serving under a subdirectory |

Administrators can change instance settings under **Account → General → Instance details → Environment variables**.

Newsletters require SMTP configuration. See the [newsletter guide](./docs/wiki/newsletters.md) for setup and the [Configuration reference](./docs/wiki/Configuration.md) for all variables, defaults, and examples.

## Data and backups

The data directory contains:

~~~text
orbitpage.db
uploads/
.jwt-secret (Docker-generated installations)
.instance-env.json (dashboard environment overrides, when saved)
~~~

Back up the whole data directory before upgrades or restores: <code>/app/data</code> in Docker, or your source installation's <code>DATA_DIR</code>. Keep any host-managed secrets backed up separately and private.

The dashboard exports selected application data as JSON, with an optional **Include images (ZIP)** archive. Newsletter records, SMTP credentials, and provider secrets require an infrastructure backup. Follow the [backup and restore guide](./docs/wiki/maintenance.md#create-and-verify-an-infrastructure-backup) for a consistent copy of the database and uploads.

## Documentation

Start from the [documentation index](./docs/README.md).

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

To automate a self-hosted installation, see the [API guide](./docs/wiki/api.md). For pages hosted on [orbitpage.com](https://orbitpage.com), use the [n8n community node](https://github.com/paoloronco/n8n-nodes-orbitpage).

## Security and contributing

Report suspected vulnerabilities privately through a [GitHub Security Advisory](https://github.com/paoloronco/OrbitPage/security/advisories/new) or the contact in [SECURITY.md](./SECURITY.md). Do not open a public issue for an unpatched vulnerability.

Issues and focused pull requests are welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, checks, compatibility expectations, and the contribution workflow. Participation follows the [Code of Conduct](./CODE_OF_CONDUCT.md).

OrbitPage's open-source edition is available under the [MIT License](./LICENSE.txt).

# OrbitPage

<p align="center">
  <img src="./app/public/brand/orbitpage-lockup.svg" alt="OrbitPage" width="420" />
</p>

<p align="center">
  Build and self-host one polished public destination for a person, brand, venue, event, or small business.
</p>

<p align="center">
  <a href="https://github.com/paoloronco/OrbitPage/releases"><img src="https://img.shields.io/github/v/release/paoloronco/OrbitPage?label=version&amp;color=2563EB" alt="Latest OrbitPage version" /></a>
  <a href="./LICENSE.txt"><img src="https://img.shields.io/badge/license-MIT-111827" alt="MIT License" /></a>
  <a href="https://hub.docker.com/r/paueron/orbitpage"><img src="https://img.shields.io/badge/Docker_Hub-paueron%2Forbitpage-2496ED?logo=docker&logoColor=white" alt="Docker Hub" /></a>
  <a href="https://github.com/paoloronco/OrbitPage/pkgs/container/orbitpage"><img src="https://img.shields.io/badge/GHCR-orbitpage-181717?logo=github&logoColor=white" alt="GitHub Container Registry" /></a>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#what-you-can-build">Features</a> ·
  <a href="./docs/README.md">Documentation</a> ·
  <a href="./CONTRIBUTING.md">Contributing</a> ·
  <a href="./SECURITY.md">Security</a>
</p>

OrbitPage is an open-source public-page builder with a real editing dashboard, responsive public rendering, an Express API for the bundled application, SQLite persistence, and local file storage. No external database is required.

This repository is the self-hosted edition. The optional managed service is available at [orbitpage.com](https://orbitpage.com), but its control plane, billing, managed storage, and hosted-only features are not part of this repository.

## Contents

- [Quick start](#quick-start)
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

Docker is the recommended production path.

### One-command Linux install

On a clean x86-64 Debian 12/13 or Ubuntu 22.04/24.04 server, VM, or LXC:

~~~bash
curl -fsSL https://raw.githubusercontent.com/paoloronco/OrbitPage/main/install.sh | sudo bash
~~~

The installer configures Docker from its official repository, generates a private JWT secret, persists application data, starts OrbitPage, and installs the <code>orbitpage</code> management command.

For a Proxmox VE 8+ host, use the dedicated host-to-LXC installer instead:

~~~bash
curl -fsSL https://raw.githubusercontent.com/paoloronco/OrbitPage/main/install-pve.sh | bash
~~~

Do not run the Linux guest installer directly on a Proxmox host. See [Deployment](./docs/wiki/Deployment.md) for supported options, static networking, image pinning, backups, updates, and removal.

### Docker Compose

1. Clone the repository.
2. Replace the sample <code>JWT_SECRET</code> in [docker-compose.yml](./docker-compose.yml).
3. Start the service:

~~~bash
docker compose up -d
~~~

Open:

- Public page: <http://localhost:8080>
- Dashboard: <http://localhost:8080/dashboard/profile>
- Health check: <http://localhost:8080/health>

The same image is published as <code>paueron/orbitpage:latest</code> and <code>ghcr.io/paoloronco/orbitpage:latest</code>. Versioned tags are listed in [GitHub Releases](https://github.com/paoloronco/OrbitPage/releases).

### Run from source

Requirements:

- Node.js <code>^20.19.0</code> or <code>>=22.12.0</code>
- npm
- Git

~~~bash
git clone https://github.com/paoloronco/OrbitPage.git
cd OrbitPage/app
npm ci
npm run install:server
export JWT_SECRET="$(openssl rand -hex 32)"
export DATA_DIR="$PWD/.orbitpage-data"
npm run start
~~~

The production-style source run is available at <http://localhost:3001>.

## What you can build

### Public pages and content

- A main public page plus focused subpages with independent slugs, titles, descriptions, and blocks.
- Link, text, heading, separator, image, native video, social, contact, map, event, callout, calendar, booking, form, and consent-aware embed blocks.
- Venue menus with locale, sections, one-level subsections, products, variants, images, prices, scheduling, and availability.
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
- Canonical URL, Open Graph, Twitter Card, Schema.org, and <code>noindex</code> controls.
- Generated <code>sitemap.xml</code>.
- Editable <code>robots.txt</code>, <code>llms.txt</code>, <code>humans.txt</code>, <code>ai.txt</code>, <code>security.txt</code>, and safe custom text endpoints.

### Operations, privacy, and security

- Built-in self-hosted click and CTA counters, plus optional GA4 integration on the public page.
- Consent controls, policy links, Google Consent Mode, and optional external CMP integration.
- Complete or selective JSON backup and restore.
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
| **Team** | Additional users and permissions |
| **Account** | Password and two-factor authentication |

Dashboard routes are stable, including <code>/dashboard/profile</code>, <code>/dashboard/content</code>, <code>/dashboard/ai</code>, <code>/dashboard/theme</code>, and <code>/dashboard/publish</code>. Legacy routes such as <code>/admin</code> and the old Links, Pages, Menu, and Access paths remain compatibility aliases.

Read the [dashboard guide](./docs/user-guide/dashboard.md) for the complete route map and editing workflow.

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
5. Choose the primary public-page slug.
6. Complete setup and follow the dashboard guide.

The administrator, slug, and starter profile are created atomically. Existing installations created before slug-based setup remain backward compatible.

## Configuration

The essential production settings are:

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| <code>JWT_SECRET</code> | Production | Random outside production | Signs sessions and protects encrypted server-side secrets |
| <code>DATA_DIR</code> | Recommended | Server directory; <code>/app/data</code> in Docker | Stores SQLite and uploads |
| <code>PORT</code> | No | <code>3001</code>; <code>8080</code> in Docker | HTTP listener |
| <code>PUBLIC_SITE_URL</code> | Recommended | Request origin | Canonical public URL for sharing, QR, sitemap, and metadata |
| <code>PUBLIC_SITE_NAME</code> | No | <code>OrbitPage</code> | Site name in generated metadata |
| <code>SEO_INDEXING</code> | No | <code>true</code> | Set to <code>false</code> for staging or private deployments |
| <code>UPLOAD_STORAGE_QUOTA_MB</code> | No | <code>1024</code> | Total upload quota |
| <code>VIDEO_UPLOAD_LIMIT_MB</code> | No | <code>100</code> | Per-file video limit |

For AI provider settings, cleanup controls, rate limiting, HTTPS, base paths, CORS, reset recovery, and build-time variables, use the complete [Configuration reference](./docs/wiki/Configuration.md).

## Data and backups

Everything that must survive a restart belongs under <code>DATA_DIR</code>:

~~~text
orbitpage.db
uploads/
~~~

Persist <code>/app/data</code> in Docker. Back up the database and uploads together before upgrades or restores. Never commit a database, database backup or sidecar, uploads, logs, environment file, or real user content.

The dashboard can create complete or selective JSON exports. Keep occasional infrastructure-level backups as well; a selective export does not replace a consistent copy of the complete data directory.

## Production checklist

1. Use a stable, long, random <code>JWT_SECRET</code>.
2. Persist <code>DATA_DIR</code> or <code>/app/data</code>.
3. Put OrbitPage behind trusted HTTPS.
4. Set <code>PUBLIC_SITE_URL</code> to the final public origin.
5. Enable TOTP for privileged users under **Dashboard > Account**.
6. Back up SQLite and uploads before upgrades.
7. Verify <code>/health</code> after deployment.
8. Set <code>SEO_INDEXING=false</code> on staging and private instances.

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
npm run test:unit
npm run build
npm run test:e2e:chromium
~~~

See [Development](./docs/wiki/Development.md) and [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

## Documentation

Start from the task-oriented [documentation index](./docs/README.md).

| Task | Guide |
| --- | --- |
| Install or evaluate | [Getting started](./docs/wiki/Getting-started.md) |
| Deploy, update, or use Proxmox | [Deployment](./docs/wiki/Deployment.md) |
| Configure environment variables | [Configuration](./docs/wiki/Configuration.md) |
| Use the editor | [Dashboard guide](./docs/user-guide/dashboard.md) |
| Configure AI safely | [AI assistant](./docs/user-guide/ai-assistant.md) |
| Configure analytics and consent | [Analytics and privacy](./docs/user-guide/analytics-and-privacy.md) |
| Configure search and discovery | [SEO and indexing](./docs/wiki/SEO-and-indexing.md) |
| Troubleshoot | [Troubleshooting](./docs/wiki/Troubleshooting.md) |

The self-hosted Express API is the internal application boundary used by the bundled dashboard. The managed, versioned Automation REST API is a separate service; [API boundaries](./docs/API.md) explains the credential and support distinction.

## Security and contributing

Report suspected vulnerabilities privately through a [GitHub Security Advisory](https://github.com/paoloronco/OrbitPage/security/advisories/new) or the contact in [SECURITY.md](./SECURITY.md). Do not open a public issue for an unpatched vulnerability.

Issues and focused pull requests are welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, checks, compatibility expectations, and the contribution workflow.

OrbitPage's open-source edition is available under the [MIT License](./LICENSE.txt).

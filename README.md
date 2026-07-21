# OrbitPage

<p align="center">
  <img src="./app/public/brand/orbitpage-lockup.svg" alt="OrbitPage" width="420" />
</p>

<p align="center">
  Build a flexible public page for a person, brand, venue, event, or small business.<br />
  Self-host the open-source edition or use the managed service at <a href="https://orbitpage.com">orbitpage.com</a>.
</p>

<p align="center">
  <a href="https://github.com/paoloronco/OrbitPage/releases"><img src="https://img.shields.io/github/v/release/paoloronco/OrbitPage?label=version&amp;color=2563EB" alt="Latest OrbitPage version" /></a>
  <a href="./LICENSE.txt"><img src="https://img.shields.io/badge/license-MIT-111827" alt="MIT License" /></a>
  <a href="https://hub.docker.com/r/paueron/orbitpage"><img src="https://img.shields.io/badge/Docker_Hub-paueron%2Forbitpage-2496ED?logo=docker&logoColor=white" alt="Docker Hub" /></a>
  <a href="https://github.com/paoloronco/OrbitPage/pkgs/container/orbitpage"><img src="https://img.shields.io/badge/GHCR-orbitpage-181717?logo=github&logoColor=white" alt="GitHub Container Registry" /></a>
</p>

<p align="center">
  <a href="https://orbitpage.com/product">Product</a> ·
  <a href="https://orbitpage.com/open-source">Open source</a> ·
  <a href="https://orbitpage.com/hosting">Managed hosting</a> ·
  <a href="https://orbitpage.com/pricing">Pricing</a> ·
  <a href="./docs/wiki/Home.md">Documentation</a>
</p>

OrbitPage is a public-page builder with a real editing workspace, not only a list of buttons. It supports links, rich content blocks, media, social profiles, maps, events, contact information, themes, analytics, SEO controls, consent settings, and responsive public rendering.

This repository contains the **open-source, self-hosted edition**. It runs as one Node.js application with a React admin interface, an Express API, SQLite persistence, and local file storage. No external database is required.

## Choose Your Edition

OrbitPage is available in two forms built around the same page builder and public-page experience.

| | Open-source edition | Managed SaaS |
| --- | --- | --- |
| Best for | Self-hosters, homelabs, developers, and teams that want infrastructure control | People and businesses that want OrbitPage without operating a server |
| Where it runs | Your Docker host, VM, or Node.js platform | Managed at [orbitpage.com](https://orbitpage.com) |
| Source | This public repository, MIT licensed | Hosted platform and managed control plane |
| Data | SQLite database and uploads on your persistent volume | Managed accounts, storage, publishing, and backups |
| Public URL | Your own deployment URL | Hosted username URL, with custom domains on eligible plans |
| Newsletters | Not included; connect an external newsletter tool if needed | Tenant SMTP, double opt-in subscribers, scheduled campaigns, and delivery reports on eligible paid plans |
| Operations | You handle deployment, TLS, updates, backups, and availability | OrbitPage handles the hosting workflow |
| Cost | Software is free; you pay for your infrastructure | Free and paid plans are listed on the [pricing page](https://orbitpage.com/pricing) |

The managed control plane, billing system, and hosting infrastructure are not included in this repository. Improvements to the shared OrbitPage application can be released in both editions.

Managed newsletters are also a hosted-platform feature rather than part of this repository. Eligible paid workspaces can connect their own SMTP server, collect confirmed subscribers, create and schedule branded campaigns, and review SMTP acceptance, opens, clicks, rejections, and unsubscribes. The customer remains responsible for consent, sender-domain authentication, provider charges, and mailing-list compliance. See the [managed service](https://orbitpage.com/hosting) and [pricing](https://orbitpage.com/pricing) for current availability and limits.

## Features

### Page building

- Main page plus organized subpages with a unique slug, title, description and independent block collection
- Stable editor routes such as `/dashboard/pages` and public subpage routes such as `/services`

- Link cards, text blocks, headings, separators, images, and native video
- Social rows, contact details, maps, events with timezone-aware countdowns, callouts, and consent-aware embeds
- Native venue menus with sections, one-level subsections, products, variants, images, and availability controls
- Scheduled menu cards plus visible unavailable states for links, tickets, menus, and dishes
- Per-block visibility, ordering, scheduling, icons, cover media, and layout controls
- Link-health indicators supplied by the managed platform without exposing browser-side probes
- Responsive rendering for desktop and mobile pages

### Design

- Ready-made page themes and card-style presets
- Live preview while editing profile, links, content, and themes
- Colors, typography, spacing, radius, borders, shadows, blur, and glow
- Profile-card, avatar/logo, background image, video, and favicon controls
- Explicit editor localization in 14 languages with Arabic RTL layout; public pages preserve the author's published content
- Optional advanced CSS customization

### Publishing and discovery

- Editable title, description, canonical URL, and social-preview metadata
- Open Graph, Twitter Card, and Schema.org output
- Editable discovery TXT files and Admin-generated `sitemap.xml`
- Customizable PNG/SVG QR codes for the main page, menu, or a safe relative campaign path
- Editable `robots.txt`, canonical `llms.txt` (`llm.txt` alias), `humans.txt`, `ai.txt`, and `security.txt`
- Safe custom `/name.txt` and `/.well-known/name.txt` endpoints
- Optional `noindex` mode for private, staging, or preview deployments

### Privacy and operations

- Basic self-hosted click analytics with privacy and consent controls
- Google Consent Mode and external CMP integration options
- Privacy Policy and Cookie Policy links or hosted content
- Selective, backward-compatible JSON backup and restore
- Storage quotas and validated image/video uploads
- Health endpoint, Docker health support, and persistent application data

### Administration and security

- First-run admin setup and bcrypt password hashing
- Signed JWT sessions and protected password recovery
- Multi-user access controls and scoped editing permissions
- Rate limits, file-type checks, upload-size limits, and path validation
- Admin, API, health, and unknown application routes excluded from indexing

## How It Works

The self-hosted edition is intentionally compact:

```text
Browser
  ├─ Public OrbitPage
  └─ /dashboard/profile React workspace
           │
           ▼
      Express API
       ├─ SQLite database
       └─ Local uploads
```

Repository layout:

```text
app/
  src/          React + TypeScript frontend
  server/       Express API, authentication, SQLite, and uploads
  public/       Static and brand assets
docs/
  wiki/         Installation and operations guides
.github/        CI, release, and container workflows
Dockerfile      Production multi-stage image
docker-compose.yml
```

## Quick Start With Docker

Docker is the recommended production path.

### One-command Linux install

On a clean x86-64 Debian 12/13 or Ubuntu 22.04/24.04 server, VM, or LXC, run:

```bash
curl -fsSL https://raw.githubusercontent.com/paoloronco/OrbitPage/main/install.sh | sudo bash
```

The installer uses Docker's official apt repository, creates a persistent data directory, generates a private JWT secret, starts OrbitPage, and waits for its health check. It is idempotent: running it again preserves the existing secret and data.

Do not run it directly on a Proxmox VE host. Create a Debian guest first. The installer is designed so a Community Scripts-style LXC wrapper can call the same tested application setup inside the guest.

After installation:

```bash
orbitpage status
orbitpage logs
orbitpage update
orbitpage backup
```

See [One-command deployment](./docs/wiki/Deployment.md#one-command-linux-install) for port, bind-address, image pinning, backups, update, and uninstall options.

### Docker run

```bash
docker run -d \
  --name orbitpage \
  --restart unless-stopped \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -v orbitpage_data:/app/data \
  paueron/orbitpage:latest
```

Open:

- Public page: <http://localhost:8080>
- Admin workspace: <http://localhost:8080/dashboard/profile>
- Health check: <http://localhost:8080/health>

On the first visit to `/dashboard/profile`, OrbitPage asks you to create the initial admin password. The first username is `admin`. Each workspace area has a stable URL, such as `/dashboard/links` and `/dashboard/theme`; the legacy `/admin` URL redirects to the profile section.

The Docker image is published to both registries:

```text
paueron/orbitpage:latest
ghcr.io/paoloronco/orbitpage:latest
```

Versioned image tags are available from [GitHub Releases](https://github.com/paoloronco/OrbitPage/releases).

## Docker Compose

1. Review [docker-compose.yml](./docker-compose.yml).
2. Replace the sample `JWT_SECRET` with a long random value.
3. Start the service:

```bash
docker compose up -d
```

The included Compose file stores persistent data in `./orbitpage-data`. Keep this directory when recreating or upgrading the container.

## Run From Source

Requirements:

- Node.js `^20.19.0` or `>=22.12.0`
- npm
- Git

Install and start:

```bash
git clone https://github.com/paoloronco/OrbitPage.git
cd OrbitPage/app
npm ci
npm run install:server
npm run start
```

The production-style source installation runs on <http://localhost:3001> by default.

## Configuration

The essential server configuration is deliberately small.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `JWT_SECRET` | Production | Random at runtime | Signs admin sessions. Use a stable, long random value in production. |
| `PORT` | No | `3001` (`8080` in Docker) | HTTP listening port. |
| `DATA_DIR` | Recommended | Server directory (`/app/data` in Docker) | Stores `orbitpage.db` and uploaded media. |
| `PUBLIC_SITE_URL` | Recommended | Request origin | Canonical public URL used for SEO, sharing, sitemap, and QR codes. |
| `PUBLIC_SITE_NAME` | No | `OrbitPage` | Site name used in generated metadata. |
| `SEO_INDEXING` | No | `true` | Set to `false` for private or staging deployments. |
| `UPLOAD_STORAGE_QUOTA_MB` | No | `1024` | Total upload quota for the installation. |
| `VIDEO_UPLOAD_LIMIT_MB` | No | `100` | Per-file MP4/WebM upload limit. |
| `MEDIA_CLEANUP_ENABLED` | No | `true` | Automatically remove uploads no longer referenced by page data. |
| `MEDIA_CLEANUP_GRACE_HOURS` | No | `24` | Minimum age before an unused upload can be removed. |
| `RESET_TOKEN` | No | Disabled | Enables protected credential recovery. Use at least 32 characters. |
| `BASE_PATH` | No | Empty | Serves OrbitPage from a subpath such as `/links`. |

See [Configuration](./docs/wiki/Configuration.md) for the complete reference, including HTTPS, reverse proxies, legal pages, and optional integrations.

## Persistent Data and Backups

Everything that must survive a restart lives under `DATA_DIR`:

```text
orbitpage.db
uploads/
```

For Docker, persist `/app/data`. Back up both the database and uploads together, or use the JSON backup/restore controls in the Admin workspace. Export and restore can be limited to profile data, blocks, appearance, privacy, discovery files, administrator accounts, or uploaded media. Unselected restore sections are left unchanged.

Complete exports retain the historical schema-v1 format. Selective exports use schema v2 and declare their included sections explicitly; current versions accept both formats. Keep an occasional complete backup even when selective backups are convenient, and never recreate a production container without its existing volume or bind mount.

OrbitPage checks unused media automatically every six hours. The cleanup scans all page data before deleting anything and protects recent uploads for at least 24 hours by default. Administrators can preview reclaimable space or run the cleanup immediately from **Backup & Restore**. Set `MEDIA_CLEANUP_ENABLED=false` to disable the scheduled job or increase `MEDIA_CLEANUP_GRACE_HOURS` for a longer safety window.

## Deploying in Production

OrbitPage can run anywhere that supports a persistent Docker container or Node.js service, including a VM, home server, Cloud Run, Render, Fly.io, DigitalOcean, Azure App Service, Coolify, CapRover, Dokku, and similar platforms.

For a production deployment:

1. Set a stable `JWT_SECRET`.
2. Enable TOTP two-factor authentication for every privileged user under **Dashboard > Access**, then store the one-time recovery codes outside OrbitPage.
2. Persist `DATA_DIR` or `/app/data`.
3. Put the service behind HTTPS using your platform or reverse proxy.
4. Set `PUBLIC_SITE_URL` to the final public origin.
5. Back up the database and uploads before upgrades.
6. Check `/health` after each deployment.

Read [Deployment](./docs/wiki/Deployment.md) for reverse-proxy headers, subpath hosting, upgrades, and rollback guidance.

## Development

Install dependencies:

```bash
cd app
npm ci
npm run install:server
```

Run the API and Vite frontend in separate terminals:

```bash
# Terminal 1
npm run server:dev

# Terminal 2
npm run dev
```

Development endpoints:

- Frontend: <http://localhost:8080>
- Admin workspace: <http://localhost:8080/dashboard/profile>
- API and health endpoint: <http://localhost:3001>

Quality checks:

```bash
npm run lint
npm run test:unit
npm run build
```

Browser tests are available through `npm run test:e2e`.

## Documentation

- [Getting started](./docs/wiki/Getting-started.md)
- [Deployment](./docs/wiki/Deployment.md)
- [Configuration](./docs/wiki/Configuration.md)
- [Development](./docs/wiki/Development.md)
- [SEO and indexing](./docs/wiki/SEO-and-indexing.md)
- [Security](./docs/wiki/Security.md)
- [Troubleshooting](./docs/wiki/Troubleshooting.md)
- [Brand assets](./docs/brand/README.md)
- [Release history](https://github.com/paoloronco/OrbitPage/releases)

## Security

Do not report unpatched vulnerabilities through a public issue. Use a private [GitHub Security Advisory](https://github.com/paoloronco/OrbitPage/security/advisories/new) or email `info@paoloronco.it`.

Deployment hardening and supported-version information are in [SECURITY.md](./SECURITY.md).

## Contributing

Issues and pull requests for the open-source application are welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, testing, coding conventions, and the contribution workflow.

Please keep reports for the hosted service separate from reproducible issues in the self-hosted application. Product and managed-hosting questions can be directed through [orbitpage.com](https://orbitpage.com).

## License

OrbitPage's open-source edition is released under the [MIT License](./LICENSE.txt).

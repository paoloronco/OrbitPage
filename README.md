# Lynx

### Your personal links hub

[![Version](https://img.shields.io/badge/version-4.3.11-blue.svg)](https://github.com/paoloronco/Lynx)
[![Docker Hub](https://img.shields.io/badge/Docker_Hub-paueron%2Flynx-2496ED?logo=docker&logoColor=white)](https://hub.docker.com/r/paueron/lynx)
[![GHCR](https://img.shields.io/badge/GHCR-ghcr.io%2Fpaoloronco%2Flynx-181717?logo=github&logoColor=white)](https://github.com/paoloronco/Lynx/pkgs/container/lynx)
[![Available on GitHub](https://img.shields.io/badge/Available_on-GitHub-181717?logo=github&logoColor=white)](https://github.com/paoloronco/Lynx)
[![Available on Gitea](https://img.shields.io/badge/Available_on-Gitea-609926?logo=gitea&logoColor=white)](https://gitea.com/paoloronco/Lynx)

**Lynx** is an open-source, self-hosted link page manager. It gives you a polished public profile page, a private admin panel, theme editing, click analytics, SQLite persistence, and production-ready Docker distribution without requiring an external database service.

## Contents

- [Try the Demo](#try-the-demo)
- [What You Get](#what-you-get)
- [Quick Start](#quick-start)
- [Production Docker](#production-docker)
- [Deploy Anywhere](#deploy-anywhere)
- [Configuration](#configuration)
- [Development](#development)
- [Search and Sharing](#search-and-sharing)
- [Documentation](#documentation)
- [Changelog](#-changelog)
- [License](#license)

## Try the Demo

The demo is the fastest way to see both sides of Lynx: the public page visitors see, and the admin panel you use to manage it.

| Area | Link | Login |
| --- | --- | --- |
| Public page | [lynx-demo.paoloronco.it](https://lynx-demo.paoloronco.it/) | No login required |
| Admin panel | [lynx-demo.paoloronco.it/admin](https://lynx-demo.paoloronco.it/admin) | `admin` / `ChangeMe123!` |

Demo changes may be reset and should not be used for private data.

[![Public page walkthrough](./docs/demo-public.gif)](https://app.arcade.software/share/avEiscyqITMJJFngqacr)

[![Admin panel walkthrough](./docs/demo-admin.gif)](https://app.arcade.software/share/PhdZgUB3JnSnyIFZaQEq)

## What You Get

| Area | Highlights |
| --- | --- |
| Public page | Profile, avatar, bio, social links, link cards, text cards, separators, cover images, SEO metadata, legal footer links |
| Admin panel | Profile editor, link manager, live preview, theme editor, analytics, privacy/legal settings, access management |
| Customization | Colors, gradients, typography, spacing, radius, blur, glow, button styles, link styles, custom CSS |
| Publishing control | Scheduled links, visibility toggles, drag-and-drop ordering, JSON import/export |
| Storage and operations | SQLite database, local uploads, Docker image, health endpoint, persistent `/app/data` volume |
| Security | bcrypt password hashing, signed JWT sessions, encrypted browser token storage, rate limits, parameterized SQLite queries, required Docker `JWT_SECRET` |

## Quick Start

Use this path when you want to try Lynx locally without Docker.

```bash
git clone https://github.com/paoloronco/Lynx.git
cd Lynx/LYNX
npm ci
npm run install:server
npm run start
```

Open:

- Public page: http://localhost:3001
- Admin panel: http://localhost:3001/admin
- Health check: http://localhost:3001/health

On the first admin visit, Lynx asks you to create the admin password. The first username is always `admin`.

Requirements:

- Node.js `^20.19.0` or `>=22.12.0`
- npm
- Git

## Production Docker

Docker is the recommended production path. The same image is published to Docker Hub and GitHub Container Registry.

```bash
docker run -d --name lynx \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -v lynx_data:/app/data \
  paueron/lynx:latest
```

Alternative image:

```bash
ghcr.io/paoloronco/lynx:latest
```

Open:

- Public page: http://localhost:8080
- Admin panel: http://localhost:8080/admin

The `/app/data` volume stores the SQLite database and uploads. Keep it mounted before upgrading or recreating the container.

### Docker Compose

```bash
docker compose up -d
```

Before exposing the app publicly, replace the sample `JWT_SECRET` in [docker-compose.yml](./docker-compose.yml).

## Deploy Anywhere

Lynx can run on any platform that supports a Docker container or a Node.js service: Cloud Run, Render, Fly.io, DigitalOcean App Platform, Azure App Service, Koyeb, Northflank, CapRover, Dokku, Coolify, and similar providers.

For container platforms, the deployment shape is always the same:

```bash
NODE_ENV=production
PORT=8080
JWT_SECRET=replace-with-a-long-random-secret
```

Then persist `/app/data` and expose port `8080`. Most platforms provide HTTPS at the edge, so `ENABLE_HTTPS` is usually only useful for local or private self-signed deployments.

## Configuration

The production essentials are intentionally small:

| Variable | Required | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | Yes in Docker/production | Stable signing key for admin sessions. Use a long random value. |
| `PORT` | Usually | HTTP port. Docker defaults to `8080`; local Node defaults to `3001`. |
| `DATA_DIR` | Recommended for custom installs | Directory for `lynx.db` and uploads. Docker uses `/app/data`. |
| `PUBLIC_SITE_URL` | Recommended behind proxies | Canonical public URL for SEO, sitemap, and social previews. |
| `SEO_INDEXING` | Optional | Set to `false` for staging/private deployments. |
| `RESET_TOKEN` | Optional | Enables protected recovery/reset endpoints. Use at least 32 characters. |

See the full environment reference in [docs/wiki/Configuration.md](./docs/wiki/Configuration.md).

## Development

Development mode uses two processes: Express for the API and Vite for the frontend.

```bash
cd Lynx/LYNX
npm ci
npm run install:server
```

Terminal 1:

```bash
npm run server:dev
```

Terminal 2:

```bash
npm run dev
```

Open:

- Frontend: http://localhost:8080
- Admin panel: http://localhost:8080/admin
- API health check: http://localhost:3001/health

Useful checks:

```bash
npm run lint
npm run test:unit
npm run build
```

## Search and Sharing

Lynx generates metadata from your saved profile and environment, so most deployments do not need source-code SEO edits.

Recommended production values:

```bash
PUBLIC_SITE_URL=https://links.example.com
PUBLIC_SITE_NAME="Your Name or Brand"
SEO_INDEXING=true
```

Use `SEO_INDEXING=false` for private, staging, or preview deployments. Lynx will emit `noindex` metadata and a blocking `robots.txt`.

Lynx also serves:

- profile-based title and meta description
- canonical URL
- Open Graph and Twitter Card metadata
- Schema.org JSON-LD
- dynamic `robots.txt`
- dynamic `sitemap.xml`
- `noindex` headers for admin, API, health, and unknown SPA routes

Full guidance lives in [docs/wiki/SEO-and-indexing.md](./docs/wiki/SEO-and-indexing.md).

## Documentation

The README is the quick path. Longer operational docs live in `docs/wiki/` and are ready to mirror into the GitHub Wiki:

- [Getting started](./docs/wiki/Getting-started.md)
- [Deployment](./docs/wiki/Deployment.md)
- [Configuration](./docs/wiki/Configuration.md)
- [Development](./docs/wiki/Development.md)
- [SEO and indexing](./docs/wiki/SEO-and-indexing.md)
- [Security](./docs/wiki/Security.md)
- [Troubleshooting](./docs/wiki/Troubleshooting.md)

## 📝 Changelog

<details>
<summary><strong>v4.3.11</strong></summary>

### CI quality gate

- Adds blocking dependency audits for frontend and backend packages in GitHub Actions.
- Adds a Docker smoke test that builds the production image, starts it with a CI secret, and checks `/health`.

</details>

<details>
<summary><strong>v4.3.10</strong></summary>

### Theme save consistency

- Makes theme import, reset, and editing follow the same preview-then-save workflow.
- Exports the pending theme and keeps unsaved theme changes visible when saving fails.

</details>

<details>
<summary><strong>v4.3.9</strong></summary>

### Link save reliability

- Keeps unsaved link changes visible when saving fails instead of clearing the dirty state too early.
- Shows the save error inline in the link manager so admins can retry without losing context.

</details>

<details>
<summary><strong>v4.3.8</strong></summary>

### CMP consent flow hardening + CCPA link polish

- Treat bootstrap CMP states from Cookiebot, OneTrust, and Cookiebot events as implicit until a user action is explicitly detected, preventing pre-granted consent from loading Google Analytics too early.
- Improve Google Consent Mode propagation from builder CMPs and keep script dispatch aligned with explicit consent only.
- Ensure the CCPA "Do not sell my personal information" footer link remains available with locale-aware label variants and a stable fallback target.

</details>

<details>
<summary><strong>v4.3.6</strong></summary>

### Consent signal hardening for Google & CCPA

- Distinguishes implicit consent state from explicit user consent for all supported external CMPs (iubenda, Cookiebot, CookieYes, OneTrust, custom snippets).
- Defers third-party tag loading until consent is explicitly granted, including GA4 script/config gating and Google Consent Mode updates.
- Syncs Google Consent Mode updates even when `gtag` is not yet loaded, avoiding silent failures and premature network requests.
- Restores privacy footer policy URL resolution from `consentConfig.legalPolicies`, so CCPA "Do not sell my personal information" links remain available when hosted/embedded legal pages are used.

</details>

<details>
<summary><strong>v4.3.6</strong></summary>

### CMP hardening for Google Consent Mode

- Prevents builder-mode external CMP signals (especially iubenda) from being treated as explicit consent before user interaction.
- Separates implicit provider state from explicit consent, so `gtag('consent', 'update')` and consent-dependent scripts dispatch only after explicit choice.
- Restricts dataLayer fallback sync to `consent update` entries only, preventing default/implicit consent bootstrap from firing tags early.

</details>

<details>
<summary><strong>v4.3.5</strong></summary>

### Documentation and wiki refresh

- Reworks the README around demo-first evaluation, shorter feature scanning, Docker production setup, configuration, development, and SEO basics.
- Adds a wiki-ready documentation set with expanded deployment, configuration, development, SEO, security, and troubleshooting guides.
- Updates `SECURITY.md`, `CONTRIBUTING.md`, and the Docker Compose image reference to match the current app architecture.

</details>

<details>
<summary><strong>v4.3.4</strong></summary>

### Minor container tag reliability

- Fixes the main-branch Docker workflow so `X.X` tags are computed without shell-interpreted JavaScript template literals.
- Adds regression coverage to keep version and minor-version image tags published from the package version.
- Keeps Docker Hub and GHCR publishing aligned for `latest`, `X.X.X`, `vX.X.X`, and `X.X` tags.

</details>

<details>
<summary><strong>v4.3.3</strong></summary>

### Versioned container tags from main

- Publishes Docker version tags directly from the main-branch build, including `X.X.X`, `vX.X.X`, and `X.X`.
- Avoids relying on tag-triggered workflows for automated release tags created by GitHub Actions.
- Keeps Docker Hub and GHCR tags aligned from the same build output.

</details>

<details>
<summary><strong>v4.3.2</strong></summary>

### Dual container registry publishing

- Publishes Docker images to both Docker Hub (`paueron/lynx`) and GitHub Container Registry (`ghcr.io/paoloronco/lynx`).
- Keeps `latest`, semantic version, minor version, and short SHA tags aligned across both registries.
- Documents the GHCR pull path alongside the existing Docker Hub distribution path.

</details>

<details>
<summary><strong>v4.3.1</strong></summary>

### Deployment and admin startup fixes

- Aligns both Dockerfiles on the production runtime contract: Node 22, `PORT=8080`, `DATA_DIR=/app/data`, and mandatory `JWT_SECRET`.
- Makes the `LYNX/` Dockerfile self-contained for `docker build ./LYNX`.
- Avoids the expected unauthenticated `/api/auth/verify` call when opening the admin login page without a stored token.

</details>

<details>
<summary><strong>v4.3.0</strong></summary>

### Multi-user access management

- Renames the **Security** admin tab to **Access**.
- Adds full multi-user management: list users, create users, change any user's password, and delete users.
- The `admin` user is created by default and cannot be deleted.
- Login form now accepts any username; backend validates credentials per-user.
- `POST /api/auth/change-password` now changes the password of the currently authenticated user (not hardcoded to `admin`).
- New API endpoints: `GET /api/users`, `POST /api/users`, `PUT /api/users/:username`, `DELETE /api/users/:username`.

</details>

<details>
<summary><strong>v4.2.0</strong></summary>

### Card cover images

- Adds optional cover/header image to link and text cards.
- Full-bleed 16:9 image displayed at the top of each card on both the public page and admin panel.
- Supports URL input or local file upload; alt text field for accessibility.
- Graceful fallback on broken image (no layout shift).
- DB migrations for `cover_image` and `cover_image_alt` columns (additive, non-destructive).

</details>

<details>
<summary><strong>v4.1.8</strong></summary>

### Legal policy embed fix

- Allows the current Usercentrics embed domains in the production CSP.
- Keeps embedded legal policy scripts executable and ordered when rendered on `/privacy` and `/cookies`.
- Adds a regression test for legal policy provider CSP sources.

</details>

<details>
<summary><strong>v4.1.7</strong></summary>

### CMP and release workflow fix

- Executes custom external CMP scripts reliably, including pasted iubenda widget snippets.
- Publishes Docker images only from release tags to avoid duplicate Docker builds on `main` and `v*`.
- Keeps `latest`, semantic version, and short SHA Docker tags on release builds.

</details>

<details>
<summary><strong>v4.1.6</strong></summary>

### Demo legal policy preset

- Adds a server-side demo preset for Privacy Policy, Cookie Policy, and external CMP.
- Serves the demo legal pages from the requested iubenda embeds when `DEMO_MODE=true`.
- Keeps public footer links on `/privacy` and `/cookies` in demo mode.
- Ensures iubenda embedded policy scripts load reliably in SPA-rendered legal pages.

</details>

<details>
<summary><strong>v4.1.5</strong></summary>

### Privacy hotfix

- Stops demo-mode write protection from being shown as an expired admin session.
- Ensures embedded legal policy scripts execute on `/privacy` and `/cookies`.
- Infers hosted legal pages from existing `/privacy` and `/cookies` profile URLs for upgraded installs.

</details>

<details>
<summary><strong>v4.1.4</strong></summary>

### Privacy and CMP configuration

- Separates legal pages from consent management in the Privacy tab.
- Adds provider-agnostic legal policy sources: external link, hosted text, and embedded code.
- Replaces provider-specific CMP fields with a single external script flow.
- Ensures `/privacy` and `/cookies` always render the latest selected source without stale provider fallback.
- Keeps form edits on screen when the admin session expires during save.

</details>

<details>
<summary><strong>v4.1.3</strong></summary>

### Consent mode

- Ensures Google Consent Mode v2 defaults are set before analytics scripts load.
- Defaults ad storage, analytics storage, user data, and personalization to denied when consent is enabled.
- Avoids duplicate default consent blocks when an advanced provider already supplies one.

</details>

<details>
<summary><strong>v4.1.2</strong></summary>

### Legal policies

- Redesigned the Privacy tab legal policy setup with a guided, non-technical flow.
- Added a footer visibility toggle, configured/missing status, and preview links for `/privacy` and `/cookies`.
- Added a public `/cookies` placeholder page.

</details>

<details>
<summary><strong>v4.1.1</strong></summary>

### Privacy and legal UX

- Moved Privacy Policy and Cookie Policy editing from Profile to Privacy.
- Kept the existing profile-backed fields as the single persistence source.
- Forced the public `/privacy` page to render in a readable light layout.

</details>

<details>
<summary><strong>v4.1.0</strong></summary>

### Legal links

- Made Admin > Profile > Legal links the single editable source for Privacy Policy and Cookie Policy URLs.
- Shows configured legal links in the public footer and hides them cleanly when empty.
- Makes the Privacy & Cookies tab read-only for policy URLs, with an Edit in Profile shortcut.
- Ensures the native cookie banner derives policy URLs from the profile instead of storing duplicate consent-config URLs.

</details>

<details>
<summary><strong>v4.0.0</strong></summary>

### Admin experience

- Redesigned the Admin panel with a clearer dashboard layout, status metrics, sticky centered navigation, and a lighter operational workspace.
- Improved the Links editor with a clearer toolbar, content creation cards, save state visibility, and a more helpful empty state.
- Added animated profile checklist guidance and save confirmation feedback for theme changes.
- Kept the public page preview isolated from the Admin styling so it continues to reflect the saved public theme.

### Loading and compatibility

- Added a single public-page payload endpoint to load profile, links, and theme together and avoid flashes of default content.
- Preserved compatibility with existing SQLite databases through additive migrations only.

</details>

<details>
<summary><strong>v3.8.0</strong></summary>

### Integrations

- Added Google Analytics 4 integration in the Admin panel (new **Integrations** tab).
- The GA4 Measurement ID (`G-XXXXXXXXXX`) is stored in the database and injected as a `gtag.js` script on the public page only — the admin panel is never tracked.
- Content Security Policy updated to allow `googletagmanager.com` and `google-analytics.com` script and connect sources.
- Measurement ID is validated client-side before saving (format `G-XXXXXXXXXX`).

</details>

<details>
<summary><strong>v3.7.0</strong></summary>

### Critical fixes

- Fixed production blank page behavior caused by CORS/CSP headers blocking API calls in production containers.
- Fixed stale frontend assets in Docker builds by cleaning `dist` before building.
- Fixed legacy database migration handling.
- Fixed missing `fs` import in `database.js`.

### Production stability

- Improved production CORS handling for same-origin and reverse-proxy deployments.
- Refined Content Security Policy settings.
- Added static asset serving logs for deployment troubleshooting.
- Improved database migration validation and error handling.

</details>

<details>
<summary><strong>v3.6.0</strong></summary>

- Added live preview inside the admin panel.
- Added a View Public Page action from the admin header.
- Added link visibility toggles.
- Added mobile drag-and-drop ordering.
- Removed sensitive authentication logs.
- Removed unused Supabase and Firebase code.
- Fixed duplicate database migration logic.
- Removed debug logging from `PublicLinkCard`.

</details>

<details>
<summary><strong>v3.5.1</strong></summary>

- Updated vulnerable frontend, backend, and Docker dependencies.
- Resolved Dependabot alerts and Docker image CVEs reported at the time of release.
- Optimized Docker build time by avoiding source builds where precompiled binaries are available.

</details>

<details>
<summary><strong>v3.5.0</strong></summary>

- Added editable profile fields with line-break support in the bio.
- Added social link controls and profile picture display controls.
- Added text cards and bulleted lists.
- Added JSON import/export for links and themes.
- Added theme controls for page styling, typography, title, meta description, and footer text.
- Added Docker startup validation for `JWT_SECRET`.
- Added optional self-signed HTTPS support with `ENABLE_HTTPS=true`.

</details>

## License

MIT License. See [LICENSE.txt](./LICENSE.txt).



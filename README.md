# Lynx

### Your personal links hub

[![Version](https://img.shields.io/badge/version-4.1.2-blue.svg)](https://github.com/paoloronco/Lynx)

**Lynx** is an open-source, self-hosted link page manager: public profile page, admin panel, SQLite storage, theme editor, analytics, and secure admin access in one small app.

## 📌 Contents

- [🎬 Demo](#-demo)
- [✨ Features](#-features)
- [🔐 Security](#-security)
- [🚀 Quick Start](#-quick-start)
- [⚙️ Configuration](#️-configuration)
- [🐳 Docker](#-docker)
- [☁️ Railway](#️-railway)
- [📝 Changelog](#-changelog)
- [📄 License](#-license)

## 🎬 Demo

[![Watch the demo](./docs/demo-public.gif)](https://app.arcade.software/share/avEiscyqITMJJFngqacr)

[![Watch the demo](./docs/demo-admin.gif)](https://app.arcade.software/share/PhdZgUB3JnSnyIFZaQEq)

- 🌐 Public page: [https://lynx-demo.paoloronco.it](https://lynx-demo.paoloronco.it/)
- 🛠 Admin panel: [https://lynx-demo.paoloronco.it/admin](https://lynx-demo.paoloronco.it/admin)
- 👤 Username: `admin`
- 🔑 Password: `ChangeMe123!`

## ✨ Features

- 🎛 **Admin panel**: edit profile, links, theme, password, and reset options from one dashboard.
- 👤 **Public profile**: name, bio, avatar, social links, page title, meta description, favicon, and footer text.
- 🔗 **Flexible cards**: classic links, text cards, bulleted/grouped content, separators, icons, emojis, and images.
- 🎨 **Theme control**: colors, gradients, fonts, spacing, radius, blur, glow, button styles, link styles, and custom CSS.
- 👁 **Live preview**: check the public page while editing.
- 📊 **Analytics**: click tracking with an admin chart.
- 🗓 **Scheduling**: show or hide links by date range.
- 🙈 **Visibility toggles**: hide links without deleting them.
- 📱 **Mobile-friendly editing**: responsive UI and touch drag-and-drop ordering.
- 📦 **Import/export**: backup and restore links and themes as JSON.
- 🗄 **Standalone storage**: SQLite by default, no Firebase or Supabase required.
- 🔒 **Optional HTTPS**: enable a self-signed HTTPS listener with `ENABLE_HTTPS=true`.

## 🔐 Security

- Passwords are hashed with `bcryptjs` using 12 salt rounds.
- Sessions use signed JWTs with a 12-hour expiry.
- The frontend stores JWTs encrypted in `localStorage` with AES-GCM.
- SQLite access uses parameterized queries.
- API, auth, login, reset, and SPA routes are rate-limited.
- Docker startup requires `JWT_SECRET` to avoid unstable sessions after restart.
- Optional `RESET_TOKEN` supports token-protected recovery if you are locked out.

## 🛠 Tech Stack

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwindcss&logoColor=white" />
</p>

## 🚀 Quick Start

Pick the path that matches what you want to do.

<details>
<summary><strong>⚡ Run Lynx locally</strong></summary>

Use this if you want to try Lynx on your machine with a production-style flow: the React app is built first, then the Express server serves both the frontend and the API.

**Requirements**

- Node.js `^20.19.0` or `>=22.12.0`
- npm
- Git

**1. Clone the repository**

```bash
git clone https://github.com/paoloronco/Lynx.git
cd Lynx/LYNX
```

**2. Install dependencies**

```bash
npm ci
npm run install:server
```

**3. Build and start**

```bash
npm run start
```

`npm run start` runs the frontend build and then starts the backend server.

Open:

- 🌐 Public page: [http://localhost:3001](http://localhost:3001)
- 🛠 Admin panel: [http://localhost:3001/admin](http://localhost:3001/admin)
- ❤️ Health check: [http://localhost:3001/health](http://localhost:3001/health)

On the first admin visit, Lynx asks you to create the admin password. The username is always `admin`.

Local data is stored in `LYNX/server/lynx.db` unless you set `DATA_DIR`.

</details>

<details>
<summary><strong>🧑‍💻 Development mode</strong></summary>

Use this when you are editing the code and want frontend hot reload.

Development mode uses two running processes:

- **Backend/API**: Express server on [http://localhost:3001](http://localhost:3001)
- **Frontend**: Vite dev server on [http://localhost:8080](http://localhost:8080)

The Vite server gives you hot reload for React and proxies `/api` requests to the Express server.

**1. Install dependencies once**

```bash
cd Lynx/LYNX
npm ci
npm run install:server
```

**2. Start the backend in the first terminal**

```bash
cd Lynx/LYNX
npm run server:dev
```

**3. Start the frontend in the second terminal**

```bash
cd Lynx/LYNX
npm run dev
```

Keep both terminals open while developing.

Open:

- 🌐 Frontend: [http://localhost:8080](http://localhost:8080)
- 🛠 Admin panel: [http://localhost:8080/admin](http://localhost:8080/admin)
- ❤️ API health check: [http://localhost:3001/health](http://localhost:3001/health)

Stop either process with `Ctrl+C`.

</details>

<details>
<summary><strong>🐳 Quick Docker run</strong></summary>

Use this if you want the fastest container-based setup.

From the repository root:

```bash
docker compose up -d
```

The included `docker-compose.yml` uses:

- image: `paueron/lynx:latest`
- port: `8080`
- volume: `./lynx-data:/app/data`

Before exposing the app, replace the sample `JWT_SECRET` in `docker-compose.yml`.

Open:

- 🌐 Public page: [http://localhost:8080](http://localhost:8080)
- 🛠 Admin panel: [http://localhost:8080/admin](http://localhost:8080/admin)

</details>

## ⚙️ Configuration

<details>
<summary><strong>Environment variables</strong></summary>

| Variable | Default | Notes |
| --- | --- | --- |
| `JWT_SECRET` | random outside Docker | Required in Docker. Use a long random value in production. |
| `NODE_ENV` | unset | Set to `production` for production deployments. |
| `PORT` | `3001` local, `8080` Docker | HTTP server port. |
| `DATA_DIR` | `LYNX/server` local, `/app/data` Docker | Stores `lynx.db` and persistent data. |
| `ENABLE_HTTPS` | `false` | Set to `true` or `1` for self-signed HTTPS. |
| `SSL_PORT` | `8443` | HTTPS port. |
| `FRONTEND_URL` | same-origin mode | Optional dev CORS/CSP origin, e.g. `http://localhost:8080`. |
| `RESET_TOKEN` | unset | Enables token-protected reset endpoints. Use at least 32 characters. |
| `VITE_ENABLE_USERCENTRICS_PRIVACY_PAGE` | `true` | Build-time flag for the optional public `/privacy` Usercentrics embed. Set to `false` to disable. |
| `VITE_USERCENTRICS_PRIVACY_POLICY_ID` | `fd1ffcdf-b560-4ea0-ba72-da943d39d953` | Build-time Usercentrics privacy policy ID used by `/privacy`. |
| `VITE_USERCENTRICS_PRIVACY_POLICY_LANGUAGE` | `en` | Build-time language passed to the Usercentrics privacy policy script. |
| `VITE_DEFAULT_PRIVACY_POLICY_URL` | `/privacy` | Build-time public Privacy Policy URL. Set to an empty string to rely only on Admin > Profile > Legal links. |

</details>

<details>
<summary><strong>💾 Data persistence</strong></summary>

- Local: data is stored in `LYNX/server/lynx.db` unless `DATA_DIR` is set.
- Docker: mount `/app/data` so the database and uploads survive container updates.

</details>

## 🐳 Docker

<details>
<summary><strong>Docker Compose</strong></summary>

From the repository root:

```bash
docker compose up -d
```

The included `docker-compose.yml` uses:

- image: `paueron/lynx:latest`
- port: `8080`
- volume: `./lynx-data:/app/data`

Before exposing the app, replace the sample `JWT_SECRET` in `docker-compose.yml`.

</details>

<details>
<summary><strong>Docker CLI</strong></summary>

```bash
docker pull paueron/lynx:latest

docker run -d --name lynx \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e JWT_SECRET="replace-with-a-long-random-secret" \
  -v lynx_data:/app/data \
  paueron/lynx:latest
```

Open:

- 🌐 Public page: [http://localhost:8080](http://localhost:8080)
- 🛠 Admin panel: [http://localhost:8080/admin](http://localhost:8080/admin)

</details>

<details>
<summary><strong>Optional HTTPS</strong></summary>

```bash
docker run -d --name lynx \
  -p 8080:8080 \
  -p 8443:8443 \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e JWT_SECRET="replace-with-a-long-random-secret" \
  -e ENABLE_HTTPS=true \
  -v lynx_data:/app/data \
  paueron/lynx:latest
```

Then open `https://localhost:8443`. The browser will warn because the certificate is self-signed.

</details>

## ☁️ Railway

<details>
<summary><strong>Deploy on Railway</strong></summary>

Railway can deploy the repository using the root `Dockerfile`.

1. Create a new Railway project from the GitHub repository.
2. Let Railway use the Dockerfile in the repository root.
3. Add:

```bash
NODE_ENV=production
PORT=8080
JWT_SECRET=replace-with-a-long-random-secret
```

4. Deploy the service.
5. Add a public domain from the Railway service settings.

Railway already provides HTTPS at the edge, so `ENABLE_HTTPS` is normally not needed there.

</details>

<details>
<summary><strong>🌍 Other hosting options</strong></summary>

Lynx can run anywhere that supports a Node app or a Docker container: Render, Fly.io, DigitalOcean App Platform, Google Cloud Run, Heroku Container Runtime, Azure App Service, AWS Elastic Beanstalk, Koyeb, Northflank, CapRover, Dokku, and Coolify.

For any container deployment, persist `/app/data` and set `JWT_SECRET`.

</details>

## 📝 Changelog

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

## 📄 License

MIT License. See [LICENSE.txt](./LICENSE.txt).

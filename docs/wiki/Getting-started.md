# Getting Started

This guide is for evaluating OrbitPage locally without Docker. For a complete production-style installation on an existing Debian or Ubuntu server, use the [one-command Linux installer](./Deployment.md#one-command-linux-install).

## What OrbitPage Runs

OrbitPage has two surfaces:

| Surface | Purpose | Authentication |
| --- | --- | --- |
| Public page | The public page visitors see | None |
| Admin panel | The private editor for page content, links, theme, analytics, and settings | Username/password |

The first admin username is `admin`. On a fresh install, OrbitPage asks you to create the first password when you open `/dashboard/profile`. Dashboard sections keep their own URL, so refreshing `/dashboard/links` or `/dashboard/theme` preserves the current workspace area. `/admin` remains a compatibility alias.

## Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- npm
- Git

## Local Production-Style Run

```bash
git clone https://github.com/paoloronco/OrbitPage.git
cd OrbitPage/app
npm ci
npm run install:server
npm run start
```

Open:

- Public page: <http://localhost:3001>
- Admin panel: <http://localhost:3001/dashboard/profile>
- Health check: <http://localhost:3001/health>

`npm run start` builds the Vite frontend and starts the Express server, which serves both the frontend and API.

## Local Data

Without custom configuration, local data is stored under:

```text
app/server/orbitpage.db
app/server/uploads/
```

Set `DATA_DIR` if you want to store data somewhere else.

## Managed Alternative

This guide covers the open-source self-hosted edition. To use OrbitPage without operating a Node.js server, database, storage, backups, or updates, start from <https://orbitpage.com> instead.

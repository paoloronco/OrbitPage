# Getting Started

This guide is for evaluating OrbitPage locally without Docker. For a complete production-style installation on an existing Debian or Ubuntu server, use the [one-command Linux installer](./Deployment.md#one-command-linux-install).

## What OrbitPage Runs

OrbitPage has two surfaces:

| Surface | Purpose | Authentication |
| --- | --- | --- |
| Public page | The public page visitors see | None |
| Admin panel | The private editor for page content, links, theme, analytics, and settings | Username/password |

Before setup, the public URL shows an **Under construction** welcome page. The first admin username is fixed to `admin`. On a fresh install, `/dashboard/profile` first checks the runtime, SQLite database, persistent storage, frontend build, and session security. When all checks pass, choose the admin password and primary public-page slug. OrbitPage then opens the dashboard tutorial. Dashboard sections keep their own URL, so refreshing `/dashboard/links` or `/dashboard/theme` preserves the current workspace area. `/admin` remains a compatibility alias.

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
export JWT_SECRET="$(openssl rand -hex 32)"
export DATA_DIR="$PWD/.orbitpage-data"
npm run start
```

Open:

- Public page: <http://localhost:3001>
- Admin panel: <http://localhost:3001/dashboard/profile>
- Health check: <http://localhost:3001/health>

`npm run start` builds the Vite frontend and starts the Express server, which serves both the frontend and API.

Windows PowerShell equivalent:

```powershell
$env:JWT_SECRET = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()
$env:DATA_DIR = "$PWD\.orbitpage-data"
npm run start
```

## Complete the First Run

1. Open the public URL and confirm the **Under construction** screen appears.
2. Open `/dashboard/profile`.
3. Wait for every dependency row to show a green check. Correct any failed row and use **Run again**.
4. Create the password for the fixed `admin` account.
5. Choose a lowercase slug such as `my-page`.
6. Select **Complete setup** and follow the in-dashboard guide.

No partially configured account is kept if setup fails. Before completion, the placeholder page is noindexed, excluded from analytics, and omitted from `sitemap.xml`.

## Local Data

Without custom configuration, local data is stored under:

```text
app/server/orbitpage.db
app/server/uploads/
```

Set `DATA_DIR` if you want to store data somewhere else.

## Managed Alternative

This guide covers the open-source self-hosted edition. To use OrbitPage without operating a Node.js server, database, storage, backups, or updates, start from <https://orbitpage.com> instead.

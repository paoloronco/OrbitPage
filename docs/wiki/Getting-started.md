# Getting Started

This guide is for evaluating Lynx locally without Docker.

## What Lynx Runs

Lynx has two surfaces:

| Surface | Purpose | Authentication |
| --- | --- | --- |
| Public page | The profile/link page visitors see | None |
| Admin panel | The private editor for profile, links, theme, analytics, and settings | Username/password |

The first admin username is `admin`. On a fresh install, Lynx asks you to create the first password when you open `/admin`.

## Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- npm
- Git

## Local Production-Style Run

```bash
git clone https://github.com/paoloronco/Lynx.git
cd Lynx/LYNX
npm ci
npm run install:server
npm run start
```

Open:

- Public page: <http://localhost:3001>
- Admin panel: <http://localhost:3001/admin>
- Health check: <http://localhost:3001/health>

`npm run start` builds the Vite frontend and starts the Express server, which serves both the frontend and API.

## Local Data

Without custom configuration, local data is stored under:

```text
LYNX/server/lynx.db
LYNX/server/uploads/
```

Set `DATA_DIR` if you want to store data somewhere else.

## Try the Demo First

- Public page: <https://lynx-demo.paoloronco.it/>
- Admin panel: <https://lynx-demo.paoloronco.it/admin>
- Username: `admin`
- Password: `ChangeMe123!`

Do not store private data in the public demo.

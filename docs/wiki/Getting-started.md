# Getting started

Run OrbitPage locally from source with this guide. For Docker, Linux, Proxmox, or a remote server, use [Deployment](./Deployment.md).

## Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- npm and Git

## Start the application

```bash
git clone https://github.com/paoloronco/OrbitPage.git
cd OrbitPage/app
npm ci
npm run install:server
export JWT_SECRET="$(node -p "require('crypto').randomBytes(32).toString('hex')")"
NODE_ENV=production npm run start
```

This builds the frontend and starts the server on port 3001.

| Destination | Local URL |
| --- | --- |
| Public page | <http://localhost:3001> |
| Dashboard and setup | <http://localhost:3001/dashboard/profile> |
| Health check | <http://localhost:3001/health> |

## Browser setup

- Before setup, the public page shows **Under construction** and is excluded from indexing and analytics.
- Open the dashboard. The wizard checks the server, database, storage, frontend, and session configuration.
- Create a password for the first account, `admin`, and confirm the public URL.
- Complete setup to open the editor. See [Dashboard](./dashboard.md) for navigation and saving.

Complete setup locally before allowing remote access. Use an HTTPS reverse proxy for a remote installation; optional host-token protection is described in [Deployment](./Deployment.md#optional-setup-token).

## Data and later starts

The application creates `app/server/orbitpage.db` and `app/server/uploads/`. Set `DATA_DIR` only to choose another location.

Source installations still require `JWT_SECRET`. Save the generated value privately and reuse it on later starts; Docker generates and persists it through its entrypoint. Keep the data directory and secret when updating. See [Configuration](./Configuration.md).

Public URLs have no language prefix, such as `/` and `/menu`. Dashboard URLs include the selected language, such as `/it-IT/dashboard/editor/page`.

To work on the code with live reload, use [Development](./Development.md).

# Development

Use this workflow to change the source code. [Application](./application.md) maps the repository and main files; [Getting started](./Getting-started.md) runs the built application locally.

## Install

Requirements: Node.js `^20.19.0` or `>=22.12.0`, npm, and Git.

```bash
cd OrbitPage/app
npm ci
npm run install:server
```

## Run with live reload

In the backend terminal, generate one development secret and reuse it while working:

```bash
cd OrbitPage/app
export JWT_SECRET="$(node -p "require('crypto').randomBytes(32).toString('hex')")"
export DATA_DIR="$PWD/.orbitpage-data"
NODE_ENV=development npm run server:dev
```

`DATA_DIR` keeps development data separate from an installed instance. The stable secret allows TOTP and encrypted provider settings to survive server restarts.

In another terminal:

```bash
cd OrbitPage/app
npm run dev
```

| Service | URL |
| --- | --- |
| Frontend | <http://localhost:8080> |
| Dashboard | <http://localhost:8080/dashboard/profile> |
| Express health | <http://localhost:3001/health> |

Vite proxies API requests to Express. Keep the frontend and backend running together.

## Checks

Run from `app/`:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e:chromium
```

- `test:unit` runs frontend and server tests.
- From `app/server/`, `npm test -- --run` runs server tests only.
- `test:e2e` is the Chromium suite; `test:e2e:firefox` and `test:e2e:webkit` select other engines.
- `test:e2e:ci` runs all three engines. Browser tests use isolated data, not the developer database.

Repository checks run from the repository root:

```bash
node scripts/check-markdown-links.mjs
node scripts/check-tracked-runtime-data.mjs
```

Installer and updater checks are listed in [Scripts](../../scripts/README.md). Do not test host-changing installers against a real instance.

## Make a change

1. Read the owning module and trace its callers.
2. Reuse shared page schemas and API/permission helpers.
3. Keep SQLite migrations compatible with existing data.
4. Add a focused test for changed behavior and update its guide.
5. Run the checks relevant to the change.

Build output, runtime data, logs, secrets, and E2E reports are ignored and must stay uncommitted. See [Contributing](../../CONTRIBUTING.md) for commit conventions and [GitHub automation](./github-automation.md) for releases and mirror settings.

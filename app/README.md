# OrbitPage application

`app/` contains the self-hosted OrbitPage frontend, backend, shared page schema, and browser tests.

## Layout

```text
src/                  React and TypeScript frontend
server/               Express API and SQLite persistence
packages/page-schema/ Shared page, theme, menu, and block schemas
e2e/                  Playwright browser tests
public/               Static and canonical brand assets copied into the build
src/hosted-entry.tsx   Shared editor entry consumed by the managed adapter
scripts/              App-local development and test helpers
dist/                 Generated production build; never commit it
```

The root [Dockerfile](../Dockerfile) is the canonical container build.
[app/Dockerfile](./Dockerfile) retains the application-directory build context
for compatible source deployments; it is exercised by deployment contract tests. See the repository [documentation index](../docs/README.md) for installation and operations.

## Install

Run commands from this directory:

```bash
npm ci
npm run install:server
```

Node.js `^20.19.0` or `>=22.12.0` is required.

The [Tailwind 4 toolchain](https://tailwindcss.com/docs/upgrade-guide#browser-requirements) targets Safari 16.4+, Chrome 111+ and Firefox 128+.
Keep vendor-prefixed CSS declarations before their standard declaration so
optimization retains the standard property in the public and hosted builds.

## Development

Start the API and frontend in separate terminals:

```bash
npm run server:dev
npm run dev
```

- Frontend: <http://localhost:8080>
- Dashboard: <http://localhost:8080/dashboard/profile>
- API and health check: <http://localhost:3001>

For a production-style local run, set a stable `JWT_SECRET` and an isolated `DATA_DIR`, then run `npm run start`.

## Checks

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e:chromium
```

`npm run test:e2e` is the Chromium suite. Firefox and WebKit have explicit scripts, and `npm run test:e2e:ci` runs all three engines.

## Boundaries

- Frontend API calls belong in `src/lib/api-client.ts` or compatible domain modules exported through that boundary.
- Public page data must conform to `packages/page-schema`.
- Personal API tokens use the bundled Express application API; see the
  [API contract](../docs/wiki/api.md). The managed versioned API is a separate service.
- `npm run build:hosted` builds the hosted-mode frontend;
  `npm run build:hosted-library` exports the shared editor consumed by SaaS.
  Hosted billing, tenant management and managed storage belong to the private adapter.
- Runtime databases, uploads, E2E state, build output, reports, and logs are ignored and must not be committed.

Read [server/README.md](./server/README.md) before backend or database work and [packages/README.md](./packages/README.md) before changing shared schemas.

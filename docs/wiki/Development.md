# Development

This page describes the local development workflow for Lynx.

## Repository Layout

```text
LYNX/
  src/           React frontend
  server/        Express backend
  public/        Static public files
  dist/          Generated frontend build
```

Important files:

- `LYNX/src/pages/Index.tsx`: public profile page
- `LYNX/src/pages/Admin.tsx`: admin shell
- `LYNX/src/lib/api-client.ts`: frontend API client and token storage
- `LYNX/src/lib/theme.ts`: theme configuration and CSS variable application
- `LYNX/server/server.js`: Express app and API routes
- `LYNX/server/database.js`: SQLite helpers and migrations
- `LYNX/server/auth.js`: authentication, JWTs, password helpers, permissions

## Install Dependencies

```bash
cd LYNX
npm ci
npm run install:server
```

## Run in Development

Terminal 1:

```bash
cd LYNX
npm run server:dev
```

Terminal 2:

```bash
cd LYNX
npm run dev
```

Open:

- Frontend: <http://localhost:8080>
- Admin panel: <http://localhost:8080/admin>
- Backend health check: <http://localhost:3001/health>

## Run Production-Style Locally

```bash
cd LYNX
npm run start
```

This builds the frontend and starts the backend server.

## Checks

```bash
cd LYNX
npm run lint
npm run test:unit
npm run build
```

E2E:

```bash
npm run test:e2e
```

All frontend commands should be run from `LYNX/`. Backend-only commands should be run from `LYNX/server/`.

## Database Notes

Lynx uses SQLite. Local data defaults to:

```text
LYNX/server/lynx.db
LYNX/server/uploads/
```

Schema migrations are additive and run on startup. Avoid destructive migrations unless there is a clear migration path and backup guidance.

## Commit Format

```text
type(scope): description
```

Examples:

```bash
feat(links): add card scheduling
fix(auth): handle expired session state
docs(wiki): add deployment guide
ci(docker): publish ghcr image
```

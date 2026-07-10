# Development

This page describes the local development workflow for OrbitPage.

## Repository Layout

```text
app/
  src/           React frontend
  server/        Express backend
  public/        Static public files
  dist/          Generated frontend build
```

Important files:

- `app/src/pages/Index.tsx`: public page
- `app/src/pages/Admin.tsx`: admin shell
- `app/src/lib/api-client.ts`: frontend API client and token storage
- `app/src/lib/theme.ts`: theme configuration and CSS variable application
- `app/server/server.js`: Express app and API routes
- `app/server/database.js`: SQLite helpers and migrations
- `app/server/auth.js`: authentication, JWTs, password helpers, permissions

## Install Dependencies

```bash
cd OrbitPage
npm ci
npm run install:server
```

## Run in Development

Terminal 1:

```bash
cd OrbitPage
npm run server:dev
```

Terminal 2:

```bash
cd OrbitPage
npm run dev
```

Open:

- Frontend: <http://localhost:8080>
- Admin panel: <http://localhost:8080/admin>
- Backend health check: <http://localhost:3001/health>

## Run Production-Style Locally

```bash
cd OrbitPage
npm run start
```

This builds the frontend and starts the backend server.

## Checks

```bash
cd OrbitPage
npm run lint
npm run test:unit
npm run build
```

E2E:

```bash
npm run test:e2e
```

All frontend commands should be run from `app/`. Backend-only commands should be run from `app/server/`.

## Database Notes

OrbitPage uses SQLite. Local data defaults to:

```text
app/server/orbitpage.db
app/server/uploads/
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

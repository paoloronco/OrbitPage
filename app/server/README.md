# OrbitPage server

This directory contains the Express backend used by the bundled self-hosted dashboard and public page.

## Main modules

- `server.js`: application bootstrap, middleware, public routes, and internal dashboard API routes.
- `database.js`: SQLite connection, additive migrations, and database helpers.
- `auth.js`: password hashing, JWT creation, and permission checks.
- `schemas/`: request validation schemas.
- `services/`: AI planning, backup, media, upload, and two-factor services.
- `*.test.js` and `services/*.test.js`: Vitest backend coverage.

The server is currently a modularizing monolith. New independent behavior should normally enter a schema or service first; extract routes incrementally without changing their paths or middleware order.

## Runtime data

`DATA_DIR` contains everything that must survive a restart:

```text
orbitpage.db
uploads/
```

Local development falls back to this directory only when `DATA_DIR` is not set. Prefer an isolated directory such as `app/.orbitpage-data` for development and tests.

Never commit SQLite databases, backups, WAL/SHM sidecars, uploaded files, logs, tokens, or real user content. Back up the database and uploads together.

## Run and test

From `app/`:

```bash
npm run install:server
npm run server:dev
npm run test:unit
```

From this directory, `npm test -- --run` runs only backend tests.

## Compatibility and security

- Keep migrations additive and safe for existing installations.
- Use parameterized queries and the existing validation and permission helpers.
- Keep authentication, setup, reset, AI, upload, restore, and destructive routes rate-limited and fail-closed.
- Keep `JWT_SECRET` stable in production. It signs sessions and protects encrypted server-side secrets.
- The frontend sends the session token in the `Authorization` header. The internal API is not a stable external SDK contract.
- Uploaded media is public when referenced by the public page; do not store private documents under `uploads/`.

The complete runtime-variable reference is in [Configuration](../../docs/wiki/Configuration.md), and the supported security model is in [SECURITY.md](../../SECURITY.md).

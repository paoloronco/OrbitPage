# OrbitPage contributor guidance

This repository contains the open-source, self-hosted OrbitPage application. Keep changes useful to self-hosted users and do not add hosted-only billing, tenant, moderation, managed-storage, or platform-control-plane concerns here.

## Repository map

- `app/src/`: React and TypeScript frontend, including the public page and dashboard.
- `app/server/`: Express API, authentication, SQLite persistence, uploads, and server tests.
- `app/packages/page-schema/`: shared page and block schemas used at application boundaries.
- `app/e2e/`: Playwright browser coverage.
- `docs/`: user, operations, API-boundary, and contributor documentation.
- `scripts/`: repository, installer, and update helpers.
- Root Docker and Compose files are the canonical production container configuration.

Read the nearest README before working in a major directory.

## Commands

Run application commands from `app/`:

```bash
npm ci
npm run install:server
npm run lint
npm run test:unit
npm run build
npm run test:e2e:chromium
```

Use the smallest relevant check while iterating, then run checks proportional to the change. Docker and installer changes also require their dedicated repository tests.

## Engineering rules

- Preserve backward compatibility for existing SQLite data, page schemas, public URLs, and documented route aliases.
- Keep database migrations additive unless a documented migration and rollback path exists.
- Validate untrusted input on the server even when the frontend validates it too.
- Reuse the shared page schema instead of creating parallel block or theme contracts.
- Keep public navigation as real links where possible and preserve keyboard, responsive, and reduced-motion behavior.
- Do not treat the self-hosted dashboard API as a stable external automation API.
- Avoid broad rewrites of large files. Extract one domain at a time and keep existing exports or routes compatible.

## Data and secrets

Never commit databases, database backups or sidecars, uploads, logs, environment files, tokens, provider keys, or real user content. Local and production data belongs under `DATA_DIR`; Docker deployments persist `/app/data`.

When tests need SQLite data, create isolated fixtures under ignored E2E or temporary directories. Never reuse a developer or production database.

## Documentation

- `README.md` is the concise product overview and quick start.
- `docs/README.md` is the task-oriented documentation index.
- `SECURITY.md` is authoritative for vulnerability reporting and the supported security model.
- `CONTRIBUTING.md` is authoritative for contribution workflow and checks.

Update documentation whenever a route, environment variable, setup command, public behavior, or security boundary changes. Prefer one canonical explanation and link to it instead of copying long operational sections between files.

## Releases

Normal `main` commits run CI but do not publish images or GitHub releases.
Maintainers release only from an exact `vX.Y.Z` tag matching both application
package versions after all four main CI checks are green. Do not create tags,
move existing version tags, or publish artifacts unless the task explicitly
authorizes a release.

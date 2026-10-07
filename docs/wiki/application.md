# Application

Technical reference for the self-hosted source code. For the system boundaries, see [Architecture](./architecture.md); for daily coding commands, see [Development](./Development.md).

## Stack and request flow

| Component | Implementation |
| --- | --- |
| Frontend | React, TypeScript, React Router, Vite, Tailwind, and shared UI components |
| Server | Node.js and Express |
| Data | SQLite plus local uploaded files |
| Validation | Zod request schemas and `@orbitpage/page-schema` |
| Authentication | bcrypt passwords, JWT sessions, TOTP, and scoped personal API tokens |
| Tests | Vitest for frontend/server tests; Playwright for browsers |

```text
Browser
  â†’ Express
    â†’ public HTML, frontend assets, and uploaded media
    â†’ /api routes â†’ validation and permissions â†’ services â†’ SQLite
```

In development, Vite serves the frontend on port 8080 and proxies `/api` to Express on port 3001. In a source production run, Express serves the built frontend and API on port 3001 unless `PORT` is set; the source quick start configures port 8080 in `app/.env`. Docker uses port 8080.

The dashboard loads saved data through the API and keeps edits in browser state until Save. The server checks permissions and input before writing. Public routes filter unpublished and unavailable content and generate metadata from saved data. See [API](./api.md) for authentication and route compatibility.

## Repository layout

```text
app/
  src/                  Frontend components, pages, clients, and styles
  server/               Express routes, SQLite, services, and server tests
  packages/page-schema/ Shared schemas and normalization
  public/               Static assets and brand files
  e2e/                  Playwright tests
  scripts/              Frontend build/test helpers
  dist/                 Generated self-hosted frontend
docs/wiki/              User and technical guides
scripts/                Install/update helpers and repository checks
.github/workflows/      CI, releases, and mirror synchronization
Dockerfile              Production image built from repository root
docker-compose.yml      Local container definition
install.sh              Linux installer and management command
install-pve.sh          Proxmox guest installer
```

## Main files

| File or directory | Responsibility |
| --- | --- |
| [src/App.tsx](../../app/src/App.tsx) | Frontend routes and page loading |
| [src/pages/Index.tsx](../../app/src/pages/Index.tsx) | Public page |
| [src/pages/Admin.tsx](../../app/src/pages/Admin.tsx) | Dashboard state, navigation, and loading |
| [src/components/AdminView.tsx](../../app/src/components/AdminView.tsx) | Dashboard workspaces and permissions in the UI |
| [src/components/VisualSiteEditor.tsx](../../app/src/components/VisualSiteEditor.tsx) | Editor sections and responsive preview |
| [src/lib/admin-navigation.ts](../../app/src/lib/admin-navigation.ts) | Dashboard paths, tabs, and aliases |
| [src/lib/editor-integration.ts](../../app/src/lib/editor-integration.ts) | Callbacks for embedding the editor in another application |
| [src/lib/api-client.ts](../../app/src/lib/api-client.ts) | API requests and browser session handling |
| [src/lib/theme.ts](../../app/src/lib/theme.ts) | Theme values and CSS application |
| [server/server.js](../../app/server/server.js) | Startup, middleware, public routes, and application API |
| [server/database.js](../../app/server/database.js) | SQLite connection, helpers, transactions, and migrations |
| [server/auth.js](../../app/server/auth.js) | Passwords, sessions, tokens, and role permissions |
| [server/schemas/](../../app/server/schemas) | Request validation |
| [server/services/](../../app/server/services) | Backups, media, newsletter, AI, security, and instance settings |
| [packages/page-schema/](../../app/packages/page-schema) | Shared profile, block, menu, page, and theme structures |
| [vite.config.ts](../../app/vite.config.ts) | Frontend proxy, aliases, chunks, and asset filenames |

Keep a feature's validation and server logic in its existing schema or service. Reuse the API client and shared schema; do not add a second set of page types or validation rules. More detail: [Server](../../app/server/README.md), [Shared packages](../../app/packages/README.md).

## Data and startup

`DATA_DIR` defaults to `app/server` from source and `/app/data` in Docker. It holds SQLite, uploads, local version history, and saved instance environment overrides. Migrations run at startup and must preserve existing data.

The Docker entrypoint creates and reuses `DATA_DIR/.jwt-secret` when `JWT_SECRET` is absent. The source server requires a configured stable secret outside development/test mode. Development/test fallback secrets are temporary and do not support persistent encrypted settings reliably.

Environment overrides load before other server settings. Backend variables apply at startup; frontend `VITE_*` values apply during the build. See [Configuration](./Configuration.md).

Do not commit runtime data, secrets, generated builds, test state, or logs. Tests must use isolated data directories.

## Builds and Docker

Run from `app/`:

| Command | Output |
| --- | --- |
| `npm run build` | Self-hosted frontend in `dist/` |
| `npm run start` | Build, then start Express |

Self-hosted assets have content hashes. Vite builds with relative asset URLs; Express adapts the entry HTML to the configured `BASE_PATH`. Generated output is rebuilt, never edited by hand.

The root [Dockerfile](../../Dockerfile) builds the frontend and packages the server. [app/Dockerfile](../../app/Dockerfile) supports the application-directory build context. Both entrypoints initialize the same persistent secret. The image defaults to `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=8080`, and `DATA_DIR=/app/data`.

Container ports, data mounts, restart policy, and security options belong to Docker Run or Compose. See [Deployment](./Deployment.md) for commands and [GitHub automation](./github-automation.md) for release publication.

## Development and checks

```bash
cd OrbitPage/app
npm ci
npm run install:server
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e:chromium
```

[Development](./Development.md) explains the two-server workflow and test isolation. [Contributing](../../CONTRIBUTING.md) covers code changes and releases; [AGENTS.md](../../AGENTS.md) contains repository instructions.

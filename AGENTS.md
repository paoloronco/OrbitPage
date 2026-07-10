# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Repository layout

The repo root contains Docker/CI configuration. All application code lives under `app/`:

```
app/
  src/           # React frontend (Vite + TypeScript)
  server/        # Express backend (ESM, Node 20)
  dist/          # Built frontend (generated; served by backend in production)
  public/        # Static assets copied verbatim into dist/
```

All frontend commands must be run from `app/`; all backend commands from `app/server/`.

## Development commands

### Frontend (run from `app/`)
```bash
npm install          # install frontend deps
npm run dev          # Vite dev server at http://localhost:5173
npm run build        # production build into app/dist/
npm run lint         # ESLint
```

### Backend (run from `app/server/`)
```bash
npm install          # install backend deps
npm run dev          # node --watch server.js (auto-restarts) on port 3001
npm run start        # production: node server.js
npm test             # vitest (server.test.js)
```

### Full production start (from `app/`)
```bash
npm run start        # builds frontend then starts backend
```

### Docker
```bash
# Build from repo root
docker build -t orbitpage .
docker run -p 3001:8080 -e JWT_SECRET=<secret> orbitpage
```
The entrypoint (`docker-entrypoint.sh`) aborts if `JWT_SECRET` is not set.

## Architecture

### Frontend (`app/src/`)
- **`pages/Index.tsx`** — public page (read-only, no auth required)
- **`pages/Admin.tsx`** — admin shell; checks auth/setup status, renders `InitialSetup`, `LoginForm`, or `AdminView`
- **`lib/api-client.ts`** — single file for all API calls; JWT token is stored AES-GCM-encrypted in localStorage via Web Crypto (falls back to sessionStorage on plain HTTP)
- **`lib/auth.ts`** — client-side auth helpers (token cache, `isFirstTimeSetup`)
- **`lib/theme.ts`** — `ThemeConfig` interface, `defaultTheme`, `applyTheme()` (writes CSS variables to `:root`)
- **`components/AdminView.tsx`** — tabbed admin UI (links, profile, theme, analytics, password)
- **`components/LinkManager.tsx`** — CRUD for links; handles all link types
- **`components/ThemeCustomizer.tsx`** — live theme editor backed by `themeApi`
- **`components/ui/`** — shadcn/ui components (do not edit directly)

### Backend (`app/server/`)
- **`server.js`** — Express app; exports `app` for tests; all API routes are under `/api`; serves the built frontend SPA for non-API routes
- **`database.js`** — SQLite via `sqlite3`; exports promise wrappers `dbGet`, `dbAll`, `dbRun`, `withTransaction`; runs best-effort `ALTER TABLE` migrations on startup
- **`auth.js`** — JWT (12h expiry) + bcryptjs; `authenticateToken` middleware; single admin user (username always `admin`)

### Database schema (SQLite, `app/server/orbitpage.db`)
Four tables: `admin_users`, `profile_data`, `links`, `theme_config`. Schema migrations are additive `ALTER TABLE ... ADD COLUMN` calls that run on every startup (errors ignored when column already exists).

### Data flow
- In **development**: frontend on `:5173` talks to backend on `:3001` via `FRONTEND_URL` CORS setting
- In **production/Docker**: backend on `:3001` serves `app/dist/` as static files; frontend and API are same-origin (`/api/*`)
- Frontend uses `API_BASE = '/api'` — no hardcoded ports

### Environment variables (backend)
| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3001` | HTTP port |
| `JWT_SECRET` | random (warn) | **Required in production** |
| `DATA_DIR` | `__dirname` | Where `orbitpage.db` and `uploads/` live (set to `/app/data` in Docker) |
| `FRONTEND_URL` | `http://localhost:3001` | CORS origin in dev; unset = production mode |
| `DEMO_MODE` | `false` | Disables destructive mutations |
| `ENABLE_HTTPS` | `false` | Self-signed TLS on `SSL_PORT` |

### Environment variables (frontend, Vite)
| Variable | Notes |
|---|---|
| `VITE_DEMO_MODE` | Exposes demo mode to the UI |

## Key conventions

- **Link types**: a `links` row has a `type` column (`'link'`, `'text'`, `'separator'`). Each type has a paired public component (`PublicLinkCard`, `PublicTextCard`, `PublicSeparatorCard`) and an admin editing component.
- **Theme**: stored as JSON in `theme_config.full_config`; applied by writing CSS custom properties to `:root` via `applyTheme()`. Components use Tailwind tokens that resolve to those variables.
- **File uploads**: multer writes to `DATA_DIR/uploads/`; served at `/uploads/`.
- **Versioning**: `APP_VERSION` is read from `server/package.json` at runtime; both `package.json` files must be kept in sync.
- **Commit format**: `type(scope): description` — types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

## CI/CD
Push to `main` triggers `.github/workflows/google-cloudrun-source.yml`, which builds via Cloud Build and deploys to Cloud Run. Requires GitHub secrets `WIF_PROVIDER` and `WIF_SERVICE_ACCOUNT` and vars `PROJECT_ID`, `REGION`, `SERVICE`.

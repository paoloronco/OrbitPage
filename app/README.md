# OrbitPage application

This directory contains the complete open-source, self-hosted OrbitPage application: the public page, visual dashboard, HTTP API, SQLite persistence, shared content contracts and automated tests. One Express process serves the built frontend and API; a persistent data directory holds the installation's content.

Use this README to understand the code and find the right place to make a change. For installing a server, start with the repository [quick start](../README.md#quick-start) or [deployment guide](../docs/wiki/administration/Deployment.md). Product expectations are defined in [Product requirements](../docs/wiki/development/product-requirements.md).

## Contents

- [Architecture and request flow](#architecture-and-request-flow)
- [Directory map](#directory-map)
- [Frontend code](#frontend-code)
- [Backend code](#backend-code)
- [Shared packages](#shared-packages)
- [Dependencies and configuration files](#dependencies-and-configuration-files)
- [Local setup and development](#local-setup-and-development)
- [Commands](#commands)
- [Data and environment](#data-and-environment)
- [Tests and scripts](#tests-and-scripts)
- [Builds and Docker](#builds-and-docker)
- [Where to make changes](#where-to-make-changes)

## Architecture and request flow

```text
Browser
  -> React routes, dashboard and public renderer
  -> same-origin /api requests
  -> Express authentication, permissions and request validation
  -> domain services and SQLite helpers
  -> DATA_DIR: database, public media and private Shop files

Production:  Express serves dist/, public routes, uploads and /api
Development: Vite serves the frontend; /api is proxied to Express
```

The dashboard loads the current content, keeps editing state in React and sends changes through the API client. Server-side permissions and validation remain authoritative. Public routes select visible content and generate metadata; the renderer displays that content. Preview uses the shared rendering components so its appearance follows the same rules as the public page.

The application is a modular monolith. Some routes remain in `server/server.js`; larger domains have separate routers and services. SQLite is the self-hosted source of truth. Run one application replica per persistent data directory.

The editor and portable modules can also be embedded by another application through [editor-integration.ts](./src/lib/editor-integration.ts) and [editor-capabilities.ts](./src/lib/editor-capabilities.ts). Those contracts provide request, authentication, navigation and capability hooks. Hosted accounts, billing, tenancy and managed storage belong to the consuming service; the hosted adapter does not use this SQLite backend. See [Architecture](../docs/wiki/development/architecture.md) for the ownership boundary.

## Directory map

```text
app/
  src/
    main.tsx, App.tsx       Browser entry point, providers and routes
    pages/                 Route-level public and dashboard screens
    components/            Editors, workspaces and public renderers
      ui/                  Reusable interface primitives
    lib/                   API client, models, routing and feature helpers
      translations/        Additional dashboard language catalogs
    hooks/                 Shared React hooks
    config/                Frontend configuration such as legal defaults
    index.css              Global styles and dashboard design tokens
  server/
    server.js              Express startup, middleware and main routes
    auth.js                Authentication and role permissions
    database.js            SQLite connection, migrations and transactions
    routes/                Extracted Shop, newsletter and consent routers
    schemas/               Server request validators
    services/              Domain logic and local integrations
  packages/
    page-schema/           Local TypeScript content-schema package
    shop/                  Shared JavaScript commerce modules and types
    analytics.js           Shared attribution rules
    map-location.js        Shared map location and URL parsing
    map-preview.js         Map previews and bounded short-link resolution
  public/                  Static assets, including brand files
  e2e/                     Playwright tests, helpers and local API fixtures
  scripts/                 Helpers invoked by this app's npm commands
  index.html               Vite HTML entry template
  package.json             Frontend dependencies and app-level commands
  package-lock.json        Locked frontend dependency graph
```

`dist/`, `node_modules/`, `e2e-data/`, `playwright-report/` and `test-results/` are generated or local directories. They are not source code. The repository's separate [`../scripts/`](../scripts/README.md) directory owns host updates and repository checks; its files are different from `app/scripts/`.

## Frontend code

The frontend uses React and TypeScript, built by Vite with the SWC React plugin. The `@/` import alias resolves to `src/`.

| Area | Start here | Responsibility |
| --- | --- | --- |
| Bootstrap and routing | [main.tsx](./src/main.tsx), [App.tsx](./src/App.tsx) | Mount React, install query/i18n/UI providers, load route components and handle routing errors. |
| Public page | [pages/Index.tsx](./src/pages/Index.tsx), [PublicView.tsx](./src/components/PublicView.tsx), [PublicBlockRenderer.tsx](./src/components/PublicBlockRenderer.tsx) | Load and render the profile, content blocks and public layout. `Public*Card` components implement individual block presentations. |
| Dashboard | [pages/Admin.tsx](./src/pages/Admin.tsx), [AdminView.tsx](./src/components/AdminView.tsx) | Coordinate authentication, editor state, sections and allowed actions. |
| Editing and preview | [VisualSiteEditor.tsx](./src/components/VisualSiteEditor.tsx), [LivePreview.tsx](./src/components/LivePreview.tsx), [LinkManager.tsx](./src/components/LinkManager.tsx) | Edit content and layout and show the resulting page before saving. |
| Menu, pages and theme | [MenuEditor.tsx](./src/components/MenuEditor.tsx), [SubpageManager.tsx](./src/components/SubpageManager.tsx), [ThemeCustomizer.tsx](./src/components/ThemeCustomizer.tsx) | Domain-specific editing controls; public output uses the matching renderer and theme model. |
| Shop and newsletter | [SelfHostedShop.tsx](./src/components/SelfHostedShop.tsx), [NewsletterWorkspace.tsx](./src/components/NewsletterWorkspace.tsx) | Connect reusable workspaces to self-hosted API operations. Shared Shop controls and customer screens live beside them. |
| API and session | [api-client.ts](./src/lib/api-client.ts) | Typed requests, session-token handling, same-origin credential checks and embedded-editor request integration. |
| URLs and navigation | [admin-navigation.ts](./src/lib/admin-navigation.ts), [public-routing.ts](./src/lib/public-routing.ts), [base-path.ts](./src/lib/base-path.ts) | Dashboard tabs and aliases, public paths and deployment mount prefixes. |
| Appearance and language | [theme.ts](./src/lib/theme.ts), [index.css](./src/index.css), [i18n.tsx](./src/lib/i18n.tsx) | Public theme application, dashboard tokens and localization. English/Italian copy is supplied in code; additional catalogs load from `lib/translations/`. |

Use [components/ui](./src/components/ui) for existing buttons, fields, dialogs, tabs, colors and feedback. The codebase combines Radix-based primitives, Material UI and its own components. Follow the [design system](../docs/wiki/development/design-system.md), including keyboard interaction, focus, responsive layouts and reduced motion. Dashboard language changes must not rewrite saved content or add language prefixes to public URLs.

## Backend code

The backend is JavaScript using native ES modules. It has its own [package.json](./server/package.json), lockfile and dependency installation; installing dependencies in `app/` alone does not install the server.

| Module | Responsibility |
| --- | --- |
| [server.js](./server/server.js) | Compose middleware and routes, serve built assets and public HTML, enforce request limits, and start listeners and background work. |
| [auth.js](./server/auth.js) | Password hashing, JWT sessions, role permissions and personal API tokens. |
| [database.js](./server/database.js) | Open SQLite, initialize/migrate tables and expose parameterized query and transaction helpers. |
| [schemas/](./server/schemas) | Validate incoming authentication, link, menu and consent payloads. Browser validation does not replace these checks. |
| [routes/](./server/routes) | Shop, newsletter and consent HTTP adapters. Most other API families still live in `server.js`. |
| [services/](./server/services) | AI planning, uploads, media cleanup, backups, version history, audit logs, TOTP, consent, instance settings, updates and commerce. |
| [services/shop.js](./server/services/shop.js), [shop-lifecycle.js](./server/services/shop-lifecycle.js) | Self-hosted Stripe integration, order lifecycle, private delivery and scheduled Shop work. |
| [services/newsletter.js](./server/services/newsletter.js) | Owner SMTP settings, audience/campaign operations and email dispatch. |
| [services/instance-details.js](./server/services/instance-details.js) | Resolve local paths and load supported saved environment overrides before startup settings are read. |

Preserve middleware order: Stripe webhook verification needs the raw request body and is mounted before ordinary JSON parsing. Keep permission checks, upload validation and transaction boundaries on the server. The dashboard's bundled `/api` evolves with the application; it is not an independently versioned external SDK. See [Server](./server/README.md) and [API](../docs/wiki/development/api.md) for detailed contracts.

## Shared packages

`packages/` holds portable code reused across application boundaries. It is not an npm-workspaces monorepo: `app/` and `app/server/` have separate installations, and only `page-schema/` has its own package manifest here. Other shared modules are imported directly by relative path.

| Package or module | What it owns | How it is consumed |
| --- | --- | --- |
| [page-schema/](./packages/page-schema) | Canonical profile, block, theme, menu, consent, subpage and discovery types, parsers, normalization and defaults. | `@orbitpage/page-schema` is a private local `file:packages/page-schema` dependency. Its export points to TypeScript source, which the frontend toolchain consumes. |
| [shop/](./packages/shop/README.md) | Product/appearance validation, Checkout payment binding, order labels, descriptions, policies, public rendering, file rules, email templates and Stripe helper operations. | Plain ESM `.js` modules with `.d.ts` declarations; used by UI and server adapters as appropriate. The consuming server supplies credentials, authorization and persistence. |
| [analytics.js](./packages/analytics.js) | Consistent AI referrer and UTM attribution conditions. | Shared reporting helper; it does not collect prompts or infer untagged AI visits. |
| [map-location.js](./packages/map-location.js), [map-preview.js](./packages/map-preview.js) | Location parsing, preview URLs and bounded resolution of supported map short links. | Shared renderer/server helpers with type declarations; server requests use provider allowlisting, redirect checks and timeouts. |

The page-schema package uses its own Zod dependency. The frontend application and backend currently also declare Zod separately; their installed versions are not interchangeable by assumption. In particular, shared Shop schema factories accept the consuming adapter's Zod. The Express server keeps its request validators in `server/schemas/`; do not assume it imports every TypeScript page parser directly.

Keep public content structures portable and backward compatible. A schema change can affect editor state, public rendering, backend validation, saved data and embedding adapters. Check each consumer and update normalization or migration tests when a supported old shape changes. See the [shared-package guide](./packages/README.md).

## Dependencies and configuration files

The manifests describe supported ranges; their lockfiles pin the installed dependency graphs. Use the existing libraries and UI components before adding another dependency.

| Layer | Main dependencies and purpose |
| --- | --- |
| Browser application | React/React DOM for UI, React Router for navigation, TanStack Query for query state, Zod for validation. |
| Interface and presentation | Radix UI, Material UI/Emotion, Tailwind, Lucide/React Icons, Recharts, `react-colorful`, QR generation and JSZip. |
| HTTP and security | Express, CORS, Helmet, rate limiting, bcrypt, JWT and OTPAuth. |
| Persistence and integrations | SQLite, Multer uploads, Nodemailer SMTP and the Stripe SDK. External integrations are optional product features. |
| Development and verification | Vite/SWC, TypeScript, ESLint, Vitest, Supertest and Playwright. |

| File | What it controls |
| --- | --- |
| [vite.config.ts](./vite.config.ts) | Development proxy, `@/` alias, build-time application version, vendor chunks and hashed output names. |
| [tsconfig.app.json](./tsconfig.app.json), [tsconfig.node.json](./tsconfig.node.json) | Frontend typechecking and Vite configuration types. `typecheck` runs the application config. |
| [eslint.config.js](./eslint.config.js) | Lint rules, React hooks checks and generated-output exclusions. |
| [tailwind.config.ts](./tailwind.config.ts), [postcss.config.js](./postcss.config.js), [components.json](./components.json) | Styling configuration, the Tailwind PostCSS plugin and shadcn component aliases. |
| [vitest.config.ts](./vitest.config.ts), [server/vitest.config.ts](./server/vitest.config.ts) | Separate frontend-helper and backend test discovery. |
| [playwright.config.ts](./playwright.config.ts) | Browser projects, test servers, isolated data directory and reports. |
| [.env.example](./.env.example) | Documented starting values for source deployments and optional build settings. |

## Local setup and development

Use Node.js accepted by the `engines` fields in both manifests, plus npm and Git. Docker is needed for container checks. From a repository clone:

```bash
cd OrbitPage/app
npm ci
npm --prefix server ci
```

There are two lockfiles because the browser/build toolchain and backend install separately. `npm run install:server` is the convenience command using `npm install` in `server/`; use `npm --prefix server ci` when reproducing its checked-in lockfile exactly.

For live development, configure a stable `JWT_SECRET`, an isolated `DATA_DIR`, `NODE_ENV=development` and backend port `3001`. The [development workflow](../docs/wiki/development/Development.md#run-with-live-reload) provides shell commands. Then run these in separate terminals from `app/`, with the backend variables already set:

```bash
# Terminal 1: Express with Node's watch mode
npm run server:dev
```

```bash
# Terminal 2: Vite
npm run dev
```

Vite defaults to port `8080` and proxies `/api` to `http://localhost:3001`. The backend defaults to `HOST=127.0.0.1`. For a local-only frontend listener, use `npm run dev -- --host 127.0.0.1`.

For the complete production-style source setup, including creating a private `.env` and generating the secret, follow [Run from source](../README.md#run-from-source). Start the backend from `app/server/` with `node --env-file=../.env server.js` when using that file. The `server`, `server:dev` and `start` npm commands do **not** load `app/.env` into Express automatically.

## Commands

Run these from `app/`. The authoritative definitions are in [package.json](./package.json).

| Command | Effect |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run server:dev` | Start Express with `node --watch`. |
| `npm run server` | Start Express without rebuilding the frontend. |
| `npm run build` | Build the production frontend into `dist/`. |
| `npm run build:dev` | Build using Vite's development mode. |
| `npm run start` | Build the frontend, then start Express with the inherited environment. |
| `npm run preview` | Preview the built frontend with Vite; this does not start the Express API. |
| `npm run install:server` | Install backend dependencies. |
| `npm run install:hooks` | Configure the repository's tracked pre-push hook. |
| `npm run lint` / `npm run typecheck` | Run ESLint / frontend TypeScript checking. |
| `npm test` | Run the frontend Vitest watcher. |
| `npm run test:unit` | Run frontend and backend Vitest suites once. |
| `npm run clean:e2e` | Reset the isolated browser-test data directory. |
| `npm run test:e2e` / `npm run test:e2e:chromium` | Reset test data and run Chromium browser tests. |
| `npm run test:e2e:firefox` / `npm run test:e2e:webkit` | Reset test data and run the selected browser suite. |
| `npm run test:e2e:ci` | Run Chromium, Firefox and WebKit sequentially. |
| `npm run test:e2e:ui` | Reset test data and open Playwright UI for Chromium. |
| `npm run test:all` | Run lint, both unit suites and Chromium E2E. Typechecking and the other browsers remain separate checks. |

From `app/server/`, `npm test -- --run` runs only backend tests; `npm run start` and `npm run serve` both start `server.js`.

## Data and environment

Backend environment variables are read during startup. Vite loads frontend environment values during development/build; only public configuration belongs in `VITE_*` variables because those values can enter browser output. Saved dashboard environment overrides apply to an allowlist of backend settings. See [Configuration](../docs/wiki/administration/Configuration.md) for precedence and the complete variable reference.

| Setting | Role |
| --- | --- |
| `DATA_DIR` | Persistent SQLite and files. Defaults to `app/server/` from source and `/app/data` in the Docker image. Relative source paths resolve from the server process's working directory. |
| `JWT_SECRET` | Stable session-signing secret and default basis for encrypted settings. Required outside development/test; use at least 32 random characters and retain it across restarts. |
| `HOST`, `PORT` | HTTP listener. Source defaults are `127.0.0.1:3001`; the example production `.env` selects port `8080`; Docker defaults to `0.0.0.0:8080`. |
| `PUBLIC_SITE_URL`, `BASE_PATH` | Canonical external URL and optional mount prefix, used by public routing and generated links. |
| Optional provider settings | AI, SMTP and owner Stripe configuration. Follow the feature guides; keys and private credentials stay server-side. |

The persistent directory includes:

```text
DATA_DIR/
  orbitpage.db           SQLite content, accounts, settings and local history
  uploads/               Public uploaded media
  shop-files/            Private purchased files, served only by authorized routes
  .instance-env.json     Saved dashboard environment overrides
  .jwt-secret            Secret persisted by the Docker entrypoint when generated
```

Database migrations run at startup and must preserve existing installations. Keep database backups, SQLite sidecars, secrets, uploads, logs and test data out of Git. Back up persistent files together with signing/encryption configuration. Do not place private purchases in public `uploads/`. [Server documentation](./server/README.md) and [Maintenance](../docs/wiki/administration/maintenance.md) explain storage and recovery.

## Tests and scripts

| Test layer | Location and scope |
| --- | --- |
| Frontend helpers | `src/**/*.{test,spec}.{ts,tsx}` via Vitest in a Node environment. Covers parsing, navigation, layout, themes and other reusable logic; browser behavior belongs in E2E. |
| Backend | `server/**/*.test.js` via its own Vitest configuration, with Supertest where HTTP behavior is exercised. Covers authorization, validation, persistence and domain services. |
| Browser | [e2e/](./e2e) via Playwright's Chromium, Firefox and WebKit projects. Exercises public pages, dashboard editing, navigation, accessibility interactions and feature flows. |
| Installer and container | [Repository scripts](../scripts/README.md) and [quality workflow](../.github/workflows/quality-checks.yml). Verify installers, updater behavior, Docker secrets and runtime-data exclusions. |

Install the needed browser before the first local E2E run, for example `npx playwright install chromium`. Playwright manages the application test server and a local AI-response fixture. Its configuration supplies isolated `e2e-data/`, test-only settings and local ports. Never point browser tests at a real installation or production database. Failure reports and traces are generated output.

Both scripts in this directory are active:

- [scripts/clean-e2e.js](./scripts/clean-e2e.js) resets `app/e2e-data/` and creates an empty SQLite file before browser tests. The empty file also prevents legacy developer data from being imported during server startup.
- [scripts/install-hooks.js](./scripts/install-hooks.js) sets Git's `core.hooksPath` to the tracked `.githooks/` directory. The optional pre-push hook runs the tracked-data guard, lint, both unit suites and a frontend build.

The repository-level `../scripts/` contains the updater and repository/installer checks. These two script directories have different callers and are not copies of one another.

## Builds and Docker

Vite produces `dist/` with hashed JavaScript/CSS assets and relative asset URLs. Express serves that output and adapts entry HTML to `BASE_PATH`, public metadata and the requested route. `public/` contains source assets copied into the build, not user uploads. Rebuild generated output instead of editing it by hand.

The root [Dockerfile](../Dockerfile) is the canonical release build. It installs build dependencies, compiles the frontend and assembles a runtime image with Node, the backend, shared modules and static output. It also bundles the host updater. Docker Run/Compose supplies the persistent `/app/data` mount. The entrypoint creates and reuses `.jwt-secret` when no explicit secret is configured.

[app/Dockerfile](./Dockerfile) supports an `app/` build context; that context does not include the repository's host-updater scripts. Use the root [Compose file](../docker-compose.yml) and [deployment guide](../docs/wiki/administration/Deployment.md) for the supported installation path. Container networking, volumes and restart policy belong to deployment configuration.

Main-branch CI checks code and builds images for verification. Publishing images and GitHub releases is a separate version-tagged workflow; see [GitHub automation](../docs/wiki/development/github-automation.md) and [Contributing](../CONTRIBUTING.md#release-notes).

## Where to make changes

| Change | Read/change first | Verify |
| --- | --- | --- |
| Content block or page field | `packages/page-schema`, its frontend editor/renderer, server validators and persistence | Old saved shapes, new validation and public/preview rendering. |
| Dashboard section or URL | `pages/Admin.tsx`, `AdminView.tsx`, `lib/admin-navigation.ts` | Direct links, refresh, Back/Forward, language changes and permissions. |
| Theme or reusable UI | `components/ui`, `src/index.css`, `lib/theme.ts` and the design system | Preview/public parity, keyboard use, narrow screens and reduced motion. |
| API or stored data | Existing `server/routes`, `server/services`, `server/schemas` and `database.js` | Unauthorized requests, invalid input, transactions and migration compatibility. |
| Shop behavior | `packages/shop`, `SelfHostedShop.tsx`, Shop routers/services | Payment binding, webhook verification, private delivery and server-owned credentials. |
| Script or deployment behavior | This app's package commands or the root scripts/Docker configuration | All callers, documentation and the dedicated isolated checks. |

Keep changes in the existing owner, preserve public URLs and stored data, and test the affected consumers. Follow [AGENTS.md](../AGENTS.md), [Contributing](../CONTRIBUTING.md) and [SECURITY.md](../SECURITY.md). The [documentation index](../docs/wiki/README.md) links user guides and deeper operational procedures.

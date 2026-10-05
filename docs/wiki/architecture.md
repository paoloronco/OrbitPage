# OrbitPage OSS architecture

| Field | Value |
| --- | --- |
| Scope | Open-source self-hosted runtime and its shared product code |
| Status | Implemented architecture contract |
| Sources | [Application layout](../../app/README.md), [server layout](../../app/server/README.md), [page schema](../../app/packages/page-schema), [Dockerfile](../../Dockerfile) |

## System shape

```text
Visitor or administrator
  -> Express HTTP server
     -> public static assets and React/Vite application
     -> internal /api routes
        -> authentication, validation and domain services
        -> SQLite database and local persistent uploads
```

The same installation serves the dashboard and public page. `DATA_DIR` owns
durable data; Docker persists it at `/app/data`. The frontend build is
generated output and is not edited or committed. The bundled API is an
application boundary, not a stable third-party SDK.

## Ownership

| Area | Canonical owner |
| --- | --- |
| Dashboard and public React UI | `app/src/` |
| Shared page, block, menu and theme schemas | `app/packages/page-schema/` |
| HTTP routes, auth and runtime startup | `app/server/server.js` and `app/server/auth.js` |
| SQLite connection and migrations | `app/server/database.js` |
| Backup, media, AI and other domain operations | `app/server/services/` |
| Browser regression checks | `app/e2e/` |
| Image and installation flow | Root Docker/Compose files and `scripts/` |

The server is a modularizing monolith. Put validation and domain logic in
the owning schema or service, then route through it; avoid a second copy of
the same rule in a UI component or another endpoint.

## Main flows

**Edit:** the authenticated dashboard reads through the internal API, edits
local state, validates on save, then the server checks authorization and writes
the relevant SQLite records. Reloading the editor reads committed state again.

**Public visit:** Express serves only publishable content and static assets.
Public routes must not expose drafts, account data, scheduling metadata or
private files. Dashboard locale prefixes do not become public URL prefixes.

**Upload and backup:** accepted media lives under persistent uploads. Backup
and restore operate on selected durable sections and must not treat generated
frontend files as application data. Back up SQLite and uploads consistently;
see [backup guidance](./backups-and-demo-mode.md).

**Update:** a release is built from the exact tagged source; container
recreation retains `DATA_DIR` and the instance secret. The
[deployment guide](./Deployment.md) owns install, update and rollback
steps. A source commit is not evidence that an operator has updated a host.

## Boundary with hosted SaaS

The public repository owns the reusable editor, renderer, schema and generic
validation. The private hosted platform pins this repository as a Git
submodule, builds the shared runtime and supplies same-origin adapters for
tenant identity, managed persistence and publication. Hosted plans, billing,
moderation, managed storage and edge routing do not belong in this repository.
The hosted adapter does not use this SQLite database.

See [product requirements](./product-requirements.md) for expected behavior,
[design system](./design-system.md) for UI rules, [security](./Security.md)
for trust boundaries, and [AGENTS.md](../../AGENTS.md) for contributor-agent rules.

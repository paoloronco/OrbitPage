# Architecture

This document explains the self-hosted runtime and its separation from the hosted service. [Application](./application.md) covers files, dependencies, builds, and commands.

## Runtime

```text
Browser → Express
            ├─ public pages, React dashboard, and assets
            ├─ /api → validation → permissions → services → SQLite
            ├─ public media in DATA_DIR/uploads
            └─ private purchases in DATA_DIR/shop-files
```

One installation serves the public page and dashboard. SQLite and local uploads belong to the same persistent `DATA_DIR`. Run one application replica per directory.

Express remains one server application. Put domain logic in the existing service or schema and retain route paths and middleware order when extracting code.

## Data flows

| Action | Flow |
| --- | --- |
| Edit | Dashboard loads saved data, keeps a local draft, then sends a validated save request. Server permission checks precede SQLite writes. |
| Public visit | Server selects visible/published content and generates metadata; the shared renderer displays the page. Private account and editing data are excluded. |
| Upload | Server checks the media and quota, writes accepted files to uploads, and stores references in SQLite. |
| Restore | Selected data and media are validated and replaced together; failed restoration rolls back the change. |
| Update | A new image or source build starts against the same data and secret. Rollback uses both the old image and its pre-update backup. |

The bundled `/api` changes with the application release; it has no independent API-version guarantee. See [API](./api.md) and [Maintenance](../administration/maintenance.md).

## Shared code and hosted service

The public repository owns the editor, renderer, page schema, and self-hosted server. Applications can reuse the editor through generic callbacks. The hosted service maintains its entry point, build configuration, authentication, persistence, and publication adapters separately.

Hosted tenants, plans, billing, managed storage, moderation, Stripe Connect platform policy and custom-domain provisioning remain outside this repository. The hosted adapter does not use the self-hosted SQLite database.

Shop schemas, payment binding/discount checks, rendering, file validation and
email templates live in `app/packages/shop`. The catalog, controls, receipt and
customer UI are shared with hosted adapters. OSS `server/services/shop.js` and
`shop-lifecycle.js` use additive SQLite tables, local private files, encrypted
owner Stripe/SMTP settings and local workers. Raw webhook routes precede JSON
parsing. One transaction queue serializes SQLite writes, webhook leases and
download counters. See [Shop](../dashboard/sections/shop.md) for setup and limits.

[Product requirements](./product-requirements.md) defines expected behavior; [Design system](./design-system.md) defines shared UI rules.

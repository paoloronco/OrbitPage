# Architecture

This document explains the self-hosted runtime and its separation from the hosted service. [Application](./application.md) covers files, dependencies, builds, and commands.

## Runtime

```text
Browser → Express
            ├─ public pages, React dashboard, and assets
            ├─ /api → validation → permissions → services → SQLite
            └─ uploaded media in DATA_DIR/uploads
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

Hosted tenants, plans, billing, managed storage, moderation, commerce, and custom-domain provisioning remain outside this repository. The hosted adapter does not use the self-hosted SQLite database.

[Product requirements](./product-requirements.md) defines expected behavior; [Design system](./design-system.md) defines shared UI rules.

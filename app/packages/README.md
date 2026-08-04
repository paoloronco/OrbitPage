# Shared application packages

This directory contains packages shared across OrbitPage application boundaries.

## `page-schema`

`@orbitpage/page-schema` defines the canonical structures for page data, content blocks, menus, subpages, discovery settings, profiles, and themes. The application consumes it through the local dependency declared in `app/package.json`.

When changing the schema:

1. Preserve parsing of data produced by supported earlier releases.
2. Prefer additive optional fields and explicit defaults.
3. Update both frontend and backend boundary tests.
4. Add normalization or migration coverage for legacy shapes.
5. Keep hosted-only fields out of the public self-hosted contract unless the shared renderer genuinely needs them.

Do not create a second copy of page or block types in another directory. Import or derive from this package so validation and rendering remain aligned.

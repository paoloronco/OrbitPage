# OrbitPage Copilot instructions

Read and follow [`AGENTS.md`](../AGENTS.md) before changing this repository. It
is the canonical source for repository boundaries, engineering rules, required
checks, documentation ownership, data safety, and release policy. Do not copy
or reinterpret those rules here.

Useful starting points:

- [`app/README.md`](../app/README.md) for the application layout.
- [`app/packages/README.md`](../app/packages/README.md) for the shared page
  schema and block contracts.
- [`app/server/README.md`](../app/server/README.md) for the Express boundary.
- [`docs/README.md`](../docs/README.md) for user and operator documentation.
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the contribution workflow and
  verification commands.

For a new or changed block, update the shared `app/packages/page-schema`
contract first, then the editor, public renderer, server validation, tests, and
user documentation. Never introduce a second schema inside a component or the
main server file.

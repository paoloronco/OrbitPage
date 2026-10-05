# OrbitPage OSS product requirements

| Field | Value |
| --- | --- |
| Scope | Open-source, self-hosted OrbitPage |
| Status | Implemented product contract; code and tests define exact behavior |
| Sources | [Product overview](../../README.md), [dashboard guide](./dashboard.md), [application layout](../../app/README.md) |

## Problem and users

A creator, venue or small business needs a public destination that is more
useful than a list of links, without building and operating a custom website.
OrbitPage provides a visual editor, a responsive public page and a self-hosted
runtime that keeps the operator in control of its data. Visitors need a page
that opens directly on a phone or desktop and makes the next action clear.

## Outcomes

- An owner can complete setup and publish a usable page without editing code.
- Saved identity, content and theme changes survive refresh and render on the
  public page through the shared renderer.
- Menu, additional pages, privacy information and discovery artifacts have
  stable public paths when enabled.
- The installation operates without a SaaS account, cloud database or managed
  billing provider.
- An operator can back up, update and recover the installation while retaining
  the persistent database, uploads and instance secret.

## Requirements and acceptance

| ID | Requirement | Acceptance condition |
| --- | --- | --- |
| O-01 | Set up the installation and administrator. | First-run setup creates the admin identity and returns to the authenticated dashboard. |
| O-02 | Edit page identity and ordered content blocks. | Save, reload and public preview show the same committed content. |
| O-03 | Edit the page theme visually. | Preview and public rendering use the same theme schema, including responsive layout. |
| O-04 | Manage optional Menu and additional Pages. | Enabled destinations resolve at their public URLs; unpublished drafts are not exposed as active content. |
| O-05 | Generate QR, sitemap and text discovery files. | Publish tools have direct dashboard subsections and use the configured public origin. |
| O-06 | Configure consent, privacy and optional analytics. | Tracking follows consent; public policy routes work without dashboard authentication. |
| O-07 | Localize dashboard navigation. | Dashboard URLs include a language prefix and selected subsection; public URLs remain free of language slugs. |
| O-08 | Support additional users with bounded roles. | The server checks permissions for reads and writes, regardless of UI visibility. |
| O-09 | Persist and recover installation data. | SQLite, uploads and the stable instance secret survive container recreation; backup and restore have documented validation. |

The [dashboard guide](./dashboard.md) owns the workspace and save
workflow; [content and design](./content-and-design.md) owns the
editor details. The Express `/api` routes serve this bundled application and
are not a versioned public automation API; see [API boundary](./api.md).

## Quality requirements

- Use semantic controls, visible focus, keyboard navigation, reduced-motion
  behavior and responsive layouts without horizontal page overflow.
- Validate untrusted data and permissions on the server. Do not expose drafts,
  private account data or executable uploads through public routes.
- Keep SQLite migrations compatible with existing installations and preserve
  documented public URL aliases.
- Keep creator-written content unchanged when the dashboard locale changes.
- Treat build and test success separately from an operator installing a release.

Hosted-only tenancy, plans, managed storage, commerce and provider policy are
outside this repository; the private SaaS platform consumes this editor and
renderer as a Git submodule. [Architecture](./architecture.md) explains that
boundary. The current deployment and release procedure is in
[Deployment](./Deployment.md).

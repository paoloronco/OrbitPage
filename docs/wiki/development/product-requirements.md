# Product requirements

This document defines what the self-hosted OrbitPage application must support. Use it to assess a feature or regression; installation and editing instructions belong in the linked guides. It describes the current product, not a roadmap.

## Goal

Anyone can create and maintain a public page without writing code, regardless of their job or intended use. The owner runs the application on their own server and controls its content, data, and access.

An installation serves a main page, optional additional pages, and a menu. It works without an OrbitPage SaaS account or cloud database.

## Required behavior

| Area | Expected result | Guide |
| --- | --- | --- |
| Setup | Browser setup checks the instance, creates the first administrator, and opens the dashboard | [Deployment](../administration/Deployment.md) |
| Visual editing | Saved profile, blocks, layouts, and theme survive reload and render on the public page | [Content and design](../dashboard/sections/content-and-design.md) |
| Public destinations | Enabled menus and published additional pages resolve at their URLs; hidden content stays private | [Dashboard](../dashboard/dashboard.md) |
| Sharing and discovery | QR codes, scheduled campaign links, metadata, sitemap, and text files use the configured public URL | [Publishing](../dashboard/sections/publishing.md), [SEO](../SEO-and-indexing.md) |
| Analytics and consent | Visit details and third-party tracking follow consent; reports are available in the dashboard | [Analytics and privacy](../dashboard/sections/analytics-and-privacy.md) |
| Newsletter | The owner can configure SMTP, verify it, manage confirmed subscribers, and send or schedule campaigns | [Newsletters](../dashboard/sections/newsletters.md) |
| AI editing | With an optional provider key, the assistant proposes changes and applies them only after confirmation | [AI assistant](../ai-assistant.md) |
| Accounts | Roles restrict reads and changes on the server; each user can manage their password and TOTP | [Account and team](../dashboard/sections/account-and-team.md) |
| Automation | Personal API tokens have limited access and expiry and can be revoked | [API](./api.md) |
| Recovery | Data and secrets survive updates; exports, version history, infrastructure backups, and admin recovery have documented procedures | [Backups](../dashboard/sections/backups-and-demo-mode.md), [Maintenance](../administration/maintenance.md), [Recovery](../administration/recovery.md) |

## Requirements across features

- Support keyboard controls, visible focus, phone and desktop layouts, and reduced motion.
- Use the same page schema and renderer for preview and the public page.
- Validate input and permissions on the server. Public responses must not expose drafts, account details, secrets, or editing metadata.
- Preserve existing SQLite data, supported backup formats, and documented URL aliases during upgrades.
- Translate dashboard controls without changing saved page content. Public URLs have no dashboard-language prefix.
- Keep external providers optional: normal editing works without AI, GA4, or SMTP.

The OSS edition has no paid feature tiers or plan quotas for pages and blocks. Storage and request limits still apply. Hosted billing, tenants, managed storage, moderation, commerce, and custom-domain provisioning belong to the managed service.

For implementation details, see [Application](./application.md), [Architecture](./architecture.md), and [Design system](./design-system.md).

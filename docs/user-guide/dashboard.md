# Dashboard guide

The self-hosted dashboard opens at `/dashboard/profile` after initial setup. Each main workspace has a stable URL, so refreshing or bookmarking it returns to the same area.

## A reliable editing workflow

Use this sequence to avoid leaving related changes half-finished:

1. Complete the profile and browser identity in **Page**.
2. Build the main-page order in **Content > Link**.
3. Add the menu or subpages only when they need a distinct destination.
4. Set shared colors, typography, spacing, cards, and background in **Theme**.
5. Configure consent before enabling GA4 or third-party embeds.
6. Review sharing and crawler files in **Publish**.
7. Create a backup, then open **Public page** and test the result as a visitor.

Page, Link blocks, subpage details, each subpage's blocks, Menu, Theme, Privacy, and Publish use their own save action. A save in one workspace does not commit an unsaved draft in another.

## First-login guidance

After the initial system, administrator, and public-URL setup, OrbitPage opens a guided tour of the available workspaces. From **Page > Guided setup** you can replay the tour or choose whether it opens at every login.

Page also shows a small checklist for the first three login sessions in that browser. It checks the name, description, first social link, and browser title. You can dismiss it permanently from the panel. The checklist and tour only guide the editor; they do not publish content themselves.

See [Getting started](../wiki/Getting-started.md) for the fresh-install sequence.

## Page tools

### Page

Use **Page** to define the identity visitors see first: profile type, image, name, description, role or activity, location, social links, browser metadata, footer, and optional profile-card overrides.

Profile-card overrides take precedence over the active theme. Use **Use theme** to return an individual value to the shared design. See [Content and design](./content-and-design.md#page-identity) for the field hierarchy and save behavior.

### Content

**Content** groups four destinations:

- **Link** contains the profile and ordered content blocks.
- **Menu** creates the native venue menu at `/menu`.
- **Shop** publishes the Stripe-powered product and service catalog at `/shop` on OrbitPage SaaS.
- **Pages** creates focused public subpages with their own slug, title, description, publication state, and blocks.

One active destination is always selected as the homepage. Choose a different homepage before deactivating the current one. Deactivation requires confirmation and keeps the destination's content saved for later reactivation.

Legacy URLs such as `/dashboard/links`, `/dashboard/menu`, and `/dashboard/pages` continue to resolve to Content. The complete block, menu, subpage, scheduling, embed, and media workflows are in [Content and design](./content-and-design.md).

### AI Assistant

The self-hosted assistant proposes profile, content, and theme operations from the current page state. Generation never applies changes immediately; review and confirm the proposal first. See [AI assistant](./ai-assistant.md) for provider setup, data sent to the provider, and failure handling.

### Theme

Use **Theme** for the page-wide visual system: presets, colors, typography, card surfaces, borders, radius, shadow, blur, spacing, width, and background. The live preview uses the public renderer.

Prefer theme-level changes for consistency. Keep individual profile or block overrides for deliberate exceptions.

### Publish

**Publish** groups sharing and discovery tools:

- generate a QR code for the current public URL;
- choose screen or print presets and download PNG or SVG;
- generate and inspect `sitemap.xml`;
- edit `robots.txt`, `llms.txt`, `humans.txt`, `ai.txt`, and `security.txt`;
- create safe custom `.txt` and `/.well-known/*.txt` endpoints.

Set `PUBLIC_SITE_URL` before distributing QR codes or canonical discovery links behind a proxy or custom domain. See [SEO and indexing](../wiki/SEO-and-indexing.md).

### Backup

Use **Backup** to export or restore selected application sections and to inspect or remove unused uploads. JSON exports are portable, but they do not replace a consistent backup of the SQLite database and uploads.

Restoring replaces only the selected sections. Restoring Media replaces the uploads directory, and restoring Admin accounts can invalidate the active session. Read [Backups, media, and demo mode](./backups-and-demo-mode.md) before the first restore or cleanup.

### Analytics and Privacy

Self-hosted **Analytics** shows built-in click and CTA counters and can configure optional GA4. **Privacy** controls policy links, the consent banner, consent categories, and optional external consent integration. See [Analytics and privacy](./analytics-and-privacy.md) before enabling third-party tracking.

## Workspace tools

- **Team** manages additional local users and their roles.
- **Account** contains the signed-in user's password, TOTP authenticator, recovery codes, and protected recovery actions.

The first `admin` account always has full access. Every signed-in user can manage their own Account; the additional roles below control access to page and installation tools:

| Role | Access |
| --- | --- |
| Admin | Full access, including users, backups, and recovery tools |
| Editor | Profile, Link blocks, menu, and built-in analytics |
| Link Editor | Full Link-block editing and built-in analytics |
| Style Editor | Card colors, fonts, and size only |
| Image Editor | Card icons and cover images only |
| Theme Editor | Shared theme and background only |
| Compliance | Privacy, consent, and discovery settings only |
| Viewer | Read-only analytics |

Assign the narrowest role that fits the person's task. Account security is per user; Team permissions do not replace unique passwords or two-factor authentication.

The legacy `/dashboard/access` path remains an alias for Account.

## Canonical dashboard routes

Only routes allowed by the signed-in user's permissions appear in navigation.

| Area | Route |
| --- | --- |
| Page | `/dashboard/profile` |
| Content · Link | `/dashboard/content/link` |
| Content · Menu | `/dashboard/content/menu` |
| Content · Shop | `/dashboard/content/shop` |
| Content · Additional pages | `/dashboard/content/pages` |
| AI Assistant | `/dashboard/ai` |
| Theme | `/dashboard/theme` |
| Publish | `/dashboard/publish` |
| Backup | `/dashboard/backup` |
| Analytics | `/dashboard/analytics` |
| Privacy | `/dashboard/privacy` |
| Team | `/dashboard/team` |
| Account | `/dashboard/account` |

`/admin` remains a compatibility entry point and redirects to the dashboard.

# Dashboard guide

The self-hosted dashboard is available at `/dashboard/profile` after initial setup. Each main workspace has a stable URL, so a refresh or bookmark returns to the same area.

## Page tools

### Page

Use **Page** to define the identity visitors see first:

- choose a creator, company, or studio page type;
- upload and show or hide the profile image;
- set image shape and size;
- edit the page name, description, role or activity, and location;
- add browser title, favicon, and social profiles;
- open advanced typography, SEO, footer, and profile-card overrides only when needed.

Profile-card overrides take precedence over the active theme. Use **Use theme style** to return the card to inherited theme values.

### Content

**Content** groups destinations that were previously separate dashboard sections:

- **Home links** contains the blocks on the main public page.
- **Menu** creates a venue menu with sections, one-level subsections, products, variants, images, prices, locale, and availability.
- **Pages** creates focused public subpages with their own slug, title, description, and blocks.

The main home is always available. Add a menu or subpage only when it gives visitors a clearer destination. Legacy dashboard URLs such as `/dashboard/links`, `/dashboard/menu`, and `/dashboard/pages` continue to resolve to Content.

### AI Assistant

The assistant proposes changes to the current page and never applies generated operations immediately. See [AI assistant](./ai-assistant.md) for provider setup, review, and confirmation.

### Theme

Use **Theme** for the page-wide visual system: preset, background, typography, surfaces, borders, radius, shadow, blur, and spacing. The live preview uses the same public renderer and is intended to show the effect before saving.

Prefer theme-level changes for consistency. Use per-card overrides only for a deliberate exception.

### Publish

**Publish** groups sharing and discovery tools:

- generate a QR code for the current public URL;
- choose screen or print presets and download PNG or SVG;
- generate and inspect `sitemap.xml`;
- edit standard discovery files such as `robots.txt`, `llms.txt`, `humans.txt`, `ai.txt`, and `security.txt`;
- create safe custom `.txt` and `/.well-known/*.txt` endpoints.

Set `PUBLIC_SITE_URL` before generating or distributing QR codes and canonical discovery links behind a proxy or custom domain. See [SEO and indexing](../wiki/SEO-and-indexing.md).

### Backup

Use **Backup** to export or restore application data and to preview or clean unused uploaded media. Complete backups preserve the established schema-v1 format; selective backups declare their included sections explicitly.

Keep an external backup of both the SQLite database and uploads before upgrades or restores. A JSON export is useful for portability but does not replace an infrastructure-level backup of `DATA_DIR`.

### Analytics and Privacy

**Analytics** shows available page and content performance. **Privacy** controls consent behavior, policy links, and optional external consent integration. See [Analytics and privacy](./analytics-and-privacy.md) before enabling GA4.

## Workspace tools

- **Team** manages additional self-hosted users and their permissions.
- **Account** contains password and time-based one-time-password controls.
- **Plan** explains the open-source edition and the optional managed alternative.

The legacy `/dashboard/access` path remains an alias for Account.

## Canonical dashboard routes

| Area | Route |
| --- | --- |
| Page | `/dashboard/profile` |
| Content | `/dashboard/content` |
| AI Assistant | `/dashboard/ai` |
| Theme | `/dashboard/theme` |
| Publish | `/dashboard/publish` |
| Backup | `/dashboard/backup` |
| Analytics | `/dashboard/analytics` |
| Privacy | `/dashboard/privacy` |
| Team | `/dashboard/team` |
| Account | `/dashboard/account` |
| Plan | `/dashboard/plan` |

`/admin` remains a compatibility entry point and redirects to the dashboard.

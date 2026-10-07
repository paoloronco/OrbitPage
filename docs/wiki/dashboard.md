# Dashboard

The dashboard is where you edit your public page, manage sharing and newsletters, and change account or installation settings.

Open `/dashboard/profile` to sign in or, on a new installation, choose the admin password.

## Dashboard main sections

### Site editor

| Section | What you edit | URL |
| --- | --- | --- |
| **Page** | Profile, image, social links, browser title, metadata, and footer | `/dashboard/editor/page` |
| **Content** | Main-page blocks, order, visibility, and schedules | `/dashboard/editor/content` |
| **Menu** | Menu settings, sections, items, prices, and appearance | `/dashboard/editor/menu/content` |
| **Pages** | Additional pages, their URLs, publication state, and blocks | `/dashboard/editor/pages` |
| **Theme** | Colors, fonts, cards, background, and responsive preview | `/dashboard/theme/page` |
| **AI Assistant** | Suggested page changes to review and confirm | `/dashboard/ai` |

The **Shop** section is unavailable in the self-hosted edition. Its shared route is `/dashboard/editor/shop/products`.

See [Content and design](./content-and-design.md) for editing controls and [AI Assistant](./ai-assistant.md) for provider setup.

### Share and manage content options

| Workspace | Tools | URL |
| --- | --- | --- |
| **Publish** | QR codes, scheduled campaign links, sitemap, and text files | `/dashboard/publish/QR` |
| **Backup** | JSON/image ZIP export, selective restore, version history, and media cleanup | `/dashboard/backup` |
| **Analytics** | Visit and click reports, QR traffic, and optional GA4 | `/dashboard/analytics` |
| **Privacy** | Consent banner, policies, and external consent providers | `/dashboard/privacy` |
| **Newsletter** | SMTP, subscribers, campaigns, schedules, and reports | `/dashboard/newsletter/overview` |

Detailed guides: [Publishing](./publishing.md), [Backups](./backups-and-demo-mode.md), [Analytics and privacy](./analytics-and-privacy.md), [Newsletters](./newsletters.md).

### Account and installation

| Workspace | Tools | URL |
| --- | --- | --- |
| **Team** | Local users, roles, passwords, and personal API tokens | `/dashboard/team` |
| **Account → General** | Instance version, health/storage details, updates, environment overrides, and public URL | `/dashboard/account/general` |
| **Account → Security** | Your password, authenticator, and recovery codes | `/dashboard/account/security` |
| **Account → Audit log** | Successful changes, with user, action, date, and text filters; administrators only | `/dashboard/account/audit` |
| **Edition** | Self-hosted features and server responsibilities | `/dashboard/plan` |

See [Account and team](./account-and-team.md), [Configuration](./Configuration.md#dashboard-environment-overrides), and [Updates](./Deployment.md#update-safely).

## Save and preview

### Save changes

1. Edit a section and use its **Save** action.
2. Save each additional section you changed. Saving Theme does not save an unsaved Menu or Page.
3. Open **Public page** to check the saved result.

### Preview and publication

The preview can show unsaved changes. In the self-hosted edition, saved public content appears on the public page without a separate site-wide publish step. Additional pages must also be marked **Published**.

### Drafts

Subpage settings and blocks have separate save controls. Theme, Menu, Privacy, and Publish keep their own drafts. Browser refresh discards unsaved work; switching a tab keeps a Menu or Theme draft.

## URLs and tabs

### Language and base path

The tables omit the language prefix: `/dashboard/account/security` becomes `/en-US/dashboard/account/security` in an English dashboard. A configured `BASE_PATH` comes before that prefix. Public routes use neither the dashboard language nor its section paths.

### Tab paths

Tabs append these slugs to their workspace path:

| Path | Tab slugs |
| --- | --- |
| `/dashboard/editor/menu` | `settings`, `content`, `design` |
| `/dashboard/editor/shop` | `legal`, `payments`, `design`, `products`, `orders`, `customers`; hosted only |
| `/dashboard/theme` | `page`, `card` |
| `/dashboard/publish` | `QR`, `Sitemap`, `TXT` |
| `/dashboard/newsletter` | `overview`, `campaigns`, `subscribers`, `settings` |
| `/dashboard/account` | `general`, `security`, `audit` |

### Bookmarks and older URLs

Bookmarks, refresh, and browser Back/Forward restore the selected section and tab.

Older `/dashboard/profile` and `/dashboard/content/{link,menu,shop,pages}` paths still work. `/dashboard/links`, `/dashboard/menu`, and `/dashboard/pages` remain Content aliases; `/dashboard/access` opens Account, and `/admin` redirects to the dashboard.

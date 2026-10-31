# Dashboard

The dashboard is where you edit your public page, manage sharing and newsletters, and change account or installation settings.

The sidebar starts directly with **Site editor**. Click the OrbitPage logo or your slug above the menu to open your public page in a new tab.

## Sign in and first page

| Edition | First access |
| --- | --- |
| **Open Source** | Open `/dashboard/profile` on your installation. On first access, choose the administrator password. |
| **SaaS** | Sign up at orbitpage.com with email/password or Google. Verify your email when requested and choose an available username during onboarding. Your public address is `https://orbitpage.net/your-name`. |

1. Open **Page** and set your name, description and profile image.
2. Open **Content** to add links, text, media or other blocks.
3. Choose your colors, font and background in **Theme**.
4. Save each section you changed, then click the OrbitPage logo or slug in the sidebar to check the public result.

In SaaS, check the selected workspace before editing. Each workspace has its own page, membership, plan and connected services. Available actions depend on your permissions; hosted plans also determine feature availability and quotas.

## Dashboard main sections

### Site editor

![Page, content, menu, additional pages, theme and AI Assistant](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.74/orbitpage-dashboard-site-editor-4.21.75.gif)

| Section | What you edit | URL |
| --- | --- | --- |
| **Page** | Profile, image, social links, browser title, metadata, and footer | `/dashboard/editor/page` |
| **Content** | Main-page blocks, order, visibility, and schedules | `/dashboard/editor/content` |
| **Menu** | Menu settings, sections, items, prices, and appearance | `/dashboard/editor/menu/content` |
| **Shop** | Digital products, services, payments, and orders | `/dashboard/editor/shop/products` |
| **Pages** | Additional pages, their URLs, publication state, and blocks | `/dashboard/editor/pages` |
| **Theme** | Colors, fonts, cards, background, and responsive preview | `/dashboard/theme/page` |
| **AI Assistant** | Suggested page changes to review and confirm | `/dashboard/ai` |

The **Shop** section sells digital products and services through the owner's Stripe account. See [Shop](./sections/shop.md) for the payment, email and publication setup for your edition.

See [Content and design](./sections/content-and-design.md) for editing controls, [External modules](../integrations/external-modules.md) for connected services and [AI Assistant](../ai-assistant.md) for provider setup.

The logo and slug always open the main public address, including while editing Shop.

### Share and manage content options

![Sharing, backups, analytics, privacy and newsletter](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.74/orbitpage-dashboard-content-management-4.21.75.gif)

| Workspace | Tools | URL |
| --- | --- | --- |
| **Publish** | QR codes, scheduled campaign links, sitemap, and text files | `/dashboard/publish/QR` |
| **Backup** | JSON/image ZIP export, selective restore, version history, and media cleanup | `/dashboard/backup` |
| **Analytics** | Visit and click reports, QR traffic, and optional GA4 | `/dashboard/analytics` |
| **Privacy** | Consent banner, policies, and external consent providers | `/dashboard/privacy` |
| **Newsletter** | SMTP, subscribers, campaigns, schedules, and reports | `/dashboard/newsletter/overview` |

Detailed guides: [Publishing](./sections/publishing.md), [Backups](./sections/backups-and-demo-mode.md), [Analytics and privacy](./sections/analytics-and-privacy.md), [Newsletters](./sections/newsletters.md).

### Account and installation

![Team and account controls, shown in the self-hosted edition](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.74/orbitpage-dashboard-account-installation-4.21.75.gif)

Team and Account share the navigation below. The illustration shows the self-hosted edition; account management and installation controls differ as described in the following table.

| Workspace | Tools | URL |
| --- | --- | --- |
| **Team** | Users, roles, permissions, and personal API tokens | `/dashboard/team` |
| **Account → General** | Account details, support, and public page controls | `/dashboard/account/general` |
| **Account → Security** | Your password, authenticator, and recovery codes | `/dashboard/account/security` |
| **Account → Audit log** | Successful changes, with user, action, date, and text filters; permission required | `/dashboard/account/audit` |

| Area | Open Source | SaaS |
| --- | --- | --- |
| Team | Local users and credentials belong to the installation. | Invite collaborators with their own accounts and grant access to the selected workspace. |
| Account → General | Account details, support and page controls. The second column stays empty. | Account details and page controls. OrbitPage manages the infrastructure. |
| Account → Audit log | Administrators can review successful changes. | Owners, administrators and custom members with member-visibility permission can review workspace events. |
| Edition / Plan | **Edition**, `/dashboard/plan`, contains instance diagnostics, updates, environment overrides, self-hosted features and server responsibilities. | **Plan**, `/dashboard/billing`, manages the subscription, usage, billing and custom domains; owner controls require ownership. |

See [Account and team](./sections/account-and-team.md) for access controls. Self-hosted administrators also use [Configuration](../administration/Configuration.md#dashboard-environment-overrides) and [Updates](../administration/Deployment.md#update-safely). SaaS owners use [Plan and billing](https://orbitpage.com/en-US/docs/billing) and [Security](https://orbitpage.com/en-US/docs/account-and-security).

## Save and preview

### Save changes

1. Edit a section and use its **Save** action.
2. Save each additional section you changed. Saving Theme does not save an unsaved Menu or Page.
3. Open **Public page** to check the saved result.

### Preview and publication

The preview can show unsaved changes. Saving a dashboard section updates its public content without a separate site-wide publish step. Additional pages must also be marked **Published**; Menu and Shop have their own publication controls. Open **Public page** after saving to verify the result.

SaaS publication can report a failure while the previous valid public version remains online. Resolve the displayed error and check the public result again. API and ChatGPT workflows can explicitly create private drafts; those require their own publication step.

### Drafts

Subpage settings and blocks have separate save controls. Theme, Menu, Privacy, and Publish keep their own drafts. Browser refresh discards unsaved work; switching a tab keeps a Menu or Theme draft.

## URLs and tabs

### Language and base path

The tables omit the language prefix: `/dashboard/account/security` becomes `/en-US/dashboard/account/security` in an English dashboard. On a self-hosted installation, a configured `BASE_PATH` comes before that prefix. Public routes use neither the dashboard language nor its section paths.

### Tab paths

Tabs append these slugs to their workspace path:

| Path | Tab slugs |
| --- | --- |
| `/dashboard/editor/menu` | `settings`, `content`, `design` |
| `/dashboard/editor/shop` | Shared tabs: `products`, `orders`, `customers`, `design`. OSS also has `legal` and `payments` tabs; SaaS opens these settings with the gear button. |
| `/dashboard/theme` | `page`, `card` |
| `/dashboard/publish` | `QR`, `Sitemap`, `TXT` |
| `/dashboard/newsletter` | `overview`, `campaigns`, `subscribers`, `settings` |
| `/dashboard/account` | `general`, `security`, `audit` |

### Bookmarks and older URLs

Bookmarks, refresh, and browser Back/Forward restore the selected section and tab.

Older `/dashboard/profile` and `/dashboard/content/{link,menu,shop,pages}` paths still work. `/dashboard/links`, `/dashboard/menu`, and `/dashboard/pages` remain Content aliases; `/dashboard/access` opens Account, and `/admin` redirects to the dashboard.

## Languages and URL slugs

Choose the interface language from the dashboard sidebar. Its slug appears before
`/dashboard`, for example `/it-IT/dashboard/editor/page`.

| Language | URL slug |
| --- | --- |
| English | `en-US` |
| Italiano | `it-IT` |
| Español | `es-ES` |
| Français | `fr-FR` |
| Deutsch | `de-DE` |
| Português | `pt-PT` |
| Nederlands | `nl-NL` |
| Polski | `pl-PL` |
| Türkçe | `tr-TR` |
| Русский | `ru-RU` |
| العربية | `ar-SA` |
| 中文 | `zh-CN` |
| 日本語 | `ja-JP` |
| 한국어 | `ko-KR` |

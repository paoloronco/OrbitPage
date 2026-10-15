# Content and design

![Page, content blocks, menu, additional pages and theme in the site editor](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.74/orbitpage-feature-content-and-design-4.21.75.gif)

Edit your public identity, content blocks, menu, additional pages and appearance in **Page**, **Content**, **Menu**, **Pages**, and **Theme**:

1. Set the public identity in **Page**.
2. Add and arrange the main-page blocks in **Content > Link**.
3. Add a menu or additional pages if needed.
4. Set colors, fonts, and background in **Theme**.
5. Save each workspace, then open **Public page** and check the result at mobile and desktop widths.

The dashboard preview uses the public renderer, but the public URL is the final check for browser metadata, external embeds, consent behavior, and real navigation.

**Arrange** is available in desktop browsers and moves or resizes whole cards freely.
Choose Mobile or Desktop to edit either layout. Phone browsers keep the preview
and item editing controls; they do not show Arrange.
Other cards stay in place during a drag, including when you cross them.
Alignment guides are visual aids; hold Shift while dragging to snap to them.
Arrow keys adjust by one pixel, or ten with Shift. Escape cancels the current
drag. Mobile and desktop layouts are independent drafts until saved.

Card text wraps and the card grows to keep it readable. Existing vertical gaps
are preserved when text needs more height; deliberate overlaps remain possible.
Icons, titles, descriptions and URLs use the automatic card layout. Old saved
text coordinates are ignored; choose Left, Center or Right in the card's
**Alignment** setting. Profile content is also not draggable in Arrange.

Content's quick-add shortcuts include Instagram, WhatsApp, Facebook and TikTok;
Forms & tools includes Calendly, Google Forms, Typeform, Google Calendar, GitHub
and Loom. The complete block library remains available through **Add content**.

## Page identity

Use **Page** for profile and browser settings:

- review the creator, company, or studio profile type;
- set the page name, description, role or activity, and location;
- upload a profile image, then choose its visibility, shape, and size;
- add supported social profiles;
- set the browser title, favicon, search description, and footer;
- optionally override the profile-card surface, border, colors, shadow, and typography.

The selected profile type changes the labels for the two detail fields; it does not create a separate kind of public page. In the self-hosted edition, choose it in Page; the managed edition uses the type selected during onboarding. The favicon may be different from the profile image. The centered footer sits at the bottom of short pages and follows the content on longer pages, including in both device previews.

In **Social links**, enter the username for each network; OrbitPage builds the public profile link automatically. YouTube uses a channel handle, Discord an invite code, WhatsApp a phone number, and Mastodon a full `@username@instance` handle. Leave a field empty to hide that social icon. Existing saved links remain editable.

Most profile-card settings inherit from **Theme**. An explicit value in **Page** takes precedence. Use **Use theme** or reset the card appearance when you want it to inherit the shared design again.

Changes in Page remain a draft in the browser until you select **Save** in the Page toolbar. **Revert** discards the current unsaved draft.

### Arrange the layout

Select **Arrange** (the pencil button) to move and resize cards in the preview.

| Control | Behavior |
| --- | --- |
| Device toggle | Mobile and desktop have independent layouts; edit each separately |
| Profile and content cards | Use the top handle to move the whole card; internal text cannot be moved separately |
| Card placement | No grid, automatic column conversion or displacement of neighboring cards; overlapping cards is possible |
| Mobile cards | Cards start full-width and can be resized side by side, down to 44% width |
| **Move up / Move down** | With mobile preview selected in Content, save that card's mobile order immediately |
| Resize controls | Drag the lower corner continuously or use arrow keys; text sets the minimum visible height |
| **Reset** while arranging | Restore the standard layout as an unsaved change |

Horizontal coordinates scale with the available page width. On touchscreens, drag the handles; swipe elsewhere to scroll. The preview scrolls when a dragged handle reaches its upper or lower edge.

Select **Done**, then **Save page** to keep both layouts.

## Main-page blocks

Open **Content > Link**, then select **Add content**. The library groups the available blocks by purpose:

| Group | Blocks and presets |
| --- | --- |
| Essentials | Link, internal page navigation, compact links, contact, and CTA |
| Connected services | Social posts, media players, scheduling, forms, WhatsApp, and GitHub presets |
| Writing and structure | Heading, text, list, and separator |
| Media and embeds | Image, uploaded video, generic embed, and map |
| Engagement | Event, callout, and the native venue-menu card |

A list is a preconfigured text block. Connected-service entries create either a link or a consent-aware embed with provider-specific defaults. The page supports one compact-links row; edit the existing row to add, remove, or reorder its destinations.

Main pages and additional pages have no block count quota. Large pages are still subject to request and storage limits.

### Internal page navigation

Use **Internal page navigation** to connect the current block-based page to any other active destination without copying its public URL. The picker includes Home, Menu, Shop on OrbitPage SaaS, and published additional pages. It is available both in Content > Link and inside every additional page. Choose **Horizontal menu** for a single row of page tabs like Home, Shop, About, and Contact.

Each navigation block can contain up to 12 destinations. Choose a horizontal menu, full-width cards, two or three side-by-side cards, or small wrapping buttons. Labels, supporting descriptions and symbols are editable; descriptions and icons can be hidden, while filled, outline and minimal appearances inherit the active theme and any block-level color overrides.

Internal paths are resolved from the OrbitPage root, so navigation remains correct on custom domains, self-hosted subfolder installations. If an additional-page slug changes, reopen any navigation block that points to it and select the renamed destination again.

### Edit and arrange blocks

Each block has its own edit panel. The available fields depend on the block type and can include:

- title, description, destination, icon, and cover media;
- alignment, size, typography, colors, and surface style;
- contact details or social destinations;
- video playback, event, map, callout, or embed settings;
- CTA intent such as booking, contact, download, subscription, or purchase;
- visibility, availability, status, campaign label, and schedule.

The floating **Save** button in Content saves edits from open cards together with additions and reordering. **Revert** discards the current unsaved content changes. The **Unsaved changes** badge identifies pending work.

The toolbar can also export only the Link blocks to `links-export.json`. Importing that format validates the file and replaces the current Link block list. Create a full backup before importing if the existing list may be needed later.

### Visibility and scheduling

These controls have different effects:

- Turning a block off hides it.
- `Draft` and `Expired` blocks are not rendered; `Live` blocks can be rendered.
- A start or end date and time limits a live block to that window in the selected IANA timezone, such as `Europe/Rome`.
- **Available now** keeps an actionable card visible but disables its destination when unavailable.
- Empty blocks that have no renderable content are omitted from the public page.

After changing a schedule, test once before the start, once during the active window, and once after the end. When the block has no timezone, the server uses its `TZ` setting and then UTC. An invalid timezone falls back to UTC, so use a recognized IANA timezone when local time matters.

### Embeds and consent

Use a provider preset when one is available. OrbitPage converts supported public share URLs to the provider's official embedded form and rejects unrelated hosts. Custom snippets run in a sandbox.

See [External modules](../../integrations/external-modules.md) for accepted URLs and provider settings, and [Consent management](../../integrations/consent-management.md) for CMP installation.

For any category other than **Necessary**, the provider is not contacted until the visitor grants that consent category. Mark an embed Necessary only when it performs no tracking and is required for the requested page function. See [Analytics and privacy](./analytics-and-privacy.md) before publishing third-party content.

## Menu

The menu opens with the mobile public preview, using the same phone and desktop frames as Shop. Use the device buttons to check desktop too. On a phone, device controls are below the site-section bar.

1. Click the title or introduction to edit them, venue type, currency and locale in a popup. The locale controls price formatting.
2. Select **Add section** or **Add item** in the toolbar. Click an existing section or dish in the preview to edit it. Hover or focus it for move up/down and delete controls; on touch screens these controls stay visible. Items move only within their own section, and sections move only among siblings.
3. Select **Personalize** to upload or remove an optional menu logo, or change preset themes, colors, typography, corner radius and image layout. The logo keeps its proportions at the right of the menu header in both preview and the public menu.
4. Click the footer in the preview to edit its text. The Made with OrbitPage switch uses the page branding setting for every workspace page; SaaS plans and page permissions determine whether it can be changed. OSS keeps the badge visible.
5. Select **Apply** to save popup edits automatically. Reordering and confirmed deletions also save immediately. Use **Save** for changes in Personalize or to retry a failed action. **Cancel** restores the popup's starting values; **Reset** discards the unsaved menu draft.

Sections can have one level of subsections. Deletion asks for confirmation; deleting a section also removes its subsections and items. **Revert** in the saved notice restores the previous menu. Disable **Allow collapsing this section** in Edit section to keep that section open and hide its arrow. Item popups include prices, images, dietary tags, allergens, availability and featured state. Invalid names and failed saves keep your draft available for correction or retry.

**Publish menu** and **Unpublish** save menu visibility immediately; save or revert other edits before using them. The menu is exposed at `/menu` under the configured public URL. Hosted publication follows the workspace publication flow. To link it from the main page, add an **Internal page navigation** or **Menu** block in Content. The menu theme remains independent from the main-page theme.

## Additional pages

Use **Content > Pages** for destinations that need their own URL and block list, such as services, an event program, or a portfolio section. Every subpage has:

- a unique lowercase slug made from letters, numbers, and hyphens;
- a title and short description;
- its own ordered blocks;
- a Published or Hidden state.

The main page is permanent. The self-hosted edition has no plan-based page quota. **Add page** creates a hidden draft, so it is not public until you publish it. Choose an additional page from the page cards, complete **Page settings**, then add blocks under **Build this page**. Its live preview appears only after a page exists and follows the selected page. Subpages reuse the installation's profile and theme, while their title, description, and blocks remain independent.

Select **Save settings** after changing the slug, title, description, or publication state. Select **Save** in the content toolbar after editing or reordering blocks; this also saves any pending page settings. If blocks have unsaved changes, save them before using **Save settings**. Switching pages asks for confirmation before discarding unsaved work. Deleting a subpage removes its public URL.

When linking to a subpage, prefer **Internal page navigation** instead of typing a second copy of the URL. Compact links can still provide icon-only shortcuts. After changing a slug, check every navigation block, external bookmark or QR code that used the old path.

## Theme and background

Use a page preset as the starting point, then refine only what the page needs. Theme controls include:

- page, profile-card, and content-card colors;
- a shared font family;
- one content-card surface or a rotating set of variants;
- solid, transparent, and liquid-glass surfaces;
- card radius, spacing, blur, shadow, and public-page width;
- solid color, gradient, uploaded MP4/WebM video, or uploaded GIF backgrounds.

Video backgrounds autoplay muted and loop. They pause when the visitor has reduced motion enabled. For video or GIF backgrounds, adjust opacity, blur, overlay, brightness, saturation, contrast, scale, and fit until foreground content remains readable. **Cover** may crop, **Contain** can letterbox, and **Fill** can distort the media.

The design precedence is:

1. Theme defaults.
2. Profile-card overrides in Page.
3. Individual block overrides in Content.

If cards become visually inconsistent, reset individual overrides first and then tune the shared theme. The floating **Save** and **Revert** actions appear when the theme differs from the saved version. Returning to the saved preset clears the draft and comparison slider. Colors, Type, Layout and Background stay on one horizontally scrollable row. Save changes before leaving the workspace.

## Media lifecycle

Raster uploads accept PNG, JPEG, GIF, WebP, and AVIF; non-animated images are optimized to AVIF when the browser supports encoding it and otherwise to WebP. Uploads are checked for their actual media type and applicable limits.

| Edition | Storage and limits |
| --- | --- |
| **Open Source** | Uploaded images, video, GIFs, icons and covers are stored under `DATA_DIR/uploads`. The installation administrator controls per-file and total upload limits through [Configuration](../../administration/Configuration.md#variables). |
| **SaaS** | Uploads count toward managed workspace storage. **Plan** shows usage and the plan's allowances; per-file limits also apply. The plan controls additional-page availability and other hosted features. |

Removing media from a block or theme removes the reference, not necessarily the stored file. Use **Backup > Check unused media** before cleanup, and keep a backup before selecting **Clean now**. The [backups and demo-mode guide](./backups-and-demo-mode.md) explains the complete workflow.

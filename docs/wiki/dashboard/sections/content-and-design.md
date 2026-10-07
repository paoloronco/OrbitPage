# Content and design

![Page, content blocks, menu, additional pages and theme in the site editor](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.74/orbitpage-feature-content-and-design-4.21.75.gif)

Edit your page in **Page**, **Content**, **Menu**, **Pages**, and **Theme**:

1. Set the public identity in **Page**.
2. Add and arrange the main-page blocks in **Content > Link**.
3. Add a menu or additional pages if needed.
4. Set colors, fonts, and background in **Theme**.
5. Save each workspace, then open **Public page** and check the result at mobile and desktop widths.

The dashboard preview uses the public renderer, but the public URL is the final check for browser metadata, external embeds, consent behavior, and real navigation.

## Page identity

Use **Page** for profile and browser settings:

- choose the creator, company, or studio profile type;
- set the page name, description, role or activity, and location;
- upload a profile image, then choose its visibility, shape, and size;
- add supported social profiles;
- set the browser title, favicon, search description, and footer;
- optionally override the profile-card surface, border, colors, shadow, and typography.

The selected profile type changes the labels for the two detail fields; it does not create a separate kind of public page. The favicon may be different from the profile image.

In **Social links**, enter the username for each network; OrbitPage builds the public profile link automatically. YouTube uses a channel handle, Discord an invite code, WhatsApp a phone number, and Mastodon a full `@username@instance` handle. Leave a field empty to hide that social icon. Existing saved links remain editable.

Most profile-card settings inherit from **Theme**. An explicit value in **Page** takes precedence. Use **Use theme** or reset the card appearance when you want it to inherit the shared design again.

Changes in Page remain a draft in the browser until you select **Save** in the Page toolbar. **Revert** discards the current unsaved draft.

### Arrange the layout

Select **Arrange** (the pencil button) to move and resize elements in the preview.

| Control | Behavior |
| --- | --- |
| Device toggle | Mobile and desktop have independent layouts; edit each separately |
| Profile and link elements | Move profile elements, cards, and a standard link card's icon/title/description/URL |
| Desktop card placement | Drag beside another card to align their row; full-width cards become two columns, custom widths are kept |
| Mobile cards | Regular cards stay full-width; **Small** cards can sit side by side |
| **Move up / Move down** | With mobile preview selected in Content, save that card's mobile order immediately |
| Resize controls | Drag the lower corner or use arrow keys; the original width is an available stop |
| **Reset** while arranging | Restore the standard layout as an unsaved change |

Desktop horizontal coordinates scale with the available page width. Alignment guides help with placement; reduced-motion preferences disable arranging animation.

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

The menu has its own public route and theme:

1. Under **Settings**, choose restaurant, bar, or cafe, then set the public name, description, ISO currency, and locale. The locale controls number and price formatting.
2. Under **Content**, create visible categories. A category can have one level of subsections.
3. Add items with name, description, price, optional image and details, dietary tags, allergens, availability, featured state, and up to eight priced options.
4. Under **Design**, choose a menu preset or adjust its colors, radius, and image layout independently from the main-page theme.

Use the category filter and item search to keep large menus manageable. Products can be moved between a category and one of its subsections. Deleting a category also removes its subsections and all items inside them, so export a backup first if the content may be needed.

Enable the menu and select **Save** to publish it at `/menu` under the configured public page URL. The menu editor has no second publish step. Use **Add menu link to main page** to create or refresh the native menu card in Link, then save the Link blocks as well.

Menu, category, item and option names must not be empty. If validation fails,
the editor shows the field to correct and keeps your unsaved changes; correct
it and select **Save** again. The footer accepts your own note or an empty value.

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

If cards become visually inconsistent, reset individual overrides first and then tune the shared theme. Select **Save changes** in Theme before leaving the workspace.

## Media lifecycle

Images, video, GIFs, icons, and covers uploaded through the editor are stored under `DATA_DIR/uploads`. Raster uploads accept PNG, JPEG, GIF, WebP, and AVIF; non-animated images are optimized to AVIF when the browser supports encoding it and otherwise to WebP. The server validates media type, per-file limits, and the installation-wide upload quota. See [Configuration](../../administration/Configuration.md) for the current controls.

Removing media from a block or theme removes the reference, not necessarily the stored file. Use **Backup > Check unused media** before cleanup, and keep a backup before selecting **Clean now**. The [backups and demo-mode guide](./backups-and-demo-mode.md) explains the complete workflow.

# Content blocks

Add and arrange links, text, media and connected services, control their visibility and connect pages through internal navigation.

Part of [Content and design](./content-and-design.md).

## Main-page blocks

Open **Content > Link**, then select **Add content**. The library groups the available blocks by purpose:

Quick-add shortcuts include Instagram, WhatsApp, Facebook and TikTok. Forms & tools includes Calendly, Google Forms, Typeform, Google Calendar, GitHub and Loom; the full library remains available through **Add content**.

| Group | Blocks and presets |
| --- | --- |
| Essentials | Link, internal page navigation, compact links, contact, and CTA |
| Connected services | Social posts, media players, scheduling, forms, WhatsApp, and GitHub presets |
| Writing and structure | Heading, text, list, and separator |
| Media and embeds | Image, uploaded video, generic embed, and map |
| Engagement | Event, callout, and the native venue-menu card |

A list is a preconfigured text block. Connected-service entries create either a link or a consent-aware embed with provider-specific defaults. The page supports one compact-links row; edit the existing row to add, remove, or reorder its destinations.

Main pages and additional pages have no block count quota. Large pages are still subject to request and storage limits.

## Internal page navigation

Use **Internal page navigation** to connect the current block-based page to any other active destination without copying its public URL. The picker includes enabled Home, Menu and Shop destinations, plus published additional pages. It is available both in Content > Link and inside every additional page. Choose **Horizontal menu** for a single row of page tabs like Home, Shop, About, and Contact.

Each navigation block can contain up to 12 destinations. Choose a horizontal menu, full-width cards, two or three side-by-side cards, or small wrapping buttons. Labels, supporting descriptions and symbols are editable; descriptions and icons can be hidden, while filled, outline and minimal appearances inherit the active theme and any block-level color overrides.

Internal paths are resolved from the OrbitPage root, so navigation remains correct on custom domains and self-hosted subfolder installations. If an additional-page slug changes, reopen any navigation block that points to it and select the renamed destination again.

## Edit and arrange blocks

Each block has its own edit panel. The available fields depend on the block type and can include:

- title, description, destination, icon, and cover media;
- alignment, size, typography, colors, and surface style;
- contact details or social destinations;
- video playback, event, map, callout, or embed settings;
- CTA intent such as booking, contact, download, subscription, or purchase;
- visibility, availability, status, campaign label, and schedule.

The floating **Save** button in Content saves edits from open cards together with additions and reordering. **Revert** discards the current unsaved content changes. The **Unsaved changes** badge identifies pending work.

The toolbar can also export only the Link blocks to `links-export.json`. Importing that format validates the file and replaces the current Link block list. Create a full backup before importing if the existing list may be needed later.

## Visibility and scheduling

These controls have different effects:

- Turning a block off hides it.
- `Draft` and `Expired` blocks are not rendered; `Live` blocks can be rendered.
- A start or end date and time limits a live block to that window in the selected IANA timezone, such as `Europe/Rome`.
- **Available now** keeps an actionable card visible but disables its destination when unavailable.
- Empty blocks that have no renderable content are omitted from the public page.

After changing a schedule, test once before the start, once during the active window, and once after the end. When the block has no timezone, the server uses its `TZ` setting and then UTC. An invalid timezone falls back to UTC, so use a recognized IANA timezone when local time matters.

## Embeds and consent

Use a provider preset when one is available. OrbitPage converts supported public share URLs to the provider's official embedded form and rejects unrelated hosts. Custom snippets run in a sandbox.

See [External modules](../../integrations/external-modules.md) for accepted URLs and provider settings, and [Consent management](../../integrations/consent-management.md) for CMP installation.

For any category other than **Necessary**, the provider is not contacted until the visitor grants that consent category. Mark an embed Necessary only when it performs no tracking and is required for the requested page function. See [Analytics and privacy](./analytics-and-privacy.md) before publishing third-party content.

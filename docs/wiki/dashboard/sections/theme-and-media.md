# Theme and media

Choose shared colors, typography and backgrounds, understand appearance overrides and manage uploaded media throughout its lifecycle.

Part of [Content and design](./content-and-design.md).

## Theme and background

Use a page preset as the starting point, then refine only what the page needs. Theme controls include:

- page, profile-card, and content-card colors;
- a shared font family;
- one content-card surface or a rotating set of variants;
- solid, transparent, and liquid-glass surfaces;
- card radius, spacing, blur, shadow, and public-page width;
- solid color, gradient, uploaded MP4/WebM video, or uploaded GIF backgrounds.

**Page themes**, **Card styles**, and **Fine tuning** share the top navigation. In Fine tuning, click your profile or a card in the real page preview to edit that element. The dialog places its controls on the left and a live element preview on the right; on phones, the preview appears above the controls. Background and layout buttons open the corresponding page controls. Additional typography, gradient and surface options stay collapsed until needed.

For a selected card, choose **This card** to override its appearance or **Shared style** to update the common style. Individual overrides remain active when editing the shared style. **Reset to shared style** removes the selected card's overrides; **Use shared style on every card** clears all individual style overrides in the draft. Profile appearance controls use the same overrides as the Page editor. Hosted plan permissions still apply to advanced customization.

## Moving backgrounds

Video backgrounds autoplay muted and loop. They pause when the visitor has reduced motion enabled. For video or GIF backgrounds, adjust opacity, blur, overlay, brightness, saturation, contrast, scale, and fit until foreground content remains readable. **Cover** may crop, **Contain** can letterbox, and **Fill** can distort the media.

## Design precedence

The design precedence is:

1. Theme defaults.
2. Profile-card overrides in Page.
3. Individual block overrides in Content.

All edits stay in a draft until **Save** or **Save changes**. **Done** closes the dialog while keeping the draft; **Revert** discards unsaved changes. Switching among the three Theme tabs preserves the draft and shows it in the comparison preview. If saving multiple sections partly succeeds, the error explains which changes remain unsaved and retry keeps that remaining draft. Save changes before leaving the Theme workspace.

## Media lifecycle

Raster uploads accept PNG, JPEG, GIF, WebP, and AVIF; non-animated images are optimized to AVIF when the browser supports encoding it and otherwise to WebP. Uploads are checked for their actual media type and applicable limits.

| Edition | Storage and limits |
| --- | --- |
| **Open Source** | Uploaded images, video, GIFs, icons and covers are stored under `DATA_DIR/uploads`. The installation administrator controls per-file and total upload limits through [Configuration](../../administration/Configuration.md#variables). |
| **SaaS** | Uploads count toward managed workspace storage. **Plan** shows usage and the plan's allowances; per-file limits also apply. The plan controls additional-page availability and other hosted features. |

Removing media from a block or theme removes the reference, not necessarily the stored file. Use **Backup > Check unused media** before cleanup, and keep a backup before selecting **Clean now**. The [backups and demo-mode guide](./backups-and-demo-mode.md) explains the complete workflow.

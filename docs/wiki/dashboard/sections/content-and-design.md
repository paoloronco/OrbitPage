# Content and design

![Page, content blocks, menu, additional pages and theme in the site editor](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.74/orbitpage-feature-content-and-design-4.21.75.gif)

Edit your public identity, content blocks, menu, additional pages and appearance in **Page**, **Content**, **Menu**, **Pages**, and **Theme**:

1. Set the public identity in **Page**.
2. Add and arrange the main-page blocks in **Content > Link**.
3. Add a menu or additional pages if needed.
4. Set colors, fonts, and background in **Theme**.
5. Save each workspace, then open **Public page** and check the result at mobile and desktop widths.

The dashboard preview uses the public renderer, but the public URL is the final check for browser metadata, external embeds, consent behavior, and real navigation.

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

Select **Arrange** (the pencil button) in a desktop browser to move or resize whole cards. Phone browsers keep the preview and item editing controls but do not show Arrange.

Alignment guides are visual aids; hold Shift while dragging to snap to them. Arrow keys adjust by one pixel, or ten with Shift. Escape cancels the current drag.

Card text wraps and the card grows to keep it readable. Existing vertical gaps are preserved when text needs more height. Icons, titles, descriptions and URLs use the automatic card layout; choose Left, Center or Right in the card's **Alignment** setting. Old saved text coordinates are ignored.

Content blocks share the same text frame: Left and Right use matching horizontal insets, and Center uses the card's exact center. Font size, font family, colors, block size and card surface do not change that frame. Icons and copy controls occupy separate rows so they cannot shift the text. The same rules apply in the editor preview and on the public page.

The profile card grows and shrinks with its visible image, name, description, details and social links. Text wraps within the chosen width. Resizing the profile vertically sets its minimum height; longer content can still expand it. Both content changes and vertical resizing move the following cards while preserving their gaps. Saving a layout keeps the manual minimum separate from the measured content height. Existing custom profile-element positions remain supported.

| Control | Behavior |
| --- | --- |
| Device toggle | Mobile and desktop have independent layouts; edit each separately |
| Profile and content cards | Use the top handle to move the whole card; internal text cannot be moved separately |
| Card placement | Move cards freely without a grid or column conversion; profile height changes reserve space for following cards |
| Mobile cards | Cards start full-width and can be resized side by side, down to 44% width |
| **Move up / Move down** | With mobile preview selected in Content, save that card's mobile order immediately |
| Resize controls | Drag the lower corner continuously or use arrow keys; text sets the minimum visible height |
| **Reset** while arranging | Restore the standard layout as an unsaved change |

Horizontal coordinates scale with the available page width. On touchscreens, drag the handles; swipe elsewhere to scroll. The preview scrolls when a dragged handle reaches its upper or lower edge.

Select **Done**, then **Save page** to keep both layouts.

## Main-page blocks

<a id="internal-page-navigation"></a>
<a id="edit-and-arrange-blocks"></a>
<a id="visibility-and-scheduling"></a>
<a id="embeds-and-consent"></a>
Use the [Content blocks](./content-blocks.md#main-page-blocks) guide for the complete steps.

## Menu

Use the [Menu](./menu.md#preview-and-navigation) guide for the complete steps.

## Additional pages

Use **Content > Pages** for destinations that need their own URL and block list, such as services, an event program, or a portfolio section. Every subpage has:

- a unique lowercase slug made from letters, numbers, and hyphens;
- a title and short description;
- its own ordered blocks;
- a Published or Hidden state.

The main page is permanent. The self-hosted edition has no plan-based page quota. **Add page** creates a hidden draft, so it is not public until you publish it. Choose an additional page from the page cards, complete **Page settings**, then add blocks under **Build this page**. Its live preview appears only after a page exists and follows the selected page. Subpages reuse the installation's profile and theme, while their title, description, and blocks remain independent. Their blocks follow the profile in normal vertical order; the main page's custom card positions apply only to the main page.

Select **Save settings** after changing the slug, title, description, or publication state. Select **Save** in the content toolbar after editing or reordering blocks; this also saves any pending page settings. If blocks have unsaved changes, save them before using **Save settings**. Switching pages asks for confirmation before discarding unsaved work. Deleting a subpage removes its public URL.

When linking to a subpage, prefer **Internal page navigation** instead of typing a second copy of the URL. Compact links can still provide icon-only shortcuts. After changing a slug, check every navigation block, external bookmark or QR code that used the old path.

## Theme and background

Use the [Theme and media](./theme-and-media.md#theme-and-background) guide for the complete steps.

## Media lifecycle

Use the [Theme and media](./theme-and-media.md#media-lifecycle) guide for the complete steps.

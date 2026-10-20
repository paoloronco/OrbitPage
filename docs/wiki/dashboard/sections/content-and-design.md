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

Content blocks use matching outer insets, and Center uses the card's exact center. Link cards keep the icon, copy and copy-link control on one compact row with equal side slots; Left and Right use matching insets within that row. Text and bulleted-list cards keep the title beside the icon, with the body below that row, including cards with a cover image. Very narrow cards stack their contents to keep text readable. Font size, font family, colors and card surface do not change the alignment. The same rules apply in the editor preview and on the public page. Internal navigation lists and buttons also keep icons beside their labels; the Grid option retains its tile layout. Explicit card heights remain minimum sizes, with navigation items grouped at the top rather than stretched through the empty space.

The profile card grows and shrinks with its visible image, name, description, details and social links. In Arrange, move and resize the image, name, work, location and social links independently. Hover over an element or focus it with Tab to reveal its controls. A visible 8px grid guides their placement; hold Alt while dragging for free movement. Arrow keys move an element by one pixel, or eight with Shift. Escape cancels the current drag. Alignment buttons set the text alignment within an element. Work and location start on the same baseline, and text wraps within the chosen width. A colliding move or resize is rejected and the previous arrangement is restored.

The bio always follows the arranged elements, centered at full width. It has no move, resize or alignment handles; older saved bio coordinates are ignored. Growing elements move the bio and following cards down automatically. **Reset profile arrangement** restores the default internal arrangement for the selected device as an unsaved change; mobile and desktop remain independent. Existing custom positions for the other profile elements remain supported.

Resizing the whole profile card vertically sets its minimum height; longer content can still expand it. Automatic content growth moves the following cards while preserving their gaps. Saving a layout keeps the manual minimum separate from the measured content height.

Manual moves and resizes must fit in free space, including when a narrower card makes its text wrap onto more lines. A colliding change is rejected in full and the previous layout is kept; other cards stay where they are. A temporary **Change not applied: space occupied** notice appears at the top and explains how to choose a free position or smaller size. The same rule applies to pointer, touch and keyboard controls in both layouts. Older overlapping layouts and growing profile elements are separated automatically in preview and on the public page without rewriting saved data.

After a rejected drag, release the handle and start again. To move past an occupied area, use separate moves through free space, for example right, down, then left. The notice disappearing does not interrupt the next drag, and a rejected drag stops automatic preview scrolling.

| Control | Behavior |
| --- | --- |
| Device toggle | Mobile and desktop have independent layouts; edit each separately |
| Profile and content cards | Use the top handle to move the whole card; internal text cannot be moved separately |
| Card placement | Move cards freely in unoccupied space without a grid or column conversion; overlapping moves or resizes are rejected |
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

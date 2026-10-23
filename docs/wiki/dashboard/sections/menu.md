# Menu

Create a venue menu with sections, items, prices, dietary information and its own appearance, then publish it at your page’s menu address.

Part of [Content and design](./content-and-design.md).

## Preview and navigation

The menu opens with the mobile public preview, using the same phone and desktop mockups as Page and Content. Use the device buttons to check desktop too. On a phone, device controls are below the site-section bar.

## First-use setup

An unused menu opens a full-page setup flow. Enter the venue name, optionally upload a logo, and choose the venue type and menu language. Restaurant, bar and café starters use categories in the selected language; **Other** starts with one editable category. Existing configured menus open directly in the editor.

Rename, reorder, remove or add categories in the full-width category step. Add dishes or drinks inside each category using the regular item editor, then choose **Finish setup** to save everything. A failed save keeps the draft and allows a retry. Setup does not publish the menu; publication remains a separate action.

## Edit menu content

1. Click the title or introduction to edit them, venue type, currency and locale in a popup. The locale controls price formatting.
2. Select **Add section** or **Add item** in the toolbar. Click an existing section or dish in the preview to edit it. Hover or focus it for move up/down and delete controls; on touch screens these controls stay visible. Items move only within their own section, and sections move only among siblings.
3. Select **Personalize** to upload or remove an optional menu logo, or change preset themes, colors, typography, corner radius and image layout. The logo keeps its proportions at the right of the menu header in both preview and the public menu.
4. Click the footer in the preview to edit its text. The Made with OrbitPage switch uses the page branding setting for every workspace page; SaaS plans and page permissions determine whether it can be changed. OSS keeps the badge visible.
5. Select **Apply** to save popup edits automatically. Reordering and confirmed deletions also save immediately. Use **Save** for changes in Personalize or to retry a failed action. **Cancel** restores the popup's starting values; **Reset** discards the unsaved menu draft.

## Sections and items

Sections can have one level of subsections. Deletion asks for confirmation; deleting a section also removes its subsections and items. **Revert** in the saved notice restores the previous menu. Edit section groups two independent switches in bordered panels: disable **Allow collapsing this section** to keep it open and hide its arrow, or disable **Show section number** to hide its 01, 02, 03 label. Existing sections keep both options enabled by default. Item popups include prices, images, dietary tags, allergens, availability and featured state. Invalid names and failed saves keep your draft available for correction or retry.

## Publish and link the menu

**Publish menu** and **Unpublish** save menu visibility immediately; save or revert other edits before using them. The menu is exposed at `/menu` under the configured public URL. Hosted publication follows the workspace publication flow. To link it from the main page, add an **Internal page navigation** or **Menu** block in Content. The menu theme remains independent from the main-page theme.

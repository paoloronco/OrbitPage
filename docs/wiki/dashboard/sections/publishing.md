# Publishing and QR codes

![Publish workspace with QR destination, preview and export controls](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.74/orbitpage-feature-publishing-4.21.75.png)

Saved content appears at the public URL. Save each section before opening **Public page**; an unsaved preview does not change the public page.

## Before sharing

1. Check the production HTTPS address for your edition under **Public address** below.
2. Save Page, Content, Menu/subpages, Theme and Privacy as applicable.
3. Open the public URL in a signed-out browser and check navigation, media,
   contact destinations, consent and mobile layout.
4. Review metadata, indexing and discovery in
   [SEO and indexing](../../SEO-and-indexing.md).

Additional pages must be marked **Published**; Menu and Shop have their own publication controls. If saving reports a publication error, resolve it and check the public result again.

## Public address

| Edition | Configuration |
| --- | --- |
| **Open Source** | Set the production HTTPS URL in `PUBLIC_SITE_URL`, including any mount path. See [Configuration](../../administration/Configuration.md#variables). |
| **SaaS** | Use the workspace's OrbitPage public address or an active custom domain. The owner connects a domain from **Plan** when the plan includes it; no server environment variables are needed. |

For a SaaS custom domain, copy the ownership-verification and routing records shown in Plan to your DNS provider. Keep DNS proxying disabled until activation, allow for propagation, and use the status check. Share the address only after ownership, routing and HTTPS are ready. See [Custom domains](https://orbitpage.com/en-US/docs/custom-domains) for the complete hosted setup.

## Search titles and link previews

Set a browser title, search description and favicon in **Page**. Check that the title and description describe the published content. Search engines and messaging apps can cache old previews; saving a change does not immediately refresh their copies.

Indexing controls let you exclude a page from search. They do not make the URL private or prevent someone with the address from opening it.

## Static QR

Open **Publish → QR**. Choose the public page, the enabled Menu or a custom
public path. Confirm the resolved destination displayed by the tool. Choose
the screen or print preset, colors, size, quiet-zone margin and error correction,
then download PNG or SVG. Settings are remembered in this browser for that URL.

The tool blocks download when QR contrast is insufficient. Keep a clear quiet
zone and test the exported image with a phone at its final display/print size.
A static QR embeds its URL: changing that URL requires a new image and print.
Changing the content at the same URL does not.

## Smart campaign QR

Use the campaign controls to create a stable campaign link, choose its default
destination and timezone, and optionally set lunch/dinner destination windows.
Select that campaign as the QR destination. Verify the default and scheduled
targets and save campaign changes before distributing the QR.

The printed campaign URL stays the same when its saved target changes. Keep
the campaign and public hostname available; deleting the campaign or changing
the hostname breaks already distributed codes. Test timezone and overlapping
schedule choices against the preview before relying on them for opening hours.

## Sitemap and text files

**Publish → Sitemap** generates the current public-route list. Disabled destinations are excluded.
**Publish → TXT** edits robots, humans, AI, LLM and security discovery files and
custom text endpoints. Save the relevant editor, then inspect the public
endpoint. Machine-readable page Markdown is opt-in and distinct from `llms.txt`.
Use the [SEO guide](../../SEO-and-indexing.md) for paths, limits and indexing rules.

When you change a page slug or domain, check the sitemap, navigation blocks, QR destinations and external links together.

If a QR points to localhost, the wrong hostname or a language-prefixed dashboard
URL, correct the public URL configuration before exporting again. For proxy and
mount-path problems, see [Troubleshooting](../../administration/Troubleshooting.md).

# Product screenshots

[orbitpage-public-page.png](./orbitpage-public-page.png) is captured from the
self-hosted public renderer at 1280 × 720 using an isolated local installation
and fictional Studio North content. It is also the About page's illustration
and social-preview image; preserve its path and dimensions when replacing it.

The README's `orbitpage-product-loop.gif` is a 1600 × 1000 loop of four current
OSS 4.21.62 views: profile editing, a selected content block, theme selection
with mobile preview, and the public page. Each scene stays visible for three
seconds. Captured on 2026-10-06 from a fresh isolated local installation using
fictional Studio North content, it contains no hosted account or customer data.
Browser screenshots use a 1280 × 800 viewport at 1.25 device pixel ratio; GIF
encoding uses a separate 256-color palette for each scene, without upscaling.
Brand source assets live in
[`app/public/brand`](../../app/public/brand); their usage is documented in the
[design system](../wiki/design-system.md#brand).

To refresh the image, build the current app, start it with a new isolated
`DATA_DIR`, complete setup, save fictional profile and content, and capture the
public page with Playwright at the dimensions above. Inspect the image before
committing. Never capture a real account, credentials, dashboard recovery tools
or customer content. Browser output and fixture data remain ignored.

For the loop, capture the same fictional workspace at
`/en-US/dashboard/editor/page`, `/en-US/dashboard/editor/content` (select a
block), `/en-US/dashboard/theme`, and `/`. Wait for fonts, images and interface
transitions to settle before each screenshot. Encode the four 1600 × 1000
frames at three seconds per frame with a per-scene palette and infinite looping.
Review the decoded GIF at its README display width of 800 pixels as well as at
native resolution; text must remain legible in the final GIF.

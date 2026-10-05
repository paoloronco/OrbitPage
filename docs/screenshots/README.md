# Product screenshots

[orbitpage-public-page.png](./orbitpage-public-page.png) is captured from the
self-hosted public renderer at 1280 × 720 using an isolated local installation
and fictional Studio North content. It is also the About page's illustration
and social-preview image; preserve its path and dimensions when replacing it.

The README's `orbitpage-product-loop.gif` is the illustrated product walkthrough
restored from its preceding presentation. It uses fictional examples and is a
concept animation, not a recording of the current dashboard. The PNG above
documents the actual public renderer. Brand source assets live in
[`app/public/brand`](../../app/public/brand); their usage is documented in the
[design system](../wiki/design-system.md#brand).

To refresh the image, build the current app, start it with a new isolated
`DATA_DIR`, complete setup, save fictional profile and content, and capture the
public page with Playwright at the dimensions above. Inspect the image before
committing. Never capture a real account, credentials, dashboard recovery tools
or customer content. Browser output and fixture data remain ignored.

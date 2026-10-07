# Product screenshots

[orbitpage-public-page.png](./orbitpage-public-page.png) is captured from the
self-hosted public renderer at 1280 × 720 using an isolated local installation
and fictional Studio North content. It is also the About page's illustration
and social-preview image; preserve its path and dimensions when replacing it.

The README's `orbitpage-product-loop.gif` is a 1600 × 1000 loop of eight current
OSS 4.21.66 views: page editing, a selected content block, menu design, additional
pages, themes, newsletter, QR publishing and the public page. Each scene stays visible for three
seconds. Captured on 2026-10-06 from a fresh isolated local installation using
fictional Studio North content, it contains no hosted account or customer data.
Browser screenshots use a 1280 × 800 viewport at 1.25 device pixel ratio; GIF
encoding uses one shared 256-color palette and complete frames, without upscaling
or incremental frame overlays. The blue and ivory workspace uses static images.
The GIF starts and loops automatically; GitHub's viewer animation preferences
can pause animated images.
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
block), `/en-US/dashboard/editor/menu` (Design), `/en-US/dashboard/editor/pages`,
`/en-US/dashboard/theme`, `/en-US/dashboard/newsletter` (Campaigns),
`/en-US/dashboard/publish/QR`, and `/`. Wait for fonts, images and interface
transitions to settle before each screenshot. Encode the eight 1600 × 1000
frames at three seconds per frame with a shared palette, complete frames and infinite looping.
Review the decoded GIF at its README display width of 800 pixels as well as at
native resolution; text must remain legible in the final GIF.

## Dashboard guide GIFs

The [dashboard guide](../wiki/dashboard/dashboard.md) embeds three GIFs hosted as GitHub
release assets. The binaries stay outside Git.

| GIF | Sections | Size |
| --- | --- | --- |
| [Site editor](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.74/orbitpage-dashboard-site-editor-4.21.75.gif) | Page, Content, Menu, Pages, Theme, AI Assistant | 436 KiB |
| [Content management](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.74/orbitpage-dashboard-content-management-4.21.75.gif) | Publish, Backup, Analytics, Privacy, Newsletter | 305 KiB |
| [Account and installation](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.74/orbitpage-dashboard-account-installation-4.21.75.gif) | Team, Account, Edition | 156 KiB |

Captured on 2026-10-07 from OSS 4.21.75 with fictional Studio North content,
local users, a newsletter draft, and sample visits. Instance paths use the example
values `/app/data` and `/app/data/orbitpage.db`. No real accounts, credentials or
customer data appear. The AI view shows provider setup without a configured key.

Use a 1280 × 800 viewport at device pixel ratio 1 and three seconds per frame.
Encode each group with a shared 256-color palette, no dithering, infinite looping
and disposal mode 2. Check the decoded frames against the encoded source images
to catch rendering artifacts. To refresh them, follow the isolated capture
procedure above, upload new versioned filenames, and update the guide's URLs.
Keep published assets available for older documentation links.

## Dashboard section previews

The [dashboard section guides](../wiki/dashboard/README.md) reuse the real dashboard captures
from the same isolated OSS 4.21.75 session on 2026-10-07. Each guide embeds its
own preview from GitHub release assets; these binaries also stay outside Git.

| Guide | Preview | Size |
| --- | --- | --- |
| [Content and design](../wiki/dashboard/sections/content-and-design.md) | [GIF: Page, Content, Menu, Pages, Theme](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.74/orbitpage-feature-content-and-design-4.21.75.gif) | 373 KiB |
| [Publishing](../wiki/dashboard/sections/publishing.md) | [PNG: QR preview and export](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.74/orbitpage-feature-publishing-4.21.75.png) | 83 KiB |
| [Backups and demo mode](../wiki/dashboard/sections/backups-and-demo-mode.md) | [PNG: version history, export and restore](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.74/orbitpage-feature-backups-and-demo-mode-4.21.75.png) | 129 KiB |
| [Analytics and privacy](../wiki/dashboard/sections/analytics-and-privacy.md) | [GIF: reports and consent settings](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.74/orbitpage-feature-analytics-and-privacy-4.21.75.gif) | 108 KiB |
| [Newsletters](../wiki/dashboard/sections/newsletters.md) | [PNG: campaign editor and preview](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.74/orbitpage-feature-newsletters-4.21.75.png) | 77 KiB |
| [Account and team](../wiki/dashboard/sections/account-and-team.md) | [GIF: members and instance settings](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.74/orbitpage-feature-account-and-team-4.21.75.gif) | 101 KiB |

Dimensions and GIF encoding match the dashboard guide above. Preserve the
fictional data and example paths when refreshing these previews.

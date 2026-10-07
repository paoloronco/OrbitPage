# OrbitPage OSS design system

For UI changes, use the [dashboard stylesheet](../../app/src/index.css),
[UI components](../../app/src/components/ui), and [theme model](../../app/src/lib/theme.ts).

## Two visual contexts

The dashboard has a dark navigation rail, light editing
surfaces, clear section headings and visible save actions. The public page is
configured by the page owner: theme colors, typography, cards and background can differ
from the dashboard. Do not force dashboard chrome onto published content.

Use the checked-in brand SVGs described below. Do not redraw the mark in a component.

## Semantic tokens

Use the variables defined on `.orbitpage-admin` in `app/src/index.css` rather
than copying colors into each workspace. Current values:

| Role | CSS variable | Current value |
| --- | --- | --- |
| Canvas and surface | `--admin-canvas`, `--admin-surface` | `#f4f6f9`, `#ffffff` |
| Text | `--admin-ink`, `--admin-secondary-copy` | `#111b2d`, `#586a84` |
| Line | `--admin-line` | `#dbe2ec` |
| Navigation | `--admin-sidebar` | `#0d1728` |
| Action | `--admin-accent`, `--admin-accent-strong` | `#3167ef`, `#2456d3` |

The dashboard font stack is `--orbitpage-dashboard-font`: Aptos, Avenir Next,
Segoe UI Variable, Segoe UI and sans-serif. Public typefaces and colors come
from `ThemeConfig`; preview and published rendering must use the same model.
Check the stylesheet before changing a value.

## Components and interaction

| Pattern | Rule |
| --- | --- |
| Navigation and tabs | Mark the active item and keep the selected subsection in the dashboard URL. Keep the site-section strip at a consistent height when section controls appear or disappear. |
| Form fields | Use existing primitives and visible labels; attach validation to the relevant control. |
| Save | Show unsaved state and save results. Self-hosted public content becomes visible when saved; additional pages also have a publication state. |
| Cards and panels | Group a task or related data; preserve a readable hierarchy on narrow screens. |
| Dialogs and sheets | Give them a name, keyboard focus management and a clear cancel or close path. |
| Feedback | State loading, success and failure in words; do not rely on color or a transient toast for critical errors. |
| Preview | Show the shared renderer and distinguish unsaved or unpublished state from the live page. |

The [UI components](../../app/src/components/ui) and
[visual editor stylesheet](../../app/src/components/visual-site-editor.css) are
the component baseline. Extend an existing primitive or workspace pattern
before introducing a parallel one.

## Accessibility and responsive rules

- Preserve `:focus-visible` and the forced-colors focus override in the shared
  stylesheet. Every interactive control must work by keyboard.
- Use semantic landmarks, heading order and accessible names. Pair icons and
  status color with text when the meaning is not otherwise available.
- Keep controls and preview usable at phone widths and text zoom; avoid
  horizontal document overflow.
- Respect `prefers-reduced-motion`. Motion may clarify a transition but must
  not be required to understand a state or complete an action.
- Localize dashboard chrome while leaving saved page content as
  saved. Public URLs do not include a dashboard-language prefix.

When changing shared UI, verify the OSS editor and the hosted adapter that
embeds it. SaaS-specific framing belongs in the private repository; the
reusable component remains here. See [architecture](./architecture.md).

## Brand

Use the checked-in brand files without redrawing or recoloring them.

| Asset | Use |
| --- | --- |
| [orbitpage-mark.svg](../../app/public/brand/orbitpage-mark.svg) | Icon on white and light backgrounds |
| [orbitpage-lockup.svg](../../app/public/brand/orbitpage-lockup.svg) | Mark and wordmark on white and light backgrounds |
| [orbitpage-mark-on-dark.svg](../brand/orbitpage-mark-on-dark.svg) | Same icon geometry, with a light-blue page for dark backgrounds |
| [orbitpage-lockup-on-dark.svg](../brand/orbitpage-lockup-on-dark.svg) | Same lockup geometry, with a light-blue page and pale wordmark for dark backgrounds |

Reuse the approved light/dark SVGs at their original aspect ratio. Keep clear
space and sufficient contrast; do not recolor ad hoc, stretch or invent an
alternative mark. The original
source uses deep blue `#223B70`/`#101828`, orbit blue `#2456D8`/`#3568F4` and
light blue `#7BA2FF`. These describe the assets, not public-page theme limits.

The dark variant replaces the page's deepest colors with `#7BA2FF` and
`#E8F0FF`, keeping the orbit, highlight, typography and proportions. The README
uses `<picture>` with `prefers-color-scheme` to select the appropriate lockup;
the original is the fallback for viewers without theme selection.

README variants and transparent PNG exports live in `docs/brand`; the original
SVGs in `app/public/brand` remain the application source assets. PNGs are
available for tools that cannot use SVG:

| Background | Icon, 512 × 512 | Lockup, 1224 × 256 |
| --- | --- | --- |
| White/light | [PNG icon](../brand/orbitpage-mark-on-light.png) | [PNG lockup](../brand/orbitpage-lockup-on-light.png) |
| Dark | [PNG icon](../brand/orbitpage-mark-on-dark.png) | [PNG lockup](../brand/orbitpage-lockup-on-dark.png) |

Product screenshots must come from the current application with fictional
content; see [screenshot provenance](../screenshots/README.md).

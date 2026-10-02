# OrbitPage OSS design system

| Field | Value |
| --- | --- |
| Scope | Self-hosted dashboard, shared editor and public renderer |
| Status | Implemented rules; components, CSS and theme schema are authoritative |
| Sources | [Dashboard stylesheet](../app/src/index.css), [UI primitives](../app/src/components/ui/), [theme model](../app/src/lib/theme.ts), [brand assets](./brand/README.md) |

## Two visual contexts

The dashboard is a workbench with a dark navigation rail, light editing
surfaces, clear section headings and visible save actions. The public page is
creator-controlled: theme colors, typography, cards and background can differ
from the dashboard. Do not force dashboard chrome onto published content.

The open-orbit `O/P` monogram and its source SVGs are defined in the
[brand guide](./brand/README.md). Do not redraw the mark in a component.

## Semantic tokens

Use the variables defined on `.orbitpage-admin` in `app/src/index.css` rather
than copying colors into each workspace. Current workbench examples are:

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
These examples describe current source values, not a second token registry.

## Components and interaction

| Pattern | Rule |
| --- | --- |
| Navigation and tabs | Mark the active item and keep the selected subsection in the dashboard URL. |
| Form fields | Use existing primitives and visible labels; attach validation to the relevant control. |
| Save and Publish | Separate draft persistence from public publication and show the outcome of each action. |
| Cards and panels | Group a task or related data; preserve a readable hierarchy on narrow screens. |
| Dialogs and sheets | Give them a name, keyboard focus management and a clear cancel or close path. |
| Feedback | State loading, success and failure in words; do not rely on color or a transient toast for critical errors. |
| Preview | Show the shared renderer and distinguish unsaved or unpublished state from the live page. |

The [UI components](../app/src/components/ui/) and
[visual editor stylesheet](../app/src/components/visual-site-editor.css) are
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
- Localize dashboard chrome while leaving creator-authored page content as
  saved. Public URLs do not include a dashboard-language prefix.

When changing shared UI, verify the OSS editor and the hosted adapter that
embeds it. SaaS-specific framing belongs in the private repository; the
reusable component remains here. See [architecture](./architecture.md).

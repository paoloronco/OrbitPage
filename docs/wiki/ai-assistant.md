# AI assistant

Use **AI Assistant** or **Edit with AI** to propose profile, content, theme changes, draft Shop products, and new menu dishes. Manual editing works without a provider.

## Configure

| Edition | Provider and allowance |
| --- | --- |
| **Open Source** | Save an OpenAI API key in **AI Assistant**, or set `OPENAI_API_KEY` on the server. A dashboard-saved key takes precedence until removed. Usage charges belong to the API-key owner. |
| **SaaS** | The managed service supplies the provider configuration; you do not need to enter an OpenAI API key. Requests use the workspace's AI allowance shown in **Plan**. |

In OSS, the dashboard key is encrypted in SQLite, never returned to the browser, and excluded from JSON exports. Keep `JWT_SECRET` stable, or set a separate stable `ORBITPAGE_SECRET_ENCRYPTION_KEY` of at least 32 characters.

For self-hosted model selection, `OPENAI_PAGE_AGENT_MODEL` supplies the default when no selection is saved; see [Configuration](./administration/Configuration.md#variables).

## Describe the change

Say which content or design you want to change and include the exact text and destination links that matter. OrbitPage reads the current page and checks supported fields, your permissions and applicable limits. Use the normal editor for direct changes that do not need an AI request.

## Review and apply

1. Describe the change.
2. Review the proposed operations.
3. Confirm to apply them.

Generation does not save page changes. Confirmation checks input, permissions, and the page revision again. Proposals expire after ten minutes or become invalid if the page changed; request a new proposal in that case.

The conversation, suggested next steps, and pending preview with its Apply/Discard controls are saved in this browser for the current page. Reloading does not renew the ten-minute approval window. The preview uses the same phone and desktop/browser mockups as Site Editor and starts in a compact mobile view; switch to the 16:9 desktop view beside Apply changes when needed. Drag the two-arrow divider, or focus it and use the arrow keys, to compare before and after. The conversation scrolls to new replies and loaded previews, while manual scrolling lets you read earlier messages.

AI-generated next-step prompts appear above the composer. Selecting one sends it directly as your next message; it does not approve a proposal.

The conversation is saved in this browser for the current page. Use the trash button to clear the visible conversation and saved history.

## Data sent to the provider

Prompts and a limited representation of the current page go to the OpenAI Responses API, with provider-side storage disabled. Do not include secrets or sensitive private content.

## Launch Kit

In SaaS, Launch Kit accepts a reference screenshot in PNG, JPEG or WebP up to 4 MB and prepares an editable page proposal. Use an image you are allowed to use. A screenshot does not supply hidden links or verified facts: check the extracted text and add correct destinations before applying. Upload final public media through the normal editor.

The dashboard assistant and the [SaaS ChatGPT integration](https://orbitpage.com/en-US/docs/ai-and-chatgpt) are separate interfaces. Connecting ChatGPT requires its own approved application connection.

## Problems

| Message | Check |
| --- | --- |
| Configuration unavailable | Stable encryption secret of at least 32 characters |
| Provider error | Key, supported model, provider access, and outbound HTTPS |
| Proposal expired or page changed | Generate from the current page again |
| Operation not allowed | Account permissions or the requested action |
| SaaS allowance reached | Check workspace usage in **Plan**, or edit directly in the dashboard |

## Draft Shop products

Users with the required Shop and AI permissions can propose digital or service products with a title, description
and price in the configured Shop currency. Confirming creates drafts only: no files, booking/Cal.com URL
or delivery instructions are added, and products cannot be bought. Complete
[Shop setup](./dashboard/sections/shop.md#required-setup-and-ai-drafts) first,
then finish delivery details manually and make the product available when ready.
Proposals still check permission, catalog limits and revision on confirmation.

## Menu dishes

Ask for dishes with their names and prices in the menu currency. The assistant can add them to an existing section even while the Menu is private. Review the names, descriptions, section and amounts, then apply: visibility and homepage routing stay as configured. Ingredient, allergen and dietary claims are not invented. Required role permissions and plan limits still apply.

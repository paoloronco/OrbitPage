# AI assistant

Use **AI Assistant** or **Edit with AI** to propose profile, content, and theme changes. Manual editing works without a provider.

## Configure

Save an OpenAI API key in **AI Assistant**, or set `OPENAI_API_KEY` on the server. A dashboard-saved key takes precedence until removed.

The dashboard key is encrypted in SQLite, never returned to the browser, and excluded from JSON exports. Keep `JWT_SECRET` stable, or set a separate stable `ORBITPAGE_SECRET_ENCRYPTION_KEY` of at least 32 characters.

Choose a supported model in the workspace. `OPENAI_PAGE_AGENT_MODEL` supplies the default when no selection is saved; see [Configuration](./administration/Configuration.md).

## Review and apply

1. Describe the change.
2. Review the proposed operations.
3. Confirm to apply them.

Generation does not save page changes. Confirmation checks input, permissions, and the page revision again. Proposals expire after ten minutes or become invalid if the page changed; request a new proposal in that case.

The conversation is saved in this browser for the current page. Use the trash button to clear the visible conversation and saved history.

## Data sent to the provider

Prompts and a limited representation of the current page go to the OpenAI Responses API, with provider-side storage disabled. Usage charges belong to the API-key owner. Do not include secrets or sensitive private content.

## Problems

| Message | Check |
| --- | --- |
| Configuration unavailable | Stable encryption secret of at least 32 characters |
| Provider error | Key, supported model, provider access, and outbound HTTPS |
| Proposal expired or page changed | Generate from the current page again |
| Operation not allowed | Account permissions or the requested action |

# Self-hosted AI assistant

OrbitPage AI can plan profile, content, and theme changes from the authenticated editor's current page context. It uses an OpenAI provider key supplied by the instance owner; it is separate from OrbitPage account credentials and from managed Automation API tokens.

## Configure a provider key

Open **Dashboard > AI Assistant** and either:

- save an OpenAI API key in the dashboard; or
- set `OPENAI_API_KEY` in the server environment for immutable-container or secret-manager deployments.

A dashboard-saved key takes precedence until it is removed. It is encrypted with AES-256-GCM before being stored in SQLite, is never returned to the browser, and is excluded from JSON backups.

Keep `JWT_SECRET` stable and at least 32 characters, or set a separate stable `ORBITPAGE_SECRET_ENCRYPTION_KEY`. Losing the encryption secret makes the saved provider key unreadable.

`OPENAI_PAGE_AGENT_MODEL` sets the default model when the dashboard has not saved a supported selection. See [Configuration](../wiki/Configuration.md) for the current variables.

## Plan, review, confirm

1. Describe the outcome you want.
2. OrbitPage sends a bounded page representation to the provider and requests structured operations.
3. Review the exact proposal in the dashboard.
4. Confirm only when the operations match the intended result.

Generation does not write page data. OrbitPage validates the proposed operations again during confirmation, checks the editor's current permissions and page revision, then applies the accepted plan. Proposals expire after ten minutes and fail if the page changed in the meantime.

## Privacy and cost

- Prompts and the bounded current-page context are sent to the configured OpenAI API.
- OrbitPage requests the Responses API with provider-side storage disabled.
- Provider usage and charges belong to the API-key owner.
- Do not include secrets, private customer data, or unpublished sensitive material in prompts or page content sent to the assistant.

## Troubleshooting

- **Configuration unavailable:** verify `JWT_SECRET` or `ORBITPAGE_SECRET_ENCRYPTION_KEY` is stable and at least 32 characters.
- **Provider error:** verify the key, supported model, provider account access, and outbound HTTPS connectivity.
- **Proposal expired or page changed:** request a fresh proposal from the current page revision.
- **Operation not allowed:** use an account with the required page permission or narrow the requested change.

Manual editing remains available when the provider is not configured.

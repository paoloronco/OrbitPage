# Self-hosted API

The bundled Express `/api` serves the dashboard and accepts personal API tokens for scripts. It changes with OrbitPage releases; it has no separate stable API version.

Keep scripts aligned with the installed release. The managed-service API and n8n node use different credentials and endpoints.

## Authentication

| Client | Credential |
| --- | --- |
| Bundled dashboard | Browser session managed by the frontend API client |
| Scripts and CI | Personal API token |
| OpenAI provider | Provider key; not an OrbitPage API credential |

Create a token under **Team → Personal API tokens**. Choose its access and expiry, enter the current password, and copy the secret once. See [Account and team](../dashboard/sections/account-and-team.md).

```sh
curl https://page.example.com/api/links/export \
  --header "Authorization: Bearer $ORBITPAGE_TOKEN"
```

Use HTTPS and store the token privately. Do not put credentials in URLs, logs, screenshots, or issue reports.

Tokens are stored as hashes. Their access cannot exceed the user's current role, and they cannot manage users or obtain dashboard sessions. Role changes apply immediately; deleting an account deletes its tokens.

## Routes and implementation

| Source | Defines |
| --- | --- |
| [api-client.ts](../../../app/src/lib/api-client.ts) | Dashboard requests, request/response types, and sessions |
| [server.js](../../../app/server/server.js) | HTTP routes and middleware |
| [auth.js](../../../app/server/auth.js) | Authentication and permissions |
| [schemas/](../../../app/server/schemas) | Request validation |
| [page-schema/](../../../app/packages/page-schema) | Shared page and content structures |

For example, `GET /api/account/audit-log` requires `users:manage` and supports `q`, `actor`, `action`, `from`, `to`, and `before` filters. It returns successful change metadata, not page contents.

When changing a route, update its client and server together, retain validation and permissions, and test the changed behavior. Keep dashboard and API on the same origin unless additional trusted origins are configured.

Network and recovery settings: [Configuration](../administration/Configuration.md), [Security](../administration/Security.md).

## Managed automation

The hosted service has its own versioned API:

- [Managed API guide](https://orbitpage.com/en-US/docs/api-tokens)
- [Managed OpenAPI](https://orbitpage.com/api/openapi.json)
- [n8n community node](https://github.com/paoloronco/n8n-nodes-orbitpage)

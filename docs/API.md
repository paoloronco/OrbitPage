# OrbitPage Automation REST API

This page introduces the app-integrated API used with scoped tokens to automate the managed OrbitPage dashboard. The exhaustive operation and payload contract is published as OpenAPI 3.1; the OpenAI provider key used by the self-hosted assistant remains unrelated.

OrbitPage has four distinct technical boundaries. Do not interchange their credentials:

| Boundary | Credential | Purpose |
| --- | --- | --- |
| Managed Automation REST API | Personal token with the `op_pat_` prefix | Supported external scripts, n8n, server backends and CI that manage a token-bound workspace |
| OrbitPage AI | Personal token with `ai:read`/`ai:write`; an OpenAI provider key on OSS | Public plan/commit endpoints apply the same reviewed and validated change flow; provider credentials remain separate |
| Dashboard application API | Firebase session on SaaS; admin session on OSS | Private browser-to-app traffic; not a stable external integration contract |
| Protected operator API | Short-lived operator-only `op_pat_` token | Audited CRM, tenant, promotion-code, moderation, plan and demo-access operations |

## Managed Automation REST API

The supported Automation REST API belongs to the managed service at [orbitpage.com](https://orbitpage.com). It uses revocable personal API tokens that are separate from the dashboard session and bound to one workspace.

Use it when a script, n8n workflow, deployment workflow, backend or CI job needs to manage a hosted OrbitPage workspace without borrowing a browser session.

- Complete guide: [orbitpage.com/docs/api-tokens](https://orbitpage.com/en-US/docs/api-tokens)
- OpenAPI 3.1 contract: [orbitpage.com/api/openapi.json](https://orbitpage.com/api/openapi.json)
- Base URL: `https://orbitpage.com/api/v1`
- Authentication: `Authorization: Bearer op_pat_...`

The contract uses standard HTTPS JSON methods (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) and can be called from curl, n8n's HTTP Request node or an OpenAPI-generated client.

Create and revoke credentials from **Dashboard > Account > Personal API tokens**. The complete secret is shown once; store it in an environment variable or the secret store used by your CI provider.

```bash
export ORBITPAGE_TOKEN='op_pat_...'

curl https://orbitpage.com/api/v1/links \
  --header "Authorization: Bearer $ORBITPAGE_TOKEN"
```

The v1 API covers:

- workspace identity, access, plan, complete draft and optimistic revision;
- profile, links/content blocks, theme, subpages, menu, privacy, text files and sitemap;
- publication status and actions, restorable versions and managed backups;
- media upload lifecycle and unused-media cleanup;
- custom domains and DNS verification;
- analytics and reviewed AI plan/commit operations;
- Shop products, appearance, publication, Stripe Connect and product-file uploads;
- newsletter settings, subscribers, campaigns and delivery controls;
- team membership and invitations;
- billing checkout, portal and promotion-code redemption;
- a separately protected operator surface for platform operations.

Read and write scopes are separate per resource. A write scope implies the corresponding read scope, while every operation also rechecks the token owner's current workspace permission. Draft mutations require the latest `If-Match` revision and remain deferred by default; use `?publish=1` only when the operation supports immediate publication.

An `op_pat_...` token works only with `https://orbitpage.com/api/v1`; an OpenAI API key never belongs in a request to that URL. The private dashboard API is not part of this contract.

## Self-hosted application API

The Express API in this repository powers the bundled React dashboard. Its routes use the self-hosted admin session and are an internal application boundary, not the versioned personal-token Automation REST API described above.

That distinction matters:

- do not send a managed `op_pat_...` token to a self-hosted instance;
- do not send a self-hosted admin JWT to `orbitpage.com/api/v1`;
- do not expose the internal `/api` routes to unrelated origins or treat undocumented response shapes as a stable public SDK;
- keep the application and API behind the same trusted HTTPS origin and preserve the reverse-proxy, rate-limit, and security-header configuration described in the operations documentation.

Developers changing the self-hosted dashboard API should start with:

- [`app/src/lib/api-client.ts`](../app/src/lib/api-client.ts) for the frontend client boundary;
- [`app/server/server.js`](../app/server/server.js) for the Express routes and middleware;
- [Development](./wiki/Development.md) for the repository workflow;
- [Security](./wiki/Security.md) for authentication and deployment constraints.

If a stable public automation API is added to the self-hosted edition in the future, it should be versioned, documented separately, and use credentials that are independent from the interactive admin session.

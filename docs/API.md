# OrbitPage Automation REST API

This page documents the app-integrated API that people use with personal tokens to automate managed OrbitPage pages. It does not document OrbitPage AI endpoints or the OpenAI provider key used by the self-hosted assistant.

OrbitPage has three distinct technical boundaries. Do not interchange their credentials:

| Boundary | Credential | Purpose |
| --- | --- | --- |
| Managed Automation REST API | Personal token with the `op_pat_` prefix | Supported external scripts, server backends and CI that read or update page blocks |
| OrbitPage AI | Authenticated dashboard session; an OpenAI provider key on OSS | Interactive, reviewed page-edit proposals inside the app; not a public personal-token API |
| Dashboard application API | Firebase session on SaaS; admin session on OSS | Private browser-to-app traffic; not a stable external integration contract |

## Managed Automation REST API

The supported Automation REST API belongs to the managed service at [orbitpage.com](https://orbitpage.com). It uses revocable personal API tokens that are separate from the dashboard session and bound to one workspace.

Use it when a script, deployment workflow, or CI job needs to read or update the blocks on a managed OrbitPage.

- Complete guide: [orbitpage.com/docs/api-tokens](https://orbitpage.com/en-US/docs/api-tokens)
- OpenAPI 3.1 contract: [orbitpage.com/api/openapi.json](https://orbitpage.com/api/openapi.json)
- Base URL: `https://orbitpage.com/api/v1`
- Authentication: `Authorization: Bearer op_pat_...`

Create and revoke credentials from **Dashboard > Account > Personal API tokens**. The complete secret is shown once; store it in an environment variable or the secret store used by your CI provider.

```bash
export ORBITPAGE_TOKEN='op_pat_...'

curl https://orbitpage.com/api/v1/links \
  --header "Authorization: Bearer $ORBITPAGE_TOKEN"
```

The current Automation REST API covers the managed workspace's link and content-block collection. It does not expose OrbitPage AI, billing, Shop administration, account management, or the private dashboard API. An `op_pat_...` token works only with `https://orbitpage.com/api/v1`; an OpenAI API key never belongs in a request to that URL.

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

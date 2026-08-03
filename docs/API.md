# OrbitPage APIs and automation

OrbitPage has two different API surfaces. Choose the one that matches where your page is hosted.

## Managed OrbitPage API

The supported public automation API belongs to the managed service at [orbitpage.com](https://orbitpage.com). It uses revocable personal API tokens that are separate from the dashboard session and bound to one workspace.

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

The current public API covers the managed workspace's link and content-block collection. It does not expose the OrbitPage AI endpoints, billing, Shop administration, account management, or the private dashboard API.

## Self-hosted application API

The Express API in this repository powers the bundled React dashboard. Its routes use the self-hosted admin session and are an internal application boundary, not the versioned personal-token contract described above.

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

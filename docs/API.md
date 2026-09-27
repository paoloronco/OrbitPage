# Self-hosted application API boundary

The Express `/api` routes in this repository are the application boundary used
by the bundled OrbitPage dashboard. Personal API tokens can also authenticate
automation against the same installation. Routes are versioned with each
OrbitPage release; self-hosted installations do not provide a separate stable
API-version compatibility contract.

## Supported use

The React dashboard and Express server are shipped as one application. Keep
them on the same trusted HTTPS origin and let the bundled API client manage the
authenticated requests between them.

The routes may change when the dashboard changes. Do not build an external SDK
against undocumented responses or expose the routes to unrelated origins. Use
a personal API token instead of an interactive administrator session in scripts
and CI.

## Security boundary

- Treat the self-hosted administrator session as a browser credential.
- Keep the dashboard and `/api` behind the same reverse proxy and origin.
- Preserve server-side authorization and input validation even when the
  dashboard already validates a field.
- Do not pass credentials in query strings, fragments, logs, screenshots, or
  issue reports.
- Do not interchange self-hosted credentials, managed-service credentials, or
  AI-provider keys.
- Personal API tokens are shown once, stored as SHA-256 hashes, limited to the
  creator's current role, and can never receive user-management permission.

Deployment hardening, CORS, rate limits, HTTPS, and recovery controls are
documented in [Security](./wiki/Security.md) and
[Configuration](./wiki/Configuration.md).

## Implementation sources of truth

- [`app/src/lib/api-client.ts`](../app/src/lib/api-client.ts) defines the
  bundled frontend client and session handling.
- [`app/server/server.js`](../app/server/server.js) registers the Express
  routes and middleware.
- [`app/server/auth.js`](../app/server/auth.js) implements the self-hosted
  authentication boundary.
- [`app/server/schemas/`](../app/server/schemas/) contains request validation
  schemas.
- [`app/packages/page-schema/`](../app/packages/page-schema/) contains the
  shared page and block contracts.

When an internal route changes, update both sides of the application, retain
server-side validation and permission checks, and add focused server and
frontend tests. Document changes that affect configuration, deployment,
public behavior, backup compatibility, or operator recovery.

## Self-hosted automation

Open **Team → Personal API tokens** in the dashboard. Choose the access level
and expiry, enter the current account password, create the token, and copy it
immediately. Send it as a bearer credential:

```sh
curl https://your-orbitpage.example/api/links/export \
  --header "Authorization: Bearer $ORBITPAGE_TOKEN"
```

Tokens can be revoked from the same panel. Role changes take effect on existing
tokens immediately, and deleting a local account deletes its tokens.

## Managed automation

The managed OrbitPage service provides a separate, versioned API with its own
credentials and compatibility contract. Its documentation does not redefine
the self-hosted `/api` routes described here.

- [Managed API guide](https://orbitpage.com/en-US/docs/api-tokens)
- [Managed OpenAPI document](https://orbitpage.com/api/openapi.json)
- [Public OrbitPage n8n integration](https://github.com/paoloronco/n8n-nodes-orbitpage)

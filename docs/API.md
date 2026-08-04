# Self-hosted application API boundary

The Express `/api` routes in this repository are the internal application boundary
used by the bundled OrbitPage dashboard. They are versioned together
with the frontend and are not a supported external automation API.

## Supported use

The React dashboard and Express server are shipped as one application. Keep
them on the same trusted HTTPS origin and let the bundled API client manage the
authenticated requests between them.

The internal routes may change when the dashboard changes. Do not build an
external SDK against undocumented responses, expose the routes to unrelated
origins, or reuse the interactive administrator session in scripts and CI.

## Security boundary

- Treat the self-hosted administrator session as a browser credential.
- Keep the dashboard and `/api` behind the same reverse proxy and origin.
- Preserve server-side authorization and input validation even when the
  dashboard already validates a field.
- Do not pass credentials in query strings, fragments, logs, screenshots, or
  issue reports.
- Do not interchange self-hosted credentials, managed-service credentials, or
  AI-provider keys.

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

## External automation

The managed OrbitPage service provides a separate, versioned API with its own
credentials and compatibility contract. Its documentation does not redefine
the self-hosted `/api` routes described here.

- [Managed API guide](https://orbitpage.com/en-US/docs/api-tokens)
- [Managed OpenAPI document](https://orbitpage.com/api/openapi.json)
- [Public OrbitPage n8n integration](https://github.com/paoloronco/n8n-nodes-orbitpage)

If a stable automation API is added to the self-hosted edition in the future,
it must be versioned, documented separately, and use credentials independent
from the interactive administrator session.

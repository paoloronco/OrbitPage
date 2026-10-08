# Shared Shop

Shop contracts, presentation and payment validation shared by the self-hosted
server and the hosted adapter. Provider credentials, tenant permissions and
persistence belong to the consuming server. Runtime helpers use plain ESM so
Express and Next.js can execute the same source without a separate build.

`payments.js` verifies the immutable Checkout binding and reconciles the original
subtotal with Stripe's discount and paid total. Call it only with a Session
retrieved server-side using the owning Stripe account, after signature validation.

`schema.js` supplies the same bounded product and appearance validators to both
backends. Each adapter supplies its installed Zod and validates logos against
its own uploaded-media paths. This preserves backend error handling and prevents
the self-hosted upload rule from widening the hosted media boundary.

`description.js` and `policies.js` own public formatting and legal navigation.

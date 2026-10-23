# Shared Shop

Shop contracts, presentation and payment validation shared by the self-hosted
server and the hosted adapter. Provider credentials, tenant permissions and
persistence belong to the consuming server. Runtime helpers use plain ESM so
Express and Next.js can execute the same source without a separate build.

`payments.js` verifies the immutable Checkout binding and reconciles the original
subtotal with Stripe's discount and paid total. Call it only with a Session
retrieved server-side using the owning Stripe account. Webhook callers must also
verify the event signature; Checkout-return callers verify the stored order/session binding.

`schema.js` supplies the same bounded product and appearance validators to both
backends. Each adapter supplies its installed Zod and validates logos against
its own uploaded-media paths. This preserves backend error handling and prevents
the self-hosted upload rule from widening the hosted media boundary.

`description.js` and `policies.js` own public formatting and legal navigation.
Only configured policies are linked; checkout notices keep their fixed core
copy and append any seller-provided note.
`render.js` includes configured product covers as absolute image URLs in the
catalog's structured data, using the same cover as the visible product card.
Cover visibility applies to cards, product dialogs and structured data. Digital
badges respect `showDigitalProductBadge` and the legacy `showProductType` preference;
enabling digital badges restores that legacy visibility setting. Hiding digital
badges preserves service labels. Customer fields and configurable acknowledgements
are validated server-side before creating Checkout; answers prefill Stripe and
acknowledgement wording and choices are stored with the order.
Adapters with a nonce-based CSP can pass their request's `scriptNonce` for the
Shop interaction script; those responses must not be shared between requests.

`stripe.js` supplies bounded account activity and coupon operations. The calling
server verifies the owner, account and mode before passing its Stripe client and
account-scoped options. Coupon creation uses stable idempotency keys; financial
responses exclude customer identities and bank details.

# Integrations

Choose an integration for embedded content, consent, email, payments or automation, then follow its setup and verification guide.

## Links, players and forms

Use [External modules](./external-modules.md) for WhatsApp, GitHub, video/audio players, Calendly, Typeform and Google Forms. These blocks use public provider URLs. They do not require the private credentials used for email or payment processing.

## Consent and privacy

Configure one banner with [Consent management](./consent-management.md). Test rejection, acceptance and withdrawal on the public page before sharing third-party embeds. Provider subscriptions and regional settings remain in the provider's own account.

## Email and commerce

[SMTP email setup](./smtp.md) covers separate Shop and Newsletter senders. [Shop](../dashboard/sections/shop.md) is the starting point for seller policies, products, publication and purchase checks; [Stripe](./stripe.md) owns self-hosted credentials, webhook verification and the transition from test to live payments.

Shop also supports signed Cal.com booking synchronization. An ordinary external booking or payment Link block is a separate integration and does not create an OrbitPage order.

## AI and automation

Use [AI assistant](../ai-assistant.md) to propose reviewed page changes. Read the [API boundary](../development/api.md) before writing a self-hosted integration; do not reuse managed personal tokens against the local dashboard API.

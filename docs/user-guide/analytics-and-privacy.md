# Analytics and privacy

OrbitPage separates its built-in self-hosted counters from optional Google Analytics 4. Configure each only when it fits the deployment's privacy notice and consent requirements.

## Built-in analytics

The self-hosted application records page-link and call-to-action click counters used by the bundled dashboard. It does not require a third-party analytics account.

Use **Dashboard > Analytics** to review the available totals and content performance. Empty states are expected on a new page. Admin activity is excluded from public-page tracking.

The managed service can expose additional visit, visitor, acquisition, device, country, and campaign reporting. Those hosted reports are not a guarantee of the self-hosted edition.

## Google Analytics 4

The self-hosted dashboard accepts a GA4 Measurement ID in the `G-XXXXXXXXXX` form. The tag is loaded on the public page only; dashboard activity is not sent to GA4.

Before enabling it:

1. Add accurate privacy and cookie policy links under **Dashboard > Privacy**.
2. Choose the appropriate consent behavior for the jurisdictions and audience involved.
3. Enter the Measurement ID under **Dashboard > Analytics**.
4. Test a fresh browser session and confirm that consent choices control analytics as intended.

OrbitPage integrates GA4 with Google Consent Mode. A Measurement ID alone does not create a compliant privacy policy or determine the lawful basis for tracking.

## Consent and external CMPs

Privacy settings can use OrbitPage's consent controls or an explicitly configured external consent-management platform. Avoid loading the same analytics integration independently in custom scripts, a tag manager, and OrbitPage at the same time; duplicate tags can produce duplicate events and conflicting consent state.

For staging or private deployments, also set `SEO_INDEXING=false`. Indexing controls and analytics consent solve different problems and should both be configured deliberately.

See [Security](../wiki/Security.md) for deployment hardening and [SEO and indexing](../wiki/SEO-and-indexing.md) for canonical URLs and crawler controls.

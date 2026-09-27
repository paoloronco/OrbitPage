# Analytics and privacy

OrbitPage separates its built-in self-hosted analytics from optional Google Analytics 4. Configure each only when it fits the deployment's privacy notice and consent requirements.

## Built-in analytics

The self-hosted application records first-party page visits and content clicks in its local SQLite database. It does not require a third-party analytics account or send these events to OrbitPage.

Use **Dashboard > Analytics** to switch between the latest 7 and 30 days and review visits, visitors, clicks, trends, content, referrers, devices, and tagged campaigns. Empty states are expected on a new page, and collection starts after the version that introduced period-based analytics is installed. Admin activity is excluded from public-page tracking.

Visit-level details are collected only after analytics consent. Click totals continue to work without consent, but OrbitPage does not attach a visitor identifier, referrer, device, or campaign values to those clicks. Raw IP addresses and user-agent strings are not stored. Local event rows are retained for 62 days so the dashboard can compare a 30-day period with the preceding 30 days. Approximate country reporting remains available only where the deployment infrastructure provides it.

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

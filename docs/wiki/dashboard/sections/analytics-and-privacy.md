# Analytics and privacy

![Analytics reports and Privacy consent settings](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.74/orbitpage-feature-analytics-and-privacy-4.21.75.gif)

Configure consent under **Privacy** and reports under **Analytics**. Built-in analytics uses the local database; GA4 is optional.

## Built-in analytics

| Report | Details |
| --- | --- |
| Period | Last 7 or 30 days, compared with the previous period |
| Traffic | Visits, visitors, clicks, trends, content, and referrers |
| Acquisition | Tagged campaigns and QR visits |
| Audience | Device breakdown; country data only when supplied by the infrastructure |

Dashboard activity is excluded. Events stay in SQLite and are not sent to OrbitPage. New installations have no historical data.

- Visit details require analytics consent.
- Click totals work without consent, with no visitor identifier, referrer, device, or campaign attached.
- Raw IP addresses and user-agent strings are not stored.
- Event rows are retained for 62 days.

QR reporting counts consented visits when the destination loads, not camera scans. Newly generated QR codes include a campaign marker; regenerate older codes without it to distinguish their traffic.

## Google Analytics 4

1. Configure privacy/cookie policies and consent behavior in **Privacy**.
2. Enter the GA4 Measurement ID, such as `G-XXXXXXXXXX`, in **Analytics**.
3. Use a fresh browser session to test accepting and rejecting analytics.

The tag runs on public pages only and follows Google Consent Mode. It does not replace your privacy policy.

## Consent providers

Use the built-in controls or configure an external consent-management provider. Avoid installing the same analytics tag in both OrbitPage and custom scripts or a tag manager.

Executable consent/policy snippets require administrator permission. Restored snippets stay blocked until an administrator reviews and saves Privacy settings. See [Security](../../administration/Security.md).

For staging, set `SEO_INDEXING=false` separately; consent settings do not control indexing.

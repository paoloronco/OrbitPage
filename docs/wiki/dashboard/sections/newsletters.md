# Newsletters

![Newsletter campaign editor with a fictional message and its preview](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.74/orbitpage-feature-newsletters-4.21.75.png)

Send newsletters through your own SMTP server. Open **Newsletter** with permission to manage settings, subscribers and campaigns for the selected page.

Read [SMTP email setup](../../integrations/smtp.md) for provider examples, authentication, DNS and troubleshooting. Newsletter requires your own SMTP in both editions. In SaaS it is available on Free with a smaller audience allowance; **Plan** shows audience and sending limits.

## Configure SMTP

1. Open **Settings**.
2. Enter the SMTP host, port, username, and password.
3. Set sender name/type, authorized sender email, optional reply-to, and footer.
4. Complete the sender address/legal details and public Privacy Policy and Terms URLs.
5. Select **Save settings**, then **Verify and send test**. OSS sends the test to the sender email; the SaaS dashboard sends it to your signed-in account. Check inbox and spam. A successful test is required before sending a campaign.

| Port | Connection |
| --- | --- |
| `465` | TLS from connection start |
| `587`, `2525` | STARTTLS required |

The password is encrypted and is not returned to the browser. Leaving its field blank reuses the saved password only if host, port, and username are unchanged. Private-network SMTP destinations are blocked. Configure SPF, DKIM and DMARC as instructed by your provider.

| Edition | Public links and credentials |
| --- | --- |
| **Open Source** | Set `PUBLIC_SITE_URL` to your public HTTPS URL, including any mount path. Keep `JWT_SECRET` stable, or use a stable `NEWSLETTER_SECRET_KEY` of at least 32 characters. Losing the key makes saved SMTP credentials unreadable and invalidates email links. |
| **SaaS** | OrbitPage manages the public address and encryption for the workspace. Check the generated signup and email links after changing the page address or domain. |

## Subscribers

Copy the signup link from the workspace. Visitors consent to receive email and confirm their address through a link valid for 48 hours. Optional open/click measurement has a separate, unchecked consent; it is not required to receive the newsletter. Imported subscribers do not have tracking consent by default. Each recipient can change tracking preferences from an email without unsubscribing.

In **Subscribers**, a user with Newsletter management permission can add an email/name after recording consent and confirmation. Every campaign includes an unsubscribe link. Removing a subscriber requires confirmation.

Search by name or email, combine status, source and email-tracking filters, and select a column heading to sort in either direction. The list starts with the newest additions and shows 10 rows per page; choose 25 or 50 for a larger page. Changing a search, filter or sort returns to the first page. **Clear filters** restores the complete loaded list.

Both editions currently load up to 100 of the most recently updated subscribers. When the audience is larger, a notice explains that search, filters, sorting and pagination cover only those loaded contacts, not the whole audience. The audience total and plan allowance remain separate from the matching-row count.

## Campaigns

1. In **Campaigns**, create a draft with its internal name, subject, and inbox preview.
2. Add the message, optional images/logo, and call-to-action. Check the preview, links, and alternative text.
3. Save the draft, or use the adjacent **Send now** and **Schedule** buttons. To schedule, first enter a future date/time in the field below them.
4. Check the campaign status and report. Cancel a schedule before delivery starts if needed.

Send and Schedule save the draft before queuing it. Check the timezone shown before scheduling. In OSS, the server checks schedules every 10 seconds and sends to active subscribers in batches of 50, so the instance must stay running. SaaS delivery runs on the managed service within the workspace's sending allowance.

Saved campaigns and their edit, cancel and delete actions are in **Overview → Campaign performance**. **Campaigns** contains the composer and live preview. Settings uses an icon badge for the last connection test; a failed test marks the connection as unavailable.

## Delivery reports

Reports show deliveries, consented unique opens/clicks, and unsubscribes. Opens and clicks are measured only for recipients with current tracking consent and may be affected by email-client image blocking, proxies or automated scanners. Tracking consent is optional and separate from newsletter subscription. An SMTP acceptance does not guarantee inbox delivery. Your provider can impose sending limits. Investigate failed delivery in the provider's logs before retrying, so you do not send duplicate messages.

Only eligible non-active campaigns can be deleted. Deletion removes the campaign/report and cannot retract sent email or reset its usage. Unsubscribed recipients stop receiving campaigns.

## Backups and problems

Dashboard page exports do not include newsletter audiences, campaigns or SMTP credentials. In OSS these records live in `DATA_DIR/orbitpage.db`; use an [infrastructure backup](../../administration/maintenance.md). Newsletter changes are disabled in OSS demo mode. In SaaS, restoring page content does not restore newsletter records.

| Problem | Check |
| --- | --- |
| Connection rejected | Host, supported TLS port, credentials, sender permission, and public DNS |
| Sending disabled | Complete sender/legal fields, save, and pass the test |
| Schedule not delivered | Running instance, logs, and provider limits; avoid re-queuing an existing send |
| Missing opens or poor delivery | Image blocking and the provider's SPF/DKIM/DMARC setup |

Self-hosted administrators can use [Configuration](../../administration/Configuration.md#variables) for public URLs and encryption keys.

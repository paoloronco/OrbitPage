# Newsletters

![Newsletter campaign editor with a fictional message and its preview](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.74/orbitpage-feature-newsletters-4.21.75.png)

Send newsletters through your own SMTP server. An administrator manages settings, subscribers, and campaigns under **Newsletter**.

Read [SMTP email setup](../../integrations/smtp.md) for provider examples, authentication, DNS and troubleshooting. OSS has no managed email service.

## Configure SMTP

1. Open **Settings**.
2. Enter the SMTP host, port, username, and password.
3. Set sender name/type, authorized sender email, optional reply-to, and footer.
4. Complete the sender address/legal details and public Privacy Policy and Terms URLs.
5. Select **Save settings**, then **Verify and send test**. The test goes to the sender email; a successful test is required before sending a campaign.

| Port | Connection |
| --- | --- |
| `465` | TLS from connection start |
| `587`, `2525` | STARTTLS required |

The password is encrypted in SQLite and is not returned to the browser. Leaving its field blank reuses the saved password only if host, port, and username are unchanged. Private-network SMTP destinations are blocked.

Set `PUBLIC_SITE_URL` to your public HTTPS URL, including any mount path. Signup, confirmation, unsubscribe, and tracking links use it. If the URL changes, update and retest settings.

Keep `JWT_SECRET` stable, or use a separate stable `NEWSLETTER_SECRET_KEY` of at least 32 characters. Losing the key makes saved SMTP credentials unreadable and invalidates email links.

## Subscribers

Copy the signup link from the workspace. Visitors consent and confirm their email through a link valid for 48 hours.

In **Subscribers**, an administrator can add an email/name after recording consent and confirmation. Every campaign includes an unsubscribe link. Removing a subscriber requires confirmation.

## Campaigns

1. In **Campaigns**, create a draft with its internal name, subject, and inbox preview.
2. Add the message, optional images/logo, and call-to-action. Check the preview, links, and alternative text.
3. Save the draft, or select **Send now** or **Schedule** with a future date/time.
4. Check the campaign status and report. Cancel a schedule before delivery starts if needed.

Send and Schedule save the draft before queuing it. The server checks schedules every 10 seconds and sends to active subscribers in batches of 50, so the instance must stay running.

Reports show deliveries, unique opens/clicks, and unsubscribes. Opens depend on email clients loading images; an SMTP acceptance does not guarantee inbox delivery. Your provider can impose sending limits.

Only eligible non-active campaigns can be deleted. Deletion removes the campaign/report and cannot retract sent email.

## Backups and problems

Newsletter data and SMTP settings live in `DATA_DIR/orbitpage.db`. Dashboard JSON exports exclude them; use an [infrastructure backup](../../administration/maintenance.md). Newsletter changes are disabled in demo mode.

| Problem | Check |
| --- | --- |
| Connection rejected | Host, supported TLS port, credentials, sender permission, and public DNS |
| Sending disabled | Complete sender/legal fields, save, and pass the test |
| Schedule not delivered | Running instance, logs, and provider limits; avoid re-queuing an existing send |
| Missing opens or poor delivery | Image blocking and the provider's SPF/DKIM/DMARC setup |

See [Configuration](../../administration/Configuration.md) for public URLs and encryption keys.

# Self-hosted newsletters

## Configure and verify SMTP

1. Open **Newsletter → Settings** as the administrator.
2. Enter your SMTP host, TLS port, username and password.
3. Complete the sender name/type, authorized sender email, optional reply-to and
   footer. Configure the sender address/legal details, public Privacy Policy URL
   and Terms URL; compliance must be complete before signup or sending.
4. Select **Save settings**, then **Verify and send test**. The test goes to the
   configured sender email. Check it arrives before preparing a campaign.

A saved SMTP password is reused only while the host, port and username stay the same. Changing any of those fields requires entering the password for the new connection. Sender-name and footer changes can keep the password field blank.

Open **Dashboard > Newsletter** with an administrator account. Enter your SMTP host, port (465, 587, or 2525), username, password, sender name, and sender email, then save and send a test message. OrbitPage requires a successful test before a campaign can be queued. Ports 587 and 2525 require STARTTLS; port 465 uses TLS from connection start. The SMTP password is encrypted in the local SQLite database and is never returned by the API.

Set `PUBLIC_SITE_URL` to the externally reachable HTTPS origin before sharing the signup link or sending email. When OrbitPage is mounted under `BASE_PATH`, the generated link includes that path. Confirmation, unsubscribe, and tracking links use the saved public URL, so update and retest SMTP settings if the public address changes. Keep `JWT_SECRET` stable, or set a separate stable `NEWSLETTER_SECRET_KEY` of at least 32 characters. Losing the encryption secret makes the saved SMTP password unreadable and invalidates outstanding email links.

## Build a consented audience

Copy the signup link from the newsletter workspace. Visitors enter an email address and explicitly consent, then confirm through a link valid for 48 hours. In **Subscribers**, administrators can add an email/name manually only after recording that subscriber's consent and selecting its confirmation field. Unsubscribing is available from every campaign email. Removing a subscriber from the list requires confirmation.

## Create, send or schedule a campaign

1. Open **Campaigns** and create a draft with its internal name, email subject
   and inbox preview.
2. Write the headline/message and optional image, logo and call-to-action.
   Review the destination, alternative text, design and footer in the preview.
3. Save the draft to keep it without sending.
4. Select **Send now**, or choose a future local date/time and **Schedule**.
   Both actions save the draft before queuing it; the selected local time is
   converted to an absolute time for delivery.
5. Check the campaign list and report for the resulting status. Cancel a
   scheduled campaign from that list before delivery starts if needed.

Create a campaign draft, preview it, and send it immediately or schedule it for a future date. The running OrbitPage server checks scheduled campaigns every 10 seconds and sends to active subscribers in batches of 50. Keep the server running for scheduled delivery. Delivery, unique open and click counts, and unsubscribe counts are shown in the campaign report. Open counts depend on the recipient's email client loading images. The SMTP provider may impose additional sending limits.

Deletion is available only for eligible non-active campaigns and requires
confirmation. It permanently removes the campaign and its delivery report;
it cannot retract email already accepted by SMTP. Accepted delivery is not
proof that the recipient's inbox displayed the message.

## Backups and troubleshooting

Settings, subscribers, campaigns, and delivery records live in `DATA_DIR/orbitpage.db`, together with the rest of the self-hosted app. Preserve this database in infrastructure backups. The dashboard's selective JSON export does not include newsletter records or SMTP credentials. Newsletter mutations are disabled in demo mode.

- **Connection rejected:** verify host, TLS port, credentials, sender permission
  and public DNS. Private-network SMTP destinations are blocked.
- **Sending disabled:** complete compliance, save settings and pass the SMTP test.
- **Scheduled but not delivered:** keep the instance running and check its logs
  and provider limits before retrying; avoid duplicating an already queued send.
- **Poor delivery/open rate:** configure the sender domain's SPF/DKIM/DMARC with
  your provider and check actual messages. Image blocking can hide opens.

See [Configuration](./Configuration.md) for stable encryption keys and
[Deployment](./Deployment.md) for consistent SQLite backups.

# Self-hosted newsletters

Open **Dashboard > Newsletter** with an administrator account. Enter your SMTP host, port (465, 587, or 2525), username, password, sender name, and sender email, then save and send a test message. OrbitPage requires a successful test before a campaign can be queued. Ports 587 and 2525 require STARTTLS; port 465 uses TLS from connection start. The SMTP password is encrypted in the local SQLite database and is never returned by the API.

Set `PUBLIC_SITE_URL` to the externally reachable HTTPS origin before sharing the signup link or sending email. When OrbitPage is mounted under `BASE_PATH`, the generated link includes that path. Confirmation, unsubscribe, and tracking links use the saved public URL, so update and retest SMTP settings if the public address changes. Keep `JWT_SECRET` stable, or set a separate stable `NEWSLETTER_SECRET_KEY` of at least 32 characters. Losing the encryption secret makes the saved SMTP password unreadable and invalidates outstanding email links.

Copy the signup link from the newsletter workspace. Visitors enter an email address and explicitly consent, then confirm through a link valid for 48 hours. Administrators can add a subscriber manually only after recording that subscriber's consent. Unsubscribing is available from every campaign email.

Create a campaign draft, preview it, and send it immediately or schedule it for a future date. The running OrbitPage server checks scheduled campaigns every 10 seconds and sends to active subscribers in batches of 50. Keep the server running for scheduled delivery. Delivery, unique open and click counts, and unsubscribe counts are shown in the campaign report. Open counts depend on the recipient's email client loading images. The SMTP provider may impose additional sending limits.

Settings, subscribers, campaigns, and delivery records live in `DATA_DIR/orbitpage.db`, together with the rest of the self-hosted app. Preserve this database in infrastructure backups. The dashboard's selective JSON export does not include newsletter records or SMTP credentials. Newsletter mutations are disabled in demo mode.

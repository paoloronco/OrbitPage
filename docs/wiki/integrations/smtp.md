# SMTP email setup

SMTP (Simple Mail Transfer Protocol) lets OrbitPage submit outgoing email to an
email provider. It is a sending connection, not a hosted mailbox or inbox.
Self-hosted OrbitPage includes no email hosting or managed sender: configure
your own SMTP separately for Shop and Newsletter.

## Choose a provider

Use a provider that permits your intended traffic and sender address. Shop
messages are transactional (purchases, delivery and appointments); newsletters
are bulk marketing mail. A provider may require separate streams or credentials.
A mailbox provider can also work if it supports password/app-password SMTP and
your sending volume; OAuth-only SMTP authentication is not implemented.

| Provider example | Host and supported port | Credentials and setup |
| --- | --- | --- |
| SendGrid | `smtp.sendgrid.net`, `587` | Username `apikey`; a Mail Send API key as password; verify the sender/domain. [Official SMTP guide](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/integrating-with-the-smtp-api) |
| Postmark Shop | `smtp.postmarkapp.com`, `587` or `2525` | Use a transactional stream's SMTP token (Access Key as username, Secret Key as password). [Official SMTP guide](https://www.postmarkapp.com/developer/user-guide/send-email-with-smtp) |
| Postmark Newsletter | `smtp-broadcasts.postmarkapp.com`, `587` or `2525` | Use a broadcast stream's SMTP token and an authorized sender. [Official SMTP guide](https://www.postmarkapp.com/developer/user-guide/send-email-with-smtp) |
| Your mailbox/relay provider | The SMTP host supplied by that provider | Its SMTP username and password/app password; confirm that marketing mail is permitted. |

Provider requirements can change: use the linked official setup instructions.
Configure the domain's SPF and DKIM records as instructed by the provider; add
its recommended DMARC policy. A Reply-to address does not authorize a From address.

## Connection fields

| Field | Enter |
| --- | --- |
| Host | SMTP hostname only, without `https://` or a path |
| Port | `465` for TLS from connection start; `587` or `2525` for required STARTTLS |
| Username | Provider's SMTP login; it may differ from the sender email |
| Password | SMTP password, app password or provider SMTP/API token |
| Sender name / email | Your public name and a sender permitted by the provider |
| Reply-to | Optional monitored address for replies |

Port 25 and unencrypted delivery are not supported. Certificate checks stay
enabled. The OrbitPage server/container needs outbound access to the chosen port.

## Shop

1. Open **Shop settings → Compliance** and save the seller profile and policies.
2. Verify **Stripe**, including the matching webhook signing secret.
3. Open **Email**, enter your SMTP and sender fields, then **Save**.
4. Select **Send test email**. OSS uses the configured sender as test recipient;
   inspect its inbox and spam folder.
5. After the test succeeds, publish the prepared Shop when its other requirements are complete.

Compliance, verified Stripe/webhook and a successful SMTP test are required
before publication or accepting payments. Products and storefront design can be
prepared before setup. Changing connection/sender settings clears
the test status; test again. The sender handles buyer confirmations, seller
notifications, questionnaire updates, booking changes and reminders. Purchase
access remains available through the verified receipt if an email is delayed.
See [Shop](../dashboard/sections/shop.md#transactional-email).

## Newsletter

1. Open **Newsletter → Settings** and enter a separate SMTP configuration.
2. Complete sender identity, postal/legal details, Privacy and Terms URLs.
3. Save, then **Verify and send test**; the test goes to the sender email.
4. Confirm receipt before sending or scheduling a campaign.

Newsletter always requires your SMTP and a successful test. Shop credentials
are not reused automatically. Marketing consent and unsubscribe handling remain
required. See [Newsletters](../dashboard/sections/newsletters.md).

## Keep settings recoverable

Passwords are encrypted in SQLite and never returned to the browser. A blank
password retains the saved value only for the same host, port and username.
Back up the database and keep `JWT_SECRET` or the configured stable encryption
secret. Losing it makes encrypted settings unreadable. Set the correct public
HTTPS URL for customer, confirmation and unsubscribe links.

Shop admins can deliberately configure a private SMTP relay; Newsletter blocks
private/reserved destinations. Do not disable TLS verification for a relay.

| Failure | Check |
| --- | --- |
| Connection timeout | DNS, firewall/hosting egress and provider port |
| Authentication rejected | SMTP credentials/app password and enabled SMTP access |
| Sender rejected | Verified sender/domain, From address and provider permissions |
| Test accepted but not received | Spam, provider delivery logs, bounce/suppression list and domain DNS |
| Settings unreadable after restart | Restore the original encryption secret or enter credentials again |

A successful test proves provider acceptance, not guaranteed inbox delivery.

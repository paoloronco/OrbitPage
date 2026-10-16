# SMTP email setup

SMTP (Simple Mail Transfer Protocol) lets OrbitPage submit outgoing email to an
email provider. It is a sending connection, not a hosted mailbox or inbox.
Self-hosted OrbitPage includes no email hosting or managed sender: configure
your own SMTP separately for Shop and Newsletter.

## Email in SaaS and OSS

| Feature | Open Source | SaaS |
| --- | --- | --- |
| Shop | Your SMTP provider | **Use OrbitPage email** or **Use custom SMTP** |
| Newsletter | Your SMTP provider | Your SMTP provider |

Shop and Newsletter settings are separate; credentials are not copied between them. SMTP delivers messages, not a mailbox for reading replies.

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

1. Open **Shop settings → Email**. In SaaS choose **Use OrbitPage email** for managed delivery or **Use custom SMTP** for your own provider. OSS uses your SMTP only.
2. For custom SMTP, enter the connection and sender fields, then **Save**.
3. For custom SMTP, select **Send test email**. OSS uses the configured sender as test recipient; SaaS uses your signed-in account. Inspect inbox and spam.
4. Repeat the test after changing the connection or sender settings.
5. Complete the payment, compliance and publication requirements for your edition before selling.

In OSS, Compliance, a verified Stripe account, a saved webhook secret and a successful SMTP test are required
before publication or accepting payments. Products and storefront design can be
prepared before setup. Changing connection/sender settings clears
the test status; test again. The sender handles buyer confirmations, seller
notifications, questionnaire updates, booking changes and reminders. Purchase
access remains available through the verified receipt if an email is delayed.
See [Shop](../dashboard/sections/shop.md#email).

Saved custom settings are used immediately. OrbitPage does not silently fall back to managed email when your SMTP fails. In SaaS, select **Use OrbitPage email** and save to return to managed sending. Email failure does not undo a confirmed purchase.

## Newsletter

1. Open **Newsletter → Settings** and enter a separate SMTP configuration.
2. Complete sender identity, postal/legal details, Privacy and Terms URLs.
3. Save, then **Verify and send test**; OSS sends to the sender email and the SaaS dashboard sends to your signed-in account.
4. Confirm receipt before sending or scheduling a campaign.

Newsletter always requires your SMTP and a successful test. Shop credentials
are not reused automatically. Marketing consent and unsubscribe handling remain
required. See [Newsletters](../dashboard/sections/newsletters.md).

## Keep settings recoverable

Passwords are encrypted and never returned to the browser. A blank password
does not clear an existing password. Enter the password again when changing
the SMTP provider or login, then repeat the test.
In OSS, back up the database and keep `JWT_SECRET` or the configured stable encryption
secret. Losing it makes encrypted settings unreadable. Set the correct public
HTTPS URL for customer, confirmation and unsubscribe links.

OSS Shop admins can deliberately configure a private SMTP relay. SaaS Shop and Newsletter in both editions block private/reserved destinations. Do not disable TLS verification for a relay.

## Troubleshooting

| Failure | Check |
| --- | --- |
| Connection timeout | DNS, firewall/hosting egress and provider port |
| Authentication rejected | SMTP credentials/app password and enabled SMTP access |
| Sender rejected | Verified sender/domain, From address and provider permissions |
| Test accepted but not received | Spam, provider delivery logs, bounce/suppression list and domain DNS |
| Settings unreadable after restart | Restore the original encryption secret or enter credentials again |

A successful test proves provider acceptance, not guaranteed inbox delivery.
Never share SMTP credentials, signed customer links or private buyer details in a public support request.

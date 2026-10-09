# Shop

One installation runs one shop with the owner's Stripe account. Self-hosting
uses SQLite, private files and the instance's configured Shop SMTP server. It
needs no OrbitPage account, Firebase, R2 or OrbitPage Stripe Connect account.
OrbitPage charges no platform fee; Stripe's fees and account eligibility apply.
The catalog, editor, delivery and customer pages share the hosted implementation.

Only administrators with `users:manage` can manage commerce. Demo mode allows
previewing the editor and blocks changes, uploads and checkout. A customer
purchase link never grants dashboard or administrator access.

## Before you start

1. Run a supported installation with a persistent `DATA_DIR` and a backup.
2. Set an absolute, canonical HTTPS `PUBLIC_SITE_URL`; preserve any `BASE_PATH`.
   Your reverse proxy must allow Stripe and calendar webhook requests.
3. Open **Site editor → Shop** (`/dashboard/editor/shop/products`). The gear
   button opens Compliance, Checkout, Stripe, Email, Calendar and INFO settings.
4. Save Compliance, verify Stripe/webhook and send a successful SMTP test.
   These three saved prerequisites unlock products and storefront design.
   **Back to shop** always returns to the preview, including from settings,
   orders and customers. The preview stays read-only until setup is complete;
   you can still switch between desktop and mobile previews and view the catalog.
   **Personalize** also opens before setup is complete; its options stay disabled
   and the panel lists the missing prerequisites until you finish setup.
5. Check desktop/mobile previews and complete the [test checklist](#test-checklist)
   before accepting live payments.

See [Configuration](../../administration/Configuration.md) for server settings.

## INFO

Open **Shop settings → INFO** for Shop publication, saved Stripe readiness/mode,
the selected Shop SMTP sender and calendar configuration. A calendar booking
link and a verified signed webhook are shown separately. The same panel checks
instance health and links to documentation and [FAQ](../../faq.md).
See the FAQ for check coverage, npm audit caching and unavailable checks.
Refresh is read-only: it does not send emails or create bookings.

## Create a catalog

Select **Add product**, choose Digital product or Service, enter its title,
short/full descriptions, EUR price and optional cover, then save. New products
are drafts; enable **Available for purchase** when ready. **View catalog** offers
search, filtering and sorting. Product cards open details; Buy is disabled in
the editor preview. Save must succeed before leaving; failed uploads can retry.

| Limit | Supported value |
| --- | --- |
| Catalog | 20 digital or service products |
| Product price | EUR 1–10,000 before discounts |
| Purchase | One product per Stripe Checkout Session; no cart |
| Digital attachments | Up to 10 files, 50 MB each, in the allowed formats |
| Service package | 1–50 sessions; instructions, an HTTPS booking link, or both |
| Service questionnaire | Up to 12 questions; optional or required |

**Manage files** handles allowed documents, archives, ebooks, images, audio and
video. Digital products need at least one file before sale. Files live in
`DATA_DIR/shop-files`, outside public `/uploads`; covers and logos are public.
Uploads share the instance's storage quota. Physical shipping, recurring
subscriptions, multi-seller marketplaces and a multi-product cart are not
implemented. Editing a product does not change an existing order's snapshot.

## Appearance and language

**Personalize** controls layout, colors, font and cards. **Use the page theme**
inherits the public page's theme. Click the preview title, introduction, logo
or back link to edit it. Apply inside the title/introduction dialog joins the shared Save/Reset flow.
Save persists all pending Shop settings; Reset restores the saved values.

The grid uses three columns when space permits, then two or one as its container
narrows. Cards fill each column's available width. The list layout stays in one column.

The receipt, delivery and **Your purchases** pages use the Shop's logo, colors,
font and card style, including inherited page styling. They show direct Download
buttons, order details, service instructions and appointment actions on mobile
and desktop. They do not use the administrator dashboard's theme.

Shop controls, Stripe Checkout, delivery, customer pages and appointment emails
use English in both editions, including dates and prices. Seller-written
descriptions, policies, checkout labels, questions and instructions keep their
original language. External booking pages choose their own language.

## Seller details and policies

Open **Shop settings → Compliance** or the Legal button. Enter your public seller
identity, contact details and applicable business information. Stripe verification
does not fill this profile. Each policy supports text hosted by OrbitPage or an
external HTTPS URL: Terms, Digital Product & License Terms, Privacy, Cookies,
Refunds, and Withdrawal and contact. Hosted text appears on `/shop/legal`;
unconfigured policy destinations return 404. Test the footer links.

Confirm seller responsibility before publication. You remain responsible for
the products, delivery, customer support, taxes, invoicing and applicable seller
disclosures. A checkbox or Stripe verification does not establish legal compliance.
Tax ID collection is not automatic tax calculation or invoice generation.

<a id="connect"></a>

## Connect Stripe

1. Choose a Stripe sandbox/test account and open **Shop settings → Stripe**.
2. Create an appropriately scoped restricted key (`rk_test_`), or use the supported
   secret key (`sk_test_`), in that account's API keys settings. Enter it in
   **Stripe secret API key**. A publishable
   `pk_` key is insufficient. Saved keys are encrypted and not returned to the browser.
3. Create an HTTPS webhook in the same account and mode using the endpoint
   shown in the form (`/api/shop/webhook`). Subscribe to
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `checkout.session.expired`,
   `charge.refunded`, `charge.dispute.created` and `charge.dispute.closed`.
4. Copy that endpoint's `whsec_` signing secret into **Webhook signing secret**,
   then select **Save and verify Stripe** below the webhook endpoint.
   This is separate from the API key and the customer-link signing secret.
   **Stripe Dashboard** opens your account in the currently configured mode.
5. Verify the Stripe payment-status heading and complete the test checklist. For live sales,
   use a separate live installation with matching live keys and webhook.

Restricted keys need account/balance reads, Checkout Session creation/retrieval,
and PaymentIntent, charge and dispute reads. Customer creation and inline
price/product features may need their corresponding permissions. Check Stripe's
request logs for a missing permission rather than granting unrelated access.
See [Stripe API keys](https://docs.stripe.com/keys) and
[webhooks](https://docs.stripe.com/webhooks).

Alternatively set `SHOP_STRIPE_SECRET_KEY` and `SHOP_STRIPE_WEBHOOK_SECRET` on
the server and restart. These overrides make the form read-only; **Check status**
verifies a changed key. Never put secrets in `VITE_*`, Git or public pages.
Once orders exist, their account and test/live mode cannot be changed: rotate
keys within the same account/mode, or use another installation. A test card does
not turn a live checkout into a test checkout.

Stripe settings refresh on opening, when you return to the tab and every 30
seconds while visible. Green **ready and configured** requires verified Stripe
readiness and a configured webhook; the heading identifies Test mode or live
payments. An unavailable check removes the green confirmation until verification
succeeds. Switching modes in Stripe Dashboard alone does not change this
installation's credentials or payment mode.

## Customer details

**Shop settings → Checkout** controls information collected by Stripe. Name and
email are required. Phone can be off/required; billing address auto/required;
business name and supported tax IDs off/optional/required. Payment methods may
require additional billing details. Add up to three text or numeric fields with
labels of at most 50 characters and answers of at most 255 characters/digits.
Do not request passwords, card data or sensitive information in custom fields.

Save applies to new checkouts. Existing orders retain their original field labels,
answers, product/files, service instructions, seller policies and consent record.
Verified buyer details appear in **Orders → View**, with customer search by name
or email. Card details are entered on Stripe, not stored by OrbitPage.

## Publish or unpublish

Save the catalog/design, make a complete product available, verify Stripe and its
webhook, and acknowledge seller responsibility. Select **Publish shop** in the
center of the top toolbar; in Settings and Orders/Customers it sits beside
**Back to shop**. In OSS, the button is always visible: **Publish shop** stays dimmed
and disabled until Compliance, Stripe and Email are configured and a complete
product is available. Hover over it or focus it with the keyboard to see what is
missing. Open `/shop` in a private window. Check policies and mobile
layout. Add Shop to Home can expose a card from your main page; newsletter signup
uses the separate Newsletter audience and compliance settings.

**Unpublish** remains available if setup becomes incomplete. It stops new
storefront sales and keeps products, orders and customers.
It does not erase purchases, refund payments or revoke existing paid links. If
Shop is the homepage, choose another homepage before removing it. Hiding a product
also stops new sales without erasing its previous purchases.

## Checkout and immediate delivery

The buyer reviews product details and seller terms, acknowledges the seller notice
and, for digital products, explicitly consents to immediate delivery. Stripe
hosts Checkout and accepts eligible promotion codes configured in your account.
A 100% discount is supported without a PaymentIntent; the completed Checkout
must still be verified. The server checks account, mode, order/session binding,
currency, original subtotal, discounts and paid amount.

After verified payment, the receipt immediately offers downloads or service
instructions/booking and a **Your purchases** link. Email is an additional route;
waiting for an email is not required. A return URL alone never proves payment.
Pending/asynchronous payments show a waiting state until Stripe confirms them;
failed or expired checkouts grant no delivery. Signed webhooks and receipt
reconciliation handle repeated events without granting a second purchase.

## Customer access and signed links

The customer opens **Your purchases** on the verified receipt or the personal link
in the purchase email. There is no registration, password login or email OTP.
Entering an email address alone cannot open purchases; the signed link is required.

The link contains a token signed server-side with HMAC-SHA256. The server verifies
its signature, issue/expiry times, customer access version and explicit order IDs,
then checks that those orders still belong to that customer and remain eligible.
It permits viewing only the included purchases, downloading their available files,
opening their booking/meeting links and submitting their service questionnaires.
It grants no administrator, dashboard, Stripe or other customer access, and does
not automatically include future purchases. A receipt renews access for its own order.

This is a **bearer link**, reusable until expiry or revocation, not a one-time link.
Anyone holding it can exercise its limited access. Keep it private, including
booking and download links: do not publish, forward or put it in shared screenshots.
The signature prevents alteration; it does not encrypt the token or make a leaked
link harmless. Use HTTPS and protect mailbox, server logs and backups accordingly.

After successful validation, the customer token is removed from the visible URL
and stored in `sessionStorage` for the current browser tab; API requests send it
in the `x-shop-customer-access` header. Refresh can reuse that tab's access. Another
device or a closed tab needs the original personal link again; bookmarking the
clean `/shop/customer` address is not a login. Storage does not extend token validity.

| Access | Validity and limits |
| --- | --- |
| Customer-area token | Seven days from issue; only the explicit included orders |
| Digital delivery | 30-day window recorded when Checkout is created |
| Downloads | Combined order allowance of 10 × purchased file count, not a separate per-file allowance |
| Renewal | Open a still-valid receipt/delivery link for a fresh seven-day customer token for that order; download expiry/count are unchanged |
| Full refund or customer erasure | The affected purchase is no longer accessible |

For example, three files share 30 download requests; downloading one file repeatedly
uses the same total. A new customer link does not restore expired or refunded
downloads. If both access routes are unavailable, contact the seller with the order
reference, not a public copy of the token. There is no email-only recovery/OTP form.

<a id="email"></a>

## Transactional email

**OSS sends through the SMTP configured on your instance in Shop settings → Email.**
It does not use OrbitPage's managed mail service or automatically reuse Newsletter
SMTP. Enter host, port, username, password/app password, sender and reply-to, save,
then **Send test email**. Port 465 uses TLS; 587/2525 require STARTTLS and a valid
certificate. An owner-controlled private relay is supported. Authorize the sender
with your provider and configure its recommended SPF, DKIM and DMARC records.

The test recipient is the configured sender address. Changing the server/account
requires re-entering the password; changed connection/sender settings clear the
test status. Credentials are encrypted server-side and not returned to the browser.

Buyer confirmations include the purchase details, delivery/booking instructions
and signed customer-area link. Seller sale notifications, questionnaire updates,
booking changes and reminders use the same Shop SMTP. The persistent retry queue
runs while the application is running and retries temporary failures with stable
message IDs. Without configured SMTP, messages cannot leave the instance; the
verified receipt still provides immediate access. Provider acceptance does not
prove inbox delivery or exactly-once delivery after a connection failure.

In **hosted SaaS**, the seller can choose **Use OrbitPage email** or **Use custom
SMTP** for these same messages and personal links. See the
[hosted Shop email guide](https://orbitpage.com/en-US/docs/shop#email).

<a id="calendar"></a>

## Calendar and reminders

Add the service instructions, session count, optional questions and HTTPS booking
URL to the Service product. Buyers can submit/update answers from **Your purchases**;
answers are attached to their order and shared with the seller. Use a booking event
that does not charge again. External booking URLs are not protected by OrbitPage;
configure access/availability rules at the provider.

For Cal.com synchronization, copy the endpoint/signing secret from **Shop settings
→ Calendar** into the owning Cal.com account's webhook. Enable `BOOKING_CREATED`,
`BOOKING_RESCHEDULED` and `BOOKING_CANCELLED`. No Cal.com API key is required.
Customers must use the complete order-specific delivered URL, including its
metadata. A bare public calendar URL cannot bind a new booking to a paid order.

Signed, matching bookings consume one session; rescheduling consumes no additional
session and cancellation restores it. Duplicate events update the same booking.
The customer area displays synchronized dates, status and meeting links. The local
worker queues 24-hour and 1-hour reminders; keep the server and SMTP running.
Other booking providers work as links without this synchronization. Cancelled
appointments do not issue a Stripe refund; handle that separately.

## Orders, refunds and customer erasure

Use **Orders → View** for payment, delivery, buyer details, answers and booking
state; **Customers** groups saved buyer records. Financial status follows verified
Stripe state, not a manual claim that payment succeeded. Issue refunds and handle
disputes in the owner's Stripe Dashboard, then check the confirmed update in Shop.

Partial refunds preserve downloads and remaining service sessions within their
existing limits. Full refunds block delivery, clear service entitlement and local
booking/reminder access. They do not retract a file already downloaded or cancel
an external appointment: manage that in the calendar provider. A disputed purchase
is unavailable while its order is not eligible for delivery.

Customer erasure removes saved identity/contact details, questionnaire answers,
local bookings and related emails, anonymizes financial orders and revokes access.
It is not a refund and does not erase Stripe's independent payment records. Do not
delete customer data merely to retry a payment or remove a draft product.

## Storage, backup and updates

Persist the complete `DATA_DIR`: `orbitpage.db`, `shop-files`, public uploads and
hidden secret/configuration files. Keep `JWT_SECRET`, the encryption key and any
separate `SHOP_DELIVERY_SECRET` stable across restarts/restores. Customer/delivery
signing defaults to `JWT_SECRET`; changing it invalidates existing links. Stripe's
webhook secret is a different secret. Removed purchased files remain until delivery
expiry. Startup adds Shop tables without changing existing content.

**Backup → Shop** contains commerce records, encrypted settings and private files,
independently of the optional public-image ZIP. Protect exports as sensitive data.
Restoring Shop replaces the selected commerce section/file store; preserve the
original secrets for saved credentials and links. Old backups without Shop leave
it unchanged. Page version history excludes commerce; full reset/personal-page
deletion removes it. Rollback needs the old runtime and matching pre-update backup.
Large catalogs may need an infrastructure backup instead of dashboard media export.
See [Backups](./backups-and-demo-mode.md) and [Maintenance](../../administration/maintenance.md).

## Test checklist

On a separate test installation using a Stripe sandbox/test account:

1. Check the Test mode badge, matching webhook, public URL and persisted data.
2. Send an SMTP test; inspect inbox/spam and sender identity.
3. Publish a fictional digital product; pay with Stripe's documented test card
   `4242 4242 4242 4242`, a future expiry and test CVC. Never use real card data here.
4. Check immediate receipt, actual file bytes, personal-link access, mobile layout
   and refresh. Test a service's instructions, questionnaire and booking separately.
5. Check a promotion and 100% discount, then partial/full refunds and revoked access.
6. Verify signed webhook deliveries and, if used, Cal.com reschedule/cancel/reminders.
7. Unpublish/hide fixtures; keep test credentials separate from live sales.

See [Stripe testing](https://docs.stripe.com/testing). Test payments do not verify
live merchant eligibility, payout readiness or real email inbox delivery.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Cannot publish/accept payments | Stripe status, matching account/mode/webhook, seller acknowledgment, available product/files and canonical URL |
| Receipt waiting | Stripe payment state and webhook deliveries; pending or failed payment grants no files |
| Customer link expired | Open the still-valid purchase receipt/delivery link, or contact the seller; plain email is insufficient |
| New purchase missing | Use that purchase's recent link; older tokens do not gain future orders |
| Download unavailable | Refund/dispute/erasure, expiry, shared download allowance and persistent private file volume |
| Email queued/missing | Shop SMTP, TLS, sender authorization, server uptime, provider logs and spam folder |
| Booking absent | Complete paid-order URL, signed Cal.com webhook, event triggers and remaining sessions |
| Settings cannot decrypt after restore | Restore the original secrets, or deliberately replace credentials; new secrets do not preserve old access links |

## Required setup and AI drafts

Before product/catalog setup, save **Compliance** (seller status, name, email,
address for traders, Terms, Privacy, Refunds and Withdrawal policies, and seller
acknowledgment), verify **Stripe** and its webhook, then configure **Email** and
send a successful SMTP test. The dashboard opens required settings until all
three are complete; the server enforces the same prerequisites.

[SMTP email setup](../../integrations/smtp.md) explains providers and each field.
OSS uses only your SMTP; Shop and Newsletter use separate configurations.

An administrator can ask **AI Assistant** to add digital or service products.
Provide the title, description, type and EUR price, review the proposal, then
confirm. Products are saved only as drafts, with no product files, booking link
or fulfillment instructions. Add delivery details manually before making them
available. The catalog limit and setup requirements still apply.

Stripe displays **Stripe payments are ready and configured** or
**Stripe payments are in test mode**, with the test status in orange. Opening
Stripe Dashboard's test/live view does not change configured credentials.

The dashboard header opens **Public Shop**. Seller information is always expanded
above the public footer, without a border or disclosure control; only configured
fields are shown. Orders have references such as **#000001**, allocated in order
of Checkout creation, including abandoned/failed attempts. Refunds do not reuse
numbers. Older orders retain a short ID reference; purchase URLs and internal IDs
remain valid. OSS Orders has no OrbitPage fee column.

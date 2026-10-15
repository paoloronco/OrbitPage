# Shop

Sell digital downloads and services from your self-hosted OrbitPage installation, using your own Stripe account and SMTP provider. OrbitPage adds no platform fee; Stripe fees apply.

![The real OrbitPage Shop editor with a fictional digital workbook and a portfolio review service](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.99/shop-guide-catalog-4.21.99.jpg)

*OrbitPage 4.21.99, captured locally with fictional Studio North products. The preview is not a live checkout.*

## Start here

Open **Site editor → Shop** as an administrator. Create the catalog, complete **Shop settings → Compliance**, connect [Stripe](#connect), configure [email](#email) and [test a purchase](#test-checklist) before publishing.

This guide covers self-hosted OSS: payments use your Stripe API key and webhook. Hosted workspaces use [Stripe Connect](https://orbitpage.com/en-US/docs/shop#connect). Buying an OrbitPage subscription is a separate payment flow.

## Before you start

- Use persistent `DATA_DIR` storage and keep a [backup](./backups-and-demo-mode.md).
- Set `PUBLIC_SITE_URL` to your public HTTPS address, including any mount path. See [Configuration](../../administration/Configuration.md).
- Allow Stripe webhooks through your reverse proxy without login, access challenges or redirects.
- Catalog editing works before setup. Publication and checkout require Compliance, verified Stripe settings, a webhook, a successful SMTP test and an available product.

The **Shop settings** gear opens Compliance, Coupons, Checkout, Stripe, Email, Calendar and INFO. **Back to shop** returns to the preview. Demo mode blocks changes, uploads and checkout.

## Create a catalog

1. Select **Add product** and choose **Digital product** or **Service**.
2. Enter a title, short description, full description and price in the selected Shop currency. Add an optional cover; click the help icons beside **Cover image** and **Product files** for formats and upload limits.
3. Save the draft product.
4. For a digital product, use **Manage files** to upload the files buyers will receive.
5. For a service, add post-payment instructions, an HTTPS booking link, or both. Set the number of sessions and optional questionnaire.
6. Enable **Available for purchase** when the product is complete, then save.
7. Use **View catalog** to find and edit products. Click a preview card to inspect its details; **Buy** is disabled in the editor.

| Limit | Supported value |
| --- | --- |
| Catalog | 20 digital or service products |
| Price before discounts | 1–10,000 in the selected currency; Stripe account/payment minimums also apply |
| Purchase | One product per Checkout; no cart |
| Digital files | Up to 10 files per product, 50 MB each, in supported formats |
| Service package | 1–50 sessions and up to 12 questionnaire questions |

- Digital products need at least one file before sale. Documents, archives, ebooks, images, audio and video are supported in the formats accepted by the uploader.
- Delivery files are private; covers and logos are public. OSS stores delivery files in `DATA_DIR/shop-files` and counts uploads toward instance storage. SaaS uses managed private storage and counts uploads toward workspace storage.
- Product edits affect new purchases. Existing orders keep their purchased product, files, instructions and policy snapshot.
- Physical shipping, recurring product subscriptions, marketplaces and multi-product carts are not supported.

### Currency

Choose **Shop settings → Checkout → Shop currency**, then save. Supported currencies: EUR, USD, GBP, CHF, CAD, AUD, NZD, SEK, NOK, DKK, PLN, CZK, SGD, HKD, INR, BRL, MXN and AED. Existing shops default to EUR; zero-decimal currencies such as JPY are not supported.

Saving updates all catalog prices without exchange-rate conversion: **10 EUR becomes 10 USD**. Review your prices before accepting new sales. Preview, public prices, new Stripe checkouts and new fixed-amount coupons use the selection.

Existing orders, open checkouts, receipts, refunds and coupons retain their original currency. Fixed-amount coupons must match the checkout currency; create a new code when needed. Stripe controls the account's payout currency, supported payment methods and conversion fees separately. See [Stripe currencies](https://docs.stripe.com/currencies).

### Required setup and AI drafts

Ask **AI Assistant** to draft a product with a title, description, type and price in the configured Shop currency. Review and confirm the proposal. AI products are saved as drafts: add real files or service delivery details yourself before enabling purchase.

## Appearance and language

- Select **Personalize** to change layout, colors, fonts and cards, or enable **Use the page theme**.
- Click the preview title, introduction, logo or back link to edit it. **Apply** in a dialog adds the change to the shared **Save / Reset** flow.
- **Save** persists pending Shop settings; **Reset** restores saved values. Save before refreshing or leaving.
- Check desktop and mobile previews. Grid cards adapt to three, two or one column; list layout uses one column.
- Receipts, downloads and **Your purchases** inherit Shop styling.
- Shop controls, Checkout, customer pages and appointment emails use English. Your own descriptions, policies, questions and instructions retain the language you write; external booking pages control their own language.

## Seller details and policies

1. Open **Shop settings → Compliance**.
2. Enter seller status, public name and email; include the geographic address for a professional/trader and other applicable contact details.
3. Add Terms, Privacy, Refunds and Withdrawal/contact policies. Complete Digital Product & License Terms and Cookie policy where applicable.
4. For each policy, choose **Host in OrbitPage** and enter text, or **External** and provide an HTTPS link.
5. Confirm the seller-responsibility acknowledgment and save.
6. Check the public footer links. Hosted policies appear under `/shop/legal`; an unconfigured policy link returns 404.

Stripe account verification does not fill these fields. You remain responsible for your products, delivery, support, taxes, invoices and applicable disclosures. Collecting a tax ID does not calculate tax or generate an invoice.

The trash button clears seller details and policies even when the profile is incomplete. Changes remain a draft until **Save**; **Reset** restores them. Saving the removal asks for confirmation and unpublishes the Shop.

### Public phone and Stripe receipts

- Leave **Public phone** empty to hide it from the OrbitPage Shop and new order emails. OrbitPage does not import your Stripe identity or support phone. Existing orders retain the seller details saved at purchase.
- Stripe Checkout, receipts and invoices use **Stripe's public business details**, which are separate from this profile. Saving or clearing a field in OrbitPage does not change that account-wide setting.
- In **Shop settings → Stripe**, select **Review public details in Stripe**. Check the selected account, then open **Business → Business details → Public details → Edit**.
- Match the public name, email, phone and address to the details you intend to publish. Turn off **Show phone number on receipts and invoices** if you do not want Stripe to display it there. Stripe may still require a support phone; this switch does not remove identity-verification data or control bank statements and third-party receipts.
- If one Stripe account serves several shops or apps, its public details apply to all of them. OrbitPage does not automatically overwrite that shared profile. Keep the same intended seller contacts across those installations.

See Stripe's official [receipt customization and support requirements](https://docs.stripe.com/receipts#customize-receipts). Do not confuse the seller's public phone with **Checkout → Phone**, which collects the buyer's phone.

<a id="connect"></a>

## Connect Stripe

| Value | Where it goes |
| --- | --- |
| Secret/restricted API key (`sk_test_…` / `rk_test_…`, then live equivalents) | OrbitPage → **Stripe secret API key** |
| Endpoint URL (`https://shop.example.com/api/shop/webhook`) | Stripe → **Endpoint URL** |
| Signing secret (`whsec_…`) | OrbitPage → **Webhook signing secret** |

Publishable `pk_…` keys do not work here. Signing secrets have the same prefix in test and live mode; copy them from the intended destination.

### 1. Select the Stripe account and test environment

In [Stripe Dashboard](https://dashboard.stripe.com/), select the account that will receive payments, then its sandbox/test environment. Keep that selection while creating both credentials. Switching Stripe's dashboard view does not change the keys saved in OrbitPage.

### 2. Create the API key

Open [API keys](https://dashboard.stripe.com/apikeys) and create a [restricted key](https://docs.stripe.com/keys/restricted-api-keys) for this installation. A supported secret key also works, with broader access. Grant:

| Feature | Required access |
| --- | --- |
| Account verification and activity | Account, balance and balance-transaction reads |
| Purchases | Checkout Session write/read, Customer creation and inline Product/Price creation |
| Payment, refund and dispute verification | PaymentIntent, Charge and Dispute reads |
| Discount codes | Coupon and Promotion Code write/read |

Paste the key into **Shop settings → Stripe → Stripe secret API key**. If Stripe denies a request, check its request log for the missing permission. Saved credentials are encrypted and are not returned to the browser.

![OrbitPage Stripe settings](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.99/shop-guide-stripe-4.21.99.jpg)

### 3. Copy the endpoint URL from OrbitPage

Copy **Stripe webhook endpoint** below the secret fields. It must use your public HTTPS address and end in `/api/shop/webhook`. With a configured `/orbitpage` mount path, for example, it is `https://example.com/orbitpage/api/shop/webhook`.

Correct `PUBLIC_SITE_URL` / `BASE_PATH` if necessary. Test and live destinations can use the same URL, but require separate signing secrets.

### 4. Create the webhook destination in Stripe

Open **Workbench → Webhooks → Create destination** in the selected account/environment:

1. Choose **Your account / Events on your account**, even if it also connects to a platform.
2. Choose **snapshot events**, API version **`2026-06-24.dahlia`**, and these seven events:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
charge.refunded
charge.dispute.created
charge.dispute.closed
```

3. Choose **Webhook endpoint**, paste the copied URL and create the destination.

See [Stripe event destinations](https://docs.stripe.com/workbench/event-destinations) for the provider's setup guide.

### 5. Copy the signing secret and save

Reveal the destination's **Signing secret**, paste it into OrbitPage and select **Save and verify Stripe**. Confirm the account and **Stripe payments are in test mode** heading. Use this destination's secret, not a Stripe CLI listener secret.

### 6. Check an actual webhook delivery

The ready/configured status verifies account access and a saved secret; it does not prove Stripe can reach the endpoint or that signatures match. Complete a [test purchase](#test-checklist), then check **Event deliveries → Delivery attempts** for its actual Checkout event. Fix failures before resending. Opening the endpoint in a browser sends GET, not a signed webhook POST.

### If this Stripe account is used by another app

Create a separate destination; keep the other app's keys and webhook intact. Account-level events may reach both installations. OrbitPage can reject an unknown order from another installation, so verify event isolation before sharing an account, including between OSS and hosted Shop. Do not delete orders or disable another app's webhook to conceal errors.

### Server-managed credentials

Alternatively set `SHOP_STRIPE_SECRET_KEY` and `SHOP_STRIPE_WEBHOOK_SECRET` on the server, restart and select **Check status**. These overrides make dashboard credentials read-only. Keep them out of `VITE_*`, Git, screenshots and public pages; see [Configuration](../../administration/Configuration.md).

<a id="email"></a>

## Transactional email

1. Open **Shop settings → Email**. OSS uses **Use custom SMTP**; it does not automatically reuse Newsletter SMTP.
2. Enter host, port, username, password/app password, sender name and sender email. Add an optional Reply-to.
3. Authorize the sender with your provider and configure its recommended SPF, DKIM and DMARC records.
4. Save, then select **Send test email**. In OSS the recipient is the configured sender address; check its inbox and spam folder.
5. Repeat the test after changing connection or sender settings. A successful test is required for publication.

![The real OrbitPage Shop email settings with empty SMTP credential fields](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.99/shop-guide-email-4.21.99.jpg)

- **465:** TLS from connection start. **587 / 2525:** required STARTTLS with certificate verification. An owner-controlled private relay is supported.
- Changing the server/account requires re-entering its password. Saved credentials are encrypted.
- Shop mail includes buyer confirmations and personal links, seller notifications, questionnaire updates, booking changes and reminders.
- The retry queue needs the server running. Provider acceptance does not guarantee inbox delivery or exactly-once delivery; the verified receipt provides access even if email is delayed.
- Hosted sellers can instead choose managed OrbitPage email: see the [hosted email guide](https://orbitpage.com/en-US/docs/shop#email).

For provider examples, fields and delivery troubleshooting, see [SMTP email setup](../../integrations/smtp.md).

## Test checklist

Use this installation with **test credentials**; no second installation is needed.

1. Confirm the **test mode** heading and matching test webhook. Configure Compliance and pass the SMTP test.
2. Create a fictional digital product, attach a harmless file, make it available and publish the Shop.
3. Open the public `/shop`, start Checkout and use Stripe's test card `4242 4242 4242 4242`, any future expiry and a valid test CVC. See [Stripe testing](https://docs.stripe.com/testing).
4. Confirm the paid receipt, download the actual file, open **Your purchases**, refresh and check mobile layout.
5. Verify the real Checkout event was delivered to your endpoint. Check a discount code and, if used, a 100% discount.
6. In the test Stripe environment, test partial/full refunds and the resulting access changes. For services, also test questionnaire and calendar behavior.
7. Hide fictional products or unpublish before switching to live mode.

Never use real card details in a test environment. Test cards do not make a live Checkout safe for testing; they work only with test credentials.

## Go live on the same installation

1. Export a Shop backup if you want to retain your local test history. Stop test purchases and hide fictional products.
2. Switch Stripe Dashboard to the intended live account. Complete account activation so it can accept payments. See [Activate your account](https://docs.stripe.com/get-started/account/activate).
3. Create a live API key (`rk_live_…` or `sk_live_…`).
4. Create a **live** webhook using the same URL and seven events described above. Copy its own `whsec_…` secret.
5. In OrbitPage, replace **both** fields and select **Save and verify Stripe**. For server-managed settings, replace both environment variables, restart and select **Check status**.
6. Confirm the intended account and live **ready and configured** status. Recheck the real catalog, policies and email before publishing.
7. Disable the retired **test** destination in Stripe once testing is finished. For server-managed secrets, disable it **before** switching: OrbitPage does not retain the old environment secret.
8. On the first legitimate live purchase, verify the paid order, customer access and successful live webhook delivery.

After live account verification succeeds, cleanup and credential activation commit together:

| Automatically cleared locally | Kept |
| --- | --- |
| Test orders and customers | Products and product files |
| Test bookings and queued emails | Page content and Shop appearance |
| Test webhook history | Seller, SMTP and publication settings |
| Order counter, restarted at `#000001` | Stripe's own test records and already sent emails |

- Old test receipt/customer links stop working. Files retained only for deleted test orders follow normal automatic cleanup; unpublish or hide test products yourself because the catalog is kept.
- Invalid credentials, an inactive live account, a missing/reused test webhook secret or a failed database update leave test data intact. Actual webhook delivery still needs the check above.
- Existing live or unclassified orders are never automatically deleted. After real orders exist, changing account or returning to test mode is blocked; rotating a key for the **same account and mode** preserves orders.
- Delayed test events signed with the previous dashboard-saved secret are acknowledged without changing live data. This does not apply to retired server-managed secrets.

## Customer details

- In **Shop settings → Checkout**, configure the information Stripe collects. Name and email are required.
- Phone: off/required. Billing address: automatic/required. Business name and supported tax IDs: off/optional/required. Payment methods may require additional details.
- Add up to three text/numeric fields: labels up to 50 characters and answers up to 255 characters/digits. Do not request passwords, card details or sensitive data.
- Save changes for new checkouts. Existing orders retain their original fields, answers and consent record. Inspect verified details under **Orders → View**.
- In **Coupons**, create percentage or fixed-amount codes in the saved Shop currency. A 100% discount is supported; Checkout completion must still be verified even when there is no PaymentIntent.
- **Create coupon** is beside the Coupons heading. Optionally set a maximum number of uses and an expiry in your local time; empty limits mean unlimited uses and no expiry. These limits are fixed at creation, so revoke and recreate the code to change them.
- The table shows discount, uses/limit, expiry and status for up to 50 recent codes. Confirm **Revoke** to stop new redemptions, or **Delete** to permanently delete the underlying discount and remove it from the list. Existing orders keep their discounts. Codes created outside this Shop, or discounts shared by multiple codes, are managed in Stripe.

## Publish or unpublish

1. Save your catalog and design, complete Compliance, verify Stripe and pass the SMTP test.
2. Make at least one complete product available.
3. Select **Publish shop** in the toolbar. If disabled, hover or focus it to see the missing requirements.
4. Visit `/shop` in a private window; check product details, policy links and mobile layout. Optionally add Shop to Home.

**Unpublish** stops new storefront sales while retaining products, orders, customers and eligible paid links. It does not refund payments. If Shop is the homepage, select another homepage first. Hiding a product also preserves past purchases. Newsletter signup uses its separate audience and consent settings.

## Checkout and immediate delivery

1. The buyer reviews the product and seller terms. Digital purchases require explicit consent to immediate delivery.
2. Stripe hosts payment entry; OrbitPage does not store card details.
3. The server verifies the payment, account, mode and order binding. A redirect alone is not proof of payment.
4. The verified receipt offers downloads or service instructions and **Your purchases** immediately. Email is an additional route.

Pending payments show a waiting state. Failed/expired checkouts grant no delivery. Repeated valid events do not create a second purchase.

## Customer access and signed links

- Open **Your purchases** from the receipt or purchase email. There is no customer registration, password or email OTP.
- The personal URL is a **private bearer link**: anyone holding it can access its included eligible purchases. Do not share it or include it in screenshots.
- A link covers the explicit orders included when issued, not future purchases or other customers. It grants no dashboard, administrator or Stripe access.
- After opening, the token moves into the current tab's session storage. Refresh works in that tab; a new tab/device needs the original link. Bookmarking the clean `/shop/customer` address does not save access.

| Access | Validity / limit |
| --- | --- |
| Customer-area link | Seven days from issue; reusable until expiry or revocation |
| Digital delivery | 30-day window recorded when Checkout is created |
| Downloads | Shared order allowance of 10 × purchased file count; three files share 30 requests |
| Renewal | A still-valid receipt/delivery link issues a fresh seven-day customer link for its order; file expiry and download allowance do not reset |
| Full refund or customer erasure | Affected purchase access is revoked |

Links use server-side HMAC-SHA256 signatures; signatures prevent changes but do not encrypt the token. Keep HTTPS, mailboxes, logs, backups and signing secrets protected.

<a id="calendar"></a>

## Calendar and reminders

1. Add service instructions, session count, optional questionnaire and an HTTPS booking URL to the product. Use an event that does not charge the buyer again.
2. For Cal.com synchronization, open **Shop settings → Calendar** and copy its endpoint/signing secret into your Cal.com webhook. No Cal.com API key is required.
3. Enable `BOOKING_CREATED`, `BOOKING_RESCHEDULED` and `BOOKING_CANCELLED`.
4. Test using the complete order-specific booking link delivered after purchase; its metadata binds the appointment to the paid order.

- Buyers submit/update answers in **Your purchases**; the seller sees them on the order.
- A matching signed booking consumes one session; rescheduling uses no extra session and cancellation restores it. Duplicate events update the same booking.
- The customer area shows dates, status and meeting links. Booking changes and 24-hour and 1-hour reminders use the selected Shop email service. In OSS, keep the server and SMTP running for delivery.
- Other providers work as booking links without synchronization. External URL access/availability is controlled by that provider; cancellation does not issue a Stripe refund.

## Orders, refunds and customer erasure

- Open **Orders and customers → Orders → View** for payment, delivery, buyer information, answers and bookings. **Customers** groups saved buyers.
- Order references such as `#000001` follow Checkout creation, including abandoned attempts. Refunds do not reuse numbers; older orders may retain short-ID references.
- Issue refunds and manage disputes in Stripe, then check the verified update in OrbitPage. Partial refunds keep eligible delivery; full refunds revoke it and clear service entitlement/local booking reminders.
- Downloaded files cannot be recalled. Cancel external appointments separately in your booking provider. Disputed purchases are unavailable while ineligible for delivery.
- Customer erasure removes saved personal details, answers, local bookings and related email; it anonymizes financial orders and revokes access. It is not a refund or deletion of Stripe's independent payment records.

## INFO

Open **Shop settings → INFO** for publication state, saved Stripe readiness/mode, SMTP, calendar status and instance checks. A booking link and a verified calendar webhook are reported separately; see [FAQ](../../faq.md) for check coverage.

Stripe settings refresh when opened, when returning to the tab and every 30 seconds while visible. The account overview shows balances and up to 50 recent transactions, including activity outside this Shop. Refresh does not create a payment, email or booking.

## Storage, backup and updates

- Persist all of `DATA_DIR`, including `orbitpage.db`, `shop-files`, uploads and hidden configuration/secret files.
- Preserve `JWT_SECRET`, encryption secrets and any `SHOP_DELIVERY_SECRET`. Customer/delivery signing defaults to `JWT_SECRET`; changing it invalidates links. The Stripe webhook secret is separate.
- **Backup → Shop** includes commerce records, encrypted settings and private files, independently of the public-image ZIP. Protect the export.
- Restoring Shop replaces that commerce section and its file store; retain original secrets. Backups without Shop leave it unchanged. Page version history does not include commerce; full reset removes it.
- Updates add Shop tables without replacing existing content. Rollback requires the old runtime and matching backup. Large catalogs may need an infrastructure backup.

See [Backups](./backups-and-demo-mode.md) and [Maintenance](../../administration/maintenance.md).

On phones, Publish/Unpublish sits beside the preview device selector. Settings
and Orders hide the selector while preserving its space. Desktop previews use
a 16:9 screen that scales to the available width.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| API key rejected | Use `sk_` / `rk_`, not `pk_`; check the selected account, mode and restricted-key permissions. |
| Signature error / HTTP 400 | Copy `whsec_` from this exact destination and environment. Do not use a CLI listener secret. See [signature troubleshooting](https://docs.stripe.com/webhooks/signature). |
| Webhook redirect, 404, 502 or timeout | Check the copied URL, HTTPS/proxy, running app and access challenges. Inspect **Event deliveries → Delivery attempts**; fix before resending. Opening the URL in a browser sends GET, not Stripe's signed POST. |
| Unknown order / ownership mismatch | Check whether the event came from another app or Shop sharing the account. Do not delete orders to make it pass. |
| Account/mode change blocked | Verified test→live transitions clear only classified test data. Live/unclassified history is protected; use the same account/mode for key rotation. |
| Cannot publish or accept payments | Complete Compliance, Stripe/webhook, successful SMTP test and an available product with delivery details. |
| Receipt waiting | Check payment state and the real Checkout event's delivery. Pending or failed payments grant no files. |
| Expired link / missing new purchase | Use that purchase's recent receipt/personal link. Old customer tokens do not gain future purchases. |
| Download unavailable | Check refund/dispute/erasure, expiry, shared download allowance and the persistent file volume. |
| Email missing | Check Shop SMTP, TLS, sender permission, provider logs, running queue and spam. See [SMTP troubleshooting](../../integrations/smtp.md). |
| Booking absent | Use the complete paid-order URL; check calendar signature, triggers and remaining sessions. |
| Settings unreadable after restore | Restore the original encryption/signing secrets or deliberately replace credentials; new secrets do not preserve old access links. |

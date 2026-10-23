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

<a id="currency"></a>
<a id="required-setup-and-ai-drafts"></a>
Create digital products or services, attach delivery files and choose the Shop currency in [Shop catalog](./shop-catalog.md).

## Appearance and language

- **Personalize** opens **Shop**. Choose small, medium or large cards from **Card size**, show or hide cover images and the digital product badge, and manage **Add Shop to Home** and **Newsletter signup**. Image visibility also applies to product details; hiding the badge does not remove the digital-delivery consent. These options are independent of the page theme.
- The footer places the seller name and details beside the contact email, separated by a divider. Policy links, payment information and the OrbitPage credit appear underneath; the contact columns stack on narrow screens.
- Select **Personalize → Theme** to change layout, colors, fonts and card styling, or enable **Use the page theme**.
- Click the preview title, introduction, logo or back link to edit it. **Apply** in a dialog adds the change to the shared **Save / Reset** flow.
- **Save** persists pending Shop settings; **Reset** restores saved values. Save before refreshing or leaving.
- Check desktop and mobile previews. Grid cards adapt to three, two or one column; list layout uses one column.
- Receipts, downloads and **Your purchases** inherit Shop styling.
- Shop controls, Checkout, customer pages and appointment emails use English. Your own descriptions, policies, questions and instructions retain the language you write; external booking pages control their own language.

## Seller details and policies

1. Open **Shop settings → Compliance**.
2. Enter seller status, public name and email; include the geographic address for a professional/trader and other applicable contact details.
   Optionally add **Seller footer text** (up to 200 characters), such as “Private seller”. It appears as plain text directly below the seller name; leave it empty to hide it.
3. Add Terms, Privacy, Refunds and Withdrawal/contact policies. Complete Digital Product & License Terms and Cookie policy where applicable.
4. For each policy, choose **Host in OrbitPage** and enter text, or **External** and provide an HTTPS link.
5. Confirm the seller-responsibility acknowledgment and save.
6. Check the public footer links. Seller details and the seller email appear side by side above the legal links on wider screens. **Terms** always opens the Shop legal page with the fixed notice “The page owner is the seller; OrbitPage provides the shop software.” and your saved terms or external HTTPS link. This notice is absent from the footer. Other policies are linked only when configured.

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

<a id="1-select-the-stripe-account-and-test-environment"></a>
<a id="2-create-the-api-key"></a>
<a id="3-copy-the-endpoint-url-from-orbitpage"></a>
<a id="4-create-the-webhook-destination-in-stripe"></a>
<a id="5-copy-the-signing-secret-and-save"></a>
<a id="6-check-an-actual-webhook-delivery"></a>
<a id="if-this-stripe-account-is-used-by-another-app"></a>
<a id="server-managed-credentials"></a>
Follow the self-hosted payment procedure in [Stripe](../../integrations/stripe.md#connect).

<a id="email"></a>

## Transactional email

Configure and test your sender with [SMTP email setup](../../integrations/smtp.md#shop). OSS uses custom SMTP; it does not provide managed OrbitPage delivery. Keep the instance running for retries and scheduled reminders.

![The real OrbitPage Shop email settings with empty SMTP credential fields](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.99/shop-guide-email-4.21.99.jpg)

## Test checklist

Follow the self-hosted payment procedure in [Stripe](../../integrations/stripe.md#test-checklist).

## Go live on the same installation

Follow the self-hosted payment procedure in [Stripe](../../integrations/stripe.md#go-live-on-the-same-installation).

## Customer details

Read the complete instructions in [Shop orders and customers](./shop-customers.md#customer-details).

## Publish or unpublish

1. Save your catalog and design, complete Compliance, verify Stripe and pass the SMTP test.
2. Make at least one complete product available.
3. Select **Publish shop** in the toolbar. If disabled, hover or focus it to see the missing requirements.
4. Visit `/shop` in a private window; check product details, policy links and mobile layout. Optionally add Shop to Home.

**Unpublish** stops new storefront sales while retaining products, orders, customers and eligible paid links. It does not refund payments. If Shop is the homepage, select another homepage first. Hiding a product also preserves past purchases. Newsletter signup uses its separate audience and consent settings.

## Checkout and immediate delivery

Checkout shows the seller's configured Terms, Privacy, Refund, Withdrawal and (for digital products) Digital Product & License policies. Customers must accept the seller's Terms when configured, acknowledge the seller notice, and explicitly consent to immediate supply for digital products. In **Shop settings → Checkout**, optional seller wording can be appended to the fixed seller notice and digital-delivery consent; the fixed acknowledgements remain visible and cannot be replaced.

Read the complete instructions in [Shop orders and customers](./shop-customers.md#checkout-and-immediate-delivery).

## Customer access and signed links

Read the complete instructions in [Shop orders and customers](./shop-customers.md#customer-access-and-signed-links).

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

Read the complete instructions in [Shop orders and customers](./shop-customers.md#orders-refunds-and-customer-erasure).

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

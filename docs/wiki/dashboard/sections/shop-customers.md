# Shop orders and customers

Follow a purchase from verified checkout to delivery, customer access, discounts, refunds and erasure of saved customer information.

Part of [Shop](./shop.md).

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

## Customer details

- In **Shop settings → Checkout**, configure the information Stripe collects. Name and email are required.
- Phone: off/required. Billing address: automatic/required. Business name and supported tax IDs: off/optional/required. Payment methods may require additional details.
- Collecting billing details or a tax ID does not enable automatic tax calculation or invoice creation. Shop Checkout does not enable Stripe Tax or automatic invoices; the seller manages tax obligations and invoicing separately. An OrbitPage order confirmation is not a tax invoice.
- Add up to three text/numeric fields: labels up to 50 characters and answers up to 255 characters/digits. Buyers complete these on the product before checkout; Stripe receives the answers prefilled for confirmation. Required fields are checked by the server before creating the payment session. Do not request passwords, card details or sensitive data.
- Under **Before checkout**, add up to five acceptance boxes with your own text. Choose required or optional, and all products, digital products or services. Boxes start unchecked; the server verifies required choices and saves the exact wording and choices with the order. Existing seller notices, seller terms and digital-delivery consent remain required where applicable.
- Save changes for new checkouts. Existing orders retain their original fields, answers and consent record. Inspect verified details under **Orders → View**.
- In **Coupons**, create percentage or fixed-amount codes in the saved Shop currency. A 100% discount is supported; Checkout completion must still be verified even when there is no PaymentIntent.
- An order discounted to zero has no payment charge to refund. Review its delivery and customer access before distributing the code.
- **Create coupon** is beside the Coupons heading. Optionally set a maximum number of uses and an expiry in your local time; empty limits mean unlimited uses and no expiry. These limits are fixed at creation, so revoke and recreate the code to change them.
- The table shows discount, uses/limit, expiry and status for up to 50 recent codes. Confirm **Revoke** to stop new redemptions, or **Delete** to permanently delete the underlying discount and remove it from the list. Existing orders keep their discounts. Codes created outside this Shop, or discounts shared by multiple codes, are managed in Stripe.

## Orders, refunds and customer erasure

- Open **Orders and customers → Orders → View** for payment, delivery, buyer information, answers and bookings. **Customers** groups saved buyers.
- Order references such as `#000001` follow Checkout creation, including abandoned attempts. Refunds do not reuse numbers; older orders may retain short-ID references.
- Issue refunds and manage disputes in Stripe, then check the verified update in OrbitPage. Partial refunds keep eligible delivery; full refunds revoke it and clear service entitlement/local booking reminders.
- Downloaded files cannot be recalled. Cancel external appointments separately in your booking provider. Disputed purchases are unavailable while ineligible for delivery.
- In OSS, customer erasure removes local customer data and queued order emails. It does not delete the Stripe customer profile; manage that separately in your Stripe account.
- Customer erasure removes saved personal details, answers and local bookings; it anonymizes financial orders and revokes access. It is not a refund and does not recall delivered files or emails, cancel appointments in your booking provider, or delete Stripe's independent payment records.

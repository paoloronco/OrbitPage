# Stripe

Connect Stripe to a self-hosted Shop, verify a test purchase and switch the same installation to live payments without mixing credentials or orders.

Part of [Shop](../dashboard/sections/shop.md). Hosted sellers use [Stripe Connect](https://orbitpage.com/en-US/docs/stripe).

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

Alternatively set `SHOP_STRIPE_SECRET_KEY` and `SHOP_STRIPE_WEBHOOK_SECRET` on the server, restart and select **Check status**. These overrides make dashboard credentials read-only. Keep them out of `VITE_*`, Git, screenshots and public pages; see [Configuration](../administration/Configuration.md).

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

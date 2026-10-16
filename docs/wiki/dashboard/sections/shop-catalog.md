# Shop catalog

Create digital products and services, choose a currency and prepare private delivery files before making products available for purchase.

Part of [Shop](./shop.md).

## Create a catalog

1. Select **Add product** and choose **Digital product** or **Service**.
2. Enter a title, short description, full description and price in the selected Shop currency. Add an optional cover; click the help icons beside **Cover image** and **Product files** for formats and upload limits.
3. Save the draft product.
4. For a digital product, use **Manage files** to upload the files buyers will receive.
5. For a service, add post-payment instructions, an HTTPS booking link, or both. Set the number of sessions and optional questionnaire.
6. Enable **Available for purchase** when the product is complete, then save.
7. Use **View catalog** to find and edit products. Click a preview card to inspect its details; **Buy** is disabled in the editor.

## Product limits and files

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

## Currency

Choose **Shop settings → Checkout → Shop currency**, then save. Supported currencies: EUR, USD, GBP, CHF, CAD, AUD, NZD, SEK, NOK, DKK, PLN, CZK, SGD, HKD, INR, BRL, MXN and AED. Existing shops default to EUR; zero-decimal currencies such as JPY are not supported.

Saving updates all catalog prices without exchange-rate conversion: **10 EUR becomes 10 USD**. Review your prices before accepting new sales. Preview, public prices, new Stripe checkouts and new fixed-amount coupons use the selection.

Existing orders, open checkouts, receipts, refunds and coupons retain their original currency. Fixed-amount coupons must match the checkout currency; create a new code when needed. Stripe controls the account's payout currency, supported payment methods and conversion fees separately. See [Stripe currencies](https://docs.stripe.com/currencies).

## Required setup and AI drafts

Ask **AI Assistant** to draft a product with a title, description, type and price in the configured Shop currency. Review and confirm the proposal. AI products are saved as drafts: add real files or service delivery details yourself before enabling purchase.

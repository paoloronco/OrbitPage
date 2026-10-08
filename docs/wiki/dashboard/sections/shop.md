# Shop

One installation runs one shop, with the owner's Stripe account. The catalog,
editor, design, checkout fields, seller policies, order details and customer
portal share the same components as hosted OrbitPage. Self-hosting uses local
SQLite, private files and your SMTP server. It needs no OrbitPage account,
Firebase, R2 or OrbitPage Stripe Connect account; OrbitPage charges no platform
fee. Stripe's own fees and account eligibility still apply.

The editor uses the same toolbar, typography and dialogs in both editions.
The Test/Live payment badge and publication actions sit below the workspace;
Stripe setup differs because self-hosted installations use their owner's keys.

Shop interfaces use English in both editions, including the dashboard editor,
catalog controls,
Stripe Checkout, order delivery, purchase history and appointment emails. Dates
and prices use English formatting regardless of the browser language. Product
descriptions, seller policies, custom checkout fields and service instructions
remain in the language written by the seller; external booking pages set their
own language.

Only administrators with `users:manage` can manage commerce. Demo mode permits
viewing the editor and blocks changes, uploads and checkout.

## Create a catalog

Open **Site editor → Shop** (`/dashboard/editor/shop/products`). Add a digital
product or service, enter its title, full description and EUR price, and save.
New products start as drafts: enable **Available for purchase** when ready.

Digital products support up to ten files, 50 MB each, in the editor's allowed
document, archive, ebook, image, audio and video formats. **Manage files** handles
uploads, retry and removal. Files are stored under `DATA_DIR/shop-files`, outside
public `/uploads`. Covers and logos are public images. A digital product needs
at least one file before it can be sold. The catalog allows twenty products,
one product per Checkout Session, and no cart. Prices and file limits are
validated on the server.

Services support post-payment instructions, an HTTPS booking link, intake
questions and a package of sessions. **Design** controls colors, typography,
cards, background, logo and navigation. **Legal** stores the seller's details
and hosted policy text or external HTTPS links. Hosted policies appear at
`/shop/legal`; unconfigured policy URLs return 404. Review your seller disclosures
and acknowledge seller responsibility before enabling the shop.

<a id="connect"></a>
<a id="customer-details"></a>

## Connect Stripe

1. Start with a Stripe test account or sandbox. Open **Shop settings → Stripe**.
2. Enter its secret API key (`sk_test_` or an appropriately scoped `rk_test_`)
   and choose **Save and verify Stripe**. The form verifies the owner and mode;
   saved keys are encrypted and are never returned to the browser.
3. In the same Stripe account and mode, create an HTTPS webhook using the
   endpoint shown in the form (`/api/shop/webhook`). Subscribe to
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `checkout.session.expired`,
   `charge.refunded`, `charge.dispute.created` and `charge.dispute.closed`.
4. Save its `whsec_` signing secret in the Stripe form and check status.
5. Enable the shop and open `/shop`. Set an absolute, canonical HTTPS
   `PUBLIC_SITE_URL` before using it publicly; retain any configured `BASE_PATH`.
6. Test an undiscounted purchase, a promotion code, the receipt, private download
   and a test refund. Stripe promotion codes are managed in the owner's account.

Restricted keys need account and balance reads, Checkout Session creation and
retrieval, and reads of PaymentIntents, charges and disputes. Checkout's enabled
customer and inline price/product features may require their corresponding
permissions. Follow [Stripe key guidance](https://docs.stripe.com/keys) and
[webhook guidance](https://docs.stripe.com/webhooks).

Alternatively, set `SHOP_STRIPE_SECRET_KEY` and `SHOP_STRIPE_WEBHOOK_SECRET` on
the server and restart. These overrides make the form read-only; **Check status**
verifies a changed key. Never use `VITE_*` for secrets. Once orders exist, the
account and test/live mode cannot be changed: rotate keys within the same
account and mode, or start a separate installation. Use a separate test instance
for testing a live shop.

Checkout is hosted by Stripe. The server snapshots the original price, seller
policies, file references and service details, verifies the exact session and
captured payment, and records Stripe's discount and net amount. Returning from
Checkout alone does not authorize delivery. A completed 100% discount is
supported without a PaymentIntent. Signed webhooks and receipt reconciliation
handle asynchronous payments and repeated events; refunds and disputes update
access using authoritative provider state.

<a id="email"></a>

## Transactional email

Configure **Shop settings → Email** with your SMTP host, port (465, 587 or 2525),
username, password, sender and reply address. Shop SMTP is independent of
Newsletter SMTP. TLS is required; test the sender before selling. Buyer receipts,
seller notifications, intake and booking notices use a persistent retry queue.
The local worker runs while the application is running, retries temporary
failures and uses stable message IDs. SMTP acceptance cannot guarantee inbox
delivery or exactly-once delivery after a connection failure.

The receipt verifies Stripe immediately on return from Checkout; email delivery
does not delay downloads or booking access. Receipts and emails include a personal
purchase-area link: no registration, password or OTP is required. The purchase
area lists files with Download buttons and service booking/questionnaire actions.
Keep the link private; it is a bearer credential and expires after seven days.
Receipts link to private downloads and the customer portal. Digital download
capabilities expire after thirty days with a combined download budget of ten
times the number of purchased files, matching hosted OrbitPage. Customer
portal links expire after seven days and can be renewed through the verified
purchase receipt. Do not publish or share these bearer links. Customer erasure
anonymizes saved orders, clears intake/contact details and revokes access.

<a id="calendar"></a>

## Calendar and reminders

Services work with an ordinary HTTPS booking link. For Cal.com booking updates,
copy the endpoint and signing secret from **Shop settings → Calendar** to the
same Cal.com webhook configuration. Enable the events shown in the form.
The purchased booking link carries order-specific metadata. Only correctly
signed bookings tied to that order and buyer can consume sessions; duplicate
events, rescheduling and cancellation update the same record. The local worker
queues twenty-four-hour and one-hour reminders. Keep the server running and
SMTP configured. Other booking providers remain links without Cal.com webhook
synchronization.

## Storage, backup and updates

Persist the complete `DATA_DIR`, including `orbitpage.db`, `shop-files`, public
uploads and hidden secret/configuration files. Keep `JWT_SECRET`, your encryption
key and any separate `SHOP_DELIVERY_SECRET` stable across restarts and restores.
The default delivery secret is `JWT_SECRET`. The shared upload quota includes
public media and private Shop files; removed purchased files remain until their
delivery expires. Startup adds Shop tables without changing existing content.
Docker and supported installers use the same server and persistent directory.

Dashboard **Backup → Shop** contains commerce records, encrypted settings and
private file bytes, independently of the optional public-image ZIP. Protect it
as sensitive customer data. Restoring Shop replaces the whole selected commerce
section and file store; preserve the original signing/encryption secrets for
credentials and existing access links. Older backups without Shop leave it
unchanged. Page version history excludes commerce. A full reset or personal-page
deletion also removes commerce records and files. A rollback needs the previous
runtime and its matching pre-update data backup.

Large catalogs may exceed the configured dashboard backup media limit. Use a
full infrastructure backup instead of raising limits blindly. See
[Backups](./backups-and-demo-mode.md) and
[Maintenance](../../administration/maintenance.md).

## Troubleshooting

- **Shop cannot accept payments:** verify Stripe and webhook mode, seller
  acknowledgment, product availability and file attachments. Recheck status
  after changing an environment key.
- **Receipt is waiting:** inspect Stripe's payment status and webhook delivery.
  An asynchronous or failed payment grants no files; retry the verified receipt
  after Stripe confirms it.
- **Download unavailable:** check refund/dispute status, customer erasure,
  capability expiry, download limit and the persistent private file volume.
- **Email queued:** check SMTP TLS, sender authorization, server uptime and the
  provider's delivery logs. A payment remains recorded while mail is retried.
- **Restore cannot decrypt settings:** restore the original secret configuration
  from the infrastructure backup or replace credentials deliberately. Do not
  create a new signing secret while expecting old receipt links to work.

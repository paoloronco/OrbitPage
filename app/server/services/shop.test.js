import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';

const provider = vi.hoisted(() => ({ sessions: new Map(), intents: new Map(), charges: new Map(), disputes: new Map(), creates: [], messages: [], signing: null, emailFailureFor: null }));
vi.mock('stripe', async () => {
  const { default: Stripe } = await vi.importActual('stripe');
  const webhooks = new Stripe('sk_test_fixture').webhooks;
  provider.signing = webhooks;
  return { default: class {
    constructor(key) {
      this.webhooks = webhooks;
      this.accounts = { retrieve: async () => { if (key === 'sk_test_invalid') throw new Error('Invalid credential'); return { id: key === 'sk_test_foreign' ? 'acct_other' : 'acct_owner', charges_enabled: true }; } };
      this.balance = { retrieve: async () => ({ livemode: key.includes('_live_') }) };
      this.checkout = { sessions: {
        create: async (input, options) => { provider.creates.push({ input, options }); const id = `cs_test_${randomUUID().replaceAll('-', '')}`;
          const session = { id, livemode: false, url: `https://checkout.stripe.com/test/${id}`, mode: 'payment', status: 'open', payment_status: 'unpaid', metadata: input.metadata,
            amount_subtotal: input.line_items[0].price_data.unit_amount, amount_total: input.line_items[0].price_data.unit_amount,
            total_details: { amount_discount: 0, amount_tax: 0, amount_shipping: null }, currency: 'eur', payment_intent: null,
            customer_details: { email: 'synthetic@example.com', name: 'Synthetic Buyer' } };
          provider.sessions.set(id, session); return session; },
        retrieve: async id => provider.sessions.get(id),
        list: async input => ({ data: [...provider.sessions.values()].filter(session => session.payment_intent === input.payment_intent) }),
      } };
      this.paymentIntents = { retrieve: async id => provider.intents.get(id) };
      this.charges = { retrieve: async id => provider.charges.get(id) };
      this.disputes = { retrieve: async id => provider.disputes.get(id) };
    }
  } };
});
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ verify: async () => true,
  sendMail: async message => {
    provider.messages.push(message);
    if (provider.emailFailureFor && message.messageId === provider.emailFailureFor) {
      provider.emailFailureFor = null; throw new Error('Synthetic temporary SMTP failure');
    }
    return { accepted: [message.to] };
  }, close() {},
}) } }));

const dataDir = mkdtempSync(join(tmpdir(), 'orbitpage-shop-'));
process.env.DATA_DIR = dataDir;
process.env.JWT_SECRET = 'shop-fixture-stable-secret-with-at-least-thirty-two-characters';
delete process.env.SHOP_STRIPE_SECRET_KEY;
delete process.env.SHOP_STRIPE_WEBHOOK_SECRET;
let db, shop, lifecycle, app, auth, adminToken;
const base = 'https://shop.example.com';
const hookSecret = 'whsec_syntheticfixture';
beforeAll(async () => {
  db = await import('../database.js'); await db.initializeDatabase();
  shop = await import('./shop.js'); lifecycle = await import('./shop-lifecycle.js'); auth = await import('../auth.js');
  await auth.setupInitialCredentials('Synthetic!Admin2026');
  const admin = await db.dbGet('SELECT * FROM admin_users WHERE username = ?', ['admin']);
  adminToken = auth.generateToken('admin', admin.auth_version, admin.session_id);
  const { createShopRouter, createShopWebhookRouter, createShopPublicRouter } = await import('../routes/shop.js');
  app = express(); app.use('/api/shop', createShopWebhookRouter({ demoMode: false })); app.use(express.json()); app.use(express.urlencoded({ extended: true }));
  app.use('/api/shop', createShopRouter({ demoMode: false, publicBase: () => base })); app.use('/shop', createShopPublicRouter({ publicBase: () => base }));
});
afterAll(async () => {
  if (db) await new Promise(resolve => db.default.close(resolve)); rmSync(dataDir, { recursive: true, force: true });
});
const digitalInput = () => ({ type: 'digital', title: 'Synthetic PDF', description: 'Test digital delivery', priceCents: 1000, active: true });
async function newProduct(input = digitalInput()) {
  const dashboard = await shop.saveShopProduct(input, base), id = dashboard.savedProductId;
  if (input.type === 'digital') {
    const body = Buffer.from('%PDF-1.7\nsynthetic download');
    const upload = await shop.reserveShopUpload({ productId: id, filename: 'synthetic.pdf', contentType: 'application/pdf', sizeBytes: body.length, kind: 'file' }, base);
    await shop.receiveShopUpload(upload.uploadToken, body, 'application/pdf'); await shop.finalizeShopUpload(upload.uploadToken, base);
  }
  return id;
}
async function newCheckout(productId, discount = 0, paid = true) {
  await shop.createShopCheckout({ productId, sellerNoticeAcknowledged: true, sellerTermsAccepted: false, digitalContentConsent: true }, base);
  const session = [...provider.sessions.values()].at(-1);
  session.status = 'complete'; session.amount_total = session.amount_subtotal - discount; session.total_details.amount_discount = discount;
  session.payment_status = paid ? session.amount_total ? 'paid' : 'no_payment_required' : 'unpaid';
  if (session.amount_total) {
    const intentId = `pi_${randomUUID()}`, chargeId = `ch_${randomUUID()}`;
    session.payment_intent = intentId;
    provider.intents.set(intentId, { id: intentId, status: 'succeeded', amount: session.amount_total, amount_received: session.amount_total, currency: 'eur', latest_charge: chargeId, application_fee_amount: null });
    provider.charges.set(chargeId, { id: chargeId, payment_intent: intentId, amount: session.amount_total, amount_refunded: 0, currency: 'eur', captured: true, paid: true, application_fee: null });
  }
  return session;
}
async function webhook(type, object, id = `evt_${randomUUID()}`, override = {}) {
  const payload = JSON.stringify({ id, object: 'event', type, livemode: false, data: { object }, ...override });
  const signature = provider.signing.generateTestHeaderString({ payload, secret: hookSecret });
  return request(app).post('/api/shop/webhook').set('Content-Type', 'application/json').set('stripe-signature', signature).send(payload);
}
describe('Shop SQLite integration with signed webhooks and simulated provider responses', () => {
  it('reports only saved Shop configuration without generating mail, calendar or payment activity', async () => {
    const messages = provider.messages.length, payments = provider.creates.length;
    const info = await shop.shopInfo();
    expect(info).toEqual({ published: false, stripe: { connected: false, ready: false, livemode: null },
      email: { mode: 'custom', configured: false, verifiedAt: null }, calendar: { configured: false, webhookVerified: false } });
    expect(provider.messages).toHaveLength(messages); expect(provider.creates).toHaveLength(payments);
    expect(JSON.stringify(info)).not.toContain(process.env.JWT_SECRET);
  });
  it('requires an administrator and never returns encrypted or clear credentials', async () => {
    expect((await request(app).get('/api/shop')).status).toBe(401);
    await db.dbRun('INSERT INTO admin_users (username, password_hash, salt, role) VALUES (?, ?, ?, ?)', ['viewer', 'unused', 'unused', 'viewer']);
    const viewer = await db.dbGet('SELECT * FROM admin_users WHERE username = ?', ['viewer']);
    expect((await request(app).get('/api/shop').auth(auth.generateToken('viewer', viewer.auth_version, viewer.session_id), { type: 'bearer' })).status).toBe(403);
    await shop.configureShopStripe({ secretKey: 'sk_test_syntheticfixture', webhookSecret: hookSecret }, base);
    const result = await request(app).get('/api/shop').auth(adminToken, { type: 'bearer' });
    expect(result.status).toBe(200); expect(JSON.stringify(result.body)).not.toContain(hookSecret); expect(JSON.stringify(result.body)).not.toContain('sk_test_');
    const persisted = await db.dbGet('SELECT data FROM shop_settings'); expect(persisted.data).not.toContain(hookSecret); expect(persisted.data).not.toContain('sk_test_');
  });
  it('allows catalog editing and uploads before setup but requires saved Compliance, Stripe and tested SMTP for publication', async () => {
    const id = await newProduct();
    const edited = await shop.saveShopProduct({ ...digitalInput(), productId: id, title: 'Editable before setup' }, base);
    expect(edited.products.find(product => product.productId === id)).toMatchObject({ title: 'Editable before setup', active: true });
    await expect(shop.setShopPublished(true, base)).rejects.toMatchObject({ code: 'SHOP_COMPLIANCE_REQUIRED' });
    await shop.saveShopAppearance({ ...(await shop.shopSettings()).appearance, sellerSelfCertified: true, sellerType: 'private', sellerName: 'Synthetic Seller', sellerEmail: 'seller@example.com', termsText: 'Seller terms', privacyText: 'Privacy policy', refundPolicyText: 'Refund policy', withdrawalText: 'Withdrawal policy' }, base);
    await expect(shop.setShopPublished(true, base)).rejects.toMatchObject({ code: 'SHOP_EMAIL_REQUIRED' });
    await shop.configureShopEmail({ mode: 'custom', host: 'smtp.example.com', port: 587, username: 'sender', password: 'synthetic-password', fromName: 'Shop', fromEmail: 'seller@example.com', replyTo: '' });
    await expect(shop.setShopPublished(true, base)).rejects.toMatchObject({ code: 'SHOP_EMAIL_REQUIRED' });
    await shop.testShopEmail();
    const setting = await shop.shopSettings();
    await shop.saveShopSettings({ ...setting, stripe: { ...setting.stripe, ready: false } });
    await expect(shop.assertShopSetup()).rejects.toMatchObject({ code: 'SHOP_NOT_READY' });
    await expect(shop.saveShopProduct({ ...digitalInput(), productId: id, active: false }, base)).resolves.toHaveProperty('savedProductId', id);
    await shop.saveShopSettings(setting);
    await shop.deleteShopProduct(id, base);
  });
  it('persists catalog and private uploads, renders the shared storefront, and keeps checkout pricing on the server', async () => {
    const id = await newProduct();
    const appearance = { ...(await shop.shopSettings()).appearance, sellerSelfCertified: true, sellerEmail: 'seller@example.com', homeLinkEnabled: true };
    await shop.saveShopAppearance(appearance, base); await shop.setShopPublished(true, base);
    const page = await request(app).get('/shop'); expect(page.status).toBe(200); expect(page.text).toContain('Synthetic PDF');
    expect((await request(app).get('/shop/legal/privacy')).status).toBe(200);
    expect((await request(app).get('/shop/legal/unknown')).status).toBe(404);
    expect(page.headers['content-security-policy']).toContain('sha256-'); expect(page.headers['content-security-policy']).toContain('https://checkout.stripe.com');
    expect((await db.dbGet('SELECT url FROM links WHERE id = ?', ['orbitpage-shop'])).url).toBe(`${base}/shop`);
    const checkout = await request(app).post('/api/shop/checkout').type('form').send({ productId: id, priceCents: 1, sellerNoticeAcknowledged: 'accepted', digitalContentConsent: 'accepted' });
    expect(checkout.status).toBe(303); expect(provider.creates.at(-1).input.line_items[0].price_data.unit_amount).toBe(1000);
    expect(provider.creates.at(-1).input.locale).toBe('en');
    expect(provider.creates.at(-1).input.payment_intent_data).not.toHaveProperty('application_fee_amount');
    const product = (await shop.shopProducts()).find(p => p.productId === id); expect(existsSync(shop.shopFilePath(product.files[0].id))).toBe(true);
    await expect(shop.reserveShopUpload({ productId: id, filename: '../../secret.pdf', contentType: 'application/pdf', sizeBytes: 20, kind: 'file' }, base)).rejects.toThrow('valid filename');
    await expect(shop.shopDelivery(`${randomUUID()}.invalid`)).rejects.toMatchObject({ code: 'SHOP_DOWNLOAD_INVALID' });
  });
  it('fulfills discounted orders exactly once, survives duplicated and delayed events, and counts downloads atomically', async () => {
    const id = await newProduct(), session = await newCheckout(id, 500), eventId = `evt_${randomUUID()}`;
    expect((await webhook('checkout.session.completed', session, eventId)).status).toBe(200);
    expect((await webhook('checkout.session.completed', session, eventId)).body.duplicate).toBe(true);
    const order = await shop.shopOrder(session.metadata.orbitpageOrderId); expect(order).toMatchObject({ status: 'paid', amountTotal: 500, amountSubtotal: 1000, amountDiscount: 500, applicationFeeAmount: 0 });
    expect((await db.dbGet('SELECT COUNT(*) AS count FROM shop_emails WHERE order_id = ?', [order.orderId])).count).toBe(2);
    const token = shop.deliveryTokenForOrder(order.orderId);
    const originalTheme = await db.dbGet('SELECT full_config FROM theme_config WHERE id = 1');
    await db.dbRun('UPDATE theme_config SET full_config = ? WHERE id = 1', [JSON.stringify({ background: '#101a2c', fontFamily: 'Georgia, serif' })]);
    const delivery = await shop.shopDelivery(token);
    expect(delivery).toMatchObject({ downloadable: true, paidAt: order.paidAt, shop: { supportEmail: 'seller@example.com', design: { pageBackground: '#101a2c', fontFamily: 'Georgia, serif' } } });
    const portal = await lifecycle.getShopCustomerPortal(new URL(delivery.customerPortalUrl).searchParams.get('access'));
    expect(portal.shop).toEqual(delivery.shop);
    expect(JSON.stringify(delivery.shop)).not.toContain('sk_test_');
    await db.dbRun('UPDATE theme_config SET full_config = ? WHERE id = 1', [originalTheme.full_config]);
    await shop.saveShopProduct({ ...digitalInput(), productId: id, priceCents: 2200, removedFileIds: order.deliveryFiles.map(file => file.id) }, base);
    await shop.deleteShopProduct(id, base); expect(existsSync(shop.shopFilePath(order.deliveryFiles[0].id))).toBe(true);
    const downloads = await Promise.allSettled(Array.from({ length: 12 }, () => shop.shopDelivery(token, 0, true)));
    expect(downloads.filter(result => result.status === 'fulfilled')).toHaveLength(10);
    expect((await shop.shopOrder(order.orderId)).downloadCount).toBe(10);
    expect((await webhook('checkout.session.expired', session)).status).toBe(200);
    expect((await shop.shopOrder(order.orderId)).status).toBe('paid');
  });
  it('does not deliver asynchronous unpaid sessions and handles failed, later successful and fully free checkouts', async () => {
    const id = await newProduct(), session = await newCheckout(id, 0, false);
    expect((await webhook('checkout.session.completed', session)).status).toBe(200);
    expect((await shop.shopOrder(session.metadata.orbitpageOrderId)).paidAt).toBeNull();
    expect((await webhook('checkout.session.async_payment_failed', session)).status).toBe(200);
    session.payment_status = 'paid'; expect((await webhook('checkout.session.async_payment_succeeded', session)).status).toBe(200);
    expect((await shop.shopOrder(session.metadata.orbitpageOrderId)).status).toBe('paid');
    const free = await newCheckout(id, 1000); free.payment_status = 'paid'; expect((await webhook('checkout.session.completed', free)).status).toBe(200);
    expect(await shop.shopOrder(free.metadata.orbitpageOrderId)).toMatchObject({ amountTotal: 0, amountDiscount: 1000, stripePaymentIntentId: null, status: 'paid' });
  });
  it('preserves the hosted download budget for purchases containing multiple files', async () => {
    const id = await newProduct(), body = Buffer.from('%PDF-1.7\nsecond synthetic file');
    const upload = await shop.reserveShopUpload({ productId: id, filename: 'second.pdf', contentType: 'application/pdf', sizeBytes: body.length, kind: 'file' }, base);
    await shop.receiveShopUpload(upload.uploadToken, body, 'application/pdf'); await shop.finalizeShopUpload(upload.uploadToken, base);
    const session = await newCheckout(id); await webhook('checkout.session.completed', session);
    const token = shop.deliveryTokenForOrder(session.metadata.orbitpageOrderId);
    expect((await shop.shopDelivery(token)).maxDownloads).toBe(20);
    await Promise.all(Array.from({ length: 11 }, () => shop.shopDelivery(token, 0, true)));
    expect((await shop.shopDelivery(token)).downloadCount).toBe(11);
  });
  it('rejects false signatures, foreign mode, tampered subtotal, and wrong payment bindings', async () => {
    const id = await newProduct(), session = await newCheckout(id);
    expect((await request(app).post('/api/shop/webhook').set('stripe-signature', 'false').send({})).status).toBe(400);
    expect((await webhook('checkout.session.completed', session, undefined, { livemode: true })).status).toBe(400);
    session.amount_subtotal = 1001; expect((await webhook('checkout.session.completed', session)).status).toBe(502);
    session.amount_subtotal = 1000; provider.intents.get(session.payment_intent).amount_received = 1;
    expect((await webhook('checkout.session.completed', session)).status).toBe(502);
    expect((await shop.shopOrder(session.metadata.orbitpageOrderId)).paidAt).toBeNull();
  });
  it('reconciles an early full refund before delivery and prevents a late paid event from resurrecting access', async () => {
    const id = await newProduct(), session = await newCheckout(id, 400);
    const charge = provider.charges.get(provider.intents.get(session.payment_intent).latest_charge); charge.amount_refunded = 600;
    expect((await webhook('charge.refunded', charge)).status).toBe(200);
    const order = await shop.shopOrder(session.metadata.orbitpageOrderId); expect(order).toMatchObject({ status: 'refunded', amountTotal: 600, amountRefunded: 600 });
    expect((await webhook('checkout.session.completed', session)).status).toBe(200);
    await expect(shop.shopDelivery(shop.deliveryTokenForOrder(order.orderId))).rejects.toMatchObject({ code: 'SHOP_DOWNLOAD_INVALID' });
    expect((await db.dbGet('SELECT COUNT(*) AS count FROM shop_emails WHERE order_id = ?', [order.orderId])).count).toBe(0);
  });
  it('keeps verified credentials on failed configuration and prevents foreign account or mode changes with orders', async () => {
    const before = (await shop.shopSettings()).stripe;
    await expect(shop.configureShopStripe({ secretKey: 'sk_test_invalid' }, base)).rejects.toThrow();
    expect((await shop.shopSettings()).stripe).toEqual(before);
    await expect(shop.configureShopStripe({ secretKey: 'sk_test_foreign' }, base)).rejects.toMatchObject({ code: 'STRIPE_ACCOUNT_CHANGE_BLOCKED' });
    await expect(shop.configureShopStripe({ secretKey: 'sk_live_syntheticfixture' }, base)).rejects.toMatchObject({ code: 'STRIPE_ACCOUNT_CHANGE_BLOCKED' });
    await shop.configureShopStripe({ secretKey: 'sk_test_rotatedfixture' }, base);
    expect((await shop.shopSettings()).stripe.accountId).toBe('acct_owner');
    process.env.SHOP_STRIPE_SECRET_KEY = 'sk_test_foreign';
    try {
      expect((await shop.shopDashboard(base)).shop.stripeReady).toBe(false);
      await expect(shop.shopStripe()).rejects.toMatchObject({ code: 'STRIPE_SETTINGS_CHANGED' });
      await expect(shop.refreshShopStripe(base)).rejects.toMatchObject({ code: 'STRIPE_ACCOUNT_CHANGE_BLOCKED' });
    }
    finally { delete process.env.SHOP_STRIPE_SECRET_KEY; }
    expect((await shop.shopSettings()).stripe.accountId).toBe('acct_owner');
  });
  it('uses the authoritative dispute state on delayed events and verifies charge ownership', async () => {
    const session = await newCheckout(await newProduct()); await webhook('checkout.session.completed', session);
    const intent = provider.intents.get(session.payment_intent);
    const dispute = { id: 'dp_fixture', payment_intent: session.payment_intent, charge: intent.latest_charge, status: 'needs_response' };
    provider.disputes.set(dispute.id, dispute);
    expect((await webhook('charge.dispute.created', dispute)).status).toBe(200);
    expect((await shop.shopOrder(session.metadata.orbitpageOrderId)).status).toBe('disputed');
    dispute.status = 'won';
    expect((await webhook('charge.dispute.created', { ...dispute, status: 'needs_response' })).status).toBe(200);
    expect((await shop.shopOrder(session.metadata.orbitpageOrderId)).status).toBe('paid');
    dispute.charge = 'ch_foreign';
    expect((await webhook('charge.dispute.closed', dispute)).status).toBe(502);
  });
  it('uses durable email retries, revokes customer access on erasure, and never restores erased details on replay', async () => {
    await shop.configureShopEmail({ mode: 'custom', host: 'smtp.example.com', port: 587, username: 'sender', password: 'synthetic-password', fromName: 'Shop', fromEmail: 'seller@example.com', replyTo: '' });
    await shop.testShopEmail('seller@example.com');
    const id = await newProduct(), session = await newCheckout(id); await webhook('checkout.session.completed', session);
    const order = await shop.shopOrder(session.metadata.orbitpageOrderId), customer = await shop.shopCustomer(order.customerId);
    const token = shop.customerPortalToken(customer, [order.orderId]);
    const portal = await lifecycle.getShopCustomerPortal(token);
    expect(portal.orders).toHaveLength(1);
    expect(portal.orders[0]).toMatchObject({ downloadsRemaining: 10, files: [{ filename: 'synthetic.pdf', sizeBytes: expect.any(Number), url: expect.stringContaining('/api/shop/download/') }] });
    expect((await request(app).get(new URL(portal.orders[0].files[0].url).pathname + '?file=0')).status).toBe(200);
    const emailId = `${order.orderId}:buyer`, messageId = `<${createHash('sha256').update(emailId).digest('hex')}@shop.example.com>`;
    provider.emailFailureFor = messageId;
    await Promise.all([shop.dispatchShopEmails(), shop.dispatchShopEmails()]);
    const failed = await db.dbGet('SELECT * FROM shop_emails WHERE id = ?', [emailId]);
    expect(failed).toMatchObject({ status: 'pending', attempts: 1, lease_until: 0 });
    expect(failed.next_run).toBeGreaterThan(Date.now());
    const buyerAttempts = () => provider.messages.filter(message => message.messageId === messageId);
    await shop.dispatchShopEmails(); expect(buyerAttempts()).toHaveLength(1);
    await db.dbRun('UPDATE shop_emails SET next_run = ? WHERE id = ?', [Date.now() - 1, emailId]);
    await Promise.all([shop.dispatchShopEmails(), shop.dispatchShopEmails()]);
    expect(await db.dbGet('SELECT status, attempts, lease_until FROM shop_emails WHERE id = ?', [emailId]))
      .toMatchObject({ status: 'sent', attempts: 2, lease_until: 0 });
    expect(buyerAttempts()).toHaveLength(2);
    const sent = provider.messages.length; await shop.dispatchShopEmails(); expect(provider.messages).toHaveLength(sent);
    await shop.deleteShopCustomer(order.customerId, base);
    await expect(lifecycle.getShopCustomerPortal(token)).rejects.toThrow('no longer active');
    await webhook('checkout.session.completed', session); expect((await shop.shopOrder(order.orderId)).buyerEmail).toBeNull();
  });
  it('allocates consecutive order numbers for simultaneous checkouts and keeps AI drafts private', async () => {
    const id = await newProduct({ type: 'service', title: 'Number fixture', description: 'Test order sequence', fulfillmentText: 'Contact the seller', priceCents: 1000, active: true });
    const before = (await shop.shopSettings()).lastOrderNumber;
    await Promise.all(Array.from({ length: 3 }, () => shop.createShopCheckout({ productId: id, sellerNoticeAcknowledged: true, digitalContentConsent: false }, base)));
    const orders = (await shop.shopDashboard(base)).orders.filter(order => order.productTitle === 'Number fixture');
    expect(orders.map(order => order.orderNumber).sort((a, b) => a - b)).toEqual([before + 1, before + 2, before + 3]);
    const draft = { productId: randomUUID(), type: 'service', title: 'AI draft', description: 'Not available for purchase', priceCents: 1000 };
    await db.withImmediateTransaction(transaction => shop.persistShopAiDrafts(transaction, [draft]));
    const product = (await shop.shopDashboard(base)).products.find(item => item.productId === draft.productId);
    expect(product).toMatchObject({ active: false, bookingUrl: '', fulfillmentText: '', files: [] });
    await expect(shop.createShopCheckout({ productId: draft.productId, sellerNoticeAcknowledged: true, digitalContentConsent: false }, base)).rejects.toThrow();
    await expect(db.withImmediateTransaction(transaction => shop.persistShopAiDrafts(transaction, [{ ...draft, productId: randomUUID(), active: true }]))).rejects.toThrow();
  });
  it('enforces paid service intake and Cal.com access, duplicate events, session counts, rescheduling and cancellation', async () => {
    const id = await newProduct({ type: 'service', title: 'Synthetic Session', description: 'Test booking', fulfillmentText: 'Choose a time.', bookingUrl: 'https://cal.com/example/session', sessionsIncluded: 2,
      intakeQuestions: [{ id: 'goal', prompt: 'Your goal?', required: true }], priceCents: 3000, active: true });
    const session = await newCheckout(id); await webhook('checkout.session.completed', session);
    const order = await shop.shopOrder(session.metadata.orbitpageOrderId), customer = await shop.shopCustomer(order.customerId), access = shop.customerPortalToken(customer, [order.orderId]);
    await expect(lifecycle.submitShopIntake(access, { orderId: order.orderId, answers: [] })).rejects.toThrow('Answer required');
    await lifecycle.submitShopIntake(access, { orderId: order.orderId, answers: [{ questionId: 'goal', answer: 'Synthetic goal' }] });
    const bookingAccess = new URL(shop.bookingUrlForOrder(order)).searchParams.get('metadata[orbitpageBookingAccess]');
    const payload = { uid: 'fixture-booking', startTime: new Date(Date.now() + 3600_000).toISOString(), endTime: new Date(Date.now() + 7200_000).toISOString(), meetingUrl: 'javascript:alert(1)', metadata: { orbitpageOrderId: order.orderId, orbitpageBookingAccess: bookingAccess } };
    const call = async (triggerEvent, extra = {}) => {
      const raw = Buffer.from(JSON.stringify({ triggerEvent, payload: { ...payload, ...extra } }));
      return lifecycle.processShopCalendarWebhook(shop.shopSign('calcom-route', 'owner'), raw, createHmac('sha256', shop.shopSign('calcom-webhook', 'owner')).update(raw).digest('hex'));
    };
    await call('BOOKING_CREATED'); await call('BOOKING_CREATED'); expect((await shop.shopOrder(order.orderId)).sessionsRemaining).toBe(1);
    expect((await lifecycle.getShopCustomerPortal(access)).bookings[0].meetingUrl).toBeNull();
    expect((await lifecycle.dispatchShopBookingReminders()).queued).toBe(1);
    expect((await lifecycle.dispatchShopBookingReminders()).queued).toBe(0);
    expect((await db.dbGet("SELECT COUNT(*) AS count FROM shop_emails WHERE order_id = ? AND id LIKE 'reminder:%'", [order.orderId])).count).toBe(2);
    await call('BOOKING_RESCHEDULED', { uid: 'replacement-booking', rescheduleUid: 'fixture-booking', startTime: new Date(Date.now() + 24 * 3600_000).toISOString() }); expect((await shop.shopOrder(order.orderId)).sessionsRemaining).toBe(1);
    expect((await lifecycle.dispatchShopBookingReminders()).queued).toBe(1);
    expect((await lifecycle.dispatchShopBookingReminders()).queued).toBe(0);
    expect((await db.dbGet("SELECT COUNT(*) AS count FROM shop_emails WHERE order_id = ? AND id LIKE 'reminder:%'", [order.orderId])).count).toBe(4);
    await call('BOOKING_CANCELLED', { uid: 'replacement-booking' }); expect((await shop.shopOrder(order.orderId)).sessionsRemaining).toBe(2);
    await call('BOOKING_CREATED', { uid: 'replacement-booking' }); expect((await shop.shopOrder(order.orderId)).sessionsRemaining).toBe(2);
  });
  it('restores Shop data and private files together, preserves legacy backups, and rolls back failed restores', async () => {
    const { createApplicationBackup, restoreApplicationBackup } = await import('./backup-service.js');
    const uploadsPath = join(dataDir, 'uploads');
    const backup = await createApplicationBackup({ appVersion: 'test', dbAll: db.dbAll, uploadsPath, sections: ['shop'] });
    expect(backup.tables.shop_orders.length).toBeGreaterThan(0);
    expect(backup.shopFiles.length).toBeGreaterThan(0);
    const privateFile = backup.shopFiles[0], original = readFileSync(shop.shopFilePath(privateFile.path));
    await expect(restoreApplicationBackup({ backup: { ...backup, shopFiles: [{ ...privateFile, path: '../uploads/exposed.pdf' }] }, dbRun: db.dbRun, uploadsPath })).rejects.toThrow();
    expect(readFileSync(shop.shopFilePath(privateFile.path))).toEqual(original);
    await expect(db.withTransaction(() => restoreApplicationBackup({ backup, dbRun: async () => { throw new Error('synthetic database failure'); }, uploadsPath, deferMediaCommit: true }))).rejects.toThrow('synthetic database failure');
    expect(readFileSync(shop.shopFilePath(privateFile.path))).toEqual(original);
    let staged;
    await db.withTransaction(async () => {
      const result = await restoreApplicationBackup({ backup, dbRun: db.dbRun, uploadsPath, deferMediaCommit: true }); staged = result.mediaRestore; staged.activate();
    }).catch(error => { staged?.rollback(); throw error; }); staged.finalize();
    expect((await db.dbGet('SELECT COUNT(*) AS count FROM shop_orders')).count).toBe(backup.tables.shop_orders.length);
    expect(readFileSync(shop.shopFilePath(privateFile.path))).toEqual(original);
    const ordersBefore = (await db.dbGet('SELECT COUNT(*) AS count FROM shop_orders')).count;
    await db.withTransaction(() => restoreApplicationBackup({ backup: { schemaVersion: 1, tables: {}, uploads: [] }, dbRun: db.dbRun, uploadsPath, sections: ['profile'] }));
    expect((await db.dbGet('SELECT COUNT(*) AS count FROM shop_orders')).count).toBe(ordersBefore);
    await db.initializeDatabase();
    expect((await shop.shopSettings()).stripe.accountId).toBe('acct_owner');
    expect((await db.dbGet('SELECT COUNT(*) AS count FROM shop_orders')).count).toBe(ordersBefore);
  });
});

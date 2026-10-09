import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { dbAll, dbGet, dbRun, withTransaction } from '../database.js';
import { getDirectorySizeBytes, getUploadStorageQuotaBytes } from './upload-policy.js';
import { encryptSmtpPassword, decryptSmtpPassword, newsletterComplianceReady } from './newsletter.js';
import { createShopSchemas, shopComplianceReady } from '../../packages/shop/schema.js';
import { checkoutAmounts, assertCheckoutCharge, stripeObjectId, stripeTaxIdCollection, stripeNameCollection } from '../../packages/shop/payments.js';
import { validateShopFile, matchesShopFileSignature } from '../../packages/shop/files.js';
import { renderShopHtml, renderShopMarkdown, shopPolicyLinks, resolvedShopDesign, buildShopHomeLinks, shopPurchasePresentation } from '../../packages/shop/render.js';
import { buildShopBuyerEmail, buildShopSellerEmail } from '../../packages/shop/email.js';

export const SHOP_FILE_BYTES = 50 * 1024 * 1024;
export const SHOP_MAX_PRODUCTS = 20;
export const shopDataDir = process.env.DATA_DIR || dirname(fileURLToPath(new URL('../server.js', import.meta.url)));
export const shopFilesPath = join(shopDataDir, 'shop-files');
export const { shopAiDraftSchema, shopProductInputSchema, shopAppearanceInputSchema, normalizeShopAppearance, normalizeShopProductCardStyle } = createShopSchemas(z,
  value => /^\/uploads\/shop-logo-[a-f0-9-]{36}\.(png|jpg|webp|avif|gif)$/.test(value));
const uuid = z.string().uuid();
const now = () => new Date().toISOString();
const hash = value => createHash('sha256').update(value).digest('hex');
const decode = row => row ? JSON.parse(row.data) : null;
export class ShopError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const fail = (status, code, message) => { throw new ShopError(status, code, message); };
// Only internal, fixed table names reach these helpers; all values are bound.
export const shopOrder = async id => decode(await dbGet('SELECT data FROM shop_orders WHERE id = ?', [id]));
export const shopCustomer = async id => decode(await dbGet('SELECT data FROM shop_customers WHERE id = ?', [id]));
export const shopSettings = async () => decode(await dbGet('SELECT data FROM shop_settings WHERE id = 1')) || {
  enabled: false, appearance: normalizeShopAppearance({}), stripe: null, email: null, publicBase: null,
};
const productFor = async id => decode(await dbGet('SELECT data FROM shop_products WHERE id = ?', [id]));
export const shopProducts = async () => (await dbAll('SELECT data FROM shop_products ORDER BY rowid')).map(decode);
export async function getShopPurchasePresentation(setting) {
  const [profile, theme] = await Promise.all([
    dbGet('SELECT name FROM profile_data WHERE id = 1'), dbGet('SELECT full_config FROM theme_config WHERE id = 1'),
  ]);
  return shopPurchasePresentation({ appearance: normalizeShopAppearance(setting.appearance),
    theme: theme?.full_config ? JSON.parse(theme.full_config) : {}, shopUrl: `${setting.publicBase}/shop`, title: profile?.name || 'Shop' });
}
export async function saveShopSettings(record) {
  await dbRun('INSERT INTO shop_settings (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data', [JSON.stringify(record)]);
}
export async function saveShopOrder(record) {
  await dbRun('INSERT INTO shop_orders (id, customer_id, session_id, payment_intent_id, data) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET customer_id = excluded.customer_id, session_id = excluded.session_id, payment_intent_id = excluded.payment_intent_id, data = excluded.data',
    [record.orderId, record.customerId || null, record.stripeCheckoutSessionId || null, record.stripePaymentIntentId || null, JSON.stringify(record)]);
}
export async function saveShopCustomer(record) {
  await dbRun('INSERT INTO shop_customers (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data', [record.customerId, JSON.stringify(record)]);
}
const saveProduct = record => dbRun('INSERT INTO shop_products (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data', [record.productId, JSON.stringify(record)]);
export function shopSign(purpose, value, encoding = 'base64url') {
  const secret = process.env.SHOP_DELIVERY_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) fail(503, 'SHOP_SECRET_MISSING', 'A stable server secret is required for Shop.');
  return createHmac('sha256', secret).update(`orbitpage-shop\0${purpose}\0${value}`).digest(encoding);
}
export function shopSafeEqual(left, right) {
  const a = Buffer.from(String(left || '')), b = Buffer.from(String(right || ''));
  return a.length === b.length && timingSafeEqual(a, b);
}
export const deliveryTokenForOrder = id => `${id}.${shopSign('delivery', id)}`;
export const shopFilePath = id => join(shopFilesPath, z.string().regex(/^(?:[a-f0-9]{64}|[a-f0-9-]{36})$/).parse(id));

async function stripeConfiguration() {
  const setting = await shopSettings();
  const secret = process.env.SHOP_STRIPE_SECRET_KEY?.trim() || (setting.stripe?.secret ? decryptSmtpPassword(setting.stripe.secret) : '');
  const webhookSecret = process.env.SHOP_STRIPE_WEBHOOK_SECRET?.trim() || (setting.stripe?.webhookSecret ? decryptSmtpPassword(setting.stripe.webhookSecret) : '');
  if (!/^(sk|rk)_(test|live)_[A-Za-z0-9]+$/.test(secret)) fail(503, 'SHOP_STRIPE_NOT_CONFIGURED', 'Configure the owner’s Stripe account in Shop payments.');
  const livemode = secret.includes('_live_');
  return { secret, webhookSecret, livemode, accountId: setting.stripe?.accountId || null, version: setting.stripe?.version,
    verified: setting.stripe?.credentialFingerprint === hash(secret) };
}
export async function shopStripe() {
  const config = await stripeConfiguration();
  if (!config.verified) fail(409, 'STRIPE_SETTINGS_CHANGED', 'Verify the Stripe key in Shop payments before using it.');
  return { client: new Stripe(config.secret, { apiVersion: '2026-06-24.dahlia', maxNetworkRetries: 2, timeout: 20_000 }), config };
}
const stripeInput = z.object({ secretKey: z.string().max(300).default(''), webhookSecret: z.string().max(300).default('') }).strict();
async function verifyStripeOwner(secret) {
  const client = new Stripe(secret, { apiVersion: '2026-06-24.dahlia', maxNetworkRetries: 2, timeout: 20_000 });
  const [account, balance] = await Promise.all([client.accounts.retrieve(), client.balance.retrieve()]);
  const livemode = secret.includes('_live_');
  if (balance.livemode !== livemode) fail(409, 'STRIPE_MODE_MISMATCH', 'The Stripe API key mode does not match the account.');
  return { accountId: account.id, livemode, ready: !livemode || Boolean(account.charges_enabled), credentialFingerprint: hash(secret), verifiedAt: now() };
}
async function assertStripeOrderOwnership(owner) {
  const foreign = await dbGet("SELECT id FROM shop_orders WHERE json_extract(data, '$.stripeAccountId') != ? OR json_extract(data, '$.stripeLivemode') != ? LIMIT 1", [owner.accountId, Number(owner.livemode)]);
  if (foreign) fail(409, 'STRIPE_ACCOUNT_CHANGE_BLOCKED', 'Existing orders belong to the configured account and mode. Rotate a key for the same account and mode, or use a separate installation.');
}
export async function configureShopStripe(raw, base) {
  const input = stripeInput.parse(raw);
  if ((input.secretKey && !/^(sk|rk)_(test|live)_[A-Za-z0-9]+$/.test(input.secretKey))
    || (input.webhookSecret && !/^whsec_[A-Za-z0-9]+$/.test(input.webhookSecret))) fail(400, 'INVALID_STRIPE_SETTINGS', 'Use a Stripe secret API key and webhook signing secret.');
  if (process.env.SHOP_STRIPE_SECRET_KEY || process.env.SHOP_STRIPE_WEBHOOK_SECRET) fail(409, 'STRIPE_ENV_MANAGED', 'Stripe is configured through server environment variables. Update those variables on the server.');
  const snapshot = (await shopSettings()).stripe;
  if (!input.secretKey && !snapshot?.secret) fail(400, 'STRIPE_KEY_REQUIRED', 'Enter your Stripe secret key.');
  const owner = await verifyStripeOwner(input.secretKey || decryptSmtpPassword(snapshot.secret));
  await withTransaction(async () => {
    const setting = await shopSettings(), previous = setting.stripe || {};
    if (previous.version !== snapshot?.version) fail(409, 'STRIPE_SETTINGS_CHANGED', 'Stripe settings changed. Refresh and retry.');
    await assertStripeOrderOwnership(owner);
    setting.stripe = { ...previous, ...owner,
      secret: input.secretKey ? encryptSmtpPassword(input.secretKey) : previous.secret,
      webhookSecret: input.webhookSecret ? encryptSmtpPassword(input.webhookSecret) : previous.webhookSecret,
      version: randomUUID(),
    };
    setting.publicBase = base;
    await saveShopSettings(setting);
  });
  return shopDashboard(base);
}
export async function refreshShopStripe(base) {
  const config = await stripeConfiguration(), owner = await verifyStripeOwner(config.secret);
  await withTransaction(async () => {
    const current = await stripeConfiguration();
    if (current.version !== config.version || current.secret !== config.secret) fail(409, 'STRIPE_SETTINGS_CHANGED', 'Stripe settings changed. Refresh and retry.');
    await assertStripeOrderOwnership(owner);
    const setting = await shopSettings();
    // Server-managed credentials are never copied into the database.
    setting.stripe = { ...setting.stripe, ...owner };
    setting.publicBase = base;
    await saveShopSettings(setting);
  });
  return shopDashboard(base);
}
const header = max => z.string().trim().min(1).max(max).refine(value => !/[\r\n]/.test(value));
const smtpSchema = z.object({ mode: z.literal('custom'), host: header(253), port: z.union([z.literal(465), z.literal(587), z.literal(2525)]),
  username: header(320), password: z.string().max(1024).default(''), fromName: header(100),
  fromEmail: z.string().trim().max(254).email(), replyTo: z.union([z.literal(''), z.string().trim().max(254).email()]).default(''),
}).strict();
const emailSettings = record => ({ mode: 'custom', host: record?.host || '', port: record?.port || 587,
  username: record?.username || '', fromName: record?.fromName || '', fromEmail: record?.fromEmail || '', replyTo: record?.replyTo || '',
  passwordConfigured: Boolean(record?.password), configured: Boolean(record?.password), verifiedAt: record?.verifiedAt || null });
export async function configureShopEmail(raw) {
  const input = smtpSchema.parse(raw);
  await withTransaction(async () => {
    const setting = await shopSettings(), previous = setting.email;
    const sameAccount = previous?.host === input.host && previous?.port === input.port && previous?.username === input.username;
    if (!input.password && (!previous?.password || !sameAccount)) fail(400, 'SMTP_PASSWORD_REQUIRED', 'Enter the SMTP password when changing the server or account.');
    const changed = !previous || !sameAccount || input.password || input.fromEmail !== previous.fromEmail || input.fromName !== previous.fromName || input.replyTo !== previous.replyTo;
    setting.email = { ...input, password: input.password ? encryptSmtpPassword(input.password) : previous.password,
      version: randomUUID(), verifiedAt: changed ? null : previous.verifiedAt };
    await saveShopSettings(setting);
  });
  return emailSettings((await shopSettings()).email);
}
export async function sendShopEmail(message, setting = null, verify = false) {
  const email = (setting || await shopSettings()).email;
  if (!email?.password) fail(503, 'SHOP_EMAIL_NOT_CONFIGURED', 'Configure SMTP for Shop delivery emails.');
  // Self-hosted owners may deliberately use a private SMTP relay. Only admins can configure it.
  const transport = nodemailer.createTransport({ host: email.host, port: email.port, secure: email.port === 465,
    requireTLS: email.port !== 465, tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    auth: { user: email.username, pass: decryptSmtpPassword(email.password) },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 25_000, disableFileAccess: true, disableUrlAccess: true });
  try {
    if (verify) await transport.verify();
    await transport.sendMail({ ...message, from: { name: email.fromName, address: email.fromEmail }, replyTo: message.replyTo || email.replyTo || email.fromEmail });
  } catch { fail(502, 'SMTP_SEND_FAILED', 'Email could not be sent. Check the SMTP connection, credentials and sender address.'); }
  finally { transport.close(); }
}
export async function testShopEmail(recipient) {
  const setting = await shopSettings(), email = setting.email;
  const to = z.string().max(254).email().parse(recipient || email?.fromEmail);
  await sendShopEmail({ to, subject: 'OrbitPage Shop SMTP test', text: 'Shop email is configured successfully.', html: '<p>Shop email is configured successfully.</p>' }, setting, true);
  return withTransaction(async () => {
    const current = await shopSettings();
    if (current.email?.version !== email?.version) fail(409, 'SMTP_SETTINGS_CHANGED', 'Settings changed during the test. Test again.');
    current.email.verifiedAt = now(); await saveShopSettings(current); return emailSettings(current.email);
  });
}
export async function shopDashboard(base) {
  const [setting, products, orders, customers, newsletter, theme] = await Promise.all([
    shopSettings(), shopProducts(), dbAll('SELECT data FROM shop_orders ORDER BY rowid DESC LIMIT 100'),
    dbAll('SELECT data FROM shop_customers ORDER BY rowid DESC LIMIT 100'),
    dbGet('SELECT * FROM newsletter_settings WHERE id = 1'), dbGet('SELECT full_config FROM theme_config WHERE id = 1'),
  ]);
  const appearance = normalizeShopAppearance(setting.appearance);
  const design = resolvedShopDesign(appearance, theme?.full_config ? JSON.parse(theme.full_config) : {});
  const stripeConfigured = Boolean(process.env.SHOP_STRIPE_SECRET_KEY || setting.stripe?.secret);
  const webhookConfigured = Boolean(process.env.SHOP_STRIPE_WEBHOOK_SECRET || setting.stripe?.webhookSecret);
  let stripeVerified = false;
  if (stripeConfigured) { try { stripeVerified = (await stripeConfiguration()).verified; } catch { /* Owners can replace an unreadable credential. */ } }
  return { mode: 'stripe', entitled: true, planId: 'oss',
    shop: { enabled: setting.enabled, reviewStatus: 'approved', stripeConnected: stripeConfigured,
      stripeReady: Boolean(stripeVerified && setting.stripe?.ready && webhookConfigured), stripeCapabilityStatus: stripeVerified && setting.stripe?.ready ? 'active' : 'inactive',
      stripeLivemode: setting.stripe?.livemode ?? null, publicUrl: `${base}/shop`, appearance, themePreview: design,
      stripeSettings: { configured: stripeConfigured, webhookConfigured, environmentManaged: Boolean(process.env.SHOP_STRIPE_SECRET_KEY || process.env.SHOP_STRIPE_WEBHOOK_SECRET),
        accountId: setting.stripe?.accountId || null, webhookUrl: `${base}/api/shop/webhook` },
      calCom: { webhookUrl: `${base}/api/shop/calendar/calcom/${shopSign('calcom-route', 'owner')}`,
        signingSecret: shopSign('calcom-webhook', 'owner'), events: ['BOOKING_CREATED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED', 'MEETING_ENDED', 'NO_SHOW'] },
      emailSettings: emailSettings(setting.email) },
    products: products.map(({ cover, ...product }) => ({ ...product, coverUrl: cover ? `${base}/api/shop/covers/${cover.id}` : null })),
    orders: orders.map(decode).map(order => { const { deliveryTokenHash, deliveryFiles, deliveryFile, ...dto } = order; return dto; }),
    customers: customers.map(decode).map(({ portalVersion, ...customer }) => customer),
    newsletterComplianceReady: newsletterComplianceReady(newsletter),
    limits: { maxProducts: SHOP_MAX_PRODUCTS, maxFileBytes: SHOP_FILE_BYTES, feePercent: 0 } };
}
export async function syncShopHome(base, previousAppearance) {
  const setting = await shopSettings(), rows = await dbAll('SELECT * FROM links ORDER BY sort_order');
  const links = rows.map(row => ({ ...row, isActive: Boolean(row.is_active), hideUrl: Boolean(row.hide_url), iconType: row.icon_type, surfaceEffect: row.surface_effect }));
  const result = buildShopHomeLinks({ links, enabled: setting.enabled, appearance: normalizeShopAppearance(setting.appearance), previousAppearance, shopUrl: `${base}/shop` });
  if (!result.changed) return;
  const existingIds = new Set(rows.map(row => row.id));
  for (const row of rows) if (!result.links.some(link => link.id === row.id)) await dbRun('DELETE FROM links WHERE id = ?', [row.id]);
  for (const [index, link] of result.links.entries()) {
    if (link.id !== 'orbitpage-shop') continue;
    await dbRun('INSERT INTO links (id, title, description, url, type, is_active, sort_order, hide_url, size, icon, icon_type, surface_effect) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description, url=excluded.url',
      [link.id, link.title, link.description || '', link.url, 'link', link.isActive ? 1 : 0, existingIds.has(link.id) ? index : -1, 1, link.size, link.icon, link.iconType, link.surfaceEffect]);
  }
}
export async function saveShopAppearance(raw, base) {
  const appearance = shopAppearanceInputSchema.parse(raw);
  if (appearance.logoUrl && !fs.existsSync(join(shopDataDir, appearance.logoUrl.slice(1)))) fail(400, 'INVALID_SHOP_LOGO', 'Choose an uploaded Shop logo.');
  if (appearance.newsletterEnabled && !newsletterComplianceReady(await dbGet('SELECT * FROM newsletter_settings WHERE id=1'))) fail(409, 'NEWSLETTER_COMPLIANCE_REQUIRED', 'Complete Newsletter compliance settings before adding signup.');
  await withTransaction(async () => {
    const setting = await shopSettings();
    if (setting.enabled && !appearance.sellerSelfCertified) fail(409, 'SHOP_SELLER_ACKNOWLEDGMENT_REQUIRED', 'Acknowledge your seller responsibilities.');
    const previousAppearance = setting.appearance;
    setting.appearance = appearance; setting.publicBase = base; await saveShopSettings(setting); await syncShopHome(base, previousAppearance);
  });
  return shopDashboard(base);
}
export async function setShopPublished(enabled, base) {
  if (enabled) await refreshShopStripe(base);
  await withTransaction(async () => {
    const setting = await shopSettings(), products = await shopProducts();
    if (enabled) {
      await assertShopSetup(setting);
      if (!setting.appearance.sellerSelfCertified) fail(409, 'SHOP_SELLER_ACKNOWLEDGMENT_REQUIRED', 'Acknowledge your seller responsibilities before publishing.');
      if (!setting.stripe?.ready || !(process.env.SHOP_STRIPE_WEBHOOK_SECRET || setting.stripe.webhookSecret)) fail(409, 'SHOP_NOT_READY', 'Configure Stripe and its webhook before publishing.');
      if (!products.some(p => p.active && (p.type === 'service' || p.files?.length))) fail(409, 'SHOP_PRODUCTS_REQUIRED', 'Add an active product with a delivery file or service instructions.');
    }
    setting.enabled = enabled; setting.publicBase = base; await saveShopSettings(setting); await syncShopHome(base);
  });
  return shopDashboard(base);
}
export async function assertShopSetup(setting = null) {
  setting ||= await shopSettings();
  if (!shopComplianceReady(normalizeShopAppearance(setting.appearance))) fail(409, 'SHOP_COMPLIANCE_REQUIRED', 'Complete Shop Compliance before adding products.');
  const config = await stripeConfiguration();
  if (!config.verified || !setting.stripe?.ready || !config.webhookSecret) fail(409, 'SHOP_NOT_READY', 'Verify Stripe and configure its webhook before adding products.');
  if (!setting.email?.verifiedAt) fail(409, 'SHOP_EMAIL_REQUIRED', 'Configure SMTP and send a successful test email before adding products.');
}
export async function persistShopAiDrafts(transaction, drafts) {
  const setting = decode(await transaction.get('SELECT data FROM shop_settings WHERE id = 1'));
  await assertShopSetup(setting);
  const count = (await transaction.get('SELECT COUNT(*) AS count FROM shop_products')).count;
  if (count + drafts.length > SHOP_MAX_PRODUCTS) fail(409, 'SHOP_PRODUCT_LIMIT', 'The catalog supports up to 20 products.');
  for (const raw of drafts) {
    const draft = shopAiDraftSchema.parse(raw), timestamp = now();
    const fields = shopProductInputSchema.parse({ ...draft, active: false });
    await transaction.run('INSERT INTO shop_products (id, data) VALUES (?, ?)', [draft.productId, JSON.stringify({ ...fields, currency: 'eur', files: [], file: null, cover: null, createdAt: timestamp, updatedAt: timestamp })]);
  }
}
export async function saveShopProduct(raw, base) {
  const input = shopProductInputSchema.parse(raw), productId = input.productId || randomUUID();
  await withTransaction(async () => {
    await assertShopSetup();
    const previous = await productFor(productId), products = await shopProducts();
    if (input.productId && !previous) fail(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
    if (!previous && products.length >= SHOP_MAX_PRODUCTS) fail(409, 'SHOP_PRODUCT_LIMIT', 'The catalog supports up to 20 products.');
    const removed = new Set(input.removedFileIds || []), files = (previous?.files || []).filter(file => !removed.has(file.id));
    if (input.type !== previous?.type && previous?.files?.length) fail(409, 'SHOP_PRODUCT_TYPE', 'Remove digital files before changing product type.');
    const { removedFileIds, ...fields } = input;
    await saveProduct({ ...previous, ...fields, productId, currency: 'eur', files, file: files[0] || null, cover: previous?.cover || null,
      createdAt: previous?.createdAt || now(), updatedAt: now() });
  });
  const result = await shopDashboard(base); return { ...result, savedProductId: productId };
}
export async function deleteShopProduct(id, base) {
  uuid.parse(id); await dbRun('DELETE FROM shop_products WHERE id = ?', [id]);
  // Purchased snapshots keep their private files for the full delivery period.
  await cleanupShopFiles();
  return shopDashboard(base);
}
const uploadSchema = z.object({ productId: uuid, filename: z.string().trim().max(240), contentType: z.string().max(100), sizeBytes: z.number().int(), kind: z.enum(['file', 'cover']) }).strict();
export async function reserveShopUpload(raw, base) {
  await assertShopSetup();
  const input = uploadSchema.parse(raw); validateShopFile({ ...input, maximumBytes: input.kind === 'cover' ? 5 * 1024 * 1024 : SHOP_FILE_BYTES });
  if (input.kind === 'cover' && !['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif'].includes(input.contentType)) fail(400, 'INVALID_SHOP_COVER', 'Choose a supported image.');
  const id = randomUUID(), token = `${id}.${shopSign('upload', id)}`;
  await withTransaction(async () => {
    const product = await productFor(input.productId);
    if (!product) fail(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
    if (input.kind === 'file' && (product.type !== 'digital' || (product.files || []).length >= 10)) fail(409, 'SHOP_FILES_LIMIT', 'Digital products support up to 10 files.');
    const reservations = (await dbAll('SELECT data FROM shop_uploads')).map(decode).filter(upload => Date.parse(upload.expiresAt) > Date.now());
    const pending = reservations.some(upload => upload.productId === input.productId);
    if (pending) fail(409, 'SHOP_UPLOAD_IN_PROGRESS', 'Wait for the current upload to finish.');
    const reservedBytes = reservations.filter(upload => !upload.received).reduce((bytes, upload) => bytes + upload.sizeBytes, 0);
    if (getDirectorySizeBytes(shopFilesPath) + getDirectorySizeBytes(join(shopDataDir, 'uploads')) + reservedBytes + input.sizeBytes > getUploadStorageQuotaBytes()) fail(413, 'SHOP_STORAGE_LIMIT', 'Upload storage quota exceeded.');
    await dbRun('INSERT INTO shop_uploads (id, data) VALUES (?, ?)', [id, JSON.stringify({ ...input, id, expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(), received: false })]);
  });
  return { uploadToken: token, uploadUrl: `${base}/api/shop/uploads/content/${encodeURIComponent(token)}`, headers: { 'Content-Type': input.contentType } };
}
export async function uploadFor(token) {
  const [id, signature, extra] = String(token).split('.');
  if (extra || !uuid.safeParse(id).success || !shopSafeEqual(signature, shopSign('upload', id))) fail(404, 'SHOP_UPLOAD_NOT_FOUND', 'Upload not found.');
  const record = decode(await dbGet('SELECT data FROM shop_uploads WHERE id = ?', [id]));
  if (!record || Date.parse(record.expiresAt) <= Date.now()) fail(410, 'SHOP_UPLOAD_EXPIRED', 'Upload expired.');
  return record;
}
export async function receiveShopUpload(token, body, contentType) {
  const upload = await uploadFor(token);
  if (body.length !== upload.sizeBytes || contentType !== upload.contentType || !matchesShopFileSignature(contentType, body.subarray(0, 32))) fail(400, 'INVALID_SHOP_FILE', 'Uploaded file content, size or type does not match the reservation.');
  fs.mkdirSync(shopFilesPath, { recursive: true, mode: 0o700 });
  const temporary = `${shopFilePath(upload.id)}.upload`;
  try { fs.writeFileSync(temporary, body, { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code === 'EEXIST') fail(409, 'SHOP_UPLOAD_RECEIVED', 'This upload has already been received.'); throw error; }
  const committed = await withTransaction(async () => {
    const current = await uploadFor(token);
    if (current.received) fail(409, 'SHOP_UPLOAD_RECEIVED', 'This upload has already been received.');
    await dbRun('UPDATE shop_uploads SET data = ? WHERE id = ?', [JSON.stringify({ ...current, received: true }), upload.id]); return true;
  }).catch(error => { fs.rmSync(temporary, { force: true }); throw error; });
  return { received: committed };
}
export async function finalizeShopUpload(token, base) {
  let moved;
  try { await withTransaction(async () => {
    const upload = await uploadFor(token), product = await productFor(upload.productId);
    if (!product || !upload.received) fail(409, 'SHOP_UPLOAD_INCOMPLETE', 'Upload is incomplete or product was removed.');
    if (upload.kind === 'file' && (product.type !== 'digital' || product.files.length >= 10)) fail(409, 'SHOP_FILES_LIMIT', 'Digital products support up to 10 files.');
    const file = { id: hash(upload.id), filename: upload.filename, contentType: upload.contentType, sizeBytes: upload.sizeBytes, createdAt: now() };
    fs.renameSync(`${shopFilePath(upload.id)}.upload`, shopFilePath(file.id));
    moved = { temporary: `${shopFilePath(upload.id)}.upload`, final: shopFilePath(file.id) };
    await dbRun('INSERT INTO shop_files (id, product_id, data) VALUES (?, ?, ?)', [file.id, product.productId, JSON.stringify({ ...file, kind: upload.kind })]);
    if (upload.kind === 'cover') product.cover = file;
    else { product.files.push(file); product.file = product.files[0]; }
    product.updatedAt = now(); await saveProduct(product); await dbRun('DELETE FROM shop_uploads WHERE id = ?', [upload.id]);
  }); } catch (error) {
    if (moved && fs.existsSync(moved.final)) fs.renameSync(moved.final, moved.temporary);
    throw error;
  }
  await cleanupShopFiles(); return shopDashboard(base);
}
export async function abortShopUpload(token) {
  let upload;
  try { upload = await uploadFor(token); } catch (error) { if (error.status === 410 || error.status === 404) return; throw error; }
  await withTransaction(async () => { await dbRun('DELETE FROM shop_uploads WHERE id = ?', [upload.id]); });
  fs.rmSync(`${shopFilePath(upload.id)}.upload`, { force: true });
}
export async function publicShopCover(id) {
  z.string().regex(/^[a-f0-9]{64}$/).parse(id); const products = await shopProducts();
  const product = products.find(p => p.cover?.id === id);
  if (!product) fail(404, 'SHOP_COVER_NOT_FOUND', 'Image not found.');
  return { ...product.cover, path: shopFilePath(id) };
}
export async function publicShop(base, markdown = false) {
  const [setting, products, profile, theme] = await Promise.all([shopSettings(), shopProducts(), dbGet('SELECT name, machine_readable_enabled FROM profile_data WHERE id = 1'), dbGet('SELECT full_config FROM theme_config WHERE id = 1')]);
  if (!setting.enabled) fail(404, 'SHOP_NOT_FOUND', 'Shop not found.');
  const visible = products.filter(p => p.active && (p.type === 'service' || p.files.length)).map(p => ({ ...p, coverKey: p.cover ? p.cover.id : null }));
  const input = { username: 'owner', title: profile?.name || 'OrbitPage', canonicalUrl: `${base}/shop`, products: visible,
    appearance: normalizeShopAppearance(setting.appearance), theme: theme?.full_config ? JSON.parse(theme.full_config) : {},
    machineReadableEnabled: Boolean(profile?.machine_readable_enabled), apiBaseUrl: base, newsletterEndpoint: `${base}/api/newsletter/public/subscribe`, newsletterContentType: 'application/json', coverUrlPrefix: `${base}/api/shop/covers/` };
  return markdown ? renderShopMarkdown(input) : renderShopHtml(input);
}
export async function cleanupShopFiles() {
  await withTransaction(async () => {
    const products = await shopProducts(), orders = (await dbAll('SELECT data FROM shop_orders')).map(decode);
    const retained = new Set(products.flatMap(p => [...(p.files || []).map(f => f.id), p.cover?.id].filter(Boolean)));
    for (const order of orders) if (Date.parse(order.deliveryExpiresAt) > Date.now()) for (const file of order.deliveryFiles || []) retained.add(file.id);
    for (const row of await dbAll('SELECT id FROM shop_files')) if (!retained.has(row.id)) {
      fs.rmSync(shopFilePath(row.id), { force: true }); await dbRun('DELETE FROM shop_files WHERE id = ?', [row.id]);
    }
    for (const row of await dbAll('SELECT id, data FROM shop_uploads')) if (Date.parse(decode(row).expiresAt) <= Date.now()) {
      fs.rmSync(`${shopFilePath(row.id)}.upload`, { force: true }); await dbRun('DELETE FROM shop_uploads WHERE id = ?', [row.id]);
    }
  });
}

export async function createShopCheckout(raw, base) {
  const input = z.object({ productId: uuid, sellerNoticeAcknowledged: z.boolean(), sellerTermsAccepted: z.boolean().default(false), digitalContentConsent: z.boolean() }).strict().parse(raw);
  const [setting, product] = await Promise.all([shopSettings(), productFor(input.productId)]);
  if (!setting.enabled || !product?.active || (product.type === 'digital' && !product.files.length)) fail(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
  const appearance = normalizeShopAppearance(setting.appearance);
  if (!appearance.sellerSelfCertified || !input.sellerNoticeAcknowledged) fail(400, 'SELLER_NOTICE_REQUIRED', 'Confirm the seller notice before checkout.');
  if (product.type === 'digital' && !input.digitalContentConsent) fail(400, 'DIGITAL_CONTENT_CONSENT_REQUIRED', 'Consent to immediate digital delivery before checkout.');
  const { client, config } = await shopStripe();
  if (!config.webhookSecret || !setting.stripe?.ready || config.livemode !== setting.stripe.livemode) fail(409, 'SHOP_NOT_READY', 'This shop cannot accept payments yet.');
  await assertShopSetup(setting);
  const orderId = randomUUID(), timestamp = now(), policy = shopPolicyLinks(appearance, `${base}/shop`);
  const order = { orderId, productId: product.productId, productType: product.type, productTitle: product.title,
    amountTotal: product.priceCents, amountSubtotal: product.priceCents, amountDiscount: 0, amountRefunded: 0,
    applicationFeeAmount: 0, applicationFeeRefunded: 0, currency: 'eur', status: 'creating',
    stripeAccountId: setting.stripe.accountId, stripeLivemode: config.livemode,
    stripeCheckoutSessionId: null, stripePaymentIntentId: null, stripeChargeId: null,
    buyerEmail: null, buyerName: null, buyerDetails: null, customerId: null,
    checkoutFields: appearance.checkout, ...Object.fromEntries(['sellerType', 'sellerName', 'sellerEmail', 'sellerPhone', 'sellerAddress', 'sellerBusinessId'].map(key => [key, appearance[key]])),
    sellerTermsText: appearance.termsText, sellerDigitalLicenseText: appearance.digitalLicenseText, sellerPrivacyText: appearance.privacyText,
    sellerRefundPolicyText: appearance.refundPolicyText, sellerWithdrawalText: appearance.withdrawalText,
    sellerTermsUrl: policy.terms, sellerDigitalLicenseUrl: policy.digitalLicense, sellerPrivacyUrl: policy.privacy,
    sellerRefundPolicyUrl: policy.refunds, sellerWithdrawalUrl: policy.withdrawal,
    sellerNoticeAcknowledgedAt: timestamp, sellerTermsAcceptedAt: input.sellerTermsAccepted ? timestamp : null,
    digitalContentConsentAt: product.type === 'digital' ? timestamp : null,
    deliveryTokenHash: hash(deliveryTokenForOrder(orderId)), deliveryExpiresAt: new Date(Date.now() + 30 * 86400_000).toISOString(), downloadCount: 0,
    deliveryFiles: product.type === 'digital' ? product.files : [],
    fulfillmentText: product.type === 'service' ? product.fulfillmentText : '', bookingUrl: product.type === 'service' ? product.bookingUrl : '',
    sessionsIncluded: product.type === 'service' ? product.sessionsIncluded : 0, sessionsRemaining: product.type === 'service' ? product.sessionsIncluded : 0,
    bookingStatus: product.type === 'service' ? 'awaiting_booking' : null, intakeQuestions: product.type === 'service' ? product.intakeQuestions : [],
    intakeAnswers: [], intakeSubmittedAt: null, createdAt: timestamp, updatedAt: timestamp, paidAt: null };
  await withTransaction(async () => {
    const current = await stripeConfiguration(), currentSetting = await shopSettings();
    if (current.version !== config.version || current.secret !== config.secret) fail(409, 'STRIPE_SETTINGS_CHANGED', 'Stripe settings changed. Retry checkout.');
    if (!currentSetting.enabled) fail(404, 'SHOP_NOT_FOUND', 'Shop not found.');
    const totals = await dbGet("SELECT COUNT(*) AS count, MAX(json_extract(data, '$.orderNumber')) AS maximum FROM shop_orders");
    order.orderNumber = Math.max(currentSetting.lastOrderNumber || 0, totals.maximum || 0, totals.count) + 1;
    currentSetting.lastOrderNumber = order.orderNumber;
    await saveShopSettings(currentSetting);
    await saveShopOrder(order);
  });
  try {
    const metadata = { orbitpageOrderId: orderId, orbitpageProductId: product.productId };
    const session = await client.checkout.sessions.create({ mode: 'payment', locale: 'en', customer_creation: 'always',
      name_collection: stripeNameCollection(appearance.checkout.businessName),
      phone_number_collection: { enabled: appearance.checkout.phone }, billing_address_collection: appearance.checkout.billingAddress,
      tax_id_collection: stripeTaxIdCollection(appearance.checkout.taxId),
      custom_fields: appearance.checkout.customFields.map(field => ({ key: field.key, label: { type: 'custom', custom: field.label }, type: field.type, optional: !field.required })),
      allow_promotion_codes: true, line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: product.priceCents, product_data: { name: product.title, description: product.description.slice(0, 500) } } }],
      metadata, payment_intent_data: { metadata },
      success_url: `${base}/shop/success?order=${orderId}&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${base}/shop`,
      custom_text: { submit: { message: 'The seller is responsible for this product or service. OrbitPage provides the shop software.' } },
    }, { idempotencyKey: `orbitpage-shop-${orderId}` });
    if (!session.url || session.livemode !== config.livemode) throw new Error('Stripe Checkout is unavailable.');
    await withTransaction(async () => { const current = await shopOrder(orderId); await saveShopOrder({ ...current, status: 'open', stripeCheckoutSessionId: session.id, updatedAt: now() }); });
    return session.url;
  } catch (error) {
    await withTransaction(async () => { const current = await shopOrder(orderId); if (current?.status === 'creating') await saveShopOrder({ ...current, status: 'payment_failed', updatedAt: now() }); });
    throw error;
  }
}
export async function queueShopEmail(id, orderId, message) {
  await dbRun('INSERT OR IGNORE INTO shop_emails (id, order_id, data) VALUES (?, ?, ?)', [id, orderId, JSON.stringify(message)]);
}
export function bookingUrlForOrder(order) {
  if (!order.bookingUrl) return '';
  const url = new URL(order.bookingUrl);
  if (url.hostname === 'cal.com' || url.hostname.endsWith('.cal.com')) {
    url.searchParams.set('metadata[orbitpageOrderId]', order.orderId);
    url.searchParams.set('metadata[orbitpageBookingAccess]', shopSign('calcom-order', `${order.orderId}\0${order.customerId}`));
  }
  return url.toString();
}
export function customerPortalToken(customer, orderIds) {
  const issuedAt = Date.now(), body = Buffer.from(JSON.stringify({ customerId: customer.customerId, version: customer.portalVersion,
    orderIds, issuedAt, expiresAt: issuedAt + 7 * 86400_000, nonce: randomUUID() })).toString('base64url');
  return `${body}.${shopSign('customer-portal', body)}`;
}
export async function reconcileShopPayment(orderId, sessionId) {
  const order = await shopOrder(orderId);
  if (!order || order.stripeCheckoutSessionId !== sessionId) fail(404, 'SHOP_ORDER_NOT_FOUND', 'Order not found.');
  const { client, config } = await shopStripe();
  if (order.stripeLivemode !== config.livemode || order.stripeAccountId !== config.accountId) throw new Error('Stripe order ownership mismatch.');
  const session = await client.checkout.sessions.retrieve(sessionId);
  if (session.livemode !== config.livemode || session.metadata?.orbitpageOrderId !== orderId || session.mode !== 'payment') throw new Error('Stripe Checkout ownership mismatch.');
  if (session.status !== 'complete' || !['paid', 'no_payment_required'].includes(session.payment_status)) return order;
  const amounts = checkoutAmounts(order, session), intentId = stripeObjectId(session.payment_intent);
  const intent = intentId ? await client.paymentIntents.retrieve(intentId, { expand: ['latest_charge'] }) : null;
  const charge = typeof intent?.latest_charge === 'string' ? await client.charges.retrieve(intent.latest_charge) : intent?.latest_charge;
  if (amounts.amountTotal > 0 && (!intent || !charge)) throw new Error('Verified payment charge is not yet available.');
  if (intent && charge) {
    assertCheckoutCharge(order, session, intent, charge);
    if (intent.application_fee_amount || charge.application_fee) throw new Error('OSS Checkout must not charge a platform fee.');
    if (!Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded < 0 || charge.amount_refunded > charge.amount) throw new Error('Stripe refund amount mismatch.');
  }
  return withTransaction(async () => {
    const current = await shopOrder(orderId);
    if (current.stripeCheckoutSessionId !== session.id || (current.paidAt && current.amountTotal !== amounts.amountTotal)) throw new Error('Stripe payment snapshot mismatch.');
    const refunded = Math.max(current.amountRefunded || 0, charge?.amount_refunded || 0);
    const status = current.status === 'disputed' ? 'disputed' : amounts.amountTotal > 0 && refunded >= amounts.amountTotal ? 'refunded' : refunded > 0 ? 'partially_refunded' : 'paid';
    const update = { ...current, ...amounts, status, amountRefunded: refunded, stripePaymentIntentId: intentId, stripeChargeId: charge?.id || null,
      paidAt: current.paidAt || now(), updatedAt: now() };
    if (!current.customerDataErasedAt) {
      const details = session.customer_details || {}, email = z.string().max(254).email().parse(details.email || session.customer_email).toLowerCase();
      const customerId = hash(`shop-customer\0${email}`), customer = await shopCustomer(customerId) || { customerId, email, portalVersion: randomUUID(), createdAt: now() };
      update.buyerEmail = email; update.buyerName = details.individual_name || details.name || null; update.customerId = customerId;
      update.buyerDetails = { businessName: details.business_name || null, phone: details.phone || null, billingAddress: details.address || null,
        taxIds: (details.tax_ids || []).flatMap(id => id.value ? [{ type: id.type, value: id.value }] : []),
        customFields: (current.checkoutFields?.customFields || []).flatMap(field => { const answer = session.custom_fields?.find(item => item.key === field.key && item.type === field.type); const value = answer?.text?.value ?? answer?.numeric?.value; return value ? [{ key: field.key, label: field.label, value }] : []; }) };
      await saveShopOrder(update);
      const customerOrders = (await dbAll('SELECT data FROM shop_orders WHERE customer_id = ?', [customerId])).map(decode).filter(item => item.paidAt).sort((a, b) => b.paidAt.localeCompare(a.paidAt));
      customer.name = update.buyerName || customer.name || null; customer.orderCount = customerOrders.length; customer.lastPurchaseAt = customerOrders[0]?.paidAt || update.paidAt; await saveShopCustomer(customer);
      if (['paid', 'partially_refunded'].includes(status)) {
        const setting = await shopSettings(), base = setting.publicBase;
        const deliveryUrl = `${base}/shop/download?token=${encodeURIComponent(deliveryTokenForOrder(orderId))}`;
        const portalUrl = `${base}/shop/customer?access=${encodeURIComponent(customerPortalToken(customer, customerOrders.filter(item => ['paid', 'partially_refunded'].includes(item.status)).slice(0, 100).map(item => item.orderId)))}`;
        await queueShopEmail(`${orderId}:buyer`, orderId, buildShopBuyerEmail({ order: { ...update, bookingUrl: bookingUrlForOrder(update) }, deliveryUrl, customerPortalUrl: portalUrl, sellerEmail: update.sellerEmail || setting.email?.fromEmail }));
        const sellerEmail = update.sellerEmail || setting.email?.fromEmail;
        if (sellerEmail) await queueShopEmail(`${orderId}:seller`, orderId, buildShopSellerEmail({ order: update, sellerEmail, shopName: setting.appearance.title || 'OrbitPage', dashboardUrl: `${base}/dashboard/editor/shop/orders` }));
      }
    }
    if (status === 'refunded') {
      update.sessionsRemaining = 0;
      if (update.productType === 'service') {
        update.bookingStatus = 'cancelled';
        for (const row of await dbAll('SELECT id, data FROM shop_bookings WHERE order_id = ?', [orderId])) {
          await dbRun('UPDATE shop_bookings SET data = ? WHERE id = ?', [JSON.stringify({ ...decode(row), status: 'cancelled', sessionConsumed: false, updatedAt: now() }), row.id]);
        }
      }
    }
    await saveShopOrder(update); return update;
  });
}
export async function processShopWebhook(rawBody, signature) {
  const { client, config } = await shopStripe();
  if (!config.webhookSecret) fail(503, 'STRIPE_WEBHOOK_NOT_CONFIGURED', 'Stripe webhook is not configured.');
  let event;
  try { event = client.webhooks.constructEvent(rawBody, signature, config.webhookSecret); }
  catch { fail(400, 'STRIPE_SIGNATURE_INVALID', 'Invalid Stripe webhook signature.'); }
  if (event.livemode !== config.livemode || event.account) fail(400, 'STRIPE_EVENT_SCOPE_INVALID', 'Invalid Stripe account or mode.');
  const lease = Date.now() + 5 * 60_000;
  const claimed = await withTransaction(async () => {
    const previous = await dbGet('SELECT * FROM shop_events WHERE id = ?', [event.id]);
    if (previous?.status === 'processed') return false;
    if (previous?.lease_until > Date.now()) fail(503, 'STRIPE_EVENT_IN_PROGRESS', 'Payment update is in progress. Retry this event.');
    await dbRun('INSERT INTO shop_events (id, status, lease_until) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET status=excluded.status, lease_until=excluded.lease_until', [event.id, 'processing', lease]); return true;
  });
  if (!claimed) return { received: true, duplicate: true };
  try {
    const object = event.data.object;
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      if (object.metadata?.orbitpageOrderId) await reconcileShopPayment(object.metadata.orbitpageOrderId, object.id);
    } else if (['checkout.session.async_payment_failed', 'checkout.session.expired'].includes(event.type)) {
      const orderId = object.metadata?.orbitpageOrderId;
      if (orderId) await withTransaction(async () => {
        const order = await shopOrder(orderId);
        if (!order || order.stripeCheckoutSessionId !== object.id) throw new Error('Stripe Checkout ownership mismatch.');
        if (!order.paidAt) await saveShopOrder({ ...order, status: event.type.endsWith('expired') ? 'expired' : 'payment_failed', updatedAt: now() });
      });
    } else if (['charge.refunded', 'charge.dispute.created', 'charge.dispute.closed'].includes(event.type)) {
      const intentId = stripeObjectId(object.payment_intent), row = intentId ? await dbGet('SELECT data FROM shop_orders WHERE payment_intent_id = ?', [intentId]) : null;
      let order = decode(row);
      // Refunds can arrive before Checkout completion. Resolve through the bound Session.
      if (!order && intentId) {
        const sessions = await client.checkout.sessions.list({ payment_intent: intentId, limit: 10 });
        for (const session of sessions.data) {
          const candidate = session.metadata?.orbitpageOrderId && await shopOrder(session.metadata.orbitpageOrderId);
          if (candidate?.stripeCheckoutSessionId === session.id) { order = candidate; break; }
        }
      }
      if (order) {
        const paid = await reconcileShopPayment(order.orderId, order.stripeCheckoutSessionId);
        if (paid.stripePaymentIntentId !== intentId) throw new Error('Stripe refund ownership mismatch.');
        if (event.type === 'charge.refunded' && object.id !== paid.stripeChargeId) throw new Error('Stripe charge ownership mismatch.');
        if (event.type.startsWith('charge.dispute.')) {
          const dispute = await client.disputes.retrieve(object.id);
          if (stripeObjectId(dispute.payment_intent) !== intentId || stripeObjectId(dispute.charge) !== paid.stripeChargeId) throw new Error('Stripe dispute ownership mismatch.');
          await withTransaction(async () => {
          const current = await shopOrder(order.orderId);
          const won = dispute.status === 'won';
          const status = won ? current.amountRefunded >= current.amountTotal ? 'refunded' : current.amountRefunded ? 'partially_refunded' : 'paid' : 'disputed';
          await saveShopOrder({ ...current, status, updatedAt: now() });
          });
        }
      }
    }
    await dbRun('UPDATE shop_events SET status = ?, lease_until = 0 WHERE id = ? AND lease_until = ?', ['processed', event.id, lease]);
    return { received: true };
  } catch (error) { await dbRun('UPDATE shop_events SET status = ?, lease_until = 0 WHERE id = ? AND lease_until = ?', ['failed', event.id, lease]); throw error; }
}
export async function shopReceipt(orderId, sessionId) {
  uuid.parse(orderId); const order = await shopOrder(orderId);
  if (!order || !sessionId || order.stripeCheckoutSessionId !== sessionId) fail(404, 'SHOP_ORDER_NOT_FOUND', 'Order not found.');
  const current = await reconcileShopPayment(orderId, sessionId);
  if (['refunded', 'disputed', 'expired', 'payment_failed'].includes(current.status) || current.customerDataErasedAt) fail(410, 'SHOP_ORDER_UNAVAILABLE', 'This purchase link is no longer available.');
  if (!['paid', 'partially_refunded'].includes(current.status)) fail(409, 'SHOP_ORDER_NOT_READY', 'Payment has not been confirmed yet.');
  return shopDeliveryInfo(current, deliveryTokenForOrder(orderId));
}
async function shopDeliveryInfo(order, token) {
  const customer = order.customerId ? await shopCustomer(order.customerId) : null, setting = await shopSettings();
  return { shop: await getShopPurchasePresentation(setting), paidAt: order.paidAt, orderId: order.orderId, orderNumber: order.orderNumber, productTitle: order.productTitle, productType: order.productType,
    amountTotal: order.amountTotal, currency: order.currency, fulfillmentText: order.fulfillmentText, bookingUrl: bookingUrlForOrder(order),
    downloadable: order.productType === 'digital', files: (order.deliveryFiles || []).map(({ filename, sizeBytes }) => ({ filename, sizeBytes })),
    downloadCount: order.downloadCount, maxDownloads: 10 * Math.max(1, order.deliveryFiles?.length || 1), expiresAt: order.deliveryExpiresAt, deliveryToken: token,
    customerPortalUrl: customer ? `${setting.publicBase}/shop/customer?access=${encodeURIComponent(customerPortalToken(customer, [order.orderId]))}` : '',
    sessionsIncluded: order.sessionsIncluded, sessionsRemaining: order.sessionsRemaining, intakeQuestions: order.intakeQuestions || [] };
}
export async function shopDelivery(token, fileId, consume = false) {
  const [orderId, signature, extra] = String(token).split('.');
  if (extra || !uuid.safeParse(orderId).success || !shopSafeEqual(signature, shopSign('delivery', orderId))) fail(404, 'SHOP_DOWNLOAD_INVALID', 'Download link is invalid.');
  return withTransaction(async () => {
    const order = await shopOrder(orderId);
    if (!order || !shopSafeEqual(hash(token), order.deliveryTokenHash) || order.customerDataErasedAt
      || !['paid', 'partially_refunded'].includes(order.status)) fail(404, 'SHOP_DOWNLOAD_INVALID', 'Download is unavailable.');
    if (Date.parse(order.deliveryExpiresAt) <= Date.now() || order.downloadCount >= 10 * Math.max(1, order.deliveryFiles?.length || 1)) fail(410, 'SHOP_DOWNLOAD_EXPIRED', 'Download link has expired or reached its limit.');
    const files = order.deliveryFiles || [], file = Number.isInteger(fileId) ? files[fileId] : fileId ? files.find(item => item.id === fileId) : files.length === 1 ? files[0] : null;
    if (!consume) return shopDeliveryInfo(order, token);
    if (order.productType !== 'digital') fail(404, 'SHOP_DOWNLOAD_INVALID', 'Download is unavailable.');
    if (!file || !fs.existsSync(shopFilePath(file.id))) fail(404, 'SHOP_DOWNLOAD_FILE_MISSING', 'File is unavailable.');
    await saveShopOrder({ ...order, downloadCount: order.downloadCount + 1, updatedAt: now() });
    return { ...file, path: shopFilePath(file.id) };
  });
}
export async function deleteShopCustomer(id, base) {
  z.string().regex(/^[a-f0-9]{64}$/).parse(id);
  await withTransaction(async () => {
    for (const row of await dbAll('SELECT data FROM shop_orders WHERE customer_id = ?', [id])) {
      const order = decode(row); await saveShopOrder({ ...order, buyerEmail: null, buyerName: null, buyerDetails: null, customerId: null,
        intakeAnswers: [], customerDataErasedAt: now(), deliveryTokenHash: null, updatedAt: now() });
      await dbRun('DELETE FROM shop_emails WHERE order_id = ?', [order.orderId]);
      await dbRun('DELETE FROM shop_bookings WHERE order_id = ?', [order.orderId]);
    }
    await dbRun('DELETE FROM shop_customers WHERE id = ?', [id]);
  });
  return shopDashboard(base);
}
export async function dispatchShopEmails() {
  const setting = await shopSettings();
  if (!setting.email?.password) return { configured: false, sent: 0 };
  let sent = 0;
  for (let index = 0; index < 20; index++) {
    const claim = await withTransaction(async () => {
      const row = await dbGet("SELECT * FROM shop_emails WHERE status IN ('pending', 'sending') AND next_run <= ? AND lease_until <= ? ORDER BY rowid LIMIT 1", [Date.now(), Date.now()]);
      if (!row) return null;
      if (row.order_id) { const order = await shopOrder(row.order_id); if (!order || order.customerDataErasedAt || !['paid', 'partially_refunded'].includes(order.status)) {
        await dbRun('UPDATE shop_emails SET status = ? WHERE id = ?', ['cancelled', row.id]); return { skip: true };
      } }
      await dbRun('UPDATE shop_emails SET status = ?, lease_until = ?, attempts = attempts + 1 WHERE id = ?', ['sending', Date.now() + 90_000, row.id]);
      return row;
    });
    if (!claim) break; if (claim.skip) continue;
    try {
      // Stable Message-ID helps receivers deduplicate a retry after a process crash.
      await sendShopEmail({ ...JSON.parse(claim.data), messageId: `<${hash(claim.id)}@${new URL(setting.publicBase).hostname}>` }, setting);
      await dbRun('UPDATE shop_emails SET status = ?, lease_until = 0 WHERE id = ?', ['sent', claim.id]); sent++;
    } catch {
      await dbRun('UPDATE shop_emails SET status = ?, lease_until = 0, next_run = ? WHERE id = ?', ['pending', Date.now() + Math.min(3600_000, 30_000 * 2 ** Math.min(claim.attempts, 7)), claim.id]);
    }
  }
  return { configured: true, sent };
}

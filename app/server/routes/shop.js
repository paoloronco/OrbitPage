import express from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { z } from 'zod';
import { authenticateToken, requirePermission } from '../auth.js';
import { matchesShopFileSignature } from '../../packages/shop/files.js';
import { renderShopPolicyHtml } from '../../packages/shop/render.js';
import { SHOP_POLICIES } from '../../packages/shop/policies.js';
import { withTransaction } from '../database.js';
import { enforceUploadStorageQuota, getUploadStorageQuotaBytes } from '../services/upload-policy.js';
import {
  ShopError, shopDataDir, shopFilesPath, shopDashboard, configureShopStripe, refreshShopStripe, configureShopEmail, testShopEmail,
  saveShopProduct, deleteShopProduct, saveShopAppearance, setShopPublished, reserveShopUpload, receiveShopUpload, finalizeShopUpload, abortShopUpload,
  publicShopCover, publicShop, createShopCheckout, processShopWebhook, shopReceipt, shopDelivery, deleteShopCustomer, shopSettings, uploadFor,
} from '../services/shop.js';
import { getShopCustomerPortal, submitShopIntake, processShopCalendarWebhook } from '../services/shop-lifecycle.js';

const writeLimiter = rateLimit({ windowMs: 15 * 60_000, max: 120, standardHeaders: true, legacyHeaders: false });
const publicLimiter = rateLimit({ windowMs: 15 * 60_000, max: 60, standardHeaders: true, legacyHeaders: false });
const webhookLimiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });
const logoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 } }).single('file');
const uuid = z.string().uuid();
const endpoint = handler => async (req, res) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    const result = await handler(req, res);
    if (result !== undefined && !res.headersSent) res.json(result);
  } catch (error) {
    if (res.headersSent) return;
    if (error instanceof ShopError) return res.status(error.status).json({ error: error.message, code: error.code });
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues[0]?.message || 'Invalid Shop data.', code: 'INVALID_SHOP_DATA' });
    // Provider exceptions can include request parameters. Keep secrets and buyer data out of logs.
    console.error('Shop request failed:', error?.code || 'unavailable');
    res.status(502).json({ error: 'Shop request could not be completed. Please try again.', code: 'SHOP_REQUEST_FAILED' });
  }
};
const writable = demoMode => (req, res, next) => demoMode
  ? res.status(403).json({ error: 'Shop changes are disabled in demo mode.' })
  : next();
export function createShopWebhookRouter({ demoMode, updateGuard = (_req, _res, next) => next() }) {
  const router = express.Router();
  router.use(updateGuard);
  router.post('/webhook', webhookLimiter, writable(demoMode), express.raw({ type: 'application/json', limit: '1mb' }), endpoint(req => processShopWebhook(req.body, req.get('stripe-signature'))));
  router.post('/calendar/calcom/:token', webhookLimiter, writable(demoMode), express.raw({ type: 'application/json', limit: '1mb' }), endpoint(req => processShopCalendarWebhook(req.params.token, req.body, req.get('x-cal-signature-256'))));
  router.put('/uploads/content/:token', publicLimiter, writable(demoMode), async (req, res, next) => {
    try {
      const upload = await uploadFor(req.params.token);
      if (req.get('content-type')?.split(';')[0] !== upload.contentType || Number(req.get('content-length')) !== upload.sizeBytes) {
        return res.status(400).json({ error: 'Upload does not match its reservation.', code: 'INVALID_SHOP_FILE' });
      }
      express.raw({ type: () => true, limit: upload.sizeBytes })(req, res, next);
    } catch (error) {
      res.status(error.status || 400).json({ error: 'Upload unavailable.', code: error.code || 'INVALID_SHOP_FILE' });
    }
  }, endpoint(req => receiveShopUpload(req.params.token, req.body, req.get('content-type')?.split(';')[0])));
  return router;
}
export function createShopRouter({ publicBase, demoMode }) {
  const router = express.Router(), base = req => publicBase(req).replace(/\/$/, '');
  const admin = [authenticateToken, requirePermission('users:manage')], write = [...admin, writeLimiter, writable(demoMode)];
  router.get('/', ...admin, endpoint(async req => {
    if (req.query.refresh === '1') {
      try { return await refreshShopStripe(base(req)); }
      catch (error) { if (error.code !== 'SHOP_STRIPE_NOT_CONFIGURED') throw error; }
    }
    return shopDashboard(base(req));
  }));
  router.post('/stripe', ...write, endpoint(req => configureShopStripe(req.body, base(req))));
  router.post('/stripe/test', ...write, endpoint(req => refreshShopStripe(base(req))));
  router.post('/email', ...write, endpoint(req => configureShopEmail(req.body)));
  router.post('/email/test', ...write, endpoint(req => testShopEmail(req.body?.recipient)));
  router.post('/products', ...write, endpoint(req => saveShopProduct(req.body, base(req))));
  router.delete('/products/:id', ...write, endpoint(req => deleteShopProduct(req.params.id, base(req))));
  router.delete('/customers/:id', ...write, endpoint(req => deleteShopCustomer(req.params.id, base(req))));
  router.post('/appearance', ...write, endpoint(req => saveShopAppearance(req.body, base(req))));
  router.post('/publish', ...write, endpoint(req => setShopPublished(true, base(req))));
  router.post('/unpublish', ...write, endpoint(req => setShopPublished(false, base(req))));
  router.post('/uploads/reserve', ...write, endpoint(req => reserveShopUpload(req.body, base(req))));
  router.post('/uploads/finalize', ...write, endpoint(req => finalizeShopUpload(z.object({ uploadToken: z.string().max(150) }).strict().parse(req.body).uploadToken, base(req))));
  router.post('/uploads/abort', ...write, endpoint(async req => { await abortShopUpload(z.object({ uploadToken: z.string().max(150) }).strict().parse(req.body).uploadToken); return { aborted: true }; }));
  router.post('/logo', ...write, logoUpload, endpoint(req => withTransaction(async () => {
    const file = req.file, extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif' };
    if (!file || !extensions[file.mimetype] || !matchesShopFileSignature(file.mimetype, file.buffer.subarray(0, 32))) throw new ShopError(400, 'INVALID_SHOP_LOGO', 'Choose a supported logo image of 5 MB or less.');
    const name = `shop-logo-${randomUUID()}.${extensions[file.mimetype]}`, directory = join(shopDataDir, 'uploads');
    fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(join(directory, name), file.buffer, { flag: 'wx', mode: 0o644 });
    enforceUploadStorageQuota({ uploadsPath: directory, filePath: join(directory, name), privateFilesPath: shopFilesPath, quotaBytes: getUploadStorageQuotaBytes() });
    return { logoUrl: `/uploads/${name}` };
  })));
  router.get('/covers/:id', endpoint(async (req, res) => {
    const file = await publicShopCover(req.params.id);
    res.set({ 'Content-Type': file.contentType, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=0, must-revalidate' });
    res.sendFile(file.path);
  }));
  router.post('/checkout', publicLimiter, writable(demoMode), endpoint(async (req, res) => {
    if (!req.is('application/x-www-form-urlencoded')) throw new ShopError(415, 'INVALID_SHOP_CHECKOUT', 'Invalid checkout request.');
    const accepted = value => value === 'accepted';
    const url = await createShopCheckout({ productId: req.body?.productId, sellerTermsAccepted: accepted(req.body?.sellerTermsAccepted),
      sellerNoticeAcknowledged: accepted(req.body?.sellerNoticeAcknowledged) || accepted(req.body?.sellerTermsAccepted), digitalContentConsent: accepted(req.body?.digitalContentConsent) }, base(req));
    res.redirect(303, url);
  }));
  router.get('/order', publicLimiter, endpoint(req => shopReceipt(req.query.order, req.query.session_id)));
  router.get('/delivery/:token', publicLimiter, endpoint(req => shopDelivery(req.params.token)));
  router.get('/download/:token', publicLimiter, endpoint(async (req, res) => {
    const index = req.query.file === undefined ? undefined : z.coerce.number().int().min(0).max(9).parse(req.query.file);
    const file = await shopDelivery(req.params.token, index, true);
    res.set({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' });
    res.download(file.path, file.filename);
  }));
  router.get('/customer', publicLimiter, endpoint(req => getShopCustomerPortal(req.query.access || req.get('x-shop-customer-access'))));
  router.post('/customer', publicLimiter, writable(demoMode), endpoint(req => submitShopIntake(req.get('x-shop-customer-access'), req.body)));
  return router;
}
export function createShopPublicRouter({ publicBase }) {
  const router = express.Router(), base = req => publicBase(req).replace(/\/$/, '');
  router.get(['/', '/legal', '/legal/:policy'], endpoint(async (req, res) => {
    const markdown = req.path === '/' && req.get('accept')?.includes('text/markdown');
    let html;
    if (req.path.startsWith('/legal')) {
      const setting = await shopSettings();
      if (!setting.enabled) throw new ShopError(404, 'SHOP_NOT_FOUND', 'Shop not found.');
      if (req.params.policy && !SHOP_POLICIES.some(policy => policy.slug === req.params.policy && setting.appearance[policy.textField]?.trim())) {
        throw new ShopError(404, 'SHOP_POLICY_NOT_FOUND', 'Shop policy not found.');
      }
      html = renderShopPolicyHtml({ appearance: setting.appearance, shopUrl: `${base(req)}/shop` });
      if (!html) throw new ShopError(404, 'SHOP_POLICY_NOT_FOUND', 'Shop policy not found.');
    } else html = await publicShop(base(req), markdown);
    if (!markdown) {
      const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => `'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`);
      res.set('Content-Security-Policy', `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self' https://checkout.stripe.com; script-src 'self' ${scripts.join(' ')}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'`);
    }
    res.set({ 'Cache-Control': 'public, max-age=0, must-revalidate', 'Content-Type': markdown ? 'text/markdown; charset=utf-8' : 'text/html; charset=utf-8' }).send(html);
  }));
  return router;
}

import { createHash } from 'node:crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticateToken, requirePermission } from '../auth.js';
import {
  NewsletterError, addSubscriber, cancelCampaign, confirmSubscription, deleteCampaign,
  newsletterDashboard, publicLanding, queueCampaign, recordEvent, removeSubscriber,
  saveCampaign, saveSmtpSettings, subscribe, testSmtp, unsubscribe,
} from '../services/newsletter.js';

const transparentGif = Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64');
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
const publicIpLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const publicEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 3, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => createHash('sha256').update(String(req.body?.email || '').trim().toLowerCase()).digest('hex'),
});

const endpoint = (handler) => async (req, res) => {
  try {
    const result = await handler(req, res);
    if (!res.headersSent && result !== undefined) res.set('Cache-Control', 'private, no-store').json(result);
  } catch (error) {
    if (error instanceof NewsletterError) return res.status(error.status).json({ error: error.message, code: error.code });
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues[0]?.message || 'Invalid newsletter data.', code: 'INVALID_NEWSLETTER_DATA' });
    console.error('Newsletter request failed:', error);
    return res.status(500).json({ error: 'Newsletter request could not be completed.' });
  }
};

export function createNewsletterRouter({ publicBase, demoMode }) {
  const router = express.Router();
  const admin = [authenticateToken, requirePermission('users:manage')];
  const writable = [...admin, writeLimiter, (req, res, next) => (
    demoMode ? res.status(403).json({ error: 'Newsletter changes are disabled in demo mode.' }) : next()
  )];
  const base = (req) => publicBase(req).replace(/\/$/, '');
  const statusUrl = (req, state) => `${new URL(base(req)).pathname.replace(/\/$/, '')}/newsletter/status?state=${state}`;

  router.get('/', ...admin, endpoint(async (req) => newsletterDashboard(base(req))));
  router.put('/settings', ...writable, endpoint(async (req) => saveSmtpSettings(req.body, base(req))));
  router.post('/settings/test', ...writable, endpoint(async (req) => testSmtp(req.body?.recipient)));
  router.post('/subscribers', ...writable, endpoint(async (req) => addSubscriber(req.body)));
  router.delete('/subscribers/:id', ...writable, endpoint(async (req) => removeSubscriber(req.params.id)));
  router.post('/campaigns', ...writable, endpoint(async (req) => saveCampaign(req.body)));
  router.delete('/campaigns/:id', ...writable, endpoint(async (req) => deleteCampaign(req.params.id)));
  router.post('/campaigns/:id/send', ...writable, endpoint(async (req) => queueCampaign(req.params.id, req.body?.scheduledFor)));
  router.delete('/campaigns/:id/send', ...writable, endpoint(async (req) => cancelCampaign(req.params.id)));

  router.get('/public/landing', endpoint(async () => {
    const landing = await publicLanding();
    if (!landing) throw new NewsletterError(404, 'NEWSLETTER_UNAVAILABLE', 'Newsletter is unavailable.');
    return landing;
  }));
  router.post('/public/subscribe', publicIpLimiter, publicEmailLimiter, endpoint(async (req) => {
    if (demoMode) throw new NewsletterError(403, 'NEWSLETTER_DEMO_DISABLED', 'Newsletter signup is disabled in demo mode.');
    const result = await subscribe(req.body);
    return result;
  }));
  router.get('/public/confirm', endpoint(async (req, res) => {
    try { await confirmSubscription(req.query.token); res.redirect(303, statusUrl(req, 'confirmed')); }
    catch { res.redirect(303, statusUrl(req, 'invalid')); }
  }));
  const unsubscribeRequest = endpoint(async (req, res) => {
    try {
      await unsubscribe(req.query.token);
      if (req.method === 'GET') res.redirect(303, statusUrl(req, 'unsubscribed'));
      else res.status(204).end();
    } catch {
      if (req.method === 'GET') res.redirect(303, statusUrl(req, 'invalid'));
      else res.status(400).json({ error: 'Invalid unsubscribe link.' });
    }
  });
  router.get('/public/unsubscribe', unsubscribeRequest);
  router.post('/public/unsubscribe', unsubscribeRequest);
  router.get('/public/open', endpoint(async (req, res) => {
    await recordEvent(req.query.token, 'open').catch(() => undefined);
    res.set({ 'Content-Type': 'image/gif', 'Cache-Control': 'private, no-store, max-age=0', 'Content-Length': String(transparentGif.length) }).send(transparentGif);
  }));
  router.get('/public/click', endpoint(async (req, res) => {
    try { res.redirect(302, await recordEvent(req.query.token, 'click')); }
    catch { res.redirect(303, statusUrl(req, 'invalid')); }
  }));
  return router;
}

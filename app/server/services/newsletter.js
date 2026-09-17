import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { dbAll, dbGet, dbRun, withImmediateTransaction } from '../database.js';

const now = () => new Date().toISOString();
const ports = [465, 587, 2525];
const header = (max) => z.string().trim().min(1).max(max).refine((value) => !/[\r\n]/.test(value));
const optionalHeader = (max) => z.string().trim().max(max).refine((value) => !/[\r\n]/.test(value));
const email = z.string().trim().toLowerCase().email().max(254);
const httpsUrl = z.string().trim().max(2048).refine((value) => !value || (() => {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
})(), 'Use a valid HTTPS URL.');
const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const designDefaults = {
  imageAlt: '', logoUrl: '', contentBackgroundColor: '#ffffff', buttonTextColor: '#ffffff',
  fontFamily: 'system', textAlign: 'left', containerWidth: 640, cornerRadius: 8, buttonRadius: 6,
};

export const smtpSchema = z.object({
  host: header(253).transform((value) => value.toLowerCase().replace(/\.$/, '')),
  port: z.number().int().refine((value) => ports.includes(value)),
  username: header(320), password: z.string().max(1024).default(''),
  fromName: header(100), fromEmail: email,
  replyTo: z.union([z.literal(''), email]).default(''),
}).strict();
export const subscriberSchema = z.object({
  email, name: optionalHeader(100).default(''), consentConfirmed: z.literal(true),
  source: z.enum(['manual', 'import']).default('manual'),
}).strict();
export const publicSubscriberSchema = z.object({
  email, name: optionalHeader(100).default(''), consent: z.literal(true),
}).strict();
export const campaignSchema = z.object({
  campaignId: z.string().uuid().optional(), name: header(100), subject: header(160),
  preheader: optionalHeader(200).default(''),
  content: z.object({
    eyebrow: optionalHeader(60).default(''), headline: header(140),
    body: z.string().trim().min(1).max(12000), ctaLabel: optionalHeader(60).default(''),
    ctaUrl: httpsUrl.default(''), imageUrl: httpsUrl.default(''),
    imageAlt: optionalHeader(160).default(''), logoUrl: httpsUrl.default(''),
    accentColor: hex, backgroundColor: hex, contentBackgroundColor: hex.default('#ffffff'),
    contentColor: hex, buttonTextColor: hex.default('#ffffff'),
    fontFamily: z.enum(['system', 'editorial', 'modern']).default('system'),
    textAlign: z.enum(['left', 'center']).default('left'),
    containerWidth: z.union([z.literal(520), z.literal(640), z.literal(720)]).default(640),
    cornerRadius: z.number().int().min(0).max(24).default(8),
    buttonRadius: z.number().int().min(0).max(28).default(6),
    footerNote: z.string().trim().max(500).default(''),
  }).strict().refine((value) => !value.ctaLabel || Boolean(value.ctaUrl), 'Add an HTTPS URL for the call-to-action button.'),
}).strict();

export class NewsletterError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function secretKey() {
  const secret = process.env.NEWSLETTER_SECRET_KEY || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new NewsletterError(503, 'NEWSLETTER_SECRET_MISSING', 'A stable server secret is required for newsletters.');
  return createHash('sha256').update('orbitpage-newsletter-v1\0').update(secret).digest();
}

export function encryptSmtpPassword(password) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secretKey(), iv);
  const value = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return JSON.stringify({ iv: iv.toString('base64url'), tag: cipher.getAuthTag().toString('base64url'), value: value.toString('base64url') });
}

export function decryptSmtpPassword(payload) {
  const { iv, tag, value } = JSON.parse(payload);
  const decipher = createDecipheriv('aes-256-gcm', secretKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(value, 'base64url')), decipher.final()]).toString('utf8');
}

export function signNewsletterToken(claims, seconds) {
  const body = Buffer.from(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + seconds })).toString('base64url');
  const signature = createHmac('sha256', secretKey()).update(`orbitpage-newsletter\0${body}`).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyNewsletterToken(token, action) {
  const [body, supplied, extra] = String(token || '').split('.');
  if (!body || !supplied || extra) throw new NewsletterError(400, 'NEWSLETTER_LINK_INVALID', 'Invalid newsletter link.');
  const expected = createHmac('sha256', secretKey()).update(`orbitpage-newsletter\0${body}`).digest('base64url');
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new NewsletterError(400, 'NEWSLETTER_LINK_INVALID', 'Invalid newsletter link.');
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { throw new NewsletterError(400, 'NEWSLETTER_LINK_INVALID', 'Invalid newsletter link.'); }
  if (payload.action !== action || !payload.subscriberId || !Number.isFinite(payload.exp) || payload.exp < Date.now() / 1000) {
    throw new NewsletterError(400, 'NEWSLETTER_LINK_INVALID', 'This newsletter link is invalid or expired.');
  }
  return payload;
}

const settings = () => dbGet('SELECT * FROM newsletter_settings WHERE id = 1');
const publicSettings = (row) => ({
  configured: Boolean(row), passwordConfigured: Boolean(row?.password_enc),
  host: row?.host || '', port: row?.port || 587, secure: row?.port === 465,
  username: row?.username || '', fromName: row?.from_name || '', fromEmail: row?.from_email || '',
  replyTo: row?.reply_to || null, verifiedAt: row?.verified_at || null, updatedAt: row?.updated_at || null,
});
const emptyStats = () => ({ attempted: 0, accepted: 0, rejected: 0, openedUnique: 0, clickedUnique: 0, unsubscribed: 0 });
const subscriberDto = (row) => ({
  subscriberId: row.id, email: row.email, name: row.name, status: row.status, source: row.source,
  consentAt: row.consent_at, confirmedAt: row.confirmed_at, unsubscribedAt: row.unsubscribed_at,
  createdAt: row.created_at, updatedAt: row.updated_at,
});
const campaignDto = (row) => ({
  campaignId: row.id, name: row.name, subject: row.subject, preheader: row.preheader,
  content: { ...designDefaults, ...JSON.parse(row.content) }, status: row.status,
  scheduledFor: row.scheduled_for, sentAt: row.sent_at, targetCount: row.target_count,
  stats: JSON.parse(row.stats), lastError: row.last_error, createdAt: row.created_at, updatedAt: row.updated_at,
});

export async function newsletterDashboard(publicBase, canManage = true) {
  const [setting, counts, subscribers, campaigns, usage] = await Promise.all([
    settings(),
    dbAll('SELECT status, COUNT(*) AS count FROM newsletter_subscribers GROUP BY status'),
    dbAll('SELECT * FROM newsletter_subscribers ORDER BY updated_at DESC LIMIT 100'),
    dbAll('SELECT * FROM newsletter_campaigns ORDER BY updated_at DESC LIMIT 50'),
    dbGet("SELECT COUNT(*) AS sent FROM newsletter_deliveries WHERE created_at >= ?", [new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()]),
  ]);
  const subscriberCounts = { total: 0, active: 0, pending: 0, unsubscribed: 0 };
  for (const row of counts) { subscriberCounts[row.status] = row.count; subscriberCounts.total += row.count; }
  return {
    available: true, canManage, planId: 'oss',
    limits: { maxSubscribers: null, maxSendsPerMonth: null, sendsThisMonth: usage?.sent || 0, reservedThisMonth: 0 },
    settings: publicSettings(setting), subscriberCounts,
    subscribers: subscribers.map(subscriberDto), campaigns: campaigns.map(campaignDto),
    signupUrl: `${publicBase}/newsletter`,
  };
}

export async function saveSmtpSettings(raw, publicBase) {
  const input = smtpSchema.parse(raw);
  const previous = await settings();
  if (!input.password && !previous?.password_enc) throw new NewsletterError(400, 'SMTP_PASSWORD_REQUIRED', 'Enter the SMTP password.');
  const changed = !previous || previous.host !== input.host || previous.port !== input.port
    || previous.username !== input.username || previous.from_email !== input.fromEmail || Boolean(input.password);
  const updatedAt = now();
  await dbRun(`INSERT INTO newsletter_settings
    (id, host, port, username, password_enc, from_name, from_email, reply_to, verified_at, public_origin, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET host=excluded.host, port=excluded.port, username=excluded.username,
    password_enc=excluded.password_enc, from_name=excluded.from_name, from_email=excluded.from_email,
    reply_to=excluded.reply_to, verified_at=excluded.verified_at, public_origin=excluded.public_origin,
    updated_at=excluded.updated_at`, [
    input.host, input.port, input.username,
    input.password ? encryptSmtpPassword(input.password) : previous.password_enc,
    input.fromName, input.fromEmail, input.replyTo || null,
    changed ? null : previous?.verified_at || null, publicBase, updatedAt,
  ]);
  return publicSettings(await settings());
}

async function transport(setting, pooled = false) {
  return nodemailer.createTransport({
    host: setting.host, port: setting.port, secure: setting.port === 465,
    requireTLS: setting.port !== 465,
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 25000,
    auth: { user: setting.username, pass: decryptSmtpPassword(setting.password_enc) },
    tls: { servername: setting.host, minVersion: 'TLSv1.2', rejectUnauthorized: true },
    ...(pooled ? { pool: true, maxConnections: 2, maxMessages: 25, rateDelta: 1000, rateLimit: 5 } : {}),
  });
}

export async function testSmtp(recipient) {
  const to = email.parse(recipient);
  const setting = await settings();
  if (!setting) throw new NewsletterError(409, 'SMTP_NOT_CONFIGURED', 'Save SMTP settings first.');
  const client = await transport(setting);
  try {
    await client.verify();
    await client.sendMail({ from: { name: setting.from_name, address: setting.from_email }, to,
      subject: 'OrbitPage newsletter SMTP test',
      text: 'Your SMTP connection is working. You can now send OrbitPage newsletters.' });
  } finally { client.close(); }
  const verifiedAt = now();
  const updated = await dbRun('UPDATE newsletter_settings SET verified_at = ?, updated_at = ? WHERE id = 1 AND updated_at = ?', [verifiedAt, verifiedAt, setting.updated_at]);
  if (!updated.changes) throw new NewsletterError(409, 'SMTP_SETTINGS_CHANGED', 'SMTP settings changed during verification. Test the current connection again.');
  return { verifiedAt };
}

export async function addSubscriber(raw) {
  const input = subscriberSchema.parse(raw);
  const existing = await dbGet('SELECT id, created_at FROM newsletter_subscribers WHERE email = ?', [input.email]);
  const id = existing?.id || randomUUID();
  const date = now();
  await dbRun(`INSERT INTO newsletter_subscribers
    (id, email, name, status, source, consent_at, confirmed_at, unsubscribed_at, created_at, updated_at)
    VALUES (?, ?, ?, 'active', ?, ?, ?, NULL, ?, ?)
    ON CONFLICT(email) DO UPDATE SET name=excluded.name, status='active', source=excluded.source,
    consent_at=excluded.consent_at, confirmed_at=excluded.confirmed_at, unsubscribed_at=NULL, updated_at=excluded.updated_at`,
  [id, input.email, input.name || null, input.source, date, date, existing?.created_at || date, date]);
  return subscriberDto(await dbGet('SELECT * FROM newsletter_subscribers WHERE email = ?', [input.email]));
}

export async function removeSubscriber(id) {
  const result = await dbRun('DELETE FROM newsletter_subscribers WHERE id = ?', [id]);
  if (!result.changes) throw new NewsletterError(404, 'NEWSLETTER_SUBSCRIBER_NOT_FOUND', 'Subscriber not found.');
  return { deleted: true };
}

export async function saveCampaign(raw) {
  const input = campaignSchema.parse(raw);
  const previous = input.campaignId ? await dbGet('SELECT * FROM newsletter_campaigns WHERE id = ?', [input.campaignId]) : null;
  if (input.campaignId && !previous) throw new NewsletterError(404, 'NEWSLETTER_CAMPAIGN_NOT_FOUND', 'Campaign not found.');
  if (previous && previous.status !== 'draft') throw new NewsletterError(409, 'NEWSLETTER_CAMPAIGN_LOCKED', 'Only draft campaigns can be edited.');
  const id = input.campaignId || randomUUID();
  const date = now();
  await dbRun(`INSERT INTO newsletter_campaigns
    (id, name, subject, preheader, content, status, target_count, stats, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'draft', 0, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, subject=excluded.subject,
    preheader=excluded.preheader, content=excluded.content, updated_at=excluded.updated_at`,
  [id, input.name, input.subject, input.preheader, JSON.stringify(input.content), JSON.stringify(emptyStats()), previous?.created_at || date, date]);
  return campaignDto(await dbGet('SELECT * FROM newsletter_campaigns WHERE id = ?', [id]));
}

export async function queueCampaign(id, scheduledFor) {
  const targetDate = scheduledFor == null ? new Date() : new Date(z.string().datetime({ offset: true }).parse(scheduledFor));
  if (!Number.isFinite(targetDate.getTime()) || targetDate.getTime() < Date.now() - 60000 || targetDate.getTime() > Date.now() + 366 * 86400000) {
    throw new NewsletterError(400, 'INVALID_NEWSLETTER_SCHEDULE', 'Choose a valid send date within the next year.');
  }
  const setting = await settings();
  if (!setting?.verified_at) throw new NewsletterError(409, 'SMTP_VERIFICATION_REQUIRED', 'Verify the SMTP connection before sending.');
  const audience = await dbGet("SELECT COUNT(*) AS count FROM newsletter_subscribers WHERE status = 'active'");
  if (!audience.count) throw new NewsletterError(409, 'NEWSLETTER_AUDIENCE_EMPTY', 'Add at least one active subscriber before sending.');
  const result = await dbRun(`UPDATE newsletter_campaigns SET status='scheduled', scheduled_for=?, target_count=?,
    next_run_at=?, dispatch_cursor=NULL, lease_until=NULL, last_error=NULL, updated_at=?
    WHERE id=? AND status='draft'`, [targetDate.toISOString(), audience.count, targetDate.toISOString(), now(), id]);
  if (!result.changes) throw new NewsletterError(409, 'NEWSLETTER_CAMPAIGN_LOCKED', 'Campaign not found or already queued.');
  return campaignDto(await dbGet('SELECT * FROM newsletter_campaigns WHERE id = ?', [id]));
}

export async function cancelCampaign(id) {
  const result = await dbRun("UPDATE newsletter_campaigns SET status='canceled', next_run_at=NULL, lease_until=NULL, updated_at=? WHERE id=? AND status='scheduled'", [now(), id]);
  if (!result.changes) throw new NewsletterError(409, 'NEWSLETTER_CAMPAIGN_LOCKED', 'Only scheduled campaigns can be canceled.');
  return { canceled: true };
}

export async function deleteCampaign(id) {
  const result = await dbRun("DELETE FROM newsletter_campaigns WHERE id=? AND status != 'sending'", [id]);
  if (!result.changes) throw new NewsletterError(409, 'NEWSLETTER_CAMPAIGN_SENDING', 'Campaign not found or currently sending.');
  return { deleted: true };
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const personalize = (value, subscriber) => String(value).replaceAll('{{name}}', subscriber.name || 'there');

export function emailDocument(campaign, subscriber, deliveryId, publicBase) {
  const content = { ...designDefaults, ...JSON.parse(campaign.content) };
  const unsubscribeUrl = `${publicBase}/api/newsletter/public/unsubscribe?token=${encodeURIComponent(signNewsletterToken({
    action: 'unsubscribe', subscriberId: subscriber.id, campaignId: campaign.id,
  }, 365 * 86400))}`;
  const openUrl = `${publicBase}/api/newsletter/public/open?token=${encodeURIComponent(signNewsletterToken({
    action: 'open', subscriberId: subscriber.id, campaignId: campaign.id, deliveryId,
  }, 365 * 86400))}`;
  const ctaUrl = content.ctaUrl ? `${publicBase}/api/newsletter/public/click?token=${encodeURIComponent(signNewsletterToken({
    action: 'click', subscriberId: subscriber.id, campaignId: campaign.id, deliveryId, url: content.ctaUrl,
  }, 365 * 86400))}` : '';
  const fonts = { system: 'Arial,Helvetica,sans-serif', editorial: 'Georgia,Times New Roman,serif', modern: 'Trebuchet MS,Arial,sans-serif' };
  const paragraphs = personalize(content.body, subscriber).split(/\n{2,}/).map((part) =>
    `<p style="margin:0 0 18px;line-height:1.65">${escapeHtml(part).replaceAll('\n', '<br>')}</p>`).join('');
  const image = content.imageUrl
    ? `<img src="${escapeHtml(content.imageUrl)}" alt="${escapeHtml(content.imageAlt)}" width="${content.containerWidth}" style="display:block;width:100%;height:auto;max-height:420px;object-fit:cover">` : '';
  const logo = content.logoUrl
    ? `<p style="margin:0 0 24px;text-align:${content.textAlign}"><img src="${escapeHtml(content.logoUrl)}" alt="" width="144" style="display:inline-block;width:auto;max-width:144px;max-height:56px;height:auto"></p>` : '';
  const cta = content.ctaLabel && ctaUrl
    ? `<p style="margin:28px 0 8px;text-align:${content.textAlign}"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:13px 20px;border-radius:${content.buttonRadius}px;background:${content.accentColor};color:${content.buttonTextColor};text-decoration:none;font-weight:700">${escapeHtml(content.ctaLabel)}</a></p>` : '';
  return {
    unsubscribeUrl,
    subject: personalize(campaign.subject, subscriber),
    text: `${personalize(content.headline, subscriber)}\n\n${personalize(content.body, subscriber)}${content.ctaUrl ? `\n\n${content.ctaLabel}: ${content.ctaUrl}` : ''}\n\nUnsubscribe: ${unsubscribeUrl}`,
    html: `<!doctype html><html><body style="margin:0;background:${content.backgroundColor};color:${content.contentColor};font-family:${fonts[content.fontFamily]}"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(campaign.preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 14px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:${content.containerWidth}px;background:${content.contentBackgroundColor};border-radius:${content.cornerRadius}px;overflow:hidden"><tr><td>${image}</td></tr><tr><td style="padding:34px;text-align:${content.textAlign}">${logo}<p style="margin:0 0 10px;color:${content.accentColor};font-size:12px;font-weight:700;text-transform:uppercase">${escapeHtml(content.eyebrow)}</p><h1 style="margin:0 0 20px;font-size:30px;line-height:1.15;color:${content.contentColor}">${escapeHtml(personalize(content.headline, subscriber))}</h1>${paragraphs}${cta}<p style="margin:34px 0 0;padding-top:20px;border-top:1px solid #e5e7eb;color:${content.contentColor};opacity:.72;font-size:12px;line-height:1.55">${escapeHtml(content.footerNote)}<br><a href="${escapeHtml(unsubscribeUrl)}" style="color:${content.contentColor}">Unsubscribe</a></p></td></tr></table></td></tr></table><img src="${escapeHtml(openUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px"></body></html>`,
  };
}

export async function publicLanding() {
  const setting = await settings();
  if (!setting?.verified_at) return null;
  return { fromName: setting.from_name, publicPageUrl: `${setting.public_origin}/` };
}

export async function subscribe(raw) {
  const input = publicSubscriberSchema.parse(raw);
  const setting = await settings();
  if (!setting?.verified_at) throw new NewsletterError(409, 'NEWSLETTER_UNAVAILABLE', 'This newsletter is not accepting subscriptions right now.');
  const existing = await dbGet('SELECT * FROM newsletter_subscribers WHERE email = ?', [input.email]);
  if (existing?.status === 'active') return { pending: false, alreadySubscribed: true };
  const id = existing?.id || randomUUID();
  const date = now();
  await dbRun(`INSERT INTO newsletter_subscribers
    (id, email, name, status, source, consent_at, confirmed_at, unsubscribed_at, created_at, updated_at)
    VALUES (?, ?, ?, 'pending', 'public', ?, NULL, NULL, ?, ?)
    ON CONFLICT(email) DO UPDATE SET name=excluded.name, status='pending', source='public',
    consent_at=excluded.consent_at, confirmed_at=NULL, unsubscribed_at=NULL, updated_at=excluded.updated_at`,
  [id, input.email, input.name || null, date, existing?.created_at || date, date]);
  const token = signNewsletterToken({ action: 'confirm', subscriberId: id }, 48 * 3600);
  const confirmUrl = `${setting.public_origin}/api/newsletter/public/confirm?token=${encodeURIComponent(token)}`;
  const client = await transport(setting);
  try {
    await client.sendMail({
      from: { name: setting.from_name, address: setting.from_email }, to: input.email,
      replyTo: setting.reply_to || undefined,
      subject: `Confirm your subscription to ${setting.from_name}`,
      text: `Confirm your subscription: ${confirmUrl}\n\nIf you did not request this, ignore this message.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px"><h1 style="font-size:24px">Confirm your subscription</h1><p>One click confirms that you want to receive updates from ${escapeHtml(setting.from_name)}.</p><p><a href="${escapeHtml(confirmUrl)}" style="display:inline-block;padding:12px 18px;border-radius:6px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700">Confirm subscription</a></p><p style="color:#667085;font-size:12px">If you did not request this, ignore this message.</p></div>`,
    });
  } finally { client.close(); }
  return { pending: true, alreadySubscribed: false };
}

export async function confirmSubscription(token) {
  const { subscriberId } = verifyNewsletterToken(token, 'confirm');
  const result = await dbRun("UPDATE newsletter_subscribers SET status='active', confirmed_at=?, unsubscribed_at=NULL, updated_at=? WHERE id=? AND status='pending'", [now(), now(), subscriberId]);
  if (!result.changes) throw new NewsletterError(400, 'NEWSLETTER_LINK_INVALID', 'This confirmation link is no longer valid.');
  return { confirmed: true };
}

export async function unsubscribe(token) {
  const { subscriberId, campaignId } = verifyNewsletterToken(token, 'unsubscribe');
  const result = await dbRun("UPDATE newsletter_subscribers SET status='unsubscribed', unsubscribed_at=?, updated_at=? WHERE id=? AND status!='unsubscribed'", [now(), now(), subscriberId]);
  if (result.changes && campaignId) await incrementStat(dbRun, campaignId, 'unsubscribed');
  return { unsubscribed: true };
}

function incrementStat(run, campaignId, field) {
  const path = `$.${field}`;
  return run("UPDATE newsletter_campaigns SET stats=json_set(stats, ?, COALESCE(json_extract(stats, ?), 0) + 1), updated_at=? WHERE id=?",
    [path, path, now(), campaignId]);
}

export async function recordEvent(token, action) {
  const payload = verifyNewsletterToken(token, action);
  if (!payload.campaignId || !payload.deliveryId) throw new NewsletterError(400, 'NEWSLETTER_TRACKING_INVALID', 'Invalid tracking link.');
  const field = action === 'open' ? 'opened_at' : 'clicked_at';
  const statsField = action === 'open' ? 'openedUnique' : 'clickedUnique';
  await withImmediateTransaction(async (db) => {
    const delivery = await db.get('SELECT * FROM newsletter_deliveries WHERE id=?', [payload.deliveryId]);
    if (!delivery || delivery.campaign_id !== payload.campaignId || delivery.subscriber_id !== payload.subscriberId || delivery[field]) return;
    await db.run(`UPDATE newsletter_deliveries SET ${field}=?, updated_at=? WHERE id=?`, [now(), now(), payload.deliveryId]);
    await incrementStat(db.run, payload.campaignId, statsField);
  });
  if (action === 'click') {
    const target = new URL(payload.url);
    if (target.protocol !== 'https:') throw new NewsletterError(400, 'NEWSLETTER_TRACKING_INVALID', 'Invalid tracking link.');
    return target.toString();
  }
}

let dispatching = false;

export async function dispatchNewsletterCampaigns() {
  if (dispatching) return;
  dispatching = true;
  try {
    for (let batch = 0; batch < 3; batch += 1) {
      const campaign = await withImmediateTransaction(async (db) => {
        const date = now();
        const due = await db.get(`SELECT * FROM newsletter_campaigns WHERE status IN ('scheduled','sending')
          AND next_run_at<=? AND (lease_until IS NULL OR lease_until<=?) ORDER BY next_run_at LIMIT 1`, [date, date]);
        if (!due) return null;
        await db.run("UPDATE newsletter_campaigns SET status='sending', lease_until=?, updated_at=? WHERE id=?",
          [new Date(Date.now() + 120000).toISOString(), date, due.id]);
        return due;
      });
      if (!campaign) break;
      try { await sendBatch(campaign.id); } catch (error) {
        console.error('Newsletter dispatch failed:', error);
        await dbRun("UPDATE newsletter_campaigns SET status='failed', next_run_at=NULL, lease_until=NULL, last_error=?, updated_at=? WHERE id=?",
          [String(error?.message || 'Newsletter dispatch failed.').slice(0, 500), now(), campaign.id]);
      }
    }
  } finally { dispatching = false; }
}

async function sendBatch(id) {
  const campaign = await dbGet('SELECT * FROM newsletter_campaigns WHERE id=?', [id]);
  const setting = await settings();
  if (!setting?.verified_at) throw new Error('SMTP settings are missing or no longer verified.');
  const recipients = await dbAll("SELECT * FROM newsletter_subscribers WHERE status='active' AND id>? ORDER BY id LIMIT 50", [campaign.dispatch_cursor || '']);
  if (!recipients.length) {
    await dbRun("UPDATE newsletter_campaigns SET status='sent', sent_at=?, next_run_at=NULL, lease_until=NULL, updated_at=? WHERE id=?", [now(), now(), id]);
    return;
  }
  const client = await transport(setting, true);
  try {
    for (const subscriber of recipients) {
      const deliveryId = createHash('sha256').update(`${id}\0${subscriber.id}`).digest('hex');
      const date = now();
      const created = await dbRun(`INSERT OR IGNORE INTO newsletter_deliveries
        (id, campaign_id, subscriber_id, email, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'sending', ?, ?)`, [deliveryId, id, subscriber.id, subscriber.email, date, date]);
      if (!created.changes) continue;
      const message = emailDocument(campaign, subscriber, deliveryId, setting.public_origin);
      await incrementStat(dbRun, id, 'attempted');
      try {
        const response = await client.sendMail({
          from: { name: setting.from_name, address: setting.from_email },
          replyTo: setting.reply_to || undefined, to: subscriber.email,
          subject: message.subject, text: message.text, html: message.html,
          headers: { 'List-Unsubscribe': `<${message.unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        });
        const accepted = response.accepted.map(String).some((entry) => entry.toLowerCase() === subscriber.email);
        await incrementStat(dbRun, id, accepted ? 'accepted' : 'rejected');
        await dbRun('UPDATE newsletter_deliveries SET status=?, provider_message_id=?, error=?, updated_at=? WHERE id=?',
          [accepted ? 'accepted' : 'rejected', response.messageId || null, accepted ? null : 'Recipient was not accepted by SMTP.', now(), deliveryId]);
      } catch (error) {
        await incrementStat(dbRun, id, 'rejected');
        await dbRun("UPDATE newsletter_deliveries SET status='rejected', error=?, updated_at=? WHERE id=?",
          [String(error?.message || 'SMTP delivery failed.').slice(0, 500), now(), deliveryId]);
      }
    }
  } finally { client.close(); }
  await dbRun('UPDATE newsletter_campaigns SET dispatch_cursor=?, lease_until=NULL, next_run_at=?, updated_at=? WHERE id=?',
    [recipients.at(-1).id, now(), now(), id]);
}

export function startNewsletterDispatcher() {
  const timer = setInterval(() => { void dispatchNewsletterCampaigns().catch((error) => console.error('Newsletter scheduler failed:', error)); }, 10000);
  timer.unref?.();
  return timer;
}

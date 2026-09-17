import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const smtp = vi.hoisted(() => ({ messages: [], verify: vi.fn(async () => true) }));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({
  verify: smtp.verify,
  sendMail: async (message) => { smtp.messages.push(message); return { accepted: [message.to], messageId: 'test-message' }; },
  close: () => undefined,
}) } }));

const dataDir = mkdtempSync(join(tmpdir(), 'orbitpage-newsletter-'));
process.env.DATA_DIR = dataDir;
process.env.JWT_SECRET = 'newsletter-test-secret-with-at-least-thirty-two-characters';

let db;
let newsletter;
beforeAll(async () => {
  db = await import('../database.js');
  await db.initializeDatabase();
  newsletter = await import('./newsletter.js');
});
afterAll(async () => {
  if (db) await new Promise((resolve) => db.default.close(resolve));
  rmSync(dataDir, { recursive: true, force: true });
});

describe('self-hosted newsletter', () => {
  it('stores SMTP credentials encrypted and completes opt-in, delivery, tracking, and unsubscribe', async () => {
    await newsletter.saveSmtpSettings({
      host: 'smtp.example.com', port: 587, username: 'sender', password: 'private-smtp-password',
      fromName: 'OrbitPage Test', fromEmail: 'sender@example.com', replyTo: '',
    }, 'https://example.com');
    const setting = await db.dbGet('SELECT * FROM newsletter_settings WHERE id = 1');
    expect(setting.password_enc).not.toContain('private-smtp-password');
    expect(newsletter.decryptSmtpPassword(setting.password_enc)).toBe('private-smtp-password');

    await newsletter.testSmtp('sender@example.com');
    await newsletter.subscribe({ email: 'reader@example.com', name: 'Reader', consent: true });
    const pending = await db.dbGet('SELECT * FROM newsletter_subscribers WHERE email = ?', ['reader@example.com']);
    expect(pending.status).toBe('pending');
    const confirmUrl = smtp.messages.at(-1).text.match(/https:\/\/\S+/)[0];
    const confirmToken = new URL(confirmUrl).searchParams.get('token');
    await newsletter.confirmSubscription(confirmToken);
    expect((await db.dbGet('SELECT status FROM newsletter_subscribers WHERE id = ?', [pending.id])).status).toBe('active');
    await expect(newsletter.confirmSubscription(confirmToken)).rejects.toMatchObject({ code: 'NEWSLETTER_LINK_INVALID' });

    const campaign = await newsletter.saveCampaign({
      name: 'News', subject: 'Hello {{name}}', preheader: '',
      content: { eyebrow: '', headline: 'Hello', body: 'A useful update', ctaLabel: 'Read',
        ctaUrl: 'https://example.com/story', imageUrl: '', imageAlt: '', logoUrl: '',
        accentColor: '#2563eb', backgroundColor: '#eef2ff', contentColor: '#111827' },
    });
    await newsletter.queueCampaign(campaign.campaignId, null);
    await newsletter.dispatchNewsletterCampaigns();
    const result = await db.dbGet('SELECT * FROM newsletter_campaigns WHERE id = ?', [campaign.campaignId]);
    expect(result.status).toBe('sent');
    expect(JSON.parse(result.stats)).toMatchObject({ attempted: 1, accepted: 1, rejected: 0 });

    const sent = smtp.messages.at(-1);
    expect(sent.subject).toBe('Hello Reader');
    const delivery = await db.dbGet('SELECT * FROM newsletter_deliveries WHERE campaign_id = ?', [campaign.campaignId]);
    expect(delivery.status).toBe('accepted');
    const clickToken = new URL(sent.html.match(/https:\/\/example\.com\/api\/newsletter\/public\/click\?token=[^"<]+/)[0]).searchParams.get('token');
    expect(await newsletter.recordEvent(clickToken, 'click')).toBe('https://example.com/story');
    await newsletter.recordEvent(clickToken, 'click');
    const unsubToken = new URL(sent.headers['List-Unsubscribe'].slice(1, -1)).searchParams.get('token');
    await newsletter.unsubscribe(unsubToken);
    expect((await db.dbGet('SELECT status FROM newsletter_subscribers WHERE id = ?', [pending.id])).status).toBe('unsubscribed');
    expect(JSON.parse((await db.dbGet('SELECT stats FROM newsletter_campaigns WHERE id = ?', [campaign.campaignId])).stats))
      .toMatchObject({ clickedUnique: 1, unsubscribed: 1 });
  });
});

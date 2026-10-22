import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const smtp = vi.hoisted(() => ({ messages: [], options: [], verify: vi.fn(async () => true) }));
vi.mock('nodemailer', () => ({ default: { createTransport: (options) => { smtp.options.push(options); return ({
  verify: smtp.verify,
  sendMail: async (message) => { smtp.messages.push(message); return { accepted: [message.to], messageId: 'test-message' }; },
  close: () => undefined,
}); } } }));

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
  const connection = {
    host: 'smtp.example.com', port: 587, username: 'sender', password: 'original-password',
    fromName: 'Sender', fromEmail: 'sender@example.com', replyTo: '', senderType: 'business',
    footerText: '', senderAddress: '1 Test Street', privacyPolicyUrl: 'https://example.com/privacy',
    termsUrl: 'https://example.com/terms',
  };

  it.each([{ host: 'replacement.example.com' }, { port: 465 }, { username: 'replacement' }])(
    'requires a new password when connection identity changes: %j', async (change) => {
      await newsletter.saveSmtpSettings(connection, 'https://example.com');
      const before = await db.dbGet('SELECT * FROM newsletter_settings WHERE id = 1');
      for (const password of ['', undefined]) {
        await expect(newsletter.saveSmtpSettings({ ...connection, ...change, password }, 'https://example.com'))
          .rejects.toMatchObject({ status: 400, code: 'SMTP_PASSWORD_REQUIRED' });
        expect(await db.dbGet('SELECT * FROM newsletter_settings WHERE id = 1')).toEqual(before);
      }
      await newsletter.saveSmtpSettings({ ...connection, ...change, password: 'replacement-password' }, 'https://example.com');
      expect((await db.dbGet('SELECT * FROM newsletter_settings WHERE id = 1')).verified_at).toBeNull();
      await newsletter.testSmtp('sender@example.com');
      expect(smtp.options.at(-1)).toMatchObject({ ...Object.fromEntries(Object.entries(change).filter(([key]) => key !== 'username')), auth: { user: change.username || 'sender', pass: 'replacement-password' } });
    }
  );

  it('retains the secret for the same normalized connection and metadata-only changes', async () => {
    await newsletter.saveSmtpSettings(connection, 'https://example.com');
    const before = await db.dbGet('SELECT * FROM newsletter_settings WHERE id = 1');
    await newsletter.saveSmtpSettings({ ...connection, host: ' SMTP.EXAMPLE.COM. ', username: ' sender ', password: '', fromName: 'New name' }, 'https://example.com');
    expect((await db.dbGet('SELECT * FROM newsletter_settings WHERE id = 1')).password_enc).toBe(before.password_enc);
    await newsletter.testSmtp('sender@example.com');
    expect(smtp.options.at(-1)).toMatchObject({ host: 'smtp.example.com', auth: { user: 'sender', pass: 'original-password' } });
  });
  it('requires complete compliance data', () => {
    expect(newsletter.newsletterComplianceReady({ sender_address: 'Via Roma 1', privacy_policy_url: 'https://example.com/privacy', terms_url: '' })).toBe(false);
    expect(newsletter.newsletterComplianceReady({ sender_address: 'Via Roma 1', privacy_policy_url: 'https://example.com/privacy', terms_url: 'https://example.com/terms' })).toBe(true);
  });

  it('stores SMTP credentials encrypted and completes opt-in, delivery, tracking, and unsubscribe', async () => {
    await newsletter.saveSmtpSettings({
      host: 'smtp.example.com', port: 587, username: 'sender', password: 'private-smtp-password',
      fromName: 'OrbitPage Test', fromEmail: 'sender@example.com', replyTo: '',
      senderType: 'restaurant', footerText: 'Restaurant updates for confirmed subscribers.',
      senderAddress: '1 Test Street, Rome', privacyPolicyUrl: 'https://example.com/privacy',
      termsUrl: 'https://example.com/terms',
    }, 'https://example.com');
    const setting = await db.dbGet('SELECT * FROM newsletter_settings WHERE id = 1');
    expect(setting.password_enc).not.toContain('private-smtp-password');
    expect(newsletter.decryptSmtpPassword(setting.password_enc)).toBe('private-smtp-password');
    expect(setting).toMatchObject({ sender_type: 'restaurant', sender_address: '1 Test Street, Rome' });

    await newsletter.testSmtp('sender@example.com');
    const firstSignup = await newsletter.subscribe({ email: 'reader@example.com', name: 'Reader', consent: true, trackingConsent: true });
    let pending;
    await vi.waitFor(async () => {
      pending = await db.dbGet('SELECT * FROM newsletter_subscribers WHERE email = ?', ['reader@example.com']);
      expect(pending?.status).toBe('pending');
      expect(smtp.messages.at(-1)?.text).toContain('Confirm your subscription:');
    });
    expect(pending.status).toBe('pending');
    const confirmUrl = smtp.messages.at(-1).text.match(/https:\/\/\S+/)[0];
    const confirmToken = new URL(confirmUrl).searchParams.get('token');
    await newsletter.confirmSubscription(confirmToken);
    expect((await db.dbGet('SELECT status FROM newsletter_subscribers WHERE id = ?', [pending.id])).status).toBe('active');
    expect(await newsletter.subscribe({ email: 'reader@example.com', name: 'Reader', consent: true })).toEqual(firstSignup);
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
    expect(sent.text).toContain('Restaurant updates for confirmed subscribers.');
    expect(sent.html).toContain('https://example.com/privacy');
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

  it('keeps legacy and imported audiences untracked, omits remote images, and separates revocation from subscription', async () => {
    const subscriber = await newsletter.addSubscriber({ email: 'imported@example.test', consentConfirmed: true, source: 'import' });
    expect(subscriber.trackingConsentAt).toBeNull();
    expect(newsletter.publicSubscriberSchema.parse({ email: 'new@example.test', consent: true }).trackingConsent).toBe(false);
    expect(newsletter.subscriberSchema.safeParse({ email: 'bad@example.test', consentConfirmed: true, trackingConsent: true }).success).toBe(false);
    const campaign = await newsletter.saveCampaign({ name: 'Consent test', subject: 'News', content: {
      headline: 'News', body: 'Message', ctaLabel: 'Read', ctaUrl: 'https://example.test/story',
      imageUrl: 'https://example.test/image', logoUrl: 'https://example.test/logo',
      accentColor: '#000000', backgroundColor: '#ffffff', contentColor: '#000000',
    } });
    const campaignRow = await db.dbGet('SELECT * FROM newsletter_campaigns WHERE id=?', [campaign.campaignId]);
    let row = await db.dbGet('SELECT * FROM newsletter_subscribers WHERE id=?', [subscriber.subscriberId]);
    const setting = await db.dbGet('SELECT * FROM newsletter_settings WHERE id=1');
    const plain = newsletter.emailDocument(campaignRow, row, 'fixture-delivery', 'https://example.test', setting);
    expect(plain.html).not.toMatch(/<img |\/public\/(open|click)\?/);
    expect(plain.html).toContain('href="https://example.test/story"');
    const token = newsletter.signNewsletterToken({ action: 'tracking', subscriberId: row.id, consentAt: row.consent_at }, 86400);
    expect((await newsletter.trackingPreference(token)).enabled).toBe(false);
    await newsletter.trackingPreference(token, true);
    row = await db.dbGet('SELECT * FROM newsletter_subscribers WHERE id=?', [row.id]);
    expect(row.tracking_consent_source).toBe('preferences');
    const instrumented = newsletter.emailDocument(campaignRow, row, 'fixture-delivery', 'https://example.test', setting);
    expect(instrumented.html).toMatch(/<img /);
    expect(instrumented.html).toContain('/public/open?');
    await db.dbRun(`INSERT INTO newsletter_deliveries (id, campaign_id, subscriber_id, email, status, created_at, updated_at, tracking_consent_id)
      VALUES (?, ?, ?, ?, 'accepted', ?, ?, ?)`, ['fixture-delivery', campaign.campaignId, row.id, row.email, row.created_at, row.updated_at, row.tracking_consent_id]);
    const click = newsletter.signNewsletterToken({ action: 'click', subscriberId: row.id, campaignId: campaign.campaignId, deliveryId: 'fixture-delivery', url: 'https://example.test/story' }, 86400);
    const open = newsletter.signNewsletterToken({ action: 'open', subscriberId: row.id, campaignId: campaign.campaignId, deliveryId: 'fixture-delivery' }, 86400);
    await newsletter.trackingPreference(token, false);
    expect((await db.dbGet('SELECT * FROM newsletter_subscribers WHERE id=?', [row.id])).status).toBe('active');
    expect(await newsletter.recordEvent(click, 'click')).toBe('https://example.test/story');
    await newsletter.recordEvent(open, 'open');
    await newsletter.trackingPreference(token, true);
    await newsletter.recordEvent(open, 'open');
    expect(await db.dbGet('SELECT * FROM newsletter_deliveries WHERE id=?', ['fixture-delivery'])).toMatchObject({ opened_at: null, clicked_at: null });
    await db.dbRun('UPDATE newsletter_subscribers SET consent_at=? WHERE id=?', ['new-subscription', row.id]);
    await expect(newsletter.trackingPreference(token, true)).rejects.toMatchObject({ status: 410 });
  });
});

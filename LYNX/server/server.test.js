import { beforeEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Mock database.js before importing server.js
vi.mock('./database.js', () => ({
  initializeDatabase: vi.fn().mockResolvedValue(true),
  dbGet: vi.fn(),
  dbAll: vi.fn(),
  dbRun: vi.fn(),
  withTransaction: vi.fn(cb => cb())
}));

// Mock auth.js
vi.mock('./auth.js', () => ({
  isFirstTimeSetup: vi.fn(),
  setupInitialCredentials: vi.fn(),
  authenticateUser: vi.fn(),
  generateToken: vi.fn(() => 'mock-token'),
  verifyToken: vi.fn(),
  authenticateToken: (req, res, next) => {
    req.user = { username: 'admin' };
    next();
  },
  isPasswordStrong: vi.fn(() => true),
  generateSecurePassword: vi.fn(() => 'SecurePass123!')
}));

// Now import app
import { app } from './server.js';
import { isFirstTimeSetup } from './auth.js';
import { dbAll, dbGet, dbRun } from './database.js';

describe('API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /health should return 200 and status ok', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('GET /api/auth/setup-status should return setup status', async () => {
    vi.mocked(isFirstTimeSetup).mockResolvedValue(true);
    const response = await request(app).get('/api/auth/setup-status');
    expect(response.status).toBe(200);
    expect(response.body.isFirstTimeSetup).toBe(true);
  });

  it('GET /api/public-page should return profile, links, and theme in one response', async () => {
    vi.mocked(dbGet)
      .mockResolvedValueOnce({
        name: 'Paolo',
        bio: 'Test bio',
        avatar: '/uploads/avatar.png',
        social_links: '{"github":"https://github.com/example"}',
        show_avatar: 1,
        name_font_size: '2rem',
        bio_font_size: '14px',
        tab_title: 'Custom title',
        privacy_policy_url: 'https://example.com/privacy',
        cookie_policy_url: 'https://example.com/cookies',
      })
      .mockResolvedValueOnce({
        primary_color: '#111111',
        background_color: '#ffffff',
        text_color: '#222222',
        full_config: JSON.stringify({ primary: '#111111', background: '#ffffff', foreground: '#222222' }),
      });
    vi.mocked(dbAll).mockResolvedValueOnce([
      {
        id: '1',
        title: 'Example',
        description: '',
        url: 'https://example.com',
        type: 'link',
        is_active: 1,
        sort_order: 0,
      },
    ]);

    const response = await request(app).get('/api/public-page');

    expect(response.status).toBe(200);
    expect(response.body.profile.name).toBe('Paolo');
    expect(response.body.profile.privacy_policy_url).toBe('https://example.com/privacy');
    expect(response.body.profile.cookie_policy_url).toBe('https://example.com/cookies');
    expect(response.body.links).toHaveLength(1);
    expect(response.body.theme.primary).toBe('#111111');
  });

  it('PUT /api/profile persists legal policy URLs in profile_data', async () => {
    vi.mocked(dbGet).mockResolvedValueOnce({ id: 1 });
    vi.mocked(dbRun).mockResolvedValueOnce({ changes: 1 });

    const response = await request(app)
      .put('/api/profile')
      .send({
        name: 'Paolo',
        bio: '',
        avatar: '',
        social_links: {},
        privacy_policy_url: ' https://example.com/privacy ',
        cookie_policy_url: 'https://example.com/cookies',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(vi.mocked(dbRun).mock.calls[0][0]).toContain('privacy_policy_url');
    expect(vi.mocked(dbRun).mock.calls[0][1]).toContain('https://example.com/privacy');
    expect(vi.mocked(dbRun).mock.calls[0][1]).toContain('https://example.com/cookies');
  });

  it('PUT /api/profile accepts the built-in /privacy route as a legal URL', async () => {
    vi.mocked(dbGet).mockResolvedValueOnce({ id: 1 });
    vi.mocked(dbRun).mockResolvedValueOnce({ changes: 1 });

    const response = await request(app)
      .put('/api/profile')
      .send({
        name: 'Paolo',
        bio: '',
        avatar: '',
        social_links: {},
        privacy_policy_url: '/privacy',
        cookie_policy_url: '',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(vi.mocked(dbRun).mock.calls[0][1]).toContain('/privacy');
  });

  it('GET /api/consent-config/public derives policy URLs from Profile', async () => {
    vi.mocked(dbGet)
      .mockResolvedValueOnce({
        mode: 'hardcoded',
        enabled: 1,
        full_config: JSON.stringify({
          legalPolicies: {
            showFooterLinks: true,
            privacyPolicy: { mode: 'external', externalUrl: 'https://legacy.example/privacy' },
            cookiePolicy: { mode: 'external', externalUrl: 'https://legacy.example/cookies' },
          },
          hardcoded: {
            urls: {
              privacyPolicy: 'https://legacy.example/privacy',
              cookiePolicy: 'https://legacy.example/cookies',
            },
          },
          builder: { providerConfig: {} },
        }),
      })
      .mockResolvedValueOnce({
        privacy_policy_url: 'https://example.com/privacy',
        cookie_policy_url: 'https://example.com/cookies',
      });

    const response = await request(app).get('/api/consent-config/public');

    expect(response.status).toBe(200);
    expect(response.body.data.hardcoded.urls.privacyPolicy).toBe('https://example.com/privacy');
    expect(response.body.data.hardcoded.urls.cookiePolicy).toBe('https://example.com/cookies');
    expect(response.body.data.legalPolicies.privacyPolicy.externalUrl).toBe('https://example.com/privacy');
    expect(response.body.data.legalPolicies.cookiePolicy.externalUrl).toBe('https://example.com/cookies');
  });

  it('GET /api/consent-config/public returns legal policies even when consent is disabled', async () => {
    vi.mocked(dbGet)
      .mockResolvedValueOnce({
        mode: 'hardcoded',
        enabled: 0,
        full_config: JSON.stringify({
          legalPolicies: {
            showFooterLinks: true,
            privacyPolicy: { mode: 'hosted', hostedText: 'Current privacy text' },
            cookiePolicy: { mode: 'embedded', embeddedCode: '<div>Cookie policy</div>' },
          },
        }),
      })
      .mockResolvedValueOnce({
        privacy_policy_url: '/privacy',
        cookie_policy_url: '/cookies',
      });

    const response = await request(app).get('/api/consent-config/public');

    expect(response.status).toBe(200);
    expect(response.body.data.mode).toBe('disabled');
    expect(response.body.data.enabled).toBe(false);
    expect(response.body.data.legalPolicies.privacyPolicy.mode).toBe('hosted');
    expect(response.body.data.legalPolicies.privacyPolicy.hostedText).toBe('Current privacy text');
    expect(response.body.data.legalPolicies.cookiePolicy.mode).toBe('embedded');
    expect(response.body.data.legalPolicies.cookiePolicy.embeddedCode).toBe('<div>Cookie policy</div>');
  });

  it('GET / injects Google Consent Mode defaults before the app when analytics and consent are enabled', async () => {
    vi.mocked(dbGet)
      .mockResolvedValueOnce({ google_analytics_id: 'G-TEST123' })
      .mockResolvedValueOnce({ mode: 'hardcoded', enabled: 1, full_config: JSON.stringify({}) });

    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.text).toContain('id="lynx-gcm-default-consent"');
    expect(response.text).toContain("'ad_storage': 'denied'");
    expect(response.text).toContain("'analytics_storage': 'denied'");
    expect(response.text).toContain("'ad_user_data': 'denied'");
    expect(response.text).toContain("'ad_personalization': 'denied'");
    expect(response.text.indexOf('id="lynx-gcm-default-consent"')).toBeLessThan(
      response.text.indexOf('<script type="module"')
    );
  });

  it('GET / does not inject Google Consent Mode defaults when consent is disabled', async () => {
    vi.mocked(dbGet)
      .mockResolvedValueOnce({ google_analytics_id: 'G-TEST123' })
      .mockResolvedValueOnce({ mode: 'disabled', enabled: 0, full_config: JSON.stringify({}) });

    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.text).not.toContain('id="lynx-gcm-default-consent"');
  });

  it('GET / does not duplicate Google Consent Mode defaults from an advanced provider snippet', async () => {
    vi.mocked(dbGet)
      .mockResolvedValueOnce({ google_analytics_id: 'G-TEST123' })
      .mockResolvedValueOnce({
        mode: 'builder',
        enabled: 1,
        full_config: JSON.stringify({
          builder: {
            providerConfig: {
              headSnippet: "gtag('consent', 'default', { ad_storage: 'denied' });",
            },
          },
        }),
      });

    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.text).not.toContain('id="lynx-gcm-default-consent"');
  });
});

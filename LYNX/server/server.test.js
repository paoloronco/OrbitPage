import { beforeEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.hoisted(() => {
  process.env.BASE_PATH = '/lynx';
});

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
import { app, stripStaticSeoTags } from './server.js';
import { isFirstTimeSetup } from './auth.js';
import { dbAll, dbGet, dbRun } from './database.js';

describe('API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbGet).mockResolvedValue(null);
    vi.mocked(dbAll).mockResolvedValue([]);
    vi.mocked(dbRun).mockResolvedValue({ changes: 1 });
  });

  it('GET /health should return 200 and status ok', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('sets CSP sources needed by embedded legal policy providers', async () => {
    const response = await request(app).get('/health');
    const csp = response.headers['content-security-policy'];

    expect(csp).toContain('script-src');
    expect(csp).toContain('connect-src');
    expect(csp).toContain('frame-src');
    expect(csp).toContain('https://*.usercentrics.eu');
    expect(csp).toContain('https://*.cmp.usercentrics.eu');
    expect(csp).toContain('https://*.iubenda.com');
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

  it('GET /lynx/api/public-page should serve the same API through BASE_PATH', async () => {
    vi.mocked(dbGet)
      .mockResolvedValueOnce({
        name: 'Paolo',
        bio: 'Test bio',
        avatar: '/uploads/avatar.png',
        social_links: '{}',
        show_avatar: 1,
      })
      .mockResolvedValueOnce({
        full_config: JSON.stringify({ primary: '#111111', background: '#ffffff', foreground: '#222222' }),
      });
    vi.mocked(dbAll).mockResolvedValueOnce([]);

    const response = await request(app).get('/lynx/api/public-page');

    expect(response.status).toBe(200);
    expect(response.body.profile.name).toBe('Paolo');
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

  it('GET /api/consent-config/public infers hosted legal policy mode from legacy local URLs', async () => {
    vi.mocked(dbGet)
      .mockResolvedValueOnce({
        mode: 'hardcoded',
        enabled: 1,
        full_config: JSON.stringify({ hardcoded: { urls: {} }, builder: { providerConfig: {} } }),
      })
      .mockResolvedValueOnce({
        privacy_policy_url: '/privacy',
        cookie_policy_url: '/cookies',
      });

    const response = await request(app).get('/api/consent-config/public');

    expect(response.status).toBe(200);
    expect(response.body.data.legalPolicies.privacyPolicy.mode).toBe('hosted');
    expect(response.body.data.legalPolicies.cookiePolicy.mode).toBe('hosted');
    expect(response.body.data.legalPolicies.privacyPolicy.externalUrl).toBe('/privacy');
    expect(response.body.data.legalPolicies.cookiePolicy.externalUrl).toBe('/cookies');
  });

  it('GET / serves profile-specific SEO metadata and crawlable fallback links', async () => {
    vi.mocked(dbGet).mockResolvedValueOnce({
      name: 'Paolo',
      bio: 'Developer and maker',
      avatar: '/uploads/avatar.png',
      social_links: '{"github":"https://github.com/example"}',
      show_avatar: 1,
      tab_title: 'Paolo Links',
      meta_description: 'All of Paolo links in one place.',
    });
    vi.mocked(dbAll).mockResolvedValueOnce([
      {
        id: '1',
        title: 'GitHub',
        description: 'Open-source work',
        url: 'https://github.com/example',
        type: 'link',
        is_active: 1,
        sort_order: 0,
      },
    ]);

    const response = await request(app)
      .get('/')
      .set('Host', 'links.example.test')
      .set('X-Forwarded-Proto', 'https');

    expect(response.status).toBe(200);
    expect(response.text).toContain('<title>Paolo Links</title>');
    expect(response.text).toContain('content="All of Paolo links in one place."');
    expect(response.text).toContain('<link rel="canonical" href="https://links.example.test/"');
    expect(response.text).toContain('<meta property="og:url" content="https://links.example.test/"');
    expect(response.text).toContain('id="lynx-structured-data"');
    expect(response.text).toContain('<noscript>');
    expect(response.text).toContain('href="https://github.com/example"');
    expect(response.text).toContain('src="/assets/');
    expect(response.text).toContain('href="/assets/');
    expect(response.text).not.toContain('src="./assets/');
  });

  it('GET /lynx serves the SPA with base-path-aware metadata and runtime config', async () => {
    vi.mocked(dbGet).mockResolvedValueOnce({
      name: 'Paolo',
      bio: 'Developer and maker',
      avatar: '/uploads/avatar.png',
      social_links: '{}',
      show_avatar: 1,
      tab_title: 'Paolo Links',
      meta_description: 'All of Paolo links in one place.',
    });
    vi.mocked(dbAll).mockResolvedValueOnce([]);

    const response = await request(app)
      .get('/lynx')
      .set('Host', 'links.example.test')
      .set('X-Forwarded-Proto', 'https');

    expect(response.status).toBe(200);
    expect(response.text).toContain('window.__LYNX_BASE_PATH__="/lynx"');
    expect(response.text).toContain('<link rel="canonical" href="https://links.example.test/lynx/"');
    expect(response.text).toContain('<meta property="og:url" content="https://links.example.test/lynx/"');
    expect(response.text).toContain('src="/lynx/assets/');
    expect(response.text).toContain('href="/lynx/assets/');
    expect(response.text).not.toContain('src="/assets/');
    expect(response.text).not.toContain('href="/assets/');
  });

  it('removes static structured-data scripts even when nested markup reintroduces a script tag', () => {
    const html = [
      '<head>',
      '<scr<script type="application/ld+json">{"stale":true}</script>ipt type="application/ld+json">{"unsafe":true}</script>',
      '<title>Old title</title>',
      '</head>',
    ].join('');

    const stripped = stripStaticSeoTags(html);

    expect(stripped).not.toContain('application/ld+json');
    expect(stripped).not.toContain('<script');
    expect(stripped).not.toContain('<title>');
  });

  it('GET /robots.txt points crawlers to the dynamic sitemap and blocks private routes', async () => {
    const response = await request(app)
      .get('/robots.txt')
      .set('Host', 'links.example.test')
      .set('X-Forwarded-Proto', 'https');

    expect(response.status).toBe(200);
    expect(response.text).toContain('Allow: /');
    expect(response.text).toContain('Disallow: /admin');
    expect(response.text).toContain('Disallow: /api');
    expect(response.text).toContain('Disallow: /lynx/admin');
    expect(response.text).toContain('Disallow: /lynx/api');
    expect(response.text).toContain('Sitemap: https://links.example.test/sitemap.xml');
    expect(response.text).toContain('Sitemap: https://links.example.test/lynx/sitemap.xml');
  });

  it('GET /sitemap.xml includes the canonical home page', async () => {
    vi.mocked(dbGet).mockResolvedValueOnce({
      privacy_policy_url: '/privacy',
      cookie_policy_url: '/cookies',
    });

    const response = await request(app)
      .get('/sitemap.xml')
      .set('Host', 'links.example.test')
      .set('X-Forwarded-Proto', 'https');

    expect(response.status).toBe(200);
    expect(response.text).toContain('<loc>https://links.example.test/</loc>');
    expect(response.text).toContain('<loc>https://links.example.test/privacy</loc>');
    expect(response.text).toContain('<loc>https://links.example.test/cookies</loc>');
  });

  it('GET /lynx/sitemap.xml includes BASE_PATH-prefixed canonical URLs', async () => {
    vi.mocked(dbGet).mockResolvedValueOnce({
      privacy_policy_url: '/privacy',
      cookie_policy_url: '/cookies',
    });

    const response = await request(app)
      .get('/lynx/sitemap.xml')
      .set('Host', 'links.example.test')
      .set('X-Forwarded-Proto', 'https');

    expect(response.status).toBe(200);
    expect(response.text).toContain('<loc>https://links.example.test/lynx/</loc>');
    expect(response.text).toContain('<loc>https://links.example.test/lynx/privacy</loc>');
    expect(response.text).toContain('<loc>https://links.example.test/lynx/cookies</loc>');
  });

  it('GET /lynx/admin serves the admin route with noindex headers', async () => {
    const response = await request(app).get('/lynx/admin');

    expect(response.status).toBe(200);
    expect(response.headers['x-robots-tag']).toContain('noindex');
    expect(response.text).toContain('<meta name="robots" content="noindex, nofollow, noarchive"');
  });

  it('unknown SPA routes return 404 and noindex to avoid duplicate indexed pages', async () => {
    const response = await request(app).get('/not-a-real-page');

    expect(response.status).toBe(404);
    expect(response.headers['x-robots-tag']).toContain('noindex');
    expect(response.text).toContain('<meta name="robots" content="noindex, nofollow, noarchive"');
  });

  it('GET / does not inject any Google tracking bootstrap before consent', async () => {
    vi.mocked(dbGet)
      .mockResolvedValueOnce({ google_analytics_id: 'G-TEST123' })
      .mockResolvedValueOnce({ mode: 'hardcoded', enabled: 1, full_config: JSON.stringify({}) });

    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.text).not.toContain('id="lynx-gcm-default-consent"');
    expect(response.text).not.toContain('googletagmanager.com/gtag/js');
    expect(response.text).not.toContain('window.dataLayer');
    expect(response.text).not.toContain('function gtag');
    expect(response.text).not.toContain("gtag('js'");
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

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.hoisted(() => {
  process.env.BASE_PATH = '/orbitpage';
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
  requirePermission: vi.fn(() => (req, res, next) => next()),
  requireAnyPermission: vi.fn(() => (req, res, next) => next()),
  isPasswordStrong: vi.fn(() => true),
  generateSecurePassword: vi.fn(() => 'SecurePass123!')
}));

vi.mock('./services/backup-service.js', () => ({
  createApplicationBackup: vi.fn(),
  restoreApplicationBackup: vi.fn(),
}));

// Now import app
import { app, buildStructuredData, renderSeoTags, stripStaticSeoTags } from './server.js';
import { isFirstTimeSetup, setupInitialCredentials, verifyToken } from './auth.js';
import { dbAll, dbGet, dbRun, withTransaction } from './database.js';
import { createApplicationBackup, restoreApplicationBackup } from './services/backup-service.js';

describe('API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbGet).mockResolvedValue(null);
    vi.mocked(dbAll).mockResolvedValue([]);
    vi.mocked(dbRun).mockResolvedValue({ changes: 1 });
    vi.mocked(withTransaction).mockImplementation(cb => cb());
    vi.mocked(isFirstTimeSetup).mockResolvedValue(false);
    vi.mocked(createApplicationBackup).mockResolvedValue({
      schemaVersion: 1,
      appVersion: 'test',
      createdAt: '2026-07-09T00:00:00.000Z',
      tables: {},
      uploads: [],
    });
    vi.mocked(restoreApplicationBackup).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
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
    expect(csp).toContain('https://cdn-cookieyes.com');
    expect(csp).toContain('https://cdn.cookielaw.org');
    expect(csp).toContain('https://privacyportal.onetrust.com');
    expect(csp).toContain('https://geolocation.onetrust.com');
  });

  it('HTTP response: no Strict-Transport-Security header', async () => {
    // supertest connects via plain HTTP so req.protocol === 'http'.
    // HSTS must not be sent on non-HTTPS connections — browsers that honour it
    // would pin the site to HTTPS even when served on plain HTTP, breaking assets.
    const response = await request(app).get('/health');
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  it('HTTP response: CSP does not contain upgrade-insecure-requests', async () => {
    // upgrade-insecure-requests in CSP tells browsers to rewrite every http://
    // subresource URL to https:// — on a plain-HTTP server this breaks all assets
    // (JS chunks, CSS, uploads/videos) because the HTTPS port is not listening.
    const response = await request(app).get('/health');
    const csp = response.headers['content-security-policy'];
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('CSP contains media-src self for local video/image uploads', async () => {
    const response = await request(app).get('/health');
    const csp = response.headers['content-security-policy'];
    expect(csp).toContain("media-src 'self'");
  });

  it('GET /api/auth/setup-status should return setup status', async () => {
    vi.mocked(isFirstTimeSetup).mockResolvedValueOnce(true);
    const response = await request(app).get('/api/auth/setup-status');
    expect(response.status).toBe(200);
    expect(response.body.isFirstTimeSetup).toBe(true);
    expect(response.body.username).toBe('admin');
    expect(response.body.usernameLocked).toBe(true);
    expect(response.body.dependencies).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'runtime', ok: true }),
      expect.objectContaining({ id: 'database', ok: true }),
      expect.objectContaining({ id: 'storage', ok: true }),
      expect.objectContaining({ id: 'frontend', ok: true }),
    ]));
    expect(response.headers['cache-control']).toContain('no-store');
  });

  it('POST /api/auth/setup creates the fixed administrator and primary page slug atomically', async () => {
    vi.mocked(dbGet).mockResolvedValue(null);

    const response = await request(app)
      .post('/api/auth/setup')
      .send({ password: 'StrongPassword1!', slug: 'my-public-page' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, token: 'mock-token', pageSlug: 'my-public-page' });
    expect(withTransaction).toHaveBeenCalledOnce();
    expect(setupInitialCredentials).toHaveBeenCalledWith('StrongPassword1!');
    expect(dbRun).toHaveBeenCalledWith(expect.stringContaining('instance_settings'), ['my-public-page']);
    expect(dbRun).toHaveBeenCalledWith(expect.stringContaining('admin_onboarding_enabled'));
  });

  it('POST /api/auth/setup rejects reserved or ambiguous page slugs', async () => {
    const reserved = await request(app)
      .post('/api/auth/setup')
      .send({ password: 'StrongPassword1!', slug: 'dashboard' });
    const ambiguous = await request(app)
      .post('/api/auth/setup')
      .send({ password: 'StrongPassword1!', slug: 'my--page' });

    expect(reserved.status).toBe(400);
    expect(ambiguous.status).toBe(400);
    expect(setupInitialCredentials).not.toHaveBeenCalled();
  });

  it('GET /api/admin/backup downloads a complete backup payload', async () => {
    vi.mocked(createApplicationBackup).mockResolvedValueOnce({
      schemaVersion: 1,
      appVersion: '4.3.18',
      createdAt: '2026-07-09T00:00:00.000Z',
      tables: { profile_data: [{ id: 1, name: 'Paolo' }] },
      uploads: [{ path: 'avatar.png', data: 'YXZhdGFy' }],
    });

    const response = await request(app).get('/api/admin/backup');

    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toContain('orbitpage-backup-');
    expect(response.body.tables.profile_data[0].name).toBe('Paolo');
    expect(response.body.uploads[0].path).toBe('avatar.png');
    expect(createApplicationBackup).toHaveBeenCalledWith({
      appVersion: expect.any(String),
      dbAll,
      uploadsPath: expect.any(String),
    });
  });

  it('persists and reloads isolated public subpages', async () => {
    const page = {
      id: 'services-page', slug: 'services', title: 'Services', description: 'What we do', links: [], enabled: true,
      createdAt: '2026-07-21T08:00:00.000Z', updatedAt: '2026-07-21T08:00:00.000Z',
    };
    const saved = await request(app).put('/orbitpage/api/subpages').send([page]);
    expect(saved.status).toBe(200);
    expect(saved.body.data[0].slug).toBe('services');
    expect(dbRun).toHaveBeenCalledWith(expect.stringContaining('subpages_config'), [expect.any(String)]);

    vi.mocked(dbGet).mockResolvedValueOnce({ full_config: JSON.stringify([page]) });
    const loaded = await request(app).get('/orbitpage/api/subpages');
    expect(loaded.status).toBe(200);
    expect(loaded.body).toEqual([page]);
  });

  it('rejects duplicate or reserved subpage slugs', async () => {
    const base = { id: 'one', title: 'Page', description: '', links: [], enabled: true };
    const reserved = await request(app).put('/orbitpage/api/subpages').send([{ ...base, slug: 'admin' }]);
    expect(reserved.status).toBe(400);
    const duplicate = await request(app).put('/orbitpage/api/subpages').send([
      { ...base, slug: 'events' },
      { ...base, id: 'two', slug: 'events' },
    ]);
    expect(duplicate.status).toBe(400);
  });

  it('GET /api/admin/backup forwards an explicit section selection', async () => {
    vi.mocked(createApplicationBackup).mockResolvedValueOnce({
      schemaVersion: 2,
      includedSections: ['profile', 'theme'],
      tables: { profile_data: [], theme_config: [] },
      uploads: [],
    });

    const response = await request(app).get('/api/admin/backup?sections=profile,theme');

    expect(response.status).toBe(200);
    expect(createApplicationBackup).toHaveBeenCalledWith({
      appVersion: expect.any(String),
      dbAll,
      uploadsPath: expect.any(String),
      sections: ['profile', 'theme'],
    });
  });

  it('POST /api/admin/restore restores a backup inside a transaction', async () => {
    const backup = {
      schemaVersion: 1,
      tables: { profile_data: [{ id: 1, name: 'Restored' }] },
      uploads: [],
    };

    const response = await request(app)
      .post('/api/admin/restore')
      .send(backup);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(withTransaction).toHaveBeenCalled();
    expect(restoreApplicationBackup).toHaveBeenCalledWith({
      backup,
      dbRun,
      uploadsPath: expect.any(String),
    });
  });

  it('POST /api/admin/restore forwards a selective restore without changing the backup', async () => {
    const backup = {
      schemaVersion: 1,
      tables: { profile_data: [{ id: 1, name: 'Restored' }] },
      uploads: [],
    };

    const response = await request(app)
      .post('/api/admin/restore')
      .send({ backup, sections: ['profile'] });

    expect(response.status).toBe(200);
    expect(restoreApplicationBackup).toHaveBeenCalledWith({
      backup,
      sections: ['profile'],
      dbRun,
      uploadsPath: expect.any(String),
    });
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

  it('GET /api/public-page hides draft, expired, and out-of-window links', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T10:30:00.000Z'));

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
    vi.mocked(dbAll).mockResolvedValueOnce([
      {
        id: 'draft-link',
        title: 'Draft',
        url: 'https://example.com/draft',
        type: 'link',
        is_active: 1,
        status: 'draft',
        sort_order: 0,
      },
      {
        id: 'expired-status-link',
        title: 'Expired Status',
        url: 'https://example.com/expired-status',
        type: 'link',
        is_active: 1,
        status: 'expired',
        sort_order: 1,
      },
      {
        id: 'future-link',
        title: 'Future',
        url: 'https://example.com/future',
        type: 'link',
        is_active: 1,
        status: 'live',
        start_date: '2026-07-11',
        sort_order: 2,
      },
      {
        id: 'before-hours-link',
        title: 'Before Hours',
        url: 'https://example.com/before-hours',
        type: 'link',
        is_active: 1,
        status: 'live',
        start_date: '2026-07-10',
        start_time: '11:00',
        sort_order: 3,
      },
      {
        id: 'current-link',
        title: 'Current',
        url: 'https://example.com/current',
        type: 'link',
        is_active: 1,
        status: 'live',
        start_date: '2026-07-10',
        start_time: '09:00',
        end_date: '2026-07-10',
        end_time: '12:00',
        sort_order: 4,
      },
      {
        id: 'legacy-live-link',
        title: 'Legacy Live',
        url: 'https://example.com/legacy',
        type: 'link',
        is_active: 1,
        sort_order: 5,
      },
    ]);

    const response = await request(app).get('/api/public-page');

    expect(response.status).toBe(200);
    expect(response.body.links.map((link) => link.id)).toEqual(['current-link', 'legacy-live-link']);
    expect(response.body.links[0]).toMatchObject({
      status: 'live',
      startDate: '2026-07-10',
      startTime: '09:00',
      endDate: '2026-07-10',
      endTime: '12:00',
    });
    expect(response.body.links[1].status).toBe('live');
  });

  it('GET /api/links includes campaign scheduling fields for admins', async () => {
    vi.mocked(verifyToken).mockReturnValue({ username: 'admin' });
    vi.mocked(dbAll).mockResolvedValueOnce([
      {
        id: 'campaign-link',
        title: 'Campaign Link',
        description: '',
        url: 'https://example.com',
        type: 'link',
        is_active: 1,
        status: 'live',
        campaign_name: 'Summer launch',
        start_date: '2026-07-10',
        start_time: '09:00',
        end_date: '2026-07-12',
        end_time: '18:30',
        timezone: 'Europe/Rome',
        sort_order: 0,
      },
    ]);

    const response = await request(app)
      .get('/api/links')
      .set('Authorization', 'Bearer mock-token');

    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({
      id: 'campaign-link',
      status: 'live',
      campaignName: 'Summer launch',
      startDate: '2026-07-10',
      startTime: '09:00',
      endDate: '2026-07-12',
      endTime: '18:30',
      timezone: 'Europe/Rome',
    });
  });

  it('GET /orbitpage/api/public-page should serve the same API through BASE_PATH', async () => {
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

    const response = await request(app).get('/orbitpage/api/public-page');

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

  it('PUT /api/profile persists contextual profile presets and rounded avatars', async () => {
    vi.mocked(dbGet).mockResolvedValueOnce({ id: 1, appearance: '{}' });
    vi.mocked(dbRun).mockResolvedValueOnce({ changes: 1 });

    const response = await request(app)
      .put('/api/profile')
      .send({
        name: 'Orbit Studio',
        bio: 'Independent design practice.',
        avatar: '',
        social_links: {},
        appearance: {
          profilePreset: 'studio',
          profileDetails: {
            primary: 'Brand and digital design',
            secondary: 'Turin, Italy',
          },
          avatarShape: 'rounded',
          cardBorderEnabled: false,
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    const savedAppearance = JSON.parse(vi.mocked(dbRun).mock.calls[0][1][15]);
    expect(savedAppearance).toEqual({
      profilePreset: 'studio',
      profileDetails: {
        primary: 'Brand and digital design',
        secondary: 'Turin, Italy',
      },
      avatarShape: 'rounded',
      cardBorderEnabled: false,
    });
  });

  it('PUT /api/theme accepts and persists modern profile and content card palettes', async () => {
    const response = await request(app)
      .put('/api/theme')
      .send({
        primary: '#2f81f7',
        background: '#0d1117',
        foreground: '#e6edf3',
        profileCard: {
          background: '#1c2433',
          backgroundSecondary: '#21303f',
          foreground: '#e6edf3',
          muted: '#8b949e',
          border: '#21262d',
          accent: '#2f81f7',
          direction: '135deg',
        },
        contentCard: {
          background: '#111827',
          backgroundSecondary: '#1f2937',
          foreground: '#f8fafc',
          muted: '#aebbd0',
          border: '#334155',
          accent: '#3b82f6',
          accentForeground: '#f8fafc',
          direction: '145deg',
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    const savedTheme = JSON.parse(vi.mocked(dbRun).mock.calls[0][1][3]);
    expect(savedTheme.profileCard.background).toBe('#1c2433');
    expect(savedTheme.contentCard.accentForeground).toBe('#f8fafc');
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
    expect(response.text).toContain('id="orbitpage-structured-data"');
    expect(response.text).toContain('<noscript>');
    expect(response.text).toContain('href="https://github.com/example"');
    expect(response.text).toContain('src="/assets/');
    expect(response.text).toContain('href="/assets/');
    expect(response.text).toContain('href="/brand/orbitpage-mark.svg"');
    expect(response.text).not.toContain('src="./assets/');
    expect(response.text).not.toContain('href="./brand/');
  });

  it('GET /orbitpage serves the SPA with base-path-aware metadata and runtime config', async () => {
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
      .get('/orbitpage')
      .set('Host', 'links.example.test')
      .set('X-Forwarded-Proto', 'https');

    expect(response.status).toBe(200);
    expect(response.text).toContain('window.__ORBITPAGE_BASE_PATH__="/orbitpage"');
    expect(response.text).toContain('<link rel="canonical" href="https://links.example.test/orbitpage/"');
    expect(response.text).toContain('<meta property="og:url" content="https://links.example.test/orbitpage/"');
    expect(response.text).toContain('src="/orbitpage/assets/');
    expect(response.text).toContain('href="/orbitpage/assets/');
    expect(response.text).toContain('href="/orbitpage/brand/orbitpage-mark.svg"');
    expect(response.text).not.toContain('src="/assets/');
    expect(response.text).not.toContain('href="/assets/');
    expect(response.text).not.toContain('href="./brand/');
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

  it('renders rich SEO tags for the demo about page', () => {
    const structuredData = buildStructuredData({
      profile: { name: 'OrbitPage', social_links: {} },
      links: [],
      origin: 'https://orbitpage-demo.paoloronco.it',
      canonicalUrl: 'https://orbitpage-demo.paoloronco.it/about',
      pageKind: 'about',
    });

    const tags = renderSeoTags({
      title: 'OrbitPage | Self-hosted Public Page Manager',
      description: 'OrbitPage is an open-source, self-hosted public page manager for people, brands, venues, events, and teams that want one place for links, content, analytics, privacy controls, and backups.',
      canonicalUrl: 'https://orbitpage-demo.paoloronco.it/about',
      imageUrl: 'https://raw.githubusercontent.com/paoloronco/OrbitPage/main/docs/screenshots/01-public-page.png',
      imageAlt: 'Screenshot of an OrbitPage public page',
      keywords: 'self-hosted public page, open-source landing page, Docker link page, privacy-friendly page manager, OrbitPage',
      robots: 'index, follow, max-image-preview:large',
      structuredData,
      basePath: '',
    });

    expect(tags).toContain('<title>OrbitPage | Self-hosted Public Page Manager</title>');
    expect(tags).toContain('<link rel="canonical" href="https://orbitpage-demo.paoloronco.it/about"');
    expect(tags).toContain('<meta name="keywords" content="self-hosted public page');
    expect(tags).toContain('<meta property="og:image:alt" content="Screenshot of an OrbitPage public page"');
    expect(tags).toContain('<meta property="og:image:width" content="1919"');
    expect(tags).toContain('<meta name="twitter:image:alt" content="Screenshot of an OrbitPage public page"');
    expect(tags).toContain('"@type":"SoftwareApplication"');
    expect(tags).toContain('"codeRepository":"https://github.com/paoloronco/OrbitPage"');
  });

  it('builds about-page structured data with product and breadcrumb entities', () => {
    const data = buildStructuredData({
      profile: { name: 'OrbitPage', social_links: {} },
      links: [],
      origin: 'https://orbitpage-demo.paoloronco.it',
      canonicalUrl: 'https://orbitpage-demo.paoloronco.it/about',
      pageKind: 'about',
    });

    const types = data['@graph'].map((entry) => entry['@type']);
    expect(types).toContain('AboutPage');
    expect(types).toContain('SoftwareApplication');
    expect(types).toContain('ImageObject');
    expect(types).toContain('BreadcrumbList');
    expect(data['@graph'].find((entry) => entry['@type'] === 'SoftwareApplication')).toMatchObject({
      name: 'OrbitPage',
      applicationCategory: 'WebApplication',
      operatingSystem: 'Docker, Linux, Windows, macOS',
      codeRepository: 'https://github.com/paoloronco/OrbitPage',
    });
  });

  it('GET /robots.txt points crawlers to the dynamic sitemap and blocks private routes', async () => {
    const response = await request(app)
      .get('/robots.txt')
      .set('Host', 'links.example.test')
      .set('X-Forwarded-Proto', 'https');

    expect(response.status).toBe(200);
    expect(response.text).toContain('Allow: /');
    expect(response.text).toContain('Disallow: /admin');
    expect(response.text).toContain('Disallow: /dashboard');
    expect(response.text).toContain('Disallow: /api');
    expect(response.text).toContain('Disallow: /orbitpage/admin');
    expect(response.text).toContain('Disallow: /orbitpage/dashboard');
    expect(response.text).toContain('Disallow: /orbitpage/api');
    expect(response.text).toContain('Sitemap: https://links.example.test/sitemap.xml');
    expect(response.text).toContain('Sitemap: https://links.example.test/orbitpage/sitemap.xml');
  });

  it('GET /robots.txt serves a saved custom robots file when configured', async () => {
    vi.mocked(dbGet).mockResolvedValueOnce({
      file_key: 'robots',
      content: 'User-agent: *\nAllow: /\nDisallow: /private\n',
    });

    const response = await request(app).get('/robots.txt');

    expect(response.status).toBe(200);
    expect(response.type).toMatch(/text\/plain/);
    expect(response.text).toBe('User-agent: *\nAllow: /\nDisallow: /private\n');
  });

  it('GET /llms.txt and /llm.txt expose the same LLM-readable project summary', async () => {
    vi.mocked(dbGet).mockResolvedValue(null);

    const canonical = await request(app)
      .get('/llms.txt')
      .set('Host', 'links.example.test')
      .set('X-Forwarded-Proto', 'https');
    const alias = await request(app)
      .get('/llm.txt')
      .set('Host', 'links.example.test')
      .set('X-Forwarded-Proto', 'https');

    expect(canonical.status).toBe(200);
    expect(canonical.text).toContain('# OrbitPage');
    expect(canonical.text).toContain('https://github.com/paoloronco/OrbitPage');
    expect(alias.status).toBe(200);
    expect(alias.text).toBe(canonical.text);
  });

  it('GET text-discovery files exposes useful defaults', async () => {
    vi.mocked(dbGet).mockResolvedValue(null);

    const humans = await request(app).get('/humans.txt');
    const security = await request(app).get('/.well-known/security.txt');
    const ai = await request(app).get('/ai.txt');

    expect(humans.status).toBe(200);
    expect(humans.text).toContain('/* TEAM */');
    expect(security.status).toBe(200);
    expect(security.text).toContain('Contact:');
    expect(ai.status).toBe(200);
    expect(ai.text).toContain('OrbitPage');
  });

  it('GET /api/text-files returns editable crawler and discovery files', async () => {
    vi.mocked(dbAll).mockResolvedValueOnce([
      { file_key: 'humans', content: '/* TEAM */\nCustom: yes\n', updated_at: '2026-07-09T00:00:00.000Z' },
    ]);

    const response = await request(app).get('/api/text-files');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.files.map((file) => file.key)).toEqual(['robots', 'llms', 'humans', 'security', 'ai']);
    expect(response.body.data.files.find((file) => file.key === 'humans').content).toContain('Custom: yes');
  });

  it('PUT /api/text-files/:key validates and saves custom content', async () => {
    const response = await request(app)
      .put('/api/text-files/llms')
      .send({ content: '# OrbitPage\nCustom LLM instructions.\n' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO text_files'),
      ['llms', '# OrbitPage\nCustom LLM instructions.\n']
    );
  });

  it('PUT /api/text-files/:key rejects unknown text files', async () => {
    const response = await request(app)
      .put('/api/text-files/not-real')
      .send({ content: 'Nope' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Unsupported text file');
  });

  it('POST /api/text-files creates a safe custom TXT endpoint', async () => {
    vi.mocked(dbGet).mockResolvedValueOnce({ count: 0 });

    const response = await request(app)
      .post('/api/text-files')
      .send({ path: 'ads.txt', content: 'example.com, publisher-1' });

    expect(response.status).toBe(201);
    expect(response.body.data.path).toBe('/ads.txt');
    expect(response.body.data.isCustom).toBe(true);
    expect(response.body.data.content).toBe('example.com, publisher-1\n');
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO text_files'),
      [expect.stringMatching(/^custom-/), '/ads.txt', 'example.com, publisher-1\n']
    );
  });

  it('POST /api/text-files rejects traversal and reserved aliases', async () => {
    const traversal = await request(app)
      .post('/api/text-files')
      .send({ path: '../private.txt' });
    const alias = await request(app)
      .post('/api/text-files')
      .send({ path: 'llm.txt' });

    expect(traversal.status).toBe(400);
    expect(alias.status).toBe(400);
    expect(alias.body.error).toContain('already managed');
  });

  it('GET a custom TXT path serves its saved plain-text content', async () => {
    vi.mocked(dbGet).mockResolvedValueOnce({
      file_key: 'custom-test',
      file_path: '/ads.txt',
      is_custom: 1,
      content: 'publisher=alice',
      updated_at: '2026-07-16T10:00:00.000Z'
    });

    const response = await request(app).get('/ads.txt');

    expect(response.status).toBe(200);
    expect(response.type).toMatch(/text\/plain/);
    expect(response.text).toBe('publisher=alice\n');
  });

  it('GET /sitemap.xml includes the canonical home page', async () => {
    vi.mocked(dbGet)
      .mockResolvedValueOnce({ lastmod: '2026-07-08 15:30:00' })
      .mockResolvedValueOnce({
        privacy_policy_url: '/privacy',
        cookie_policy_url: '/cookies',
      });

    const response = await request(app)
      .get('/sitemap.xml')
      .set('Host', 'links.example.test')
      .set('X-Forwarded-Proto', 'https');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.text).toContain('<loc>https://links.example.test/</loc>');
    expect(response.text).toContain('<loc>https://links.example.test/privacy</loc>');
    expect(response.text).toContain('<loc>https://links.example.test/cookies</loc>');
    expect(response.text).toContain('<lastmod>2026-07-08T15:30:00.000Z</lastmod>');
    expect(response.text).not.toContain('<loc>https://links.example.test/about</loc>');
  });

  it('GET /sitemap.xml falls back to the current time when content timestamps are unavailable', async () => {
    vi.mocked(dbGet)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        privacy_policy_url: null,
        cookie_policy_url: null,
      });

    const response = await request(app)
      .get('/sitemap.xml')
      .set('Host', 'links.example.test')
      .set('X-Forwarded-Proto', 'https');

    expect(response.status).toBe(200);
    expect(response.text).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}T/);
    expect(response.text).not.toContain('<loc>https://links.example.test/privacy</loc>');
    expect(response.text).not.toContain('<loc>https://links.example.test/cookies</loc>');
  });

  it('GET /orbitpage/sitemap.xml includes BASE_PATH-prefixed canonical URLs', async () => {
    vi.mocked(dbGet)
      .mockResolvedValueOnce({ lastmod: '2026-07-08T15:30:00.000Z' })
      .mockResolvedValueOnce({
        privacy_policy_url: '/privacy',
        cookie_policy_url: '/cookies',
      });

    const response = await request(app)
      .get('/orbitpage/sitemap.xml')
      .set('Host', 'links.example.test')
      .set('X-Forwarded-Proto', 'https');

    expect(response.status).toBe(200);
    expect(response.text).toContain('<loc>https://links.example.test/orbitpage/</loc>');
    expect(response.text).toContain('<loc>https://links.example.test/orbitpage/privacy</loc>');
    expect(response.text).toContain('<loc>https://links.example.test/orbitpage/cookies</loc>');
  });

  it('GET /orbitpage/admin serves the admin route with noindex headers', async () => {
    const response = await request(app).get('/orbitpage/admin');

    expect(response.status).toBe(200);
    expect(response.headers['x-robots-tag']).toContain('noindex');
    expect(response.text).toContain('<meta name="robots" content="noindex, nofollow, noarchive"');
  });

  it('GET /about is not exposed outside demo mode', async () => {
    const response = await request(app).get('/about');

    expect(response.status).toBe(404);
    expect(response.headers['x-robots-tag']).toContain('noindex');
    expect(response.text).not.toContain('Self-hosted Public Page Manager');
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
    expect(response.text).not.toContain('id="orbitpage-gcm-default-consent"');
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
    expect(response.text).not.toContain('id="orbitpage-gcm-default-consent"');
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
    expect(response.text).not.toContain('id="orbitpage-gcm-default-consent"');
  });

  it('PUT /api/links preserves existing click counts from DB (analytics not wiped on save)', async () => {
    // Simulate DB having a link with 42 clicks
    vi.mocked(dbAll).mockResolvedValueOnce([
      { id: 'link-1', click_count: 42 },
    ]);

    const payload = [
      {
        id: 'link-1',
        title: 'Test Link',
        description: '',
        url: 'https://example.com',
        type: 'link',
        isActive: true,
        clickCount: 0, // frontend sends stale 0 — DB value (42) must win
      },
    ];

    const response = await request(app)
      .put('/orbitpage/api/links')
      .set('Authorization', 'Bearer mock-token')
      .send(payload);

    expect(response.status).toBe(200);

    // Find the INSERT dbRun call (the one that is not DELETE)
    const insertCall = vi.mocked(dbRun).mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.trim().toUpperCase().startsWith('INSERT')
    );
    expect(insertCall).toBeDefined();
    // click_count should be the DB value (42), not the stale frontend value (0)
    const insertValues = insertCall[1];
    const clickCountIndex = insertValues.indexOf(42);
    expect(clickCountIndex).toBeGreaterThanOrEqual(0);
  });

  it('PUT /api/links uses frontend clickCount for brand-new links (no existing DB row)', async () => {
    // DB has no existing links
    vi.mocked(dbAll).mockResolvedValueOnce([]);

    const payload = [
      {
        id: 'new-link',
        title: 'New Link',
        description: '',
        url: 'https://example.com',
        type: 'link',
        isActive: true,
        clickCount: 7, // new link imported with clicks
      },
    ];

    const response = await request(app)
      .put('/orbitpage/api/links')
      .set('Authorization', 'Bearer mock-token')
      .send(payload);

    expect(response.status).toBe(200);

    const insertCall = vi.mocked(dbRun).mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.trim().toUpperCase().startsWith('INSERT')
    );
    expect(insertCall).toBeDefined();
    // No existing DB row → frontend clickCount (7) is used
    const insertValues = insertCall[1];
    expect(insertValues).toContain(7);
  });

  it('GET /api/sitemap exposes generation status and its public URL', async () => {
    vi.mocked(dbGet).mockReset();
    vi.mocked(dbGet)
      .mockResolvedValueOnce({ generated_at: '2026-07-16T12:00:00.000Z', updated_at: '2026-07-16T12:00:00.000Z' })
      .mockResolvedValueOnce({ lastmod: '2026-07-16T12:00:00.000Z' })
      .mockResolvedValueOnce({ privacy_policy_url: '/privacy', cookie_policy_url: null });

    const response = await request(app)
      .get('/api/sitemap')
      .set('Host', 'links.example.test')
      .set('X-Forwarded-Proto', 'https');

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      generated: true,
      url: 'https://links.example.test/sitemap.xml',
      entryCount: 2,
      automaticUpdates: true,
    });
  });

  it('POST /api/sitemap/generate persists a fresh generation', async () => {
    vi.mocked(dbGet).mockReset();
    vi.mocked(dbGet)
      .mockResolvedValueOnce({ lastmod: '2026-07-16T12:00:00.000Z' })
      .mockResolvedValueOnce({ privacy_policy_url: null, cookie_policy_url: null })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ generated_at: '2026-07-16T12:00:00.000Z', updated_at: '2026-07-16T12:00:00.000Z' })
      .mockResolvedValueOnce({ lastmod: '2026-07-16T12:00:00.000Z' })
      .mockResolvedValueOnce({ privacy_policy_url: null, cookie_policy_url: null })
      .mockResolvedValueOnce(null);

    const response = await request(app).post('/api/sitemap/generate');

    expect(response.status).toBe(200);
    expect(response.body.data.generated).toBe(true);
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sitemap_config'),
      [expect.stringMatching(/^2026-/)]
    );
  });

  it('GET /orbitpage/dashboard/theme supports direct section refreshes with noindex headers', async () => {
    const response = await request(app).get('/orbitpage/dashboard/theme');

    expect(response.status).toBe(200);
    expect(response.headers['x-robots-tag']).toContain('noindex');
    expect(response.text).toContain('<meta name="robots" content="noindex, nofollow, noarchive"');
  });

  it.each(['menu', 'qr', 'sitemap'])('GET /orbitpage/dashboard/%s supports direct section refreshes', async (section) => {
    const response = await request(app).get(`/orbitpage/dashboard/${section}`);
    expect(response.status).toBe(200);
    expect(response.headers['x-robots-tag']).toContain('noindex');
  });

  it('PUT /api/links persists the public URL visibility preference', async () => {
    vi.mocked(dbAll).mockResolvedValueOnce([]);

    const response = await request(app)
      .put('/orbitpage/api/links')
      .set('Authorization', 'Bearer mock-token')
      .send([
        {
          id: 'private-label-link',
          title: 'Portfolio',
          url: 'https://example.com',
          type: 'link',
          hideUrl: true,
          availability: 'unavailable',
        },
      ]);

    expect(response.status).toBe(200);

    const insertCall = vi.mocked(dbRun).mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.trim().toUpperCase().startsWith('INSERT')
    );
    expect(insertCall).toBeDefined();
    expect(insertCall[0]).toContain('hide_url');
    expect(insertCall[0]).toContain('availability');
    expect(insertCall[1][4]).toBe(1);
    expect(insertCall[1].at(-1)).toBe('unavailable');
  });

  it('PUT /api/links preserves smart CTA metadata and existing CTA clicks', async () => {
    vi.mocked(dbAll).mockResolvedValueOnce([
      { id: 'cta-1', click_count: 30, cta_click_count: 9 },
    ]);

    const response = await request(app)
      .put('/orbitpage/api/links')
      .set('Authorization', 'Bearer mock-token')
      .send([
        {
          id: 'cta-1',
          title: 'Book now',
          description: 'Reserve a slot',
          url: 'https://example.com/book',
          type: 'cta',
          ctaAction: 'book',
          ctaClicks: 0,
          isActive: true,
        },
      ]);

    expect(response.status).toBe(200);

    const insertCall = vi.mocked(dbRun).mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.trim().toUpperCase().startsWith('INSERT')
    );
    expect(insertCall).toBeDefined();
    expect(insertCall[0]).toContain('cta_action');
    expect(insertCall[0]).toContain('cta_click_count');
    expect(insertCall[1]).toContain('book');
    expect(insertCall[1]).toContain(9);
  });

  it('POST /api/links/:id/click increments click count', async () => {
    vi.mocked(dbRun).mockResolvedValueOnce({ changes: 1 });

    const response = await request(app)
      .post('/orbitpage/api/links/link-abc/click');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const updateCall = vi.mocked(dbRun).mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('click_count = click_count + 1')
    );
    expect(updateCall).toBeDefined();
    expect(updateCall[1]).toContain('link-abc');
  });

  it('POST /api/links/:id/click increments dedicated CTA click count when link is a CTA', async () => {
    vi.mocked(dbRun).mockResolvedValueOnce({ changes: 1 });

    const response = await request(app)
      .post('/orbitpage/api/links/cta-abc/click');

    expect(response.status).toBe(200);

    const updateCall = vi.mocked(dbRun).mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('cta_click_count')
    );
    expect(updateCall).toBeDefined();
    expect(updateCall[0]).toContain("type = 'cta'");
    expect(updateCall[1]).toContain('cta-abc');
  });
});

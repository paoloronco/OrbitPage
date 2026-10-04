import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.hoisted(() => {
  process.env.BASE_PATH = '/orbitpage';
  process.env.ORBITPAGE_ALLOWED_ORIGINS = 'https://trusted.example';
  process.env.ORBITPAGE_TRUST_PROXY = 'loopback';
  process.env.ORBITPAGE_DISTRIBUTION_IMAGE = 'docker.io/paueron/orbitpage';
});

const authMockState = vi.hoisted(() => ({
  username: 'admin',
  authType: null,
  permissions: [
    'links:write', 'links:style', 'links:images', 'theme:write', 'profile:write',
    'menu:write', 'analytics:read', 'compliance:write', 'users:manage',
  ],
}));

// Mock database.js before importing server.js
vi.mock('./database.js', () => ({
  initializeDatabase: vi.fn().mockResolvedValue(true),
  dbGet: vi.fn(),
  dbAll: vi.fn(),
  dbRun: vi.fn(),
  withTransaction: vi.fn(cb => cb()),
  withImmediateTransaction: vi.fn(),
}));

// Mock auth.js
vi.mock('./auth.js', () => ({
  isStrongJwtSecret: vi.fn((value) => typeof value === 'string' && value.length >= 32 && value !== 'replace-with-a-long-random-secret'),
  isFirstTimeSetup: vi.fn(),
  setupInitialCredentials: vi.fn(),
  authenticateUser: vi.fn(),
  generateToken: vi.fn(() => 'mock-token'),
  verifyToken: vi.fn(),
  authenticateToken: (req, res, next) => {
    req.user = {
      username: authMockState.username,
      authType: authMockState.authType,
      permissions: [...authMockState.permissions],
    };
    next();
  },
  requirePermission: vi.fn((permission) => (req, res, next) => (
    req.user?.permissions?.includes(permission)
      ? next()
      : res.status(403).json({ error: 'Insufficient permissions' })
  )),
  requireAnyPermission: vi.fn((...permissions) => (req, res, next) => (
    permissions.some((permission) => req.user?.permissions?.includes(permission))
      ? next()
      : res.status(403).json({ error: 'Insufficient permissions' })
  )),
  isPasswordStrong: vi.fn(() => true),
  generateSecurePassword: vi.fn(() => 'SecurePass123!')
}));

vi.mock('./services/backup-service.js', () => ({
  SELECTIVE_BACKUP_SCHEMA_VERSION: 2,
  createApplicationBackup: vi.fn(),
  restoreApplicationBackup: vi.fn(),
  stageUploads: vi.fn(() => ({ activate: vi.fn(), rollback: vi.fn(), finalize: vi.fn() })),
}));

vi.mock('./services/setup-token.js', () => ({
  ensureSetupToken: vi.fn(() => 'a'.repeat(64)),
  verifySetupToken: vi.fn((token) => token === 'a'.repeat(64)),
  rotateSetupToken: vi.fn(),
  consumeSetupToken: vi.fn(),
}));

vi.mock('./services/instance-details.js', async (importOriginal) => ({
  ...await importOriginal(),
  saveEnvironmentChanges: vi.fn().mockResolvedValue([{ key: 'PUBLIC_SITE_NAME', label: 'Public site name', configured: true, overridden: true }]),
}));

// Now import app
import { app, buildStructuredData, renderSeoTags, stripStaticSeoTags } from './server.js';
import { authenticateUser, isFirstTimeSetup, setupInitialCredentials, verifyToken } from './auth.js';
import { dbAll, dbGet, dbRun, withImmediateTransaction, withTransaction } from './database.js';
import { createApplicationBackup, restoreApplicationBackup, stageUploads } from './services/backup-service.js';
import { consumeSetupToken, rotateSetupToken } from './services/setup-token.js';
import { updateAgentRequest } from './services/application-updates.js';
import { saveEnvironmentChanges } from './services/instance-details.js';
vi.mock('./services/application-updates.js', async importOriginal => ({
  ...await importOriginal(), updateAgentRequest: vi.fn(),
}));

describe('API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateAgentRequest).mockReset().mockResolvedValue({ enabled: false, job: null });
    authMockState.username = 'admin';
    authMockState.authType = null;
    authMockState.permissions = [
      'links:write', 'links:style', 'links:images', 'theme:write', 'profile:write',
      'menu:write', 'analytics:read', 'compliance:write', 'users:manage',
    ];
    vi.mocked(dbGet).mockResolvedValue(null);
    vi.mocked(dbAll).mockResolvedValue([]);
    vi.mocked(dbRun).mockResolvedValue({ changes: 1 });
    vi.mocked(withTransaction).mockImplementation(cb => cb());
    vi.mocked(withImmediateTransaction).mockReset();
    vi.mocked(isFirstTimeSetup).mockResolvedValue(false);
    vi.mocked(authenticateUser).mockResolvedValue(true);
    vi.mocked(createApplicationBackup).mockResolvedValue({
      schemaVersion: 1,
      appVersion: 'test',
      createdAt: '2026-07-09T00:00:00.000Z',
      tables: {},
      uploads: [],
    });
    vi.mocked(restoreApplicationBackup).mockResolvedValue({ mediaRestore: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('GET /health should return 200 and status ok', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.distributionImage).toBe('docker.io/paueron/orbitpage');
  });

  it('requires administrator permission and password for host updates, and locks writes across dashboard sessions', async () => {
    const endpoint = '/orbitpage/api/account/updates';
    const input = { version: '4.21.35', currentPassword: 'Current123!' };
    authMockState.permissions = ['analytics:read'];
    expect((await request(app).post(endpoint).send(input)).status).toBe(403);
    authMockState.permissions = ['users:manage'];
    vi.mocked(authenticateUser).mockResolvedValueOnce(false);
    expect((await request(app).post(endpoint).send(input)).status).toBe(400);
    expect(updateAgentRequest).not.toHaveBeenCalled();
    expect((await request(app).post(endpoint).send({ ...input, command: 'rm -rf /' })).status).toBe(400);
    const job = { state: 'running', version: input.version, logs: 'Backup created', error: null };
    vi.mocked(updateAgentRequest).mockResolvedValue({ enabled: true, job });
    expect((await request(app).post(endpoint).send(input)).status).toBe(202);
    expect(updateAgentRequest).toHaveBeenCalledWith(expect.any(String), input.version);
    expect((await request(app).put('/orbitpage/api/profile').send({ name: 'While updating' })).status).toBe(423);
    expect((await request(app).get(endpoint)).body.job.logs).toBe('Backup created');
    authMockState.permissions = ['analytics:read'];
    expect((await request(app).get(endpoint)).body.job.logs).toBe('');
    vi.mocked(updateAgentRequest).mockResolvedValue({ enabled: true, job: { ...job, state: 'completed' } });
    expect((await request(app).put('/orbitpage/api/profile').send({ name: 'After updating' })).status).not.toBe(423);
  });

  it('serves unused-media inspection as JSON under the configured base path', async () => {
    const response = await request(app)
      .get('/orbitpage/api/admin/media/cleanup')
      .set('Authorization', 'Bearer mock-token');

    expect(response.status).toBe(200);
    expect(response.type).toBe('application/json');
    expect(response.body).toMatchObject({ dryRun: true, deleted: 0 });
  });

  it('exposes local page versions instead of falling through to the SPA', async () => {
    const response = await request(app)
      .get('/orbitpage/api/versions')
      .set('Authorization', 'Bearer mock-token');

    expect(response.status).toBe(200);
    expect(response.type).toBe('application/json');
    expect(response.body).toMatchObject({ retention: 25, currentRevision: 0, versions: [] });
  });

  it('does not grant CORS access to arbitrary production origins', async () => {
    const response = await request(app)
      .get('/health')
      .set('Origin', 'https://attacker.example');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('grants non-credentialed CORS only to an explicitly trusted origin', async () => {
    const response = await request(app)
      .options('/api/ai/settings')
      .set('Origin', 'https://trusted.example')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('https://trusted.example');
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    expect(response.headers['access-control-allow-headers']).toContain('Authorization');
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

  it('allows the official origins used by service content players', async () => {
    const response = await request(app).get('/health');
    const csp = response.headers['content-security-policy'];

    for (const origin of [
      'https://www.instagram.com',
      'https://www.youtube-nocookie.com',
      'https://open.spotify.com',
      'https://widget.deezer.com',
      'https://w.soundcloud.com',
      'https://player.vimeo.com',
      'https://www.tiktok.com',
      'https://giphy.com',
      'https://calendar.google.com',
      'https://*.typeform.com',
      'https://*.typeform.eu',
    ]) {
      expect(csp).toContain(origin);
    }
  });

  it('preserves the origin needed by third-party media players', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
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

  it('CSP allows blob URLs for client-side image and media previews', async () => {
    const response = await request(app).get('/health');
    const csp = response.headers['content-security-policy'];
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).toContain("media-src 'self' blob:");
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

  it('POST /api/auth/reset rejects users without user-management permission', async () => {
    authMockState.username = 'viewer';
    authMockState.permissions = ['analytics:read'];

    const response = await request(app)
      .post('/api/auth/reset')
      .set('Authorization', 'Bearer viewer-token')
      .send({ currentPassword: 'Viewer123!' });

    expect(response.status).toBe(403);
    expect(authenticateUser).not.toHaveBeenCalled();
  });

  it('POST /api/auth/reset re-authenticates the administrator before deleting data', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce(false);

    const response = await request(app)
      .post('/api/auth/reset')
      .set('Authorization', 'Bearer admin-token')
      .send({ currentPassword: 'Wrong123!' });

    expect(response.status).toBe(401);
    expect(authenticateUser).toHaveBeenCalledWith('Wrong123!', 'admin');
    expect(dbRun).not.toHaveBeenCalled();
  });

  it('POST /api/auth/change-password never upgrades a personal token into a session', async () => {
    authMockState.authType = 'personal_token';
    const response = await request(app)
      .post('/api/auth/change-password')
      .send({ currentPassword: 'Current123!', newPassword: 'NewPassword123!' });

    expect(response.status).toBe(403);
    expect(dbGet).not.toHaveBeenCalled();
    expect(dbRun).not.toHaveBeenCalled();
  });

  it('POST /api/auth/reset replaces public uploads after the database reset', async () => {
    const response = await request(app)
      .post('/api/auth/reset')
      .set('X-Forwarded-For', '203.0.113.21')
      .send({ currentPassword: 'Current123!' });

    expect(response.status).toBe(200);
    expect(stageUploads).toHaveBeenCalledWith({ uploadsPath: expect.any(String), uploads: [] });
    expect(rotateSetupToken).toHaveBeenCalledOnce();
    const mediaReset = vi.mocked(stageUploads).mock.results[0].value;
    expect(mediaReset.activate).toHaveBeenCalledOnce();
    expect(mediaReset.finalize).toHaveBeenCalledOnce();
    expect(mediaReset.rollback).not.toHaveBeenCalled();
  });

  it('POST /api/auth/reset restores uploads when database deletion fails', async () => {
    vi.mocked(dbAll).mockResolvedValueOnce([{ name: 'admin_users' }]);
    vi.mocked(dbRun).mockRejectedValueOnce(new Error('write failed'));
    const response = await request(app)
      .post('/api/auth/reset')
      .set('X-Forwarded-For', '203.0.113.22')
      .send({ currentPassword: 'Current123!' });

    expect(response.status).toBe(500);
    const mediaReset = vi.mocked(stageUploads).mock.results[0].value;
    expect(mediaReset.rollback).toHaveBeenCalledOnce();
    expect(mediaReset.activate).not.toHaveBeenCalled();
  });

  it('POST /api/auth/reset-via-token rejects whitespace-only reset credentials', async () => {
    const whitespaceToken = ' '.repeat(32);
    vi.stubEnv('RESET_TOKEN', whitespaceToken);

    const response = await request(app)
      .post('/api/auth/reset-via-token')
      .set('X-Forwarded-For', '203.0.113.10')
      .send({ token: whitespaceToken, newPassword: 'SecurePass123!' });

    expect(response.status).toBe(403);
    expect(dbRun).not.toHaveBeenCalled();
  });

  it('POST /api/auth/force-reset rejects whitespace-only reset credentials', async () => {
    const whitespaceToken = ' '.repeat(32);
    vi.stubEnv('RESET_TOKEN', whitespaceToken);

    const response = await request(app)
      .post('/api/auth/force-reset')
      .set('X-Forwarded-For', '203.0.113.11')
      .send({ token: whitespaceToken, newPassword: 'SecurePass123!' });

    expect(response.status).toBe(403);
    expect(dbRun).not.toHaveBeenCalled();
  });

  it('GET /api/map-preview resolves coordinates embedded in a Maps URL without an upstream request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await request(app)
      .get('/api/map-preview')
      .query({ url: 'https://www.google.com/maps/place/Turin/@45.0703,7.6869,15z' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ lat: '45.0703', lon: '7.6869', source: 'coordinates' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GET /api/map-preview geocodes the location encoded in a full Maps URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ lat: '45.0703', lon: '7.6869', display_name: 'Torino' }],
    });
    vi.stubGlobal('fetch', fetchMock);
    const response = await request(app)
      .get('/api/map-preview')
      .query({ url: 'https://example.com/?q=Porta+Nuova+Torino' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ lat: '45.0703', lon: '7.6869', source: 'geocoding' });
    expect(String(fetchMock.mock.calls[0][0])).toContain('q=Porta+Nuova+Torino');
  });

  it('GET /api/map-preview follows an allowlisted Google Maps short URL only', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      url: 'https://maps.app.goo.gl/torino',
      headers: new Headers({ location: 'https://www.google.com/maps/place/Turin/@45.0703,7.6869,15z' }),
      body: { cancel: vi.fn().mockResolvedValue(undefined) },
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await request(app)
      .get('/api/map-preview')
      .query({ url: 'https://maps.app.goo.gl/torino' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ lat: '45.0703', lon: '7.6869', source: 'redirect' });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(new URL(String(fetchMock.mock.calls[0][0])).origin).toBe('https://maps.app.goo.gl');
  });

  it('GET /api/map-preview never requests a Maps lookalike host', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await request(app)
      .get('/api/map-preview')
      .query({ url: 'https://maps.app.goo.gl.attacker.example/torino' });

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POST /api/auth/setup creates the administrator without a page slug', async () => {
    vi.mocked(dbGet).mockResolvedValue(null);

    const response = await request(app)
      .post('/api/auth/setup')
      .send({ password: 'StrongPassword1!', setupToken: 'a'.repeat(64) });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, token: 'mock-token', pageSlug: null });
    expect(withTransaction).toHaveBeenCalledOnce();
    expect(setupInitialCredentials).toHaveBeenCalledWith('StrongPassword1!');
    expect(consumeSetupToken).toHaveBeenCalledOnce();
    expect(dbRun).not.toHaveBeenCalledWith(expect.stringContaining("VALUES ('page_slug'"), expect.anything());
    expect(dbRun).toHaveBeenCalledWith(expect.stringContaining('admin_onboarding_enabled'));
  });

  it('POST /api/ai/page/plan stores a reviewable proposal without mutating the page', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-proj-server-test-key-123456789');
    vi.mocked(dbGet).mockImplementation(async (sql) => {
      const query = String(sql);
      if (query.includes('FROM ai_settings')) return null;
      if (query.includes('FROM profile_data')) {
        return {
          id: 1,
          name: 'Orbit Studio',
          bio: 'Original bio',
          avatar: '',
          social_links: '{}',
          show_avatar: 1,
          appearance: '{}',
        };
      }
      if (query.includes('FROM theme_config')) {
        return {
          id: 1,
          primary_color: '#2563eb',
          background_color: '#ffffff',
          text_color: '#0f172a',
          full_config: '{"primary":"#2563eb","background":"#ffffff","foreground":"#0f172a"}',
        };
      }
      if (query.includes('FROM page_state')) return { revision: 9 };
      return null;
    });
    vi.mocked(dbAll).mockResolvedValue([]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'x-request-id': 'req_server_test' }),
      json: async () => ({
        status: 'completed',
        output: [{
          type: 'message',
          content: [{
            type: 'output_text',
            text: JSON.stringify({
              intent: 'propose_changes',
              answer: 'I prepared a shorter bio.',
              summary: 'Shorten the profile introduction.',
              operations: [{
                kind: 'profile.set',
                targetId: null,
                field: 'bio',
                value: 'A short, direct bio.',
                blockType: null,
                title: null,
                description: null,
                url: null,
                content: null,
                index: null,
              }],
            }),
          }],
        }],
      }),
    }));

    const response = await request(app)
      .post('/orbitpage/api/ai/page/plan')
      .send({ message: 'Shorten the bio', history: [] });

    expect(response.status).toBe(200);
    expect(response.body.reply).toBe('I prepared a shorter bio.');
    expect(response.body.proposal).toMatchObject({
      summary: 'Shorten the profile introduction.',
      expectedRevision: 9,
      changes: ['Update profile field bio.'],
    });
    expect(response.body.proposal.previewToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(response.body.proposal.preview.before.profile.bio).toBe('Original bio');
    expect(response.body.proposal.preview.after.profile.bio).toBe('A short, direct bio.');
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ai_page_previews'),
      expect.arrayContaining(['admin', 9]),
    );
    expect(dbRun).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE profile_data'),
      expect.anything(),
    );
  });

  it('POST /api/ai/page/commit checks the revision and applies a single-use preview transactionally', async () => {
    const token = 'A'.repeat(43);
    let pageStateReads = 0;
    const transaction = {
      get: vi.fn(async (sql) => {
        const query = String(sql);
        if (query.includes('FROM ai_page_previews')) {
          return {
            token_hash: 'stored-hash',
            username: 'admin',
            expected_revision: 4,
            changes: JSON.stringify({
              profile: {
                name: 'Orbit Studio',
                bio: 'Approved bio',
                avatar: '',
                social_links: {},
                show_avatar: 1,
              },
            }),
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            used_at: null,
            committed_revision: null,
          };
        }
        if (query.includes('FROM page_state')) {
          pageStateReads += 1;
          return { revision: pageStateReads === 1 ? 4 : 5 };
        }
        if (query.includes('FROM profile_data')) {
          return {
            id: 1,
            privacy_policy_url: '/privacy',
            cookie_policy_url: '/cookies',
            admin_onboarding_enabled: 1,
            appearance: '{}',
          };
        }
        return null;
      }),
      all: vi.fn(async () => []),
      run: vi.fn(async () => ({ changes: 1 })),
    };
    vi.mocked(withImmediateTransaction).mockImplementation(async (callback) => callback(transaction));

    const response = await request(app)
      .post('/orbitpage/api/ai/page/commit')
      .send({ previewToken: token });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, revision: 5, alreadyApplied: false });
    expect(transaction.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE profile_data SET'),
      expect.arrayContaining(['Orbit Studio', 'Approved bio']),
    );
    expect(transaction.run).toHaveBeenCalledWith(
      expect.stringContaining("changes = '{}'"),
      expect.arrayContaining([5, 'stored-hash']),
    );
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
    for (const slug of ['admin', 'go', 'links']) {
      const reserved = await request(app).put('/orbitpage/api/subpages').send([{ ...base, slug }]);
      expect(reserved.status).toBe(400);
    }
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
      deferMediaCommit: true,
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
      deferMediaCommit: true,
    });
  });

  it('GET /api/public-page should return profile, links, and theme in one response', async () => {
    vi.mocked(dbGet)
      .mockResolvedValueOnce(null)
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
        show_orbitpage_badge: 0,
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
    expect(response.body.branding.showOrbitPageBadge).toBe(true);
    expect(response.body.links).toHaveLength(1);
    expect(response.body.theme.primary).toBe('#111111');
  });

  it('redirects a stable campaign slug to the active local-time menu section', async () => {
    vi.setSystemTime(new Date('2026-09-14T12:00:00Z'));
    const campaign = {
      slug: 'today-menu',
      label: 'Today menu',
      destination: 'menu',
      timezone: 'Europe/Rome',
      enabled: true,
      rules: [
        { label: 'Lunch', destination: 'menu?section=lunch', startTime: '11:30', endTime: '15:00', enabled: true },
        { label: 'Dinner', destination: 'menu?section=dinner', startTime: '18:00', endTime: '23:30', enabled: true },
      ],
    };
    vi.mocked(dbGet).mockImplementation(async (sql) => {
      const query = String(sql);
      if (query.includes("key = 'public_page_active'")) return { value: '1' };
      if (query.includes('FROM campaign_links')) return { full_config: JSON.stringify([campaign]) };
      if (query.includes("key = 'page_slug'")) return { value: 'venue' };
      return null;
    });

    const response = await request(app).get('/orbitpage/go/today-menu');

    expect(response.status).toBe(302);
    expect(new URL(response.headers.location).pathname).toBe('/orbitpage/menu');
    expect(new URL(response.headers.location).search).toBe('?section=lunch');
    expect(response.headers['cache-control']).toContain('no-store');

    const qrResponse = await request(app).get('/orbitpage/go/today-menu?utm_source=qr&utm_medium=qr');
    const qrTarget = new URL(qrResponse.headers.location);
    expect(qrTarget.searchParams.get('section')).toBe('lunch');
    expect(qrTarget.searchParams.get('utm_medium')).toBe('qr');
    expect(qrTarget.searchParams.get('utm_campaign')).toBe('today-menu');
  });

  it('returns a removed-page response without exposing old public content', async () => {
    vi.mocked(dbGet).mockResolvedValueOnce({ value: '0' });

    const response = await request(app).get('/api/public-page');

    expect(response.status).toBe(410);
    expect(response.body).toEqual({ error: 'PAGE_REMOVED' });
    expect(dbAll).not.toHaveBeenCalled();
  });

  it('removes only public page data while preserving the administrator account', async () => {
    const activate = vi.fn();
    const finalize = vi.fn();
    vi.mocked(dbGet).mockImplementation(async (sql, params) => {
      if (String(sql).includes('instance_settings') && params?.[0] === 'public_page_active') return { value: '1' };
      if (String(sql).includes('instance_settings') && params?.[0] === 'page_slug') return { value: 'my-page' };
      return null;
    });
    vi.mocked(restoreApplicationBackup).mockResolvedValue({ mediaRestore: { activate, finalize, rollback: vi.fn() } });

    const response = await request(app)
      .post('/api/account/personal-page')
      .set('Authorization', 'Bearer mock-token')
      .send({ action: 'delete', confirmation: 'REMOVE my-page', currentPassword: 'Secret123!' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, active: false, slug: null });
    const backup = vi.mocked(restoreApplicationBackup).mock.calls[0][0].backup;
    expect(backup.includedSections).not.toContain('accounts');
    expect(backup.tables).not.toHaveProperty('admin_users');
    expect(authenticateUser).toHaveBeenCalledWith('Secret123!', 'admin');
    expect(activate).toHaveBeenCalledOnce();
    expect(finalize).toHaveBeenCalledOnce();
    expect(dbRun).not.toHaveBeenCalledWith(expect.stringContaining('DELETE FROM admin_users'));
  });

  it('recreates a removed public page at the installation root', async () => {
    vi.mocked(dbGet).mockImplementation(async (_sql, params) => (
      params?.[0] === 'public_page_active' ? { value: '0' } : null
    ));

    const response = await request(app)
      .post('/api/account/personal-page')
      .set('Authorization', 'Bearer mock-token')
      .set('X-Forwarded-For', '198.51.100.42')
      .send({ action: 'create' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, active: true, slug: null, confirmationLabel: 'PAGE' });
    expect(dbRun).toHaveBeenCalledWith("DELETE FROM instance_settings WHERE key = 'page_slug'");
  });

  it('GET /api/menu removes subsections and products beneath hidden parents', async () => {
    vi.mocked(dbGet).mockResolvedValueOnce({
      full_config: JSON.stringify({
        version: 1,
        enabled: true,
        venueType: 'restaurant',
        name: 'Test menu',
        description: '',
        currency: 'EUR',
        locale: 'en-GB',
        sections: [
          { id: 'hidden-root', name: 'Hidden', visible: false, position: 0 },
          { id: 'hidden-child', parentId: 'hidden-root', name: 'Leaked child', visible: true, position: 1 },
          { id: 'public-root', name: 'Public', visible: true, position: 2 },
          { id: 'public-child', parentId: 'public-root', name: 'Public child', visible: true, position: 3 },
        ],
        items: [
          { id: 'hidden-item', sectionId: 'hidden-child', name: 'Hidden item', priceMinor: 100, variants: [], allergens: [], dietaryTags: [], available: true, featured: false, position: 0 },
          { id: 'public-item', sectionId: 'public-child', name: 'Public item', priceMinor: 200, variants: [], allergens: [], dietaryTags: [], available: true, featured: false, position: 1 },
        ],
        theme: { preset: 'editorial', background: '#ffffff', surface: '#ffffff', text: '#111111', muted: '#666666', accent: '#225544', border: '#dddddd', radius: 8, imageLayout: 'compact' },
        routing: { homepage: 'link', linkEnabled: true },
      }),
    });

    const response = await request(app).get('/api/menu');

    expect(response.status).toBe(200);
    expect(response.body.sections.map((section) => section.id)).toEqual(['public-root', 'public-child']);
    expect(response.body.items.map((item) => item.id)).toEqual(['public-item']);
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
    });
    expect(response.body.links[0]).not.toHaveProperty('startDate');
    expect(response.body.links[0]).not.toHaveProperty('endDate');
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
      .mockResolvedValueOnce(null)
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

  it('POST /api/auth/setup rejects a caller without the local setup token', async () => {
    const response = await request(app)
      .post('/api/auth/setup')
      .send({ password: 'StrongPassword1!', setupToken: 'b'.repeat(64) });

    expect(response.status).toBe(403);
    expect(setupInitialCredentials).not.toHaveBeenCalled();
  });

  it('PUT /api/profile rejects policy URL changes from profile editors', async () => {
    authMockState.permissions = ['profile:write'];
    vi.mocked(dbGet).mockResolvedValueOnce({ id: 1, privacy_policy_url: '/privacy', cookie_policy_url: '/cookies' });
    const response = await request(app).put('/api/profile').send({
      name: 'Paolo', privacy_policy_url: 'https://example.com/other', cookie_policy_url: '/cookies',
    });

    expect(response.status).toBe(403);
    expect(dbRun).not.toHaveBeenCalled();
  });

  it('PUT /api/profile keeps unchanged policy URLs for profile editors', async () => {
    authMockState.permissions = ['profile:write'];
    vi.mocked(dbGet).mockResolvedValueOnce({ id: 1, privacy_policy_url: '/privacy', cookie_policy_url: '/cookies' });
    const response = await request(app).put('/api/profile').send({
      name: 'Paolo', privacyPolicyUrl: '/privacy', cookiePolicyUrl: '/cookies',
    });

    expect(response.status).toBe(200);
    expect(vi.mocked(dbRun).mock.calls[0][1]).toContain('/privacy');
  });

  it('PUT /api/profile accepts an unchanged legacy URL after URL normalization', async () => {
    authMockState.permissions = ['profile:write'];
    vi.mocked(dbGet).mockResolvedValueOnce({ id: 1, privacy_policy_url: 'https://example.com', cookie_policy_url: null });
    const response = await request(app).put('/api/profile').send({
      name: 'Paolo', privacyPolicyUrl: 'https://example.com', cookiePolicyUrl: null,
    });

    expect(response.status).toBe(200);
    expect(vi.mocked(dbRun).mock.calls[0][1]).toContain('https://example.com');
  });

  it('PUT /api/profile keeps the public OrbitPage badge enabled', async () => {
    vi.mocked(dbGet).mockResolvedValueOnce({ id: 1, show_orbitpage_badge: 1 });
    vi.mocked(dbRun).mockResolvedValueOnce({ changes: 1 });

    const response = await request(app)
      .put('/api/profile')
      .send({
        name: 'Paolo',
        bio: '',
        avatar: '',
        social_links: {},
        show_orbitpage_badge: false,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(vi.mocked(dbRun).mock.calls[0][0]).toContain('show_orbitpage_badge = ?');
    expect(vi.mocked(dbRun).mock.calls[0][1][10]).toBe(1);
  });

  it('PUT /api/profile persists visual profile and card layouts', async () => {
    vi.mocked(dbGet).mockResolvedValueOnce({ id: 1, appearance: '{}' });
    vi.mocked(dbRun).mockResolvedValueOnce({ changes: 1 });
    const layouts = {
      mobile: null,
      desktop: {
        positions: {
          avatar: { x: 0, y: 0, width: 28, height: 96 },
          name: { x: 34, y: 0, width: 40, height: 96 },
        },
        height: 192,
      },
    };
    const cardLayouts = {
      mobile: null,
      desktop: {
        positions: {
          'orbitpage-profile': { x: 25, y: 0, width: 50, height: 456 },
          github: { x: 0, y: 480, width: 42, height: 100 },
          website: { x: 56, y: 480, width: 44, height: 100 },
        },
        contents: { github: { positions: { title: { x: 16, y: 0, width: 80, height: 24 } }, height: 64 } },
        height: 580,
      },
    };

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
          surfaceEffect: 'liquid-glass',
          surfaceOpacity: 0.44,
          surfaceBlur: 18,
          cardBorderWidth: 2,
          cardRadius: 24,
          cardShadowColor: '#112233',
          cardShadowOpacity: 0.2,
          layout: {
            positions: {
              avatar: { x: 0, y: 0, width: 28, height: 96 },
              name: { x: 34, y: 0, width: 40, height: 96 },
              bio: { x: 4, y: 120, width: 92, height: 72 },
            },
            height: 192,
          },
          layouts,
          cardLayouts,
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    const savedAppearance = JSON.parse(vi.mocked(dbRun).mock.calls[0][1][17]);
    expect(savedAppearance).toEqual({
      profilePreset: 'studio',
      profileDetails: {
        primary: 'Brand and digital design',
        secondary: 'Turin, Italy',
      },
      avatarShape: 'rounded',
      cardBorderEnabled: false,
      surfaceEffect: 'liquid-glass',
      surfaceOpacity: 0.44,
      surfaceBlur: 18,
      cardBorderWidth: 2,
      cardRadius: 24,
      cardShadowColor: '#112233',
      cardShadowOpacity: 0.2,
      layout: {
        positions: {
          avatar: { x: 0, y: 0, width: 28, height: 96 },
          name: { x: 34, y: 0, width: 40, height: 96 },
          bio: { x: 4, y: 120, width: 92, height: 72 },
        },
        height: 192,
      },
      layouts,
      cardLayouts,
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
          builder: { provider: 'custom', providerConfig: { headSnippet: '<script>secret()</script>' } },
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
    expect(response.body.data).not.toHaveProperty('builder');
  });

  it('limits instance details and masked environment settings to administrators', async () => {
    authMockState.permissions = ['analytics:read'];
    expect((await request(app).get('/orbitpage/api/account/instance-details')).status).toBe(403);
    authMockState.permissions = ['users:manage'];
    authMockState.authType = 'personal_token';
    expect((await request(app).get('/orbitpage/api/account/instance-details')).status).toBe(403);
    authMockState.authType = null;
    const response = await request(app).get('/orbitpage/api/account/instance-details');
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body.databasePath).toMatch(/orbitpage\.db$/);
    expect(response.body.services).toHaveProperty('database', true);
    expect(response.body.environment).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'OPENAI_API_KEY' })]));
    expect(response.body.environment.every((entry) => Object.keys(entry).every((key) => ['key', 'label', 'configured', 'overridden'].includes(key)))).toBe(true);
  });

  it('requires password and validates environment changes without returning values', async () => {
    const endpoint = '/orbitpage/api/account/instance-environment';
    const input = { currentPassword: 'Current123!', changes: { PUBLIC_SITE_NAME: 'Example' } };
    authMockState.permissions = ['analytics:read'];
    expect((await request(app).put(endpoint).send(input)).status).toBe(403);
    authMockState.permissions = ['users:manage'];
    vi.mocked(authenticateUser).mockResolvedValueOnce(false);
    expect((await request(app).put(endpoint).send(input)).status).toBe(400);
    expect((await request(app).put(endpoint).send({ ...input, extra: true })).status).toBe(400);
    const response = await request(app).put(endpoint).send(input);
    expect(response.status).toBe(200);
    expect(saveEnvironmentChanges).toHaveBeenCalledWith(input.changes);
    expect(response.text).not.toContain('Example');
    expect(response.body.restartRequired).toBe(true);
  });

  it('limits the audit log to administrators and returns a private paginated response', async () => {
    authMockState.permissions = ['analytics:read'];
    expect((await request(app).get('/orbitpage/api/account/audit-log')).status).toBe(403);
    authMockState.permissions = ['users:manage'];
    vi.mocked(dbAll).mockResolvedValueOnce([{ id: 4, createdAt: '2026-10-03T12:00:00.000Z', actor: 'admin', action: 'profile.put', description: 'Updated page profile' }]);
    const response = await request(app).get('/orbitpage/api/account/audit-log?q=profile');
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body).toMatchObject({ events: [{ actor: 'admin', action: 'profile.put' }], nextCursor: null });
  });

  it('POST /api/ai/page/plan keeps draft links out of theme-only AI context and preview', async () => {
    authMockState.permissions = ['theme:write'];
    vi.stubEnv('OPENAI_API_KEY', 'sk-proj-server-test-key-123456789');
    vi.mocked(dbGet).mockImplementation(async (sql) => String(sql).includes('FROM page_state') ? { revision: 2 } : null);
    vi.mocked(dbAll).mockResolvedValue([{ id: 'draft', title: 'Private campaign', url: 'https://secret.example', is_active: 0, status: 'draft' }]);
    const provider = vi.fn().mockResolvedValue({
      ok: true, status: 200, headers: new Headers(),
      json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
        intent: 'propose_changes', answer: 'A new card color.', summary: 'Change card color.',
        operations: [{ kind: 'theme.set', targetId: null, field: 'card', value: '#123456', blockType: null, title: null, description: null, url: null, content: null, index: null }],
      }) }] }] }),
    });
    vi.stubGlobal('fetch', provider);

    const response = await request(app).post('/orbitpage/api/ai/page/plan').send({ message: 'Change the card color', history: [] });
    expect(response.status).toBe(200);
    expect(JSON.stringify(provider.mock.calls[0][1].body)).not.toContain('Private campaign');
    expect(JSON.stringify(response.body)).not.toContain('Private campaign');
    expect(response.body.proposal.preview.before.links).toEqual([]);
  });

  it('GET /api/consent-config/public omits inactive policy drafts', async () => {
    vi.mocked(dbGet)
      .mockResolvedValueOnce({ mode: 'hardcoded', enabled: 1, full_config: JSON.stringify({
        legalPolicies: { privacyPolicy: { mode: 'external', hostedText: 'unpublished', embeddedCode: '<script>draft()</script>' } },
      }) })
      .mockResolvedValueOnce({ privacy_policy_url: 'https://example.com/privacy', cookie_policy_url: '' });
    const response = await request(app).get('/api/consent-config/public');
    expect(response.status).toBe(200);
    expect(response.body.data.legalPolicies.privacyPolicy).not.toHaveProperty('hostedText');
    expect(response.body.data.legalPolicies.privacyPolicy).not.toHaveProperty('embeddedCode');
  });

  it('GET /api/links/export denies analytics-only users', async () => {
    authMockState.permissions = ['analytics:read'];
    expect((await request(app).get('/api/links/export')).status).toBe(403);
    expect(dbAll).not.toHaveBeenCalled();
    authMockState.permissions = ['links:write'];
    expect((await request(app).get('/api/links/export')).status).toBe(200);
  });

  it('PUT /api/theme rejects CSS URLs while accepting normal colors', async () => {
    expect((await request(app).put('/api/theme').send({ background: 'url(http://127.0.0.1/admin)' })).status).toBe(400);
    expect(dbRun).not.toHaveBeenCalled();
    expect((await request(app).put('/api/theme').send({ background: '#123456' })).status).toBe(200);
  });

  it('GET /api/links omits analytics and campaign metadata for public callers', async () => {
    vi.mocked(dbAll).mockResolvedValueOnce([{
      id: 'public-link',
      title: 'Public Link',
      url: 'https://example.com',
      type: 'link',
      is_active: 1,
      status: 'live',
      click_count: 42,
      cta_click_count: 7,
      campaign_name: 'Private campaign',
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-02T00:00:00.000Z',
    }]);

    const response = await request(app).get('/api/links');

    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({ id: 'public-link', title: 'Public Link' });
    for (const field of ['clickCount', 'ctaClicks', 'campaignName', 'createdAt', 'updatedAt']) {
      expect(response.body[0]).not.toHaveProperty(field);
    }
  });

  it('GET /api/profile keeps dashboard onboarding state private', async () => {
    const profile = {
      name: 'Paolo',
      bio: '',
      avatar: '',
      social_links: '{}',
      admin_onboarding_enabled: 1,
    };
    vi.mocked(dbGet).mockResolvedValue(profile);

    const publicResponse = await request(app).get('/api/profile');
    const adminResponse = await request(app)
      .get('/api/profile')
      .set('Authorization', 'Bearer admin-token');

    expect(publicResponse.body).not.toHaveProperty('admin_onboarding_enabled');
    expect(adminResponse.body.admin_onboarding_enabled).toBe(1);
  });

  it('PUT /api/consent-config prevents compliance editors from adding executable snippets', async () => {
    authMockState.username = 'privacy-editor';
    authMockState.permissions = ['compliance:write'];
    vi.mocked(dbGet).mockResolvedValueOnce(null);

    const response = await request(app)
      .put('/api/consent-config')
      .set('Authorization', 'Bearer compliance-token')
      .send({
        mode: 'builder',
        enabled: true,
        builder: { provider: 'custom', providerConfig: { headSnippet: '<script>attack()</script>' } },
      });

    expect(response.status).toBe(403);
    expect(dbRun).not.toHaveBeenCalled();
  });

  it('PUT /api/consent-config prevents compliance editors from activating provider scripts', async () => {
    authMockState.username = 'privacy-editor';
    authMockState.permissions = ['compliance:write'];
    vi.mocked(dbGet).mockResolvedValue(null);

    const response = await request(app)
      .put('/api/consent-config')
      .set('Authorization', 'Bearer compliance-token')
      .send({
        mode: 'builder',
        enabled: true,
        builder: { provider: 'cookieyes', providerConfig: { scriptId: 'site-123' } },
      });

    expect(response.status).toBe(403);
    expect(dbRun).not.toHaveBeenCalled();
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
    vi.mocked(dbGet).mockImplementation(async (sql) => {
      if (String(sql).includes('instance_settings')) return null;
      if (!String(sql).includes('FROM profile_data')) return null;
      return {
        name: 'Paolo',
        bio: 'Developer and maker',
        avatar: '/uploads/avatar.png',
        social_links: '{"github":"https://github.com/example"}',
        show_avatar: 1,
        tab_title: 'Paolo Links',
        meta_description: 'All of Paolo links in one place.',
      };
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
      {
        id: '2',
        title: 'Opening hours',
        description: 'Monday to Friday',
        url: '',
        type: 'link',
        is_active: 1,
        sort_order: 1,
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
    expect(response.text).toContain('<li>Opening hours<p>Monday to Friday</p></li>');
    expect(response.text).toContain('src="/assets/');
    expect(response.text).toContain('href="/assets/');
    expect(response.text).toContain('href="/brand/orbitpage-favicon-48.png"');
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
      .get('/orbitpage/')
      .set('Host', 'links.example.test')
      .set('X-Forwarded-Proto', 'https');

    expect(response.status).toBe(200);
    expect(response.text).toContain('window.__ORBITPAGE_BASE_PATH__="/orbitpage"');
    expect(response.text).toContain('<link rel="canonical" href="https://links.example.test/orbitpage/"');
    expect(response.text).toContain('<meta property="og:url" content="https://links.example.test/orbitpage/"');
    expect(response.text).toContain('src="/orbitpage/assets/');
    expect(response.text).toContain('href="/orbitpage/assets/');
    expect(response.text).toContain('href="/orbitpage/brand/orbitpage-favicon-48.png"');
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
      origin: 'https://orbitpage-demo.example',
      canonicalUrl: 'https://orbitpage-demo.example/about',
      pageKind: 'about',
    });

    const tags = renderSeoTags({
      title: 'OrbitPage | Self-hosted Public Page Manager',
      description: 'OrbitPage is an open-source, self-hosted public page manager for people, brands, venues, events, and teams that want one place for links, content, analytics, privacy controls, and backups.',
      canonicalUrl: 'https://orbitpage-demo.example/about',
      imageUrl: 'https://raw.githubusercontent.com/paoloronco/OrbitPage/main/docs/screenshots/orbitpage-public-page.png',
      imageAlt: 'Screenshot of an OrbitPage public page',
      imageWidth: 1280,
      imageHeight: 720,
      keywords: 'self-hosted public page, open-source landing page, Docker link page, privacy-friendly page manager, OrbitPage',
      robots: 'index, follow, max-image-preview:large',
      structuredData,
      basePath: '',
    });

    expect(tags).toContain('<title>OrbitPage | Self-hosted Public Page Manager</title>');
    expect(tags).toContain('<link rel="canonical" href="https://orbitpage-demo.example/about"');
    expect(tags).toContain('<meta name="keywords" content="self-hosted public page');
    expect(tags).toContain('<meta property="og:image:alt" content="Screenshot of an OrbitPage public page"');
    expect(tags).toContain('<meta property="og:image:width" content="1280"');
    expect(tags).toContain('<meta property="og:image:height" content="720"');
    expect(tags).toContain('<meta name="twitter:image:alt" content="Screenshot of an OrbitPage public page"');
    expect(tags).toContain('"@type":"SoftwareApplication"');
    expect(tags).toContain('"codeRepository":"https://github.com/paoloronco/OrbitPage"');
  });

  it('uses the public root regardless of browser language while preserving legacy aliases', async () => {
    vi.mocked(dbGet).mockImplementation(async (sql, params) => {
      if (params?.[0] === 'page_slug') return { value: 'old-page' };
      if (String(sql).includes('FROM campaign_links')) return { full_config: JSON.stringify([
        { slug: 'home', label: 'Home', destination: '', timezone: 'Europe/Rome', enabled: true, rules: [] },
      ]) };
      return null;
    });

    const [root, alias, publicUrl, sitemap, campaign] = await Promise.all([
      request(app).get('/').set('Host', '127.0.0.1:9006').set('Accept-Language', 'it-IT,it;q=0.9'),
      request(app).get('/old-page').set('Host', '127.0.0.1:9006'),
      request(app).get('/api/public-url?locale=it').set('Host', '127.0.0.1:9006'),
      request(app).get('/sitemap.xml').set('Host', '127.0.0.1:9006'),
      request(app).get('/go/home').set('Host', '127.0.0.1:9006'),
    ]);

    expect(root.status).toBe(200);
    expect(root.text).toContain('href="http://127.0.0.1:9006/"');
    expect(alias.status).toBe(302);
    expect(alias.headers.location).toBe('/');
    expect(publicUrl.body.publicUrl).toBe('http://127.0.0.1:9006/');
    expect(sitemap.text).toContain('<loc>http://127.0.0.1:9006/</loc>');
    expect(sitemap.text).not.toMatch(/\/(?:en-US|it-IT)/);
    expect(campaign.headers.location).toBe('http://127.0.0.1:9006/');
  });

  it('redirects old localized public routes, preserving mount paths and query strings', async () => {
    vi.mocked(dbGet).mockImplementation(async (sql, params) => {
      if (params?.[0] === 'page_slug') return { value: 'paolo' };
      if (params?.[0] === 'public_page_active') return { value: '1' };
      if (String(sql).includes('FROM subpages_config')) return { full_config: JSON.stringify([{ id: 'services', slug: 'services', title: 'Services', description: '', links: [], enabled: true }]) };
      return null;
    });

    const [home, subpage, legacy, missing] = await Promise.all([
      request(app).get('/it-IT'),
      request(app).get('/orbitpage/en-US/services?source=old'),
      request(app).get('/it-IT/paolo'),
      request(app).get('/it-IT/other'),
    ]);

    expect(home.status).toBe(302);
    expect(home.headers.location).toBe('/');
    expect(subpage.status).toBe(302);
    expect(subpage.headers.location).toBe('/orbitpage/services?source=old');
    expect(legacy.status).toBe(302);
    expect(legacy.headers.location).toBe('/');
    expect(missing.status).toBe(404);
  });

  it('omits Open Graph dimensions when the image size is unknown', () => {
    const tags = renderSeoTags({
      title: 'Public profile',
      description: 'A public OrbitPage profile.',
      canonicalUrl: 'https://links.example.test/profile',
      imageUrl: 'https://cdn.example.test/user-upload.jpg',
      imageAlt: 'Profile cover',
      robots: 'index, follow',
      basePath: '',
    });

    expect(tags).toContain('<meta property="og:image" content="https://cdn.example.test/user-upload.jpg"');
    expect(tags).not.toContain('og:image:width');
    expect(tags).not.toContain('og:image:height');
  });

  it('builds about-page structured data with product and breadcrumb entities', () => {
    const data = buildStructuredData({
      profile: { name: 'OrbitPage', social_links: {} },
      links: [],
      origin: 'https://orbitpage-demo.example',
      canonicalUrl: 'https://orbitpage-demo.example/about',
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
    vi.mocked(dbGet).mockImplementation(async (sql) => String(sql).includes('FROM profile_data')
      ? { name: 'OrbitPage', bio: 'Public profile', machine_readable_enabled: 1 }
      : null);

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
    expect(canonical.text).toContain('Public profile');
    expect(canonical.type).toMatch(/text\/markdown/);
    expect(alias.status).toBe(200);
    expect(alias.text).toBe(canonical.text);
  });

  it('negotiates Markdown for the public page only after the profile opt-in', async () => {
    vi.mocked(dbGet).mockImplementation(async (sql) => String(sql).includes('FROM profile_data')
      ? { name: 'Alice', bio: 'Designer', social_links: '{}', machine_readable_enabled: 1 }
      : null);
    vi.mocked(dbAll).mockImplementation(async (sql) => String(sql).includes('FROM links')
      ? [{ id: 'portfolio', title: 'Portfolio', description: 'Selected work', url: 'https://example.com', type: 'link', is_active: 1 }]
      : []);

    const response = await request(app).get('/').set('Accept', 'text/markdown');

    expect(response.status).toBe(200);
    expect(response.type).toMatch(/text\/markdown/);
    expect(response.headers.vary).toBe('Accept');
    expect(response.text).toContain('# Alice');
    expect(response.text).toContain('Selected work');
    expect(dbRun).toHaveBeenCalledWith(expect.stringContaining('machine_readable_metrics'), ['markdown', '/']);
  });

  it('keeps HTML unchanged and rejects Markdown when machine access is disabled', async () => {
    vi.mocked(dbGet).mockImplementation(async (sql) => String(sql).includes('FROM profile_data')
      ? { name: 'Alice', bio: 'Designer', social_links: '{}', machine_readable_enabled: 0 }
      : null);

    const markdown = await request(app).get('/').set('Accept', 'text/markdown');
    const html = await request(app).get('/').set('Accept', 'text/html');

    expect(markdown.status).toBe(406);
    expect(html.status).toBe(200);
    expect(html.type).toMatch(/text\/html/);
    expect(html.text).toContain('application/ld+json');
    expect(html.text).not.toContain('type="text/markdown"');
  });

  it('returns bounded aggregate machine-readable telemetry to analytics readers', async () => {
    vi.mocked(dbAll).mockResolvedValueOnce([
      { day: '2026-09-14', format: 'markdown', path: '/', requests: 3 },
    ]);

    const response = await request(app).get('/api/analytics/machine-readable');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.headers).toHaveProperty('ratelimit-policy');
    expect(response.body.data).toEqual([
      { day: '2026-09-14', format: 'markdown', path: '/', requests: 3 },
    ]);
  });

  it('returns the shared 7-day analytics report from local events', async () => {
    vi.mocked(dbAll)
      .mockResolvedValueOnce([{ visits: 12, visitors: 8, clicks: 4, qr_visits: 3 }])
      .mockResolvedValueOnce([{ visits: 6, visitors: 4, clicks: 2 }])
      .mockResolvedValueOnce([{ date: '2026-09-27', visits: 12, visitors: 8, clicks: 4 }])
      .mockResolvedValueOnce([{ label: 'Direct', value: 12 }])
      .mockResolvedValueOnce([{ label: 'Desktop', value: 12 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ label: 'Homepage', value: 4 }])
      .mockResolvedValueOnce([{ label: '/', value: 12 }])
      .mockResolvedValueOnce([{ label: '/menu', value: 3 }]);

    const response = await request(app).get('/api/analytics?days=7');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.body).toMatchObject({
      configured: true,
      detailed: true,
      periodDays: 7,
      maxPeriodDays: 30,
      summary: { visits: 12, visitors: 8, clicks: 4, qrVisits: 3, ctr: 33.3 },
      comparison: { changes: { visits: 100, visitors: 100, clicks: 100, ctr: 0 } },
      links: [{ label: 'Homepage', value: 4 }],
      qrPaths: [{ label: '/menu', value: 3 }],
    });
  });

  it('stores a consented public page view without raw request identifiers', async () => {
    const response = await request(app)
      .post('/api/analytics/events')
      .set('User-Agent', 'Mozilla/5.0 (iPhone; Mobile)')
      .send({
        event: 'view',
        visitorId: 'visitor-1',
        referrer: 'https://www.instagram.com/post',
        path: '/it-IT/',
        utmSource: 'profile',
      });

    expect(response.status).toBe(204);
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO analytics_events'),
      ['view', 'visitor-1', null, 'instagram.com', 'Mobile', '/it-IT/', 'profile', null, null],
    );
  });

  it('GET text-discovery files exposes useful defaults', async () => {
    vi.mocked(dbGet).mockImplementation(async (sql) => String(sql).includes('FROM profile_data')
      ? { name: 'OrbitPage', machine_readable_enabled: 1 }
      : null);

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
    expect(response.body.data.files.map((file) => file.description)).toEqual([
      'Crawler access rules for this public page.',
      'The canonical LLM-readable summary. llm.txt is served as an alias.',
      'Human-readable page credits and ownership notes.',
      'Responsible disclosure contact metadata.',
      'Optional plain-text guidance for AI systems.',
    ]);
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
    vi.mocked(dbGet).mockImplementation(async (sql) => {
      if (String(sql).includes('FROM sitemap_config')) return { generated_at: '2026-07-16T12:00:00.000Z', updated_at: '2026-07-16T12:00:00.000Z' };
      if (String(sql).includes('SELECT MAX(updated_at)')) return { lastmod: '2026-07-16T12:00:00.000Z' };
      return null;
    });

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

  it.each(['menu', 'qr', 'sitemap', 'content/link', 'content/menu', 'content/shop', 'content/pages', 'editor/page', 'editor/content', 'editor/menu', 'editor/shop', 'editor/pages'])('GET /orbitpage/dashboard/%s supports direct section refreshes', async (section) => {
    const response = await request(app).get(`/orbitpage/dashboard/${section}`);
    expect(response.status).toBe(200);
    expect(response.headers['x-robots-tag']).toContain('noindex');
  });

  it('GET /orbitpage/it-IT/dashboard supports localized direct refreshes', async () => {
    const response = await request(app).get('/orbitpage/it-IT/dashboard');

    expect(response.status).toBe(200);
    expect(response.headers['x-robots-tag']).toContain('noindex');
    expect(response.headers['content-language']).toBe('it-IT');
  });

  it.each(['links', 'menu'])('GET /orbitpage/en-US/%s redirects to the public destination', async (destination) => {
    const response = await request(app).get(`/orbitpage/en-US/${destination}`);
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(`/orbitpage/${destination}`);
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

  it('PUT /api/links persists per-card surface effects', async () => {
    vi.mocked(dbAll).mockResolvedValueOnce([]);

    const response = await request(app)
      .put('/orbitpage/api/links')
      .set('Authorization', 'Bearer mock-token')
      .send([{
        id: 'glass-card',
        title: 'Glass card',
        url: 'https://example.com',
        type: 'link',
        surfaceEffect: 'liquid-glass',
      }]);

    expect(response.status).toBe(200);
    const insertCall = vi.mocked(dbRun).mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.trim().toUpperCase().startsWith('INSERT')
    );
    expect(insertCall).toBeDefined();
    expect(insertCall[0]).toContain('surface_effect');
    expect(insertCall[1]).toContain('liquid-glass');
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

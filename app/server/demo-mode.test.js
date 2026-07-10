import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const DEMO_TABLES = ['admin_users', 'profile_data', 'links', 'theme_config', 'cookie_consent_config'];

const createDatabaseMocks = () => {
  const tableRows = {
    admin_users: [
      {
        id: 1,
        username: 'admin',
        password_hash: 'hash',
        salt: 'salt',
        created_at: '2026-01-01 00:00:00',
        role: 'admin',
      },
      {
        id: 2,
        username: 'viewer',
        password_hash: 'viewer-hash',
        salt: 'viewer-salt',
        created_at: '2026-01-01 00:01:00',
        role: 'viewer',
      },
    ],
    profile_data: [],
    links: [],
    theme_config: [],
    cookie_consent_config: [],
  };

  const columnsFor = (table) => {
    const firstRow = tableRows[table]?.[0];
    if (firstRow) return Object.keys(firstRow).map((name) => ({ name }));
    return [{ name: 'id' }];
  };

  return {
    initializeDatabase: vi.fn().mockResolvedValue(true),
    dbGet: vi.fn(async (sql) => {
      if (String(sql).includes('SELECT id') && String(sql).includes('FROM profile_data')) {
        return { id: 1, privacy_policy_url: '/privacy', cookie_policy_url: '/cookies' };
      }
      if (String(sql).includes('SELECT username FROM admin_users')) return null;
      return null;
    }),
    dbAll: vi.fn(async (sql) => {
      const pragmaMatch = String(sql).match(/^PRAGMA table_info\((\w+)\)$/);
      if (pragmaMatch) return columnsFor(pragmaMatch[1]);

      const selectMatch = String(sql).match(/^SELECT \* FROM (\w+)$/);
      if (selectMatch) return tableRows[selectMatch[1]] || [];

      return [];
    }),
    dbRun: vi.fn().mockResolvedValue({ changes: 1 }),
    withTransaction: vi.fn(async (callback) => callback()),
  };
};

const importDemoServer = async () => {
  vi.resetModules();
  process.env.DEMO_MODE = 'true';
  process.env.BASE_PATH = '';

  const databaseMocks = createDatabaseMocks();

  vi.doMock('./database.js', () => databaseMocks);
  vi.doMock('./auth.js', () => ({
    isFirstTimeSetup: vi.fn().mockResolvedValue(false),
    setupInitialCredentials: vi.fn(),
    authenticateUser: vi.fn(),
    generateToken: vi.fn(() => 'mock-token'),
    verifyToken: vi.fn(() => ({ username: 'admin' })),
    authenticateToken: (req, res, next) => {
      req.user = {
        username: 'admin',
        role: 'admin',
        permissions: ['profile:write', 'users:manage', 'compliance:write'],
      };
      next();
    },
    requirePermission: vi.fn(() => (req, res, next) => next()),
    requireAnyPermission: vi.fn(() => (req, res, next) => next()),
    isPasswordStrong: vi.fn(() => true),
    generateSecurePassword: vi.fn(() => 'SecurePass123!'),
    ROLES: ['admin', 'editor', 'viewer'],
    ROLE_PERMISSIONS: {},
    getPermissionsForRole: vi.fn(() => ['profile:write', 'users:manage', 'compliance:write']),
  }));

  const { app } = await import('./server.js');
  return { app, databaseMocks };
};

describe('demo mode', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('./database.js');
    vi.doUnmock('./auth.js');
    delete process.env.DEMO_MODE;
    delete process.env.BASE_PATH;
  });

  it('allows creating additional users while demo mode is active', async () => {
    const { app, databaseMocks } = await importDemoServer();

    const response = await request(app)
      .post('/api/users')
      .set('Authorization', 'Bearer mock-token')
      .send({ username: 'demo_user', password: 'SecurePass123!', role: 'viewer' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ success: true, username: 'demo_user', role: 'viewer' });
    expect(databaseMocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO admin_users'),
      expect.arrayContaining(['demo_user', 'viewer'])
    );
  });

  it('preserves privacy policy URLs when saving profile changes in demo mode', async () => {
    const { app, databaseMocks } = await importDemoServer();

    const response = await request(app)
      .put('/api/profile')
      .set('Authorization', 'Bearer mock-token')
      .send({
        name: 'Edited Demo Profile',
        bio: 'This edit is allowed until reset.',
        avatar: '',
        social_links: {},
        privacy_policy_url: 'https://attacker.example/privacy',
        cookie_policy_url: 'https://attacker.example/cookies',
      });

    expect(response.status).toBe(200);
    const updateCall = databaseMocks.dbRun.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE profile_data SET')
    );
    expect(updateCall).toBeDefined();
    expect(updateCall[1]).toContain('/privacy');
    expect(updateCall[1]).toContain('/cookies');
    expect(updateCall[1]).not.toContain('https://attacker.example/privacy');
    expect(updateCall[1]).not.toContain('https://attacker.example/cookies');
  });

  it('restores the original demo database snapshot every 5 minutes', async () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    const { databaseMocks } = await importDemoServer();

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5 * 60 * 1000);

    databaseMocks.dbRun.mockClear();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    for (const table of DEMO_TABLES) {
      expect(databaseMocks.dbRun).toHaveBeenCalledWith(`DELETE FROM ${table}`);
    }
    expect(databaseMocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO admin_users'),
      expect.arrayContaining(['viewer', 'viewer-hash', 'viewer-salt', 'viewer'])
    );
  });
});

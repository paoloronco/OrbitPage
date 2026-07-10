import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.hoisted(() => {
  process.env.BASE_PATH = '/orbitpage';
  delete process.env.PUBLIC_SITE_URL;
  delete process.env.SITE_URL;
});

vi.mock('./database.js', () => ({
  initializeDatabase: vi.fn().mockResolvedValue(true),
  dbGet: vi.fn(),
  dbAll: vi.fn().mockResolvedValue([]),
  dbRun: vi.fn(),
  withTransaction: vi.fn(cb => cb())
}));

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

import { app } from './server.js';

describe('public URL endpoint', () => {
  it('returns the installed public page URL and ignores arbitrary URL input', async () => {
    const response = await request(app)
      .get('/orbitpage/api/public-url?url=https://evil.example.test/')
      .set('Host', 'links.example.test')
      .set('X-Forwarded-Proto', 'https');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      publicUrl: 'https://links.example.test/orbitpage/',
      source: 'request',
    });
  });
});

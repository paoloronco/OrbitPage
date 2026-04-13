import { describe, it, expect, vi } from 'vitest';
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

describe('API Endpoints', () => {
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
});

import { describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const TEST_JWT_SECRET = vi.hoisted(() => {
  const secret = 'orbitpage-test-jwt-secret-32-characters';
  process.env.JWT_SECRET = secret;
  return secret;
});

vi.mock('./database.js', () => ({
  dbAll: vi.fn(),
  dbGet: vi.fn(),
  dbRun: vi.fn(),
}));

import { dbGet, dbRun } from './database.js';

import {
  authenticateToken,
  createPersonalApiToken,
  generateToken,
  generateTwoFactorChallenge,
  isStrongJwtSecret,
  verifyToken,
  verifyTwoFactorChallenge,
} from './auth.js';

describe('JWT secret policy', () => {
  it.each(['', 'short', 'change-me', 'change-me-to-a-long-random-string', 'replace-with-a-long-random-secret', 'your-secret-key'])(
    'rejects insecure value %j',
    (value) => expect(isStrongJwtSecret(value)).toBe(false),
  );

  it('accepts a deployment-specific secret of at least 32 characters', () => {
    expect(isStrongJwtSecret('4fca58f3c9308ad18f292fabf94a88da')).toBe(true);
  });
});

describe('JWT purpose boundaries', () => {
  it('accepts sessions and restricts two-factor challenges to their verifier', () => {
    const session = generateToken('admin', 3);
    const challenge = generateTwoFactorChallenge('admin', 3);
    const legacyChallenge = jwt.sign(
      { username: 'admin', authVersion: 3, purpose: 'two-factor-login' },
      TEST_JWT_SECRET,
      { expiresIn: '5m', audience: 'orbitpage-two-factor', issuer: 'orbitpage' },
    );

    expect(verifyToken(session)).toMatchObject({ username: 'admin', authVersion: 3 });
    expect(verifyTwoFactorChallenge(challenge)).toMatchObject({ username: 'admin', authVersion: 3 });
    expect(verifyToken(challenge)).toBeNull();
    expect(verifyToken(legacyChallenge)).toBeNull();
  });

  it('limits personal tokens to stored scopes and never grants user management', async () => {
    dbGet.mockReset();
    dbRun.mockReset();
    dbGet
      .mockResolvedValueOnce({
        id: 'token-id', username: 'admin', scopes: JSON.stringify(['links:write', 'users:manage']),
      })
      .mockResolvedValueOnce({ username: 'admin', role: 'admin' });
    dbRun.mockResolvedValueOnce({ changes: 1 });
    const req = { headers: { authorization: 'Bearer op_pat_test-token' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toMatchObject({
      username: 'admin', authType: 'personal_token', permissions: ['links:write'],
    });
    expect(req.user.permissions).not.toContain('users:manage');
  });

  it('stores only a hash when creating a personal token', async () => {
    dbGet.mockReset();
    dbRun.mockReset();
    dbGet.mockResolvedValueOnce({ count: 0 });
    dbRun.mockResolvedValueOnce({ changes: 1 });

    const result = await createPersonalApiToken('admin', {
      name: 'automation', scopes: ['links:write'], expiresInDays: 90,
    });

    const insertedValues = dbRun.mock.calls[0][1];
    expect(result.token).toMatch(/^op_pat_/);
    expect(insertedValues).not.toContain(result.token);
    expect(insertedValues[4]).toMatch(/^[a-f0-9]{64}$/);
  });
});

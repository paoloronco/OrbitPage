import { describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const TEST_JWT_SECRET = vi.hoisted(() => {
  const secret = 'orbitpage-test-jwt-secret-32-characters';
  process.env.JWT_SECRET = secret;
  return secret;
});

vi.mock('./database.js', () => ({
  dbGet: vi.fn(),
  dbRun: vi.fn(),
}));

import {
  generateToken,
  generateTwoFactorChallenge,
  isStrongJwtSecret,
  verifyToken,
  verifyTwoFactorChallenge,
} from './auth.js';

describe('JWT secret policy', () => {
  it.each(['', 'short', 'change-me', 'change-me-to-a-long-random-string', 'your-secret-key'])(
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
});

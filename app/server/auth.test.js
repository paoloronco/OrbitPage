import { describe, expect, it, vi } from 'vitest';

vi.mock('./database.js', () => ({
  dbGet: vi.fn(),
  dbRun: vi.fn(),
}));

import { isStrongJwtSecret } from './auth.js';

describe('JWT secret policy', () => {
  it.each(['', 'short', 'change-me', 'change-me-to-a-long-random-string', 'your-secret-key'])(
    'rejects insecure value %j',
    (value) => expect(isStrongJwtSecret(value)).toBe(false),
  );

  it('accepts a deployment-specific secret of at least 32 characters', () => {
    expect(isStrongJwtSecret('4fca58f3c9308ad18f292fabf94a88da')).toBe(true);
  });
});

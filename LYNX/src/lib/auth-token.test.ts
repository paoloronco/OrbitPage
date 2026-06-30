import { afterEach, describe, expect, it, vi } from 'vitest';

import { authApi } from './api-client';

const storage = () => {
  let values: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => values[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete values[key];
    }),
    clear: vi.fn(() => {
      values = {};
    }),
  };
};

describe('auth token presence', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports no stored token when neither secure nor fallback storage has one', () => {
    vi.stubGlobal('localStorage', storage());
    vi.stubGlobal('sessionStorage', storage());

    expect(authApi.hasStoredToken()).toBe(false);
  });

  it('reports a stored token when the encrypted token and IV are present', () => {
    const local = storage();
    local.setItem('lynx-auth-token', 'ciphertext');
    local.setItem('lynx-auth-iv-lynx-auth-token', 'iv');
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', storage());

    expect(authApi.hasStoredToken()).toBe(true);
  });

  it('reports a stored token when the plain fallback token is present', () => {
    const session = storage();
    session.setItem('lynx-auth-token-plain', 'token');
    vi.stubGlobal('localStorage', storage());
    vi.stubGlobal('sessionStorage', session);

    expect(authApi.hasStoredToken()).toBe(true);
  });
});

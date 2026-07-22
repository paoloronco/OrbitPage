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
    if (typeof window !== 'undefined') delete (window as any).__orbitpageTokenCache;
    vi.unstubAllGlobals();
  });

  it('reports no stored token when neither secure nor fallback storage has one', () => {
    vi.stubGlobal('localStorage', storage());
    vi.stubGlobal('sessionStorage', storage());

    expect(authApi.hasStoredToken()).toBe(false);
  });

  it('reports a stored token when the encrypted token and IV are present', () => {
    const local = storage();
    local.setItem('orbitpage-auth-token', 'ciphertext');
    local.setItem('orbitpage-auth-iv-orbitpage-auth-token', 'iv');
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', storage());

    expect(authApi.hasStoredToken()).toBe(true);
  });

  it('ignores obsolete plaintext fallback tokens', () => {
    const session = storage();
    session.setItem('orbitpage-auth-token-plain', 'token');
    vi.stubGlobal('localStorage', storage());
    vi.stubGlobal('sessionStorage', session);

    expect(authApi.hasStoredToken()).toBe(false);
  });

  it('reports an in-memory token in non-secure browser contexts', () => {
    vi.stubGlobal('localStorage', storage());
    vi.stubGlobal('sessionStorage', storage());
    vi.stubGlobal('window', {
      location: { hash: '', search: '', href: 'http://example.test/', origin: 'http://example.test' },
      history: { replaceState: vi.fn(), state: null },
    });
    (window as any).__orbitpageTokenCache = { iv: '', ct: '', val: 'token' };

    expect(authApi.hasStoredToken()).toBe(true);
  });
});

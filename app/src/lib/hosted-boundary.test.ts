import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { authApi, getSaasApiBase, isSaasMode } from './api-client';
import { apiPath } from './base-path';
import { getHostedSurfaceConfig } from './hosted-surface';
import { getPublicUrlOverride } from './public-url-override';

const adminViewSource = readFileSync(new URL('../components/AdminView.tsx', import.meta.url), 'utf8');

const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
    clear: vi.fn(() => values.clear()),
  };
};

const browserWindow = (href: string) => {
  const url = new URL(href);
  const location = {
    href: url.toString(),
    origin: url.origin,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
  };
  const replaceState = vi.fn((_state: unknown, _title: string, nextHref: string) => {
    const next = new URL(nextHref, location.href);
    location.href = next.toString();
    location.origin = next.origin;
    location.pathname = next.pathname;
    location.search = next.search;
    location.hash = next.hash;
  });
  return { location, history: { replaceState, state: null } };
};

const jsonResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  headers: { get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
  json: vi.fn(async () => body),
  text: vi.fn(async () => JSON.stringify(body)),
});

describe('hosted runtime boundary', () => {
  afterEach(() => {
    try {
      authApi.logout();
    } catch {
      // Some assertions intentionally run without browser storage.
    }
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('ignores hosted URL, token, slug, public URL, and global config inputs in the OSS build', async () => {
    vi.stubEnv('VITE_ORBITPAGE_HOSTED_MODE', 'false');
    const currentWindow = browserWindow(
      'https://self-hosted.example/dashboard/profile?apiBase=https%3A%2F%2Fattacker.example%2Fapi&publicSlug=stolen&publicUrl=https%3A%2F%2Fattacker.example%2Fpage#apiToken=hash-token&appCheckToken=hash-app-check',
    );
    Object.assign(currentWindow, {
      __ORBITPAGE_API_BASE__: 'https://attacker.example/global-api',
      __ORBITPAGE_HOSTED_SURFACE__: true,
      __ORBITPAGE_HOSTED_CONFIG__: {
        apiBase: 'https://attacker.example/config-api',
        publicSlug: 'config-slug',
        publicUrl: 'https://attacker.example/config-page',
        apiToken: 'config-token',
        section: 'profile',
        locale: 'en',
      },
      __orbitpageTokenCache: { iv: '', ct: '', val: 'self-hosted-session-token' },
    });
    vi.stubGlobal('window', currentWindow);
    vi.stubGlobal('localStorage', storage());
    vi.stubGlobal('sessionStorage', storage());
    vi.stubGlobal('crypto', {});
    const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({ valid: true }));
    vi.stubGlobal('fetch', request);

    expect(isSaasMode()).toBe(false);
    expect(getSaasApiBase()).toBeNull();
    expect(getHostedSurfaceConfig()).toBeNull();
    expect(getPublicUrlOverride()).toBeNull();
    expect(apiPath('/auth/verify')).toBe('/api/auth/verify');

    await authApi.verify();

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe('/api/auth/verify');
    expect(request.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer self-hosted-session-token',
    });
    expect(request.mock.calls[0][1]?.headers).not.toHaveProperty('X-Firebase-AppCheck');
    expect(currentWindow.history.replaceState).not.toHaveBeenCalled();
  });

  it('does not infer hosted dashboard mode directly from an apiBase query parameter', () => {
    expect(adminViewSource).not.toContain('new URLSearchParams(window.location.search).has("apiBase")');
  });

  it('uses only the integrated same-origin host configuration in a hosted build', async () => {
    vi.stubEnv('VITE_ORBITPAGE_HOSTED_MODE', 'true');
    const currentWindow = browserWindow(
      'https://orbitpage.com/dashboard/profile?apiBase=https%3A%2F%2Fattacker.example%2Fapi&publicSlug=stolen&publicUrl=https%3A%2F%2Fattacker.example%2Fpage#apiToken=hash-token&appCheckToken=hash-app-check',
    );
    Object.assign(currentWindow, {
      __ORBITPAGE_HOSTED_SURFACE__: true,
      __ORBITPAGE_HOSTED_CONFIG__: {
        apiBase: 'https://orbitpage.com/api/orbitpage',
        publicSlug: 'alice',
        publicUrl: 'https://orbitpage.net/alice',
        apiToken: 'hosted-token',
        appCheckToken: 'hosted-app-check',
        section: 'profile',
        locale: 'en',
      },
    });
    vi.stubGlobal('window', currentWindow);
    vi.stubGlobal('localStorage', storage());
    vi.stubGlobal('sessionStorage', storage());
    vi.stubGlobal('crypto', {});
    const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({ valid: true }));
    vi.stubGlobal('fetch', request);

    expect(isSaasMode()).toBe(true);
    expect(getSaasApiBase()).toBe('https://orbitpage.com/api/orbitpage');
    expect(getPublicUrlOverride()).toBe('https://orbitpage.net/alice');

    await authApi.verify();

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe('https://orbitpage.com/api/orbitpage/auth/verify');
    expect(request.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer hosted-token',
      'X-Firebase-AppCheck': 'hosted-app-check',
    });
    expect(currentWindow.history.replaceState).not.toHaveBeenCalled();
  });

  it('blocks a hosted credential from reaching a cross-origin API base', async () => {
    vi.stubEnv('VITE_ORBITPAGE_HOSTED_MODE', 'true');
    const currentWindow = browserWindow(
      'https://orbitpage.com/dashboard/profile?apiBase=https%3A%2F%2Fattacker.example%2Fapi#apiToken=hosted-token',
    );
    Object.assign(currentWindow, {
      __ORBITPAGE_API_BASE__: 'https://attacker.example/api',
      __ORBITPAGE_HOSTED_SURFACE__: true,
      __ORBITPAGE_HOSTED_CONFIG__: {
        apiBase: 'https://attacker.example/api',
        publicSlug: 'alice',
        publicUrl: 'https://orbitpage.net/alice',
        apiToken: 'hosted-token',
        section: 'profile',
        locale: 'en',
      },
    });
    vi.stubGlobal('window', currentWindow);
    vi.stubGlobal('localStorage', storage());
    vi.stubGlobal('sessionStorage', storage());
    vi.stubGlobal('crypto', {});
    const request = vi.fn();
    vi.stubGlobal('fetch', request);

    await expect(authApi.verify()).rejects.toThrow('Authenticated API requests must use the current browser origin.');
    expect(request).not.toHaveBeenCalled();
  });

  it('keeps a trusted cross-origin API base available to an unauthenticated static snapshot', () => {
    vi.stubEnv('VITE_ORBITPAGE_HOSTED_MODE', 'false');
    const currentWindow = browserWindow('https://public.example/alice');
    Object.assign(currentWindow, {
      __ORBITPAGE_STATIC_SNAPSHOT__: { page: {} },
      __ORBITPAGE_API_BASE__: 'https://orbitpage.com/api/orbitpage',
    });
    vi.stubGlobal('window', currentWindow);

    expect(apiPath('/embed/block-1')).toBe('https://orbitpage.com/api/orbitpage/embed/block-1');
  });

  it('blocks credentials even when a static snapshot has a cross-origin API base', async () => {
    vi.stubEnv('VITE_ORBITPAGE_HOSTED_MODE', 'false');
    const currentWindow = browserWindow('https://public.example/alice');
    Object.assign(currentWindow, {
      __ORBITPAGE_STATIC_SNAPSHOT__: { page: {} },
      __ORBITPAGE_API_BASE__: 'https://attacker.example/api',
      __orbitpageTokenCache: { iv: '', ct: '', val: 'unexpected-session-token' },
    });
    vi.stubGlobal('window', currentWindow);
    vi.stubGlobal('localStorage', storage());
    vi.stubGlobal('sessionStorage', storage());
    vi.stubGlobal('crypto', {});
    const request = vi.fn();
    vi.stubGlobal('fetch', request);

    await expect(authApi.verify()).rejects.toThrow('Authenticated API requests must use the current browser origin.');
    expect(request).not.toHaveBeenCalled();
  });
});

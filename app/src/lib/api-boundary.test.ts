import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { authApi, uploadApi } from './api-client';
import { apiPath } from './base-path';
import { configureEditorIntegration, getEditorIntegration, isEmbeddedEditor } from './editor-integration';
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

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
  json: vi.fn(async () => body),
  text: vi.fn(async () => JSON.stringify(body)),
});

describe('self-hosted API boundary', () => {
  afterEach(async () => {
    try {
      await authApi.logout();
    } catch {
      // Some assertions intentionally run without browser storage.
    }
    configureEditorIntegration(null, null);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('ignores URL and global inputs that try to override the local session and API', async () => {
    const currentWindow = browserWindow(
      'https://self-hosted.example/dashboard/profile?apiBase=https%3A%2F%2Fattacker.example%2Fapi&publicSlug=stolen&publicUrl=https%3A%2F%2Fattacker.example%2Fpage#apiToken=hash-token&appCheckToken=hash-app-check',
    );
    Object.assign(currentWindow, {
      __ORBITPAGE_API_BASE__: 'https://attacker.example/global-api',
      __orbitpageTokenCache: { iv: '', ct: '', val: 'self-hosted-session-token' },
    });
    vi.stubGlobal('window', currentWindow);
    vi.stubGlobal('localStorage', storage());
    vi.stubGlobal('sessionStorage', storage());
    vi.stubGlobal('crypto', {});
    const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({ valid: true }));
    vi.stubGlobal('fetch', request);

    expect(isEmbeddedEditor()).toBe(false);
    expect(getEditorIntegration()).toBeNull();
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

  it('uploads source videos directly to the local server without a managed reservation', async () => {
    vi.stubGlobal('window', browserWindow('https://self-hosted.example/dashboard/profile'));
    vi.stubGlobal('sessionStorage', storage());
    vi.stubGlobal('crypto', {});
    const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({ filePath: 'video.webm', fullUrl: '/uploads/video.webm', fileName: 'video.webm' }));
    vi.stubGlobal('fetch', request);
    await uploadApi.uploadVideo(new File(['video'], 'video.webm', { type: 'video/webm' }), 'test-video');
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe('/api/upload/video');
  });

  it('keeps a trusted cross-origin API base available to an unauthenticated static snapshot', () => {
    const currentWindow = browserWindow('https://public.example/alice');
    Object.assign(currentWindow, {
      __ORBITPAGE_STATIC_SNAPSHOT__: { page: {} },
      __ORBITPAGE_API_BASE__: 'https://orbitpage.com/api/orbitpage',
    });
    vi.stubGlobal('window', currentWindow);

    expect(apiPath('/embed/block-1')).toBe('https://orbitpage.com/api/orbitpage/embed/block-1');
  });

  it('blocks credentials even when a static snapshot has a cross-origin API base', async () => {
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

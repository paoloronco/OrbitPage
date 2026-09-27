import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasStaticPublicSnapshot, trackPublicLinkClick, trackPublicPageView } from './public-runtime';
import { consentManager } from './consent-manager';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('managed public runtime', () => {
  it('sends managed page views and clicks to the same-origin edge collector', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    const localStorage = new Map<string, string>();
    const sessionStorage = new Map<string, string>();
    vi.stubGlobal('window', {
      __ORBITPAGE_STATIC_SNAPSHOT__: { page: {} },
      __ORBITPAGE_BASE_PATH__: '/example',
      location: { href: 'https://orbitpage.net/example?utm_source=ig', hostname: 'orbitpage.net', pathname: '/example', search: '?utm_source=ig' },
      localStorage: { getItem: (key: string) => localStorage.get(key) || null, setItem: (key: string, value: string) => localStorage.set(key, value) },
      sessionStorage: { getItem: (key: string) => sessionStorage.get(key) || null, setItem: (key: string, value: string) => sessionStorage.set(key, value) },
    });
    vi.stubGlobal('document', { referrer: 'https://instagram.com/' });
    vi.stubGlobal('crypto', { randomUUID: () => 'visitor-1' });
    vi.stubGlobal('fetch', fetchMock);

    expect(hasStaticPublicSnapshot()).toBe(true);
    trackPublicPageView();
    trackPublicPageView();
    trackPublicLinkClick('link-1');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/example/_orbitpage/event', expect.objectContaining({ method: 'POST', keepalive: true }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/example/_orbitpage/event', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ event: 'view', visitorId: 'visitor-1', utmSource: 'ig' });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ event: 'click', linkId: 'link-1' });
  });

  it('sends self-hosted views and clicks to the local analytics API', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    const localStorage = new Map<string, string>();
    const sessionStorage = new Map<string, string>();
    vi.spyOn(consentManager, 'isGranted').mockReturnValue(true);
    vi.stubGlobal('window', {
      location: { href: 'https://self-hosted.example/', hostname: 'self-hosted.example', pathname: '/', search: '' },
      localStorage: { getItem: (key: string) => localStorage.get(key) || null, setItem: (key: string, value: string) => localStorage.set(key, value) },
      sessionStorage: { getItem: (key: string) => sessionStorage.get(key) || null, setItem: (key: string, value: string) => sessionStorage.set(key, value) },
    });
    vi.stubGlobal('document', { referrer: '' });
    vi.stubGlobal('crypto', { randomUUID: () => 'visitor-oss' });
    vi.stubGlobal('fetch', fetchMock);

    expect(hasStaticPublicSnapshot()).toBe(false);
    trackPublicPageView();
    trackPublicLinkClick('link-1');

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/analytics/events', expect.objectContaining({
      method: 'POST',
      keepalive: true,
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/links/link-1/click', expect.objectContaining({
      method: 'POST',
      keepalive: true,
    }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ event: 'view', visitorId: 'visitor-oss' });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ event: 'click', linkId: 'link-1' });
  });
});

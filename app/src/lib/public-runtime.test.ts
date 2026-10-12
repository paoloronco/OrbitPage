import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasStaticPublicSnapshot, startPublicPageEngagement, trackPublicLinkClick, trackPublicPageView } from './public-runtime';
import { consentManager } from './consent-manager';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('managed public runtime', () => {
  it('measures visible time only after consent, stops on withdrawal and removes its listeners', () => {
    vi.useFakeTimers();
    let granted = false;
    let now = 0;
    let changed: Parameters<typeof consentManager.onConsentChange>[0] = () => {};
    const off = vi.fn();
    vi.spyOn(consentManager, 'isGranted').mockImplementation(() => granted);
    vi.spyOn(consentManager, 'onConsentChange').mockImplementation(callback => { changed = callback; return off; });
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const local = new Map<string, string>(), session = new Map<string, string>();
    const storage = (map: Map<string, string>) => ({ getItem: (key: string) => map.get(key) || null, setItem: (key: string, value: string) => map.set(key, value) });
    const pageWindow = Object.assign(new EventTarget(), { __ORBITPAGE_STATIC_SNAPSHOT__: { page: {} }, location: { hostname: 'example.invalid', href: 'https://example.invalid/', pathname: '/', search: '' }, localStorage: storage(local), sessionStorage: storage(session) });
    const pageDocument = Object.assign(new EventTarget(), { referrer: '', visibilityState: 'visible' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('window', pageWindow); vi.stubGlobal('document', pageDocument); vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'fictional-session-1' });
    const stop = startPublicPageEngagement()!;
    vi.advanceTimersByTime(30_000);
    expect(fetchMock).not.toHaveBeenCalled(); expect(local.size + session.size).toBe(0);
    granted = true; changed(null);
    now = 30_000; vi.advanceTimersByTime(30_000);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ event: 'engagement', durationSeconds: 30, activeSeconds: 30, engagementStart: true });
    now = 35_000; pageDocument.visibilityState = 'hidden'; pageDocument.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(90_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    now = 125_000; pageDocument.visibilityState = 'visible'; pageDocument.dispatchEvent(new Event('visibilitychange'));
    now = 155_000; vi.advanceTimersByTime(30_000);
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toMatchObject({ durationSeconds: 65, activeSeconds: 30, engagementStart: false });
    granted = false; changed(null); now = 200_000; vi.advanceTimersByTime(30_000); stop();
    expect(fetchMock).toHaveBeenCalledTimes(4); expect(off).toHaveBeenCalledOnce();
    granted = true; pageWindow.dispatchEvent(new Event('pageshow')); now = 230_000; vi.advanceTimersByTime(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
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

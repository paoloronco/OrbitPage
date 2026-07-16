import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasStaticPublicSnapshot, trackPublicLinkClick } from './public-runtime';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('managed public runtime', () => {
  it('does not send click requests from a static managed snapshot', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('window', {
      __ORBITPAGE_STATIC_SNAPSHOT__: { page: {} },
      location: { href: 'https://orbitpage.net/example', pathname: '/example', search: '' },
    });
    vi.stubGlobal('fetch', fetchMock);

    expect(hasStaticPublicSnapshot()).toBe(true);
    trackPublicLinkClick('link-1');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps click tracking available to the self-hosted runtime', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('window', {
      location: { href: 'https://self-hosted.example/', pathname: '/', search: '' },
    });
    vi.stubGlobal('fetch', fetchMock);

    expect(hasStaticPublicSnapshot()).toBe(false);
    trackPublicLinkClick('link-1');

    expect(fetchMock).toHaveBeenCalledWith('/api/links/link-1/click', { method: 'POST' });
  });
});

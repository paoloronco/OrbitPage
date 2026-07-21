import { describe, expect, it } from 'vitest';
import { getKnownEmbedUrl, getServiceLinkData, getSocialRowData, getSocialRowDraftData } from './link-blocks';

describe('compact link block data', () => {
  it('keeps legacy social rows compatible', () => {
    const data = getSocialRowData(JSON.stringify({
      items: [
        { label: 'Instagram', url: 'https://instagram.com/orbitpage' },
        { label: '', url: '' },
      ],
    }));

    expect(data).toMatchObject({
      layout: 'icons',
      iconStyle: 'brand',
      columns: 2,
      boxed: false,
      showTitle: false,
      showLabels: false,
    });
    expect(data.items).toEqual([
      { label: 'Instagram', url: 'https://instagram.com/orbitpage', platform: 'auto', icon: '' },
    ]);
  });

  it('keeps icon-only custom URLs without requiring visible text', () => {
    const data = getSocialRowData(JSON.stringify({
      items: [{ label: '', url: 'https://orbitpage.com', platform: 'website' }],
    }));

    expect(data.items).toEqual([
      { label: '', url: 'https://orbitpage.com', platform: 'website', icon: '' },
    ]);
    expect(data).toMatchObject({ layout: 'icons', boxed: false, showTitle: false });
  });

  it('normalizes rich compact links and rejects unsupported settings', () => {
    const data = getSocialRowDraftData(JSON.stringify({
      layout: 'icons',
      iconStyle: 'brand',
      columns: 4,
      boxed: false,
      showTitle: false,
      showLabels: false,
      items: [
        { label: 'Menu', url: '/menu', platform: 'page', icon: '🍽️' },
        { label: 'Unsafe setting', url: '/other', platform: 'unknown' },
      ],
    }));

    expect(data).toMatchObject({
      layout: 'icons',
      iconStyle: 'brand',
      columns: 4,
      boxed: false,
      showTitle: false,
      showLabels: false,
    });
    expect(data.items?.[0]).toEqual({ label: 'Menu', url: '/menu', platform: 'page', icon: '🍽️' });
    expect(data.items?.[1]?.platform).toBe('auto');
  });

  it('caps the number of compact links', () => {
    const items = Array.from({ length: 30 }, (_, index) => ({
      label: `Link ${index}`,
      url: `/page-${index}`,
    }));

    expect(getSocialRowDraftData(JSON.stringify({ items })).items).toHaveLength(16);
  });
});

describe('official service embeds', () => {
  it.each([
    ['instagram', 'https://www.instagram.com/reel/ABC_123/', 'https://www.instagram.com/reel/ABC_123/embed/captioned/'],
    ['youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['youtube', 'https://www.youtube.com/shorts/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['youtube', 'https://www.youtube.com/live/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['spotify', 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT', 'https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT'],
    ['deezer', 'https://www.deezer.com/track/3135556', 'https://widget.deezer.com/widget/auto/track/3135556'],
    ['vimeo', 'https://vimeo.com/76979871', 'https://player.vimeo.com/video/76979871?dnt=1'],
    ['tiktok', 'https://www.tiktok.com/@scout2015/video/6718335390845095173', 'https://www.tiktok.com/player/v1/6718335390845095173'],
    ['giphy', 'https://giphy.com/gifs/reaction-example-3o7aD2saalBwwftBIY', 'https://giphy.com/embed/3o7aD2saalBwwftBIY'],
  ] as const)('creates an allowlisted %s player URL', (provider, source, expected) => {
    expect(getKnownEmbedUrl(provider, source)).toBe(expected);
  });

  it('creates a SoundCloud player without trusting a supplied iframe host', () => {
    const result = getKnownEmbedUrl('soundcloud', 'https://soundcloud.com/forss/flickermood');
    expect(result).toContain('https://w.soundcloud.com/player/?url=');
    expect(result).toContain(encodeURIComponent('https://soundcloud.com/forss/flickermood'));
  });

  it('rejects lookalike and non-HTTPS provider domains', () => {
    expect(getKnownEmbedUrl('spotify', 'https://open.spotify.com.evil.example/track/example')).toBeNull();
    expect(getKnownEmbedUrl('vimeo', 'http://vimeo.com/76979871')).toBeNull();
    expect(getKnownEmbedUrl('giphy', 'https://example.com/embed/3o7aD2saalBwwftBIY')).toBeNull();
  });

  it('keeps branded service-link metadata backward compatible', () => {
    expect(getServiceLinkData(JSON.stringify({ service: 'whatsapp' }))).toEqual({ service: 'whatsapp' });
    expect(getServiceLinkData(JSON.stringify({ service: 'unsupported' }))).toEqual({ service: undefined });
    expect(getServiceLinkData(undefined)).toEqual({});
  });
});

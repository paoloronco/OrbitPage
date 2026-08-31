import { describe, expect, it } from 'vitest';
import { detectEmbedProvider, getInternalLinksData, getKnownEmbedUrl, getServiceLinkData, getSocialRowData, getSocialRowDraftData, getTypeformFormReference, isSocialRowContent } from './link-blocks';

describe('compact link block data', () => {
  it('normalizes internal navigation layouts and removes unsafe stored paths', () => {
    expect(getInternalLinksData(JSON.stringify({
      items: [
        { id: 'menu', kind: 'menu', path: '/menu', label: 'Menu' },
        { id: 'unsafe', kind: 'page', path: '//attacker.test', label: 'Unsafe' },
      ],
      layout: 'grid',
      columns: 3,
      itemStyle: 'minimal',
      showDescriptions: false,
      showIcons: true,
    }))).toMatchObject({
      layout: 'grid',
      columns: 3,
      itemStyle: 'minimal',
      showDescriptions: false,
      items: [{ id: 'menu', kind: 'menu', path: '/menu', label: 'Menu' }],
    });
  });
  it('recognizes legacy quick-link payloads when their block type was lost', () => {
    expect(isSocialRowContent(JSON.stringify({
      items: [{ label: 'Instagram', url: 'orbitpage', platform: 'instagram' }],
      iconStyle: 'brand',
      showLabels: false,
    }))).toBe(true);
    expect(isSocialRowContent(JSON.stringify({ text: 'not a quick-link row' }))).toBe(false);
    expect(isSocialRowContent(JSON.stringify({
      items: [{ id: 'menu', kind: 'menu', path: '/menu', label: 'Menu' }],
      layout: 'grid',
      itemStyle: 'outline',
      showDescriptions: true,
      showIcons: true,
    }))).toBe(false);
  });

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
    ['facebook', 'https://www.facebook.com/orbitpage/posts/123456789012345', 'https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Forbitpage%2Fposts%2F123456789012345&show_text=true&width=500'],
    ['youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['youtube', 'https://www.youtube.com/shorts/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['youtube', 'https://www.youtube.com/live/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['spotify', 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT', 'https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT'],
    ['apple_music', 'https://music.apple.com/it/album/example/123456789', 'https://embed.music.apple.com/it/album/example/123456789'],
    ['deezer', 'https://www.deezer.com/track/3135556', 'https://widget.deezer.com/widget/auto/track/3135556'],
    ['mixcloud', 'https://www.mixcloud.com/orbitpage/demo-show/', 'https://www.mixcloud.com/widget/iframe/?hide_cover=1&light=1&feed=%2Forbitpage%2Fdemo-show%2F'],
    ['vimeo', 'https://vimeo.com/76979871', 'https://player.vimeo.com/video/76979871?dnt=1'],
    ['loom', 'https://www.loom.com/share/12345678-1234-1234-1234-123456789abc', 'https://www.loom.com/embed/12345678-1234-1234-1234-123456789abc'],
    ['tiktok', 'https://www.tiktok.com/@scout2015/video/6718335390845095173', 'https://www.tiktok.com/player/v1/6718335390845095173'],
    ['giphy', 'https://giphy.com/gifs/reaction-example-3o7aD2saalBwwftBIY', 'https://giphy.com/embed/3o7aD2saalBwwftBIY'],
    ['google_calendar', 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ0123456789_ABCDEFGHIJKLMNOPQRSTUVWXYZabcd', 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ0123456789_ABCDEFGHIJKLMNOPQRSTUVWXYZabcd?gv=true'],
    ['calendly', 'https://calendly.com/orbitpage-demo/30min', 'https://calendly.com/orbitpage-demo/30min'],
    ['typeform', 'https://orbitpage.typeform.com/to/moe6aa?typeform-source=example.com', 'https://form.typeform.com/to/moe6aa'],
    ['google_forms', 'https://docs.google.com/forms/d/e/1FAIpQLSc1234567890abcdefghijklmnop/viewform', 'https://docs.google.com/forms/d/e/1FAIpQLSc1234567890abcdefghijklmnop/viewform?embedded=true'],
  ] as const)('creates an allowlisted %s player URL', (provider, source, expected) => {
    expect(getKnownEmbedUrl(provider, source)).toBe(expected);
  });

  it('creates a SoundCloud player without trusting a supplied iframe host', () => {
    const result = getKnownEmbedUrl('soundcloud', 'https://soundcloud.com/forss/flickermood');
    expect(result).toContain('https://w.soundcloud.com/player/?url=');
    expect(result).toContain(encodeURIComponent('https://soundcloud.com/forss/flickermood'));
  });

  it('identifies YouTube embeds without leaking tenant paths or access tokens', () => {
    const result = getKnownEmbedUrl(
      'youtube',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://orbitpage.net/example?demoAccess=secret-token',
    );
    const playerUrl = new URL(result || '');

    expect(playerUrl.origin).toBe('https://www.youtube-nocookie.com');
    expect(playerUrl.searchParams.get('enablejsapi')).toBe('1');
    expect(playerUrl.searchParams.get('origin')).toBe('https://orbitpage.net');
    expect(playerUrl.searchParams.get('widget_referrer')).toBe('https://orbitpage.net');
    expect(result).not.toContain('example');
    expect(result).not.toContain('secret-token');
  });

  it('ignores invalid or credential-bearing embedder URLs', () => {
    expect(getKnownEmbedUrl('youtube', 'https://youtu.be/dQw4w9WgXcQ', 'javascript:alert(1)'))
      .toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(getKnownEmbedUrl('youtube', 'https://youtu.be/dQw4w9WgXcQ', 'https://user:secret@orbitpage.net/example'))
      .toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });

  it('rejects lookalike and non-HTTPS provider domains', () => {
    expect(getKnownEmbedUrl('spotify', 'https://open.spotify.com.evil.example/track/example')).toBeNull();
    expect(getKnownEmbedUrl('vimeo', 'http://vimeo.com/76979871')).toBeNull();
    expect(getKnownEmbedUrl('giphy', 'https://example.com/embed/3o7aD2saalBwwftBIY')).toBeNull();
    expect(getKnownEmbedUrl('google_calendar', 'https://calendar.google.com.evil.example/calendar/appointments/schedules/AcZssZ0123456789_ABCDEFGHIJKLMNOPQRSTUVWXYZabcd')).toBeNull();
    expect(getKnownEmbedUrl('google_calendar', 'https://calendar.google.com/calendar/u/0/r')).toBeNull();
    expect(getKnownEmbedUrl('typeform', 'https://typeform.com.evil.example/to/moe6aa')).toBeNull();
    expect(getKnownEmbedUrl('typeform', 'https://admin.typeform.com/form/moe6aa/create')).toBeNull();
    expect(getKnownEmbedUrl('facebook', 'https://facebook.com.evil.example/orbitpage/posts/123')).toBeNull();
    expect(getKnownEmbedUrl('apple_music', 'https://music.apple.com.evil.example/it/album/example/123')).toBeNull();
    expect(getKnownEmbedUrl('mixcloud', 'https://mixcloud.com.evil.example/orbitpage/show/')).toBeNull();
    expect(getKnownEmbedUrl('loom', 'https://loom.com.evil.example/share/12345678-1234-1234-1234-123456789abc')).toBeNull();
    expect(getKnownEmbedUrl('google_forms', 'https://docs.google.com/forms/d/e/example/edit')).toBeNull();
  });

  it('detects providers by parsed hostname instead of unsafe substrings', () => {
    expect(detectEmbedProvider('https://open.spotify.com/track/example')).toBe('spotify');
    expect(detectEmbedProvider('https://music.apple.com/it/album/example/123456789')).toBe('apple_music');
    expect(detectEmbedProvider('https://www.loom.com/share/12345678-1234-1234-1234-123456789abc')).toBe('loom');
    expect(detectEmbedProvider('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>')).toBe('youtube');
    expect(detectEmbedProvider('https://open.spotify.com.attacker.example/track/example')).toBe('custom');
    expect(detectEmbedProvider('https://attacker.example/?next=calendly.com/demo')).toBe('custom');
    expect(detectEmbedProvider('javascript:youtube.com')).toBe('custom');
  });

  it('extracts Typeform IDs and selects the matching data region', () => {
    expect(getTypeformFormReference('https://form.typeform.com/to/moe6aa')).toEqual({
      id: 'moe6aa',
      region: 'us',
      publicUrl: 'https://form.typeform.com/to/moe6aa',
    });
    expect(getTypeformFormReference('https://eu.typeform.com/to/AbCd_123')).toEqual({
      id: 'AbCd_123',
      region: 'eu',
      publicUrl: 'https://eu.typeform.com/to/AbCd_123',
    });
  });

  it('keeps branded service-link metadata backward compatible', () => {
    expect(getServiceLinkData(JSON.stringify({ service: 'whatsapp' }))).toEqual({ service: 'whatsapp' });
    expect(getServiceLinkData(JSON.stringify({ service: 'unsupported' }))).toEqual({ service: undefined });
    expect(getServiceLinkData(undefined)).toEqual({});
  });
});

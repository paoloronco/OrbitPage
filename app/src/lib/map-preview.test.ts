import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveMapPreview } from '../../packages/map-preview.js';

describe('map short-link request boundary', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    'http://maps.app.goo.gl/test',
    'https://maps.app.goo.gl.attacker.example/test',
    'https://maps.app.goo.gl@127.0.0.1/test',
    'https://user:password@maps.app.goo.gl/test',
    'https://maps.app.goo.gl:8443/test',
    'https://maps.app.goo.gl/%2f%2f127.0.0.1',
    'https://maps.app.goo.gl/test/extra',
    'https://goo.gl/not-maps/test',
    'https://127.0.0.1/test',
    'https://[::1]/test',
  ])('never fetches an unsupported target: %s', async mapUrl => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(resolveMapPreview({ mapUrl })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(['https://maps.app.goo.gl/allowed', 'https://goo.gl/maps/allowed'])('fetches only the canonical short link: %s', async mapUrl => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'https://www.google.com/maps?q=45.1,7.2' } }));
    vi.stubGlobal('fetch', fetcher);
    await expect(resolveMapPreview({ mapUrl: `${mapUrl}?ignored=value#fragment` })).resolves.toMatchObject({ lat: '45.1', lon: '7.2', source: 'redirect' });
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(mapUrl, expect.objectContaining({ redirect: 'manual' }));
  });

  it.each(['http://169.254.169.254/metadata', 'https://maps.app.goo.gl.attacker.example/redirect', '//127.0.0.1/private'])('rejects an unsafe redirect: %s', async location => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location } }));
    vi.stubGlobal('fetch', fetcher);
    await expect(resolveMapPreview({ mapUrl: `https://maps.app.goo.gl/redirect-${encodeURIComponent(location).length}` })).rejects.toThrow('supported providers');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('stops a short-link redirect loop after five provider requests', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: '/loop' } }));
    vi.stubGlobal('fetch', fetcher);
    await expect(resolveMapPreview({ mapUrl: 'https://maps.app.goo.gl/loop' })).rejects.toThrow('redirect limit');
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
});

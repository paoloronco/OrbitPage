import { describe, expect, it } from 'vitest';
import {
  isPrivateBrowserHostname,
  resolveSafeBrowserHttpUrl,
  resolveSafePublicHref,
  resolveSafePublicMediaUrl,
} from './browser-network-policy';

describe('browser network policy', () => {
  it.each(['localhost', 'preview.localhost', '127.0.0.1', '10.0.0.8', '172.16.0.1', '192.168.1.20', 'router.local'])(
    'recognizes %s as a private destination',
    (hostname) => expect(isPrivateBrowserHostname(hostname)).toBe(true),
  );

  it('blocks loopback and LAN endpoints from a public page', () => {
    expect(resolveSafeBrowserHttpUrl('http://localhost:3000/api', 'https://orbitpage.com/dashboard')).toBeNull();
    expect(resolveSafeBrowserHttpUrl('https://192.168.1.20/media', 'https://orbitpage.com/dashboard')).toBeNull();
  });

  it('allows public HTTPS endpoints and relative same-origin paths', () => {
    expect(resolveSafeBrowserHttpUrl('https://orbitpage.net/api', 'https://orbitpage.com/dashboard')?.origin)
      .toBe('https://orbitpage.net');
    expect(resolveSafeBrowserHttpUrl('/api/orbitpage', 'https://orbitpage.com/dashboard')?.toString())
      .toBe('https://orbitpage.com/api/orbitpage');
  });

  it('keeps cross-port localhost development working', () => {
    expect(resolveSafeBrowserHttpUrl('http://127.0.0.1:3000/api', 'http://localhost:5173/admin')?.port)
      .toBe('3000');
  });

  it('rejects executable, credentialed and private public-page links', () => {
    const publicPage = 'https://orbitpage.net/example';
    expect(resolveSafePublicHref('javascript:alert(1)', publicPage)).toBeNull();
    expect(resolveSafePublicHref('https://user:pass@example.com/', publicPage)).toBeNull();
    expect(resolveSafePublicHref('http://127.0.0.1/admin', publicPage)).toBeNull();
    expect(resolveSafePublicHref('https://example.com/path', publicPage)).toBe('https://example.com/path');
    expect(resolveSafePublicHref('/menu', publicPage)).toBe('/menu');
    expect(resolveSafePublicHref('mailto:hello@example.com', publicPage)).toBe('mailto:hello@example.com');
  });

  it('allows raster media while rejecting active inline content', () => {
    const publicPage = 'https://orbitpage.net/example';
    expect(resolveSafePublicMediaUrl('/uploads/photo.webp', publicPage)).toBe('/uploads/photo.webp');
    expect(resolveSafePublicMediaUrl('data:image/png;base64,aGVsbG8=', publicPage)).toContain('data:image/png');
    expect(resolveSafePublicMediaUrl('data:image/svg+xml,<svg onload=alert(1)>', publicPage)).toBeNull();
    expect(resolveSafePublicMediaUrl('javascript:alert(1)', publicPage)).toBeNull();
  });
});

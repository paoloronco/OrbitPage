import { describe, expect, it } from 'vitest';
import { detectCompactLinkPlatform, getCompactLinkBrandStyle, getSafeCompactLinkHref } from '../lib/compact-links';

describe('compact link platform detection', () => {
  it.each([
    ['https://instagram.com/orbitpage', 'instagram'],
    ['https://wa.me/391234567890', 'whatsapp'],
    ['https://youtu.be/example', 'youtube'],
    ['mailto:hello@orbitpage.com', 'email'],
    ['/menu', 'page'],
    ['#contact', 'page'],
    ['https://example.com', 'website'],
  ])('detects %s as %s', (url, expected) => {
    expect(detectCompactLinkPlatform(url)).toBe(expected);
  });

  it('uses the detected platform brand color', () => {
    expect(getCompactLinkBrandStyle('auto', 'https://instagram.com/orbitpage')).toEqual({
      backgroundColor: '#d62976',
      color: '#ffffff',
    });
  });

  it('only permits public and internal link protocols', () => {
    expect(getSafeCompactLinkHref('/events')).toBe('/events');
    expect(getSafeCompactLinkHref('https://orbitpage.com')).toBe('https://orbitpage.com/');
    expect(getSafeCompactLinkHref('mailto:contact@orbitpage.com')).toBe('mailto:contact@orbitpage.com');
    expect(getSafeCompactLinkHref('javascript:alert(1)')).toBeNull();
    expect(getSafeCompactLinkHref('not a url')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { detectCompactLinkPlatform, getCompactLinkBrandStyle, getCompactLinkHref, getCompactLinkInputKind, getSafeCompactLinkHref } from '../lib/compact-links';

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

  it('turns social usernames and contact values into safe destinations', () => {
    expect(getCompactLinkHref('instagram', '@orbitpage')).toBe('https://www.instagram.com/orbitpage/');
    expect(getCompactLinkHref('tiktok', 'orbitpage')).toBe('https://www.tiktok.com/@orbitpage');
    expect(getCompactLinkHref('github', 'paoloronco')).toBe('https://github.com/paoloronco');
    expect(getCompactLinkHref('whatsapp', '+39 123 456 7890')).toBe('https://wa.me/391234567890');
    expect(getCompactLinkHref('email', 'contact@orbitpage.com')).toBe('mailto:contact@orbitpage.com');
  });

  it('keeps unsafe or incomplete compact destinations disabled', () => {
    expect(getCompactLinkHref('instagram', 'javascript:alert(1)')).toBeNull();
    expect(getCompactLinkHref('whatsapp', '123')).toBeNull();
    expect(getCompactLinkHref('email', 'not-an-email')).toBeNull();
  });

  it('describes the simplest input for each service', () => {
    expect(getCompactLinkInputKind('instagram')).toBe('username');
    expect(getCompactLinkInputKind('whatsapp')).toBe('phone');
    expect(getCompactLinkInputKind('email')).toBe('email');
    expect(getCompactLinkInputKind('linkedin')).toBe('url');
  });
});

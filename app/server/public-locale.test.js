import { describe, expect, it } from 'vitest';
import { localizedAlternates, localizedPublicPath, normalizePublicLocale, parseLocalizedPublicPath } from './public-locale.js';

describe('localized public routes', () => {
  it('uses the locale as the stable route prefix', () => {
    expect(localizedPublicPath('it')).toBe('/it-IT');
    expect(localizedPublicPath('en-US', '/menu')).toBe('/en-US/menu');
    expect(parseLocalizedPublicPath('/it-IT/services')).toEqual({ locale: 'it', slug: 'it-IT', routePath: '/services' });
    expect(parseLocalizedPublicPath('/other/services')).toBeNull();
    expect(normalizePublicLocale('it-IT')).toEqual({ locale: 'it', slug: 'it-IT' });
  });

  it('publishes language alternates under an installation base path', () => {
    const alternates = localizedAlternates('https://example.test', '/orbitpage');
    expect(alternates['en-US']).toBe('https://example.test/orbitpage/en-US');
    expect(alternates['it-IT']).toBe('https://example.test/orbitpage/it-IT');
    expect(alternates['x-default']).toBe(alternates['en-US']);
  });
});

import { describe, expect, it } from 'vitest';
import { localizedAlternates, localizedPublicPath, normalizePublicLocale, parseLocalizedPublicPath } from './public-locale.js';

describe('localized public routes', () => {
  it('uses locale and primary slug as a stable route prefix', () => {
    expect(localizedPublicPath('it', 'paolo')).toBe('/it-IT/paolo');
    expect(localizedPublicPath('en-US', 'paolo', '/menu')).toBe('/en-US/paolo/menu');
    expect(parseLocalizedPublicPath('/it-IT/paolo/services', 'paolo')).toEqual({ locale: 'it', slug: 'it-IT', routePath: '/services' });
    expect(parseLocalizedPublicPath('/it-IT/other', 'paolo')).toBeNull();
    expect(normalizePublicLocale('it-IT')).toEqual({ locale: 'it', slug: 'it-IT' });
  });

  it('publishes language alternates under an installation base path', () => {
    const alternates = localizedAlternates('https://example.test', '/orbitpage', 'paolo');
    expect(alternates['en-US']).toBe('https://example.test/orbitpage/en-US/paolo');
    expect(alternates['it-IT']).toBe('https://example.test/orbitpage/it-IT/paolo');
    expect(alternates['x-default']).toBe(alternates['en-US']);
  });
});

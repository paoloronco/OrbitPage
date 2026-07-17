import { describe, expect, it } from 'vitest';

import { buildNativeMenuHref, createNativeMenuLink, isNativeMenuLink, upsertNativeMenuLink } from './native-menu-link';

describe('native menu links', () => {
  it('builds stable menu URLs for hosted and root pages', () => {
    expect(buildNativeMenuHref('https://orbitpage.net/example/')).toBe('https://orbitpage.net/example/menu');
    expect(buildNativeMenuHref('/')).toBe('/menu');
  });

  it('creates one recognizable native menu card', () => {
    const link = createNativeMenuLink('/example', {
      title: 'View menu',
      description: 'Browse food and drinks',
    });

    expect(link).toMatchObject({
      id: 'orbitpage-native-menu',
      type: 'menu',
      url: '/example/menu',
      hideUrl: true,
      size: 'large',
    });
    expect(isNativeMenuLink(link)).toBe(true);
    expect(isNativeMenuLink({ id: 'orbitpage-native-menu', type: 'link' })).toBe(true);
  });

  it('updates legacy cards and removes duplicate menu entries', () => {
    const menuLink = createNativeMenuLink('/venue', { title: 'Menu', description: 'Food and drinks' });
    const links = upsertNativeMenuLink([
      { id: 'first', title: 'Legacy menu', description: '', url: '/old', type: 'menu' },
      { id: 'second', title: 'Duplicate menu', description: '', url: '/old-2', type: 'menu' },
      { id: 'contact', title: 'Contact', description: '', url: '/contact', type: 'link' },
    ], menuLink);

    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({ id: 'first', type: 'menu', url: '/venue/menu' });
    expect(links[1].id).toBe('contact');
  });
});

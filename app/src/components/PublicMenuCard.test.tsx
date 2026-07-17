import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PublicBlockRenderer } from './PublicBlockRenderer';

describe('PublicMenuCard', () => {
  it('renders a dedicated native menu card', () => {
    const html = renderToStaticMarkup(
      <PublicBlockRenderer
        link={{
          id: 'orbitpage-native-menu',
          title: 'View menu',
          description: 'Browse food and drinks',
          url: '/venue/menu',
          type: 'menu',
          isActive: true,
        }}
      />,
    );

    expect(html).toContain('data-orbitpage-block="menu"');
    expect(html).toContain('href="/venue/menu"');
    expect(html).toContain('View menu');
    expect(html).toContain('Browse food and drinks');
  });

  it('upgrades legacy native-menu links at render time', () => {
    const html = renderToStaticMarkup(
      <PublicBlockRenderer
        link={{
          id: 'orbitpage-native-menu',
          title: 'Menu',
          description: '',
          url: '/menu',
          type: 'link',
        }}
      />,
    );

    expect(html).toContain('data-orbitpage-block="menu"');
  });
});

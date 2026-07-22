import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PublicBlockRenderer } from './PublicBlockRenderer';

describe('PublicSocialRowCard', () => {
  it('renders stored usernames as icon-only social destinations', () => {
    const html = renderToStaticMarkup(
      <PublicBlockRenderer
        link={{
          id: 'quick-links',
          title: 'Quick links',
          description: 'Legacy copy',
          url: '',
          type: 'social_row',
          content: JSON.stringify({
            items: [
              { id: 'instagram', label: 'Instagram', url: '@orbitpage', platform: 'instagram' },
              { id: 'whatsapp', label: 'WhatsApp', url: '+39 123 456 7890', platform: 'whatsapp' },
            ],
            iconStyle: 'brand',
            showLabels: false,
          }),
        }}
      />,
    );

    expect(html).toContain('public-compact-links');
    expect(html).toContain('href="https://www.instagram.com/orbitpage/"');
    expect(html).toContain('href="https://wa.me/391234567890"');
    expect(html).not.toContain('Legacy copy');
    expect(html).not.toContain('>Instagram<');
  });

  it('recovers a legacy quick-link payload saved with the generic link type', () => {
    const html = renderToStaticMarkup(
      <PublicBlockRenderer
        link={{
          id: 'legacy-quick-links',
          title: 'Quick links',
          description: '',
          url: '',
          type: 'link',
          content: JSON.stringify({
            items: [{ label: 'GitHub', url: 'paoloronco', platform: 'github' }],
            layout: 'icons',
            iconStyle: 'brand',
          }),
        }}
      />,
    );

    expect(html).toContain('public-compact-links');
    expect(html).toContain('href="https://github.com/paoloronco"');
    expect(html).not.toContain('public-link-card');
  });
});

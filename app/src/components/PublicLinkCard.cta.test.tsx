import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PublicLinkCard } from './PublicLinkCard';

describe('PublicLinkCard CTA rendering', () => {
  it('renders smart CTAs with the action label and dedicated class', () => {
    const html = renderToStaticMarkup(
      <PublicLinkCard
        link={{
          id: 'cta-book',
          title: 'Reserve your slot',
          description: 'Limited seats this week',
          url: 'https://example.com/book',
          type: 'cta',
          ctaAction: 'book',
          ctaClicks: 5,
          isActive: true,
        }}
      />,
    );

    expect(html).toContain('public-cta-card');
    expect(html).toContain('Prenota');
    expect(html).toContain('Reserve your slot');
    expect(html).toContain('Limited seats this week');
  });
});

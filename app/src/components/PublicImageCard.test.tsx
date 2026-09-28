import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PublicImageCard } from './PublicImageCard';

describe('PublicImageCard', () => {
  it('renders only the image when title and description are empty', () => {
    const html = renderToStaticMarkup(
      <PublicImageCard
        link={{
          id: 'image-only',
          title: '',
          description: '',
          url: '',
          type: 'image',
          coverImage: '/uploads/image.webp',
        }}
      />,
    );

    expect(html).toContain('<img');
    expect(html).not.toContain('<p');
  });
});

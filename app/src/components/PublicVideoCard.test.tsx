import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildBlockContent } from '@/lib/link-blocks';
import { PublicVideoCard } from './PublicVideoCard';

describe('PublicVideoCard', () => {
  it('renders safe inline playback settings and a poster image', () => {
    const html = renderToStaticMarkup(
      <PublicVideoCard
        link={{
          id: 'video-1',
          title: 'Product reel',
          description: 'A short introduction',
          url: '',
          type: 'video',
          coverImage: '/uploads/poster.webp',
          content: buildBlockContent({
            mediaUrl: '/uploads/reel.mp4',
            controls: true,
            autoplay: true,
            loop: true,
            muted: true,
            objectFit: 'contain',
          }),
        }}
      />,
    );

    expect(html).toContain('<video');
    expect(html).toContain('playsinline=""');
    expect(html).toContain('preload="metadata"');
    expect(html).toContain('poster="/uploads/poster.webp"');
    expect(html).toContain('object-fit:contain');
    expect(html).toContain('Product reel');
  });
});

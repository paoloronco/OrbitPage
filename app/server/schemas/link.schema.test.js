import { describe, expect, it } from 'vitest';

import { LinkSchema, LinksPayloadSchema } from './link.schema.js';

describe('link schemas', () => {
  it('normalizes supported link payloads and strips unknown fields', () => {
    const result = LinkSchema.parse({
      id: 12,
      title: 'Portfolio',
      url: 'https://example.com',
      hideUrl: true,
      availability: 'available',
      iconType: { type: 'emoji' },
      unknown: 'remove me',
    });

    expect(result).toEqual({
      id: 12,
      title: 'Portfolio',
      description: '',
      url: 'https://example.com',
      hideUrl: true,
      icon: null,
      type: 'link',
      iconType: 'emoji',
      isActive: true,
      status: 'live',
      availability: 'available',
    });
  });

  it('limits bulk payloads to 200 links', () => {
    const links = Array.from({ length: 201 }, (_, index) => ({
      id: String(index),
      title: `Link ${index}`,
    }));

    expect(() => LinksPayloadSchema.parse(links)).toThrow();
  });

  it('accepts only supported card surface effects', () => {
    expect(LinkSchema.parse({ id: 'glass', title: 'Glass', surfaceEffect: 'liquid-glass' }).surfaceEffect)
      .toBe('liquid-glass');
    expect(() => LinkSchema.parse({ id: 'invalid', title: 'Invalid', surfaceEffect: 'blurred' }))
      .toThrow();
  });

  it('allows a titleless compact-link dock but keeps titles required elsewhere', () => {
    expect(LinkSchema.parse({ id: 'quick-links', type: 'social_row', title: '' }).title).toBe('');
    expect(() => LinkSchema.parse({ id: 'regular-link', type: 'link', title: '' })).toThrow();
  });
});

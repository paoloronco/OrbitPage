import { describe, expect, it } from 'vitest';

import { LinkSchema, LinksPayloadSchema } from './link.schema.js';

describe('link schemas', () => {
  it('normalizes supported link payloads and strips unknown fields', () => {
    const result = LinkSchema.parse({
      id: 12,
      title: 'Portfolio',
      url: 'https://example.com',
      hideUrl: true,
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
    });
  });

  it('limits bulk payloads to 200 links', () => {
    const links = Array.from({ length: 201 }, (_, index) => ({
      id: String(index),
      title: `Link ${index}`,
    }));

    expect(() => LinksPayloadSchema.parse(links)).toThrow();
  });
});

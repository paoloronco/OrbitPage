import { describe, expect, it } from 'vitest';

import { normalizeLinkDto, normalizeLinkDtos } from './link-normalization';

describe('link normalization', () => {
  it('normalizes mixed API link DTO shapes into LinkData', () => {
    expect(normalizeLinkDto({
      id: 42,
      title: 'Portfolio',
      description: null,
      url: 'https://example.com',
      type: 'link',
      icon_type: 'emoji',
      titleFont: 'Inter',
      descriptionFontSize: '13px',
      clickCount: 7,
      coverImage: '/uploads/cover.webp',
    })).toEqual({
      id: '42',
      title: 'Portfolio',
      description: '',
      url: 'https://example.com',
      type: 'link',
      icon: undefined,
      iconType: 'emoji',
      backgroundColor: undefined,
      textColor: undefined,
      size: undefined,
      content: undefined,
      textItems: undefined,
      titleFontFamily: 'Inter',
      descriptionFontFamily: undefined,
      alignment: undefined,
      titleFontSize: undefined,
      descriptionFontSize: '13px',
      isActive: true,
      clickCount: 7,
      startDate: undefined,
      endDate: undefined,
      coverImage: '/uploads/cover.webp',
      coverImageAlt: undefined,
    });
  });

  it('normalizes arrays safely when the API returns nullish values', () => {
    expect(normalizeLinkDtos(null)).toEqual([]);
    expect(normalizeLinkDtos([{ id: 'a', title: 'A' }])).toHaveLength(1);
  });
});

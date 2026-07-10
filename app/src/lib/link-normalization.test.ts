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
      status: 'live',
      campaignName: undefined,
      startDate: undefined,
      startTime: undefined,
      endDate: undefined,
      endTime: undefined,
      timezone: undefined,
      coverImage: '/uploads/cover.webp',
      coverImageAlt: undefined,
    });
  });

  it('keeps campaign scheduling fields from API DTOs', () => {
    expect(normalizeLinkDto({
      id: 'launch',
      title: 'Launch',
      status: 'draft',
      campaignName: 'Summer launch',
      startDate: '2026-07-10',
      startTime: '09:00',
      endDate: '2026-07-12',
      endTime: '18:30',
      timezone: 'Europe/Rome',
    })).toMatchObject({
      id: 'launch',
      status: 'draft',
      campaignName: 'Summer launch',
      startDate: '2026-07-10',
      startTime: '09:00',
      endDate: '2026-07-12',
      endTime: '18:30',
      timezone: 'Europe/Rome',
    });
  });

  it('keeps smart CTA fields from API DTOs', () => {
    expect(normalizeLinkDto({
      id: 'cta-1',
      title: 'Reserve a table',
      url: 'https://example.com/book',
      type: 'cta',
      ctaAction: 'book',
      ctaClicks: 12,
    })).toMatchObject({
      id: 'cta-1',
      type: 'cta',
      ctaAction: 'book',
      ctaClicks: 12,
    });
  });

  it('normalizes arrays safely when the API returns nullish values', () => {
    expect(normalizeLinkDtos(null)).toEqual([]);
    expect(normalizeLinkDtos([{ id: 'a', title: 'A' }])).toHaveLength(1);
  });
});

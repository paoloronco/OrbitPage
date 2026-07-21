import { describe, expect, it } from 'vitest';
import { getSocialRowData, getSocialRowDraftData } from './link-blocks';

describe('compact link block data', () => {
  it('keeps legacy social rows compatible', () => {
    const data = getSocialRowData(JSON.stringify({
      items: [
        { label: 'Instagram', url: 'https://instagram.com/orbitpage' },
        { label: '', url: '' },
      ],
    }));

    expect(data).toMatchObject({
      layout: 'grid',
      iconStyle: 'theme',
      columns: 2,
      boxed: true,
      showTitle: true,
      showLabels: true,
    });
    expect(data.items).toEqual([
      { label: 'Instagram', url: 'https://instagram.com/orbitpage', platform: 'auto', icon: '' },
    ]);
  });

  it('normalizes rich compact links and rejects unsupported settings', () => {
    const data = getSocialRowDraftData(JSON.stringify({
      layout: 'icons',
      iconStyle: 'brand',
      columns: 4,
      boxed: false,
      showTitle: false,
      showLabels: false,
      items: [
        { label: 'Menu', url: '/menu', platform: 'page', icon: '🍽️' },
        { label: 'Unsafe setting', url: '/other', platform: 'unknown' },
      ],
    }));

    expect(data).toMatchObject({
      layout: 'icons',
      iconStyle: 'brand',
      columns: 4,
      boxed: false,
      showTitle: false,
      showLabels: false,
    });
    expect(data.items?.[0]).toEqual({ label: 'Menu', url: '/menu', platform: 'page', icon: '🍽️' });
    expect(data.items?.[1]?.platform).toBe('auto');
  });

  it('caps the number of compact links', () => {
    const items = Array.from({ length: 30 }, (_, index) => ({
      label: `Link ${index}`,
      url: `/page-${index}`,
    }));

    expect(getSocialRowDraftData(JSON.stringify({ items })).items).toHaveLength(16);
  });
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_MENU_CATALOG, parseMenuCatalog } from './menu.schema.js';

describe('menu schema', () => {
  it('accepts a valid editable venue menu', () => {
    const parsed = parseMenuCatalog({
      ...DEFAULT_MENU_CATALOG,
      enabled: true,
      venueType: 'bar',
      items: [{
        id: 'spritz', sectionId: 'section-1', name: 'Spritz', priceMinor: 700,
        variants: [{ id: 'glass', name: 'Glass', priceMinor: 700 }],
        allergens: [], dietaryTags: [], available: true, featured: true, position: 0,
      }],
    });
    expect(parsed.items[0].variants[0].name).toBe('Glass');
  });

  it('rejects duplicate IDs and unknown sections', () => {
    expect(() => parseMenuCatalog({
      ...DEFAULT_MENU_CATALOG,
      sections: [DEFAULT_MENU_CATALOG.sections[0], DEFAULT_MENU_CATALOG.sections[0]],
    })).toThrow();
    expect(() => parseMenuCatalog({
      ...DEFAULT_MENU_CATALOG,
      items: [{
        id: 'item', sectionId: 'missing', name: 'Item', priceMinor: 100,
        variants: [], allergens: [], dietaryTags: [], available: true, featured: false, position: 0,
      }],
    })).toThrow();
  });
});

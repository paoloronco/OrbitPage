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

  it('keeps legacy menus compatible and validates content routing', () => {
    const { routing: _routing, ...legacyMenu } = DEFAULT_MENU_CATALOG;
    expect(parseMenuCatalog(legacyMenu).routing).toEqual({ homepage: 'link', linkEnabled: true });
    expect(parseMenuCatalog({
      ...DEFAULT_MENU_CATALOG,
      routing: { homepage: 'pages', homepagePageSlug: 'summer-menu', linkEnabled: false },
    }).routing).toEqual({ homepage: 'pages', homepagePageSlug: 'summer-menu', linkEnabled: false });
    expect(() => parseMenuCatalog({
      ...DEFAULT_MENU_CATALOG,
      routing: { homepage: 'unknown', linkEnabled: true },
    })).toThrow();
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

  it('accepts one level of menu subsections and rejects invalid parents', () => {
    const parsed = parseMenuCatalog({
      ...DEFAULT_MENU_CATALOG,
      sections: [
        DEFAULT_MENU_CATALOG.sections[0],
        { id: 'wine', parentId: 'section-1', name: 'Wine', visible: true, position: 1 },
      ],
    });
    expect(parsed.sections[1].parentId).toBe('section-1');

    expect(() => parseMenuCatalog({
      ...DEFAULT_MENU_CATALOG,
      sections: [
        DEFAULT_MENU_CATALOG.sections[0],
        { id: 'orphan', parentId: 'missing', name: 'Orphan', visible: true, position: 1 },
      ],
    })).toThrow('Menu subsection references an unknown parent');

    expect(() => parseMenuCatalog({
      ...DEFAULT_MENU_CATALOG,
      sections: [
        DEFAULT_MENU_CATALOG.sections[0],
        { id: 'wine', parentId: 'section-1', name: 'Wine', visible: true, position: 1 },
        { id: 'red', parentId: 'wine', name: 'Red wine', visible: true, position: 2 },
      ],
    })).toThrow('Menu subsections support one nesting level');
  });
});

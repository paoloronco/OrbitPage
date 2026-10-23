import { describe, expect, it } from 'vitest';
import { parseOrbitPageMenu } from '@orbitpage/page-schema';

it('preserves an optional logo through both menu contracts and normalization', () => {
  const menu = { ...createDefaultMenu(), logoUrl: '/uploads/menu-logo.png' };
  expect(normalizeMenuCatalog(parseOrbitPageMenu(menu)).logoUrl).toBe(menu.logoUrl);
  expect(normalizeMenuCatalog(parseMenuCatalog(menu)).logoUrl).toBe(menu.logoUrl);
  expect(normalizeMenuCatalog({ ...menu, logoUrl: 'javascript:alert(1)' }).logoUrl).toBeUndefined();
  expect(parseOrbitPageMenu(createDefaultMenu()).logoUrl).toBeUndefined();
});
// The standalone Node backend consumes JavaScript schemas; verify the same wire contract.
import { parseMenuCatalog } from '../../server/schemas/menu.schema.js';
import {
  MENU_THEME_PRESETS, createDefaultMenu, formatMenuPriceInput, normalizeMenuCatalog, parseMenuPriceInput,
  menuStarterSections, needsMenuOnboarding,
} from './menu';

const luminance = (hex: string) => {
  const [red, green, blue] = hex.match(/\w\w/g)!.map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrast = (foreground: string, background: string) => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

describe('menu catalog normalization', () => {
  it('seeds localized venue categories and preserves saved menus', () => {
    expect(menuStarterSections('restaurant', 'it-IT').map(section => section.name)).toEqual(['Antipasti', 'Primi', 'Secondi', 'Contorni', 'Dolci']);
    expect(menuStarterSections('bar', 'it-IT').map(section => section.name)).toEqual(['Birre', 'Cocktail', 'Vini', 'Analcolici']);
    expect(menuStarterSections('bar', 'fr-CA')[0].name).toBe('Bières');
    for (const locale of ['en', 'it', 'es', 'fr', 'de', 'pt', 'nl', 'pl', 'tr', 'ru', 'ar', 'zh', 'ja', 'ko']) {
      for (const venue of ['restaurant', 'bar', 'cafe', 'other'] as const) {
        const menu = { ...createDefaultMenu(venue), setupCompleted: true, sections: menuStarterSections(venue, locale) };
        expect(parseOrbitPageMenu(menu)).toEqual(parseMenuCatalog(menu));
      }
    }
    expect(needsMenuOnboarding(createDefaultMenu())).toBe(true);
    for (const patch of [{ name: 'Custom venue' }, { updatedAt: '2026-10-23T00:00:00.000Z' }, { enabled: true }, { setupCompleted: true }, { sections: menuStarterSections('bar', 'it') }]) {
      expect(needsMenuOnboarding({ ...createDefaultMenu(), ...patch })).toBe(false);
    }
  });
  it('round-trips setup and section numbering while rejecting invalid booleans', () => {
    const menu = createDefaultMenu('other');
    menu.setupCompleted = true;
    menu.sections[0].showNumber = false;
    const payload = normalizeMenuCatalog(menu);
    expect(parseOrbitPageMenu(payload)).toEqual(parseMenuCatalog(payload));
    expect(payload.sections[0].showNumber).toBe(false);
    expect(payload.setupCompleted).toBe(true);
    for (const parse of [parseOrbitPageMenu, parseMenuCatalog]) {
      expect(() => parse({ ...payload, setupCompleted: 'true' })).toThrow();
      expect(() => parse({ ...payload, sections: [{ ...payload.sections[0], showNumber: 'false' }] })).toThrow();
    }
  });
  it('round-trips the optional collapse setting through both backend contracts', () => {
    const menu = createDefaultMenu();
    menu.sections[0].collapsible = false;
    const payload = normalizeMenuCatalog(menu);
    expect(parseOrbitPageMenu(payload)).toEqual(parseMenuCatalog(payload));
    expect(parseMenuCatalog(payload).sections[0].collapsible).toBe(false);
    expect(payload.sections[1]).not.toHaveProperty('collapsible');
    for (const parse of [parseOrbitPageMenu, parseMenuCatalog]) {
      expect(() => parse({ ...payload, sections: [{ ...payload.sections[0], collapsible: 'false' }] })).toThrow();
    }
  });
  it('round-trips supported fonts through both backend contracts', () => {
    const menu = createDefaultMenu();
    for (const fontFamily of ['editorial', 'sans', 'serif', 'mono'] as const) {
      menu.theme.fontFamily = fontFamily;
      const payload = normalizeMenuCatalog(menu);
      expect(parseOrbitPageMenu(payload)).toEqual(parseMenuCatalog(payload));
      expect(parseMenuCatalog(payload).theme.fontFamily).toBe(fontFamily);
    }
    expect(() => parseMenuCatalog({ ...menu, theme: { ...menu.theme, fontFamily: 'url(evil)' } })).toThrow();
  });
  it.each(['restaurant', 'bar', 'cafe'] as const)('round-trips the %s editor through both server contracts', (venue) => {
    const draft = createDefaultMenu(venue);
    draft.footerText = ' Seasonal availability. ';
    const payload = JSON.parse(JSON.stringify(normalizeMenuCatalog(draft)));
    expect(parseOrbitPageMenu(payload)).toEqual(parseMenuCatalog(payload));
    expect(parseOrbitPageMenu(payload).footerText).toBe('Seasonal availability.');
    const { footerText: _footer, routing: _routing, ...legacy } = payload;
    expect(parseOrbitPageMenu(legacy)).toEqual(parseMenuCatalog(legacy));
    expect(parseOrbitPageMenu({ ...payload, footerText: '' }).footerText).toBe('');
  });

  it('preserves one level of menu subsections without changing existing roots', () => {
    const menu = createDefaultMenu('bar');
    menu.sections = [
      { id: 'beverage', name: 'Beverage', visible: true, position: 0 },
      { id: 'red-wine', parentId: 'beverage', name: 'Red wine', visible: true, position: 1 },
    ];

    const normalized = normalizeMenuCatalog(menu);

    expect(normalized.sections[0]).not.toHaveProperty('parentId');
    expect(normalized.sections[1].parentId).toBe('beverage');
  });

  it('flattens invalid or deeper subsection relationships during normalization', () => {
    const menu = createDefaultMenu('bar');
    menu.sections = [
      { id: 'beverage', name: 'Beverage', visible: true, position: 0 },
      { id: 'wine', parentId: 'beverage', name: 'Wine', visible: true, position: 1 },
      { id: 'red-wine', parentId: 'wine', name: 'Red wine', visible: true, position: 2 },
      { id: 'orphan', parentId: 'missing', name: 'Orphan', visible: true, position: 3 },
    ];

    const normalized = normalizeMenuCatalog(menu);

    expect(normalized.sections.find((section) => section.id === 'wine')?.parentId).toBe('beverage');
    expect(normalized.sections.find((section) => section.id === 'red-wine')).not.toHaveProperty('parentId');
    expect(normalized.sections.find((section) => section.id === 'orphan')).not.toHaveProperty('parentId');
  });

  it('preserves an in-progress space while editing menu text', () => {
    const menu = createDefaultMenu();
    menu.items = [{
      id: 'item-1',
      sectionId: menu.sections[0].id,
      name: 'Pasta ',
      description: 'Fresh pasta ',
      priceMinor: 1200,
      variants: [],
      allergens: [],
      dietaryTags: [],
      available: true,
      featured: false,
      position: 0,
    }];

    const editing = normalizeMenuCatalog(menu, 250, { preserveTextEdges: true });

    expect(editing.items[0].name).toBe('Pasta ');
    expect(editing.items[0].description).toBe('Fresh pasta ');
  });

  it('trims text before persistence', () => {
    const menu = createDefaultMenu();
    menu.name = ' Dinner menu ';
    menu.footerText = ' Seasonal availability. ';
    menu.items = [{
      id: 'item-1',
      sectionId: menu.sections[0].id,
      name: ' Pasta al pomodoro ',
      description: ' Tomato, basil and olive oil ',
      priceMinor: 1200,
      variants: [],
      allergens: [],
      dietaryTags: [],
      available: true,
      featured: false,
      position: 0,
    }];

    const persisted = normalizeMenuCatalog(menu);

    expect(persisted.name).toBe('Dinner menu');
    expect(persisted.footerText).toBe('Seasonal availability.');
    expect(persisted.items[0].name).toBe('Pasta al pomodoro');
    expect(persisted.items[0].description).toBe('Tomato, basil and olive oil');
  });

  it('defaults legacy catalogs and preserves explicit content routing', () => {
    const menu = createDefaultMenu();
    const { routing: _routing, ...legacyMenu } = menu;

    expect(normalizeMenuCatalog(legacyMenu).routing).toEqual({ homepage: 'link', linkEnabled: true });
    expect(normalizeMenuCatalog({
      ...menu,
      routing: { homepage: 'pages', homepagePageSlug: 'summer-menu', linkEnabled: false },
    }).routing).toEqual({ homepage: 'pages', homepagePageSlug: 'summer-menu', linkEnabled: false });
  });

  it('offers four visually distinct default themes', () => {
    const themes = Object.values(MENU_THEME_PRESETS);

    expect(themes).toHaveLength(4);
    expect(new Set(themes.map((theme) => theme.background)).size).toBe(4);
    expect(new Set(themes.map((theme) => `${theme.radius}:${theme.imageLayout}`)).size).toBeGreaterThan(2);
    for (const theme of themes) {
      for (const color of [theme.text, theme.muted, theme.accent]) {
        expect(contrast(color, theme.background)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(color, theme.surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe('menu price input', () => {
  it.each([
    ['12', 1200],
    ['12,5', 1250],
    ['12,50', 1250],
    ['12.50', 1250],
    ['0,09', 9],
    ['12,', 1200],
  ])('parses %s into integer cents', (value, expected) => {
    expect(parseMenuPriceInput(value)).toBe(expected);
  });

  it.each(['', '-1', '12,345', '12.3.4', 'free', '100000,01'])(
    'rejects invalid price %s',
    (value) => {
      expect(parseMenuPriceInput(value)).toBeNull();
    },
  );

  it('formats the editable value using the menu locale', () => {
    expect(formatMenuPriceInput(1250, 'it-IT')).toBe('12,50');
    expect(formatMenuPriceInput(1250, 'en-GB')).toBe('12.50');
  });
});

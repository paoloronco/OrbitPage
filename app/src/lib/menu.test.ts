import { describe, expect, it } from 'vitest';
import {
  createDefaultMenu, formatMenuPriceInput, normalizeMenuCatalog, parseMenuPriceInput,
} from './menu';

describe('menu catalog normalization', () => {
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
    expect(persisted.items[0].name).toBe('Pasta al pomodoro');
    expect(persisted.items[0].description).toBe('Tomato, basil and olive oil');
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

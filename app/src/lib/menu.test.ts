import { describe, expect, it } from 'vitest';
import { createDefaultMenu, normalizeMenuCatalog } from './menu';

describe('menu catalog normalization', () => {
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

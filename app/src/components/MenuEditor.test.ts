import { describe, expect, it } from 'vitest';
import type { MenuItem, MenuSection } from '@/lib/menu';
import { reorderMenuItems, reorderMenuSections } from './menu-editor-order';

describe('MenuEditor constrained ordering', () => {
  it('reorders only within the same category level', () => {
    const sections: MenuSection[] = [
      { id: 'lunch', name: 'Lunch', visible: true, position: 0 },
      { id: 'lunch-firsts', parentId: 'lunch', name: 'Firsts', visible: true, position: 1 },
      { id: 'dinner', name: 'Dinner', visible: true, position: 2 },
      { id: 'dinner-firsts', parentId: 'dinner', name: 'Firsts', visible: true, position: 3 },
    ];

    expect(reorderMenuSections(sections, 'lunch', 'dinner').map((section) => section.id)).toEqual([
      'dinner', 'dinner-firsts', 'lunch', 'lunch-firsts',
    ]);
    expect(reorderMenuSections(sections, 'lunch-firsts', 'dinner')).toBe(sections);
  });

  it('reorders items inside their category without crossing into another one', () => {
    const item = (id: string, sectionId: string, position: number): MenuItem => ({
      id, sectionId, position, name: id, priceMinor: 0, variants: [], allergens: [], dietaryTags: [], available: true, featured: false,
    });
    const items = [item('starter-a', 'starters', 0), item('drink-a', 'drinks', 1), item('starter-b', 'starters', 2)];

    expect(reorderMenuItems(items, 'starter-b', 'starter-a').map((entry) => entry.id)).toEqual([
      'starter-b', 'drink-a', 'starter-a',
    ]);
    expect(reorderMenuItems(items, 'starter-a', 'drink-a')).toBe(items);
  });
});

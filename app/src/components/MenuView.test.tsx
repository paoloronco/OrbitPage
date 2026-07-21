import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createDefaultMenu } from '@/lib/menu';
import { MenuView } from './MenuView';

describe('MenuView subsections', () => {
  it('renders products beneath their subsection and exposes a direct section link', () => {
    const menu = createDefaultMenu('bar');
    menu.enabled = true;
    menu.sections = [
      { id: 'beverage', name: 'Beverage', visible: true, position: 0 },
      { id: 'beer', parentId: 'beverage', name: 'Beer', description: 'Draft and bottled', visible: true, position: 1 },
    ];
    menu.items = [
      {
        id: 'water', sectionId: 'beverage', name: 'Still water', priceMinor: 300,
        variants: [], allergens: [], dietaryTags: [], available: true, featured: false, position: 0,
      },
      {
        id: 'lager', sectionId: 'beer', name: 'House lager', priceMinor: 600,
        variants: [], allergens: ['Gluten'], dietaryTags: [], available: true, featured: false, position: 1,
      },
    ];

    const html = renderToStaticMarkup(<MenuView menu={menu} />);

    expect(html).toContain('href="#menu-beverage"');
    expect(html).toContain('href="#menu-beer"');
    expect(html).toContain('id="menu-beverage"');
    expect(html).toContain('id="menu-beer"');
    expect(html).toContain('<span>Beer</span>');
    expect(html).toContain('House lager');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-controls="menu-content-beverage"');
  });

  it('keeps long menus compact and exposes search', () => {
    const menu = createDefaultMenu('restaurant');
    menu.enabled = true;
    menu.items = Array.from({ length: 12 }, (_, index) => ({
      id: `item-${index}`,
      sectionId: menu.sections[index % menu.sections.length].id,
      name: `Dish ${index + 1}`,
      priceMinor: 1200,
      variants: [], allergens: [], dietaryTags: [], available: true, featured: false, position: index,
    }));

    const html = renderToStaticMarkup(<MenuView menu={menu} />);

    expect(html).toContain('placeholder="Search the menu"');
    expect(html).toContain('12 items');
    expect(html).toContain('aria-expanded="false"');
  });
});

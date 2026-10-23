import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createDefaultMenu } from '@/lib/menu';
import { MenuView } from './MenuView';

describe('MenuView subsections', () => {
  it('hides numbers independently of section titles and collapsing', () => {
    const menu = createDefaultMenu();
    const render = () => renderToStaticMarkup(<MenuView menu={menu} onEditSection={() => {}} />);
    expect(render()).toContain('<span>01</span>');
    menu.sections[0].showNumber = false;
    const html = render();
    expect(html).not.toContain('<span>01</span>');
    expect(html).toContain('<span>02</span>');
    expect(html).toContain(menu.sections[0].name);
    expect(html).toContain('Collapse Starters');
  });
  it('renders the optional menu logo safely in the header', () => {
    const menu = { ...createDefaultMenu(), logoUrl: '/uploads/menu-logo.png' };
    const html = renderToStaticMarkup(<MenuView menu={menu} />);
    expect(html).toContain('class="orbitpage-menu__logo" src="/uploads/menu-logo.png"');
    expect(html.indexOf('orbitpage-menu__logo')).toBeLessThan(html.indexOf('orbitpage-menu__identity'));
    expect(renderToStaticMarkup(<MenuView menu={{ ...menu, logoUrl: 'javascript:alert(1)' }} />)).not.toContain('orbitpage-menu__logo');
  });
  it('uses the page branding choice and exposes editable footer text in the preview', () => {
    const menu = createDefaultMenu();
    const html = renderToStaticMarkup(<MenuView menu={menu} showOrbitPageBadge={false} onEditFooter={() => {}} />);
    expect(html).not.toContain('Made with OrbitPage');
    expect(html).toContain('Edit menu footer');
    expect(html).toContain(menu.footerText);
  });
  it('renders products beneath their subsection and exposes a direct section link', () => {
    const menu = createDefaultMenu('bar');
    menu.enabled = true;
    menu.footerText = 'Seasonal availability. Ask us about allergens.';
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

    expect(html).toContain('class="orbitpage-menu"');
    expect(html).toContain('class="orbitpage-menu__back"');
    expect(html).toContain('class="orbitpage-menu__footer"');
    expect(html).toContain('Back to main page');
    expect(html).not.toContain('Restaurant menu');
    expect(html).toContain('Seasonal availability. Ask us about allergens.');
    expect(html).toContain('href="#menu-beverage"');
    expect(html).toContain('href="#menu-beer"');
    expect(html).toContain('id="menu-beverage"');
    expect(html).toContain('id="menu-beer"');
    expect(html).toContain('<span>Beer</span>');
    expect(html).not.toContain('<small>2</small>');
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

    expect(html).not.toContain('Restaurant menu');
    expect(html).toContain('placeholder="Search the menu"');
    expect(html).toContain('12 items');
    expect(html).toContain('aria-expanded="false"');

    menu.sections.forEach(section => { section.collapsible = false; });
    const expanded = renderToStaticMarkup(<MenuView menu={menu} />);
    expect(expanded).not.toContain('aria-expanded=');
    expect(expanded).not.toContain(' hidden=');
    expect(expanded).toContain('Dish 12');
  });

  it('shows only the menu section selected by a smart campaign link', () => {
    const menu = createDefaultMenu('restaurant');
    menu.enabled = true;
    menu.sections = [
      { id: 'lunch', name: 'Lunch', visible: true, position: 0 },
      { id: 'dinner', name: 'Dinner', visible: true, position: 1 },
    ];
    menu.items = [
      { id: 'salad', sectionId: 'lunch', name: 'Lunch salad', priceMinor: 900, variants: [], allergens: [], dietaryTags: [], available: true, featured: false, position: 0 },
      { id: 'steak', sectionId: 'dinner', name: 'Dinner steak', priceMinor: 2200, variants: [], allergens: [], dietaryTags: [], available: true, featured: false, position: 0 },
    ];

    const html = renderToStaticMarkup(<MenuView menu={menu} selectedSectionId="lunch" />);

    expect(html).toContain('Lunch salad');
    expect(html).not.toContain('Dinner steak');
  });
});

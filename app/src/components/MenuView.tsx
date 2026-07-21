import { useState, type CSSProperties } from 'react';
import { ArrowLeft, ChevronDown, Leaf, Search, Sparkles, X } from 'lucide-react';
import { formatMenuPrice, type MenuCatalog } from '@/lib/menu';
import { withBasePath } from '@/lib/base-path';

interface MenuViewProps {
  menu: MenuCatalog;
  embedded?: boolean;
  pageHref?: string;
}

export function MenuView({ menu, embedded = false, pageHref = withBasePath('/') }: MenuViewProps) {
  const [query, setQuery] = useState('');
  const [sectionState, setSectionState] = useState<Record<string, boolean>>({});
  const sections = [...menu.sections]
    .filter((section) => section.visible)
    .sort((a, b) => a.position - b.position);
  const rootSections = sections.filter((section) => !section.parentId);
  const subsectionsFor = (sectionId: string) => sections.filter((section) => section.parentId === sectionId);
  const sectionsWithItems = new Set(menu.items.map((item) => item.sectionId));
  const navigableSections = rootSections.flatMap((section) => {
    const subsections = subsectionsFor(section.id).filter((subsection) => sectionsWithItems.has(subsection.id));
    const hasVisibleContent = sectionsWithItems.has(section.id) || subsections.length > 0;
    return hasVisibleContent ? [section, ...subsections] : [];
  });
  const isItalian = menu.locale.toLowerCase().startsWith('it');
  const copy = isItalian ? {
    search: 'Cerca nel menu', clear: 'Cancella ricerca', products: 'prodotti', product: 'prodotto',
    noResults: 'Nessun prodotto corrisponde alla ricerca.', expand: 'Espandi', collapse: 'Comprimi',
  } : {
    search: 'Search the menu', clear: 'Clear search', products: 'items', product: 'item',
    noResults: 'No menu items match your search.', expand: 'Expand', collapse: 'Collapse',
  };
  const normalizedQuery = query.trim().toLocaleLowerCase(menu.locale);
  const filteredItems = normalizedQuery
    ? menu.items.filter((item) => [
      item.name, item.description, item.details, ...item.dietaryTags, ...item.allergens,
      ...item.variants.map((variant) => variant.name),
    ].some((value) => value?.toLocaleLowerCase(menu.locale).includes(normalizedQuery)))
    : menu.items;
  const isLongMenu = menu.items.length >= 12 || navigableSections.length >= 7;
  const showDirectory = navigableSections.length > 1 || menu.items.length >= 8;
  const isOpen = (sectionId: string, defaultOpen: boolean) => normalizedQuery
    ? true
    : sectionState[sectionId] ?? defaultOpen;
  const setOpen = (sectionId: string, open: boolean) => {
    setSectionState((current) => ({ ...current, [sectionId]: open }));
  };
  const revealSection = (sectionId: string, parentId?: string) => {
    setSectionState((current) => ({
      ...current,
      [parentId || sectionId]: true,
      ...(parentId ? { [sectionId]: true } : {}),
    }));
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      document.getElementById(`menu-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  };
  const style = {
    '--menu-bg': menu.theme.background,
    '--menu-surface': menu.theme.surface,
    '--menu-text': menu.theme.text,
    '--menu-muted': menu.theme.muted,
    '--menu-accent': menu.theme.accent,
    '--menu-border': menu.theme.border,
    '--menu-radius': `${menu.theme.radius}px`,
  } as CSSProperties;

  const renderItems = (items: MenuCatalog['items']) => (
    <div className="orbitpage-menu__items">
      {items.map((item) => (
        <article
          key={item.id}
          className={`orbitpage-menu-item${item.featured ? ' orbitpage-menu-item--featured' : ''}${!item.available ? ' orbitpage-menu-item--unavailable' : ''}`}
        >
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt={item.imageAlt || ''}
              loading="lazy"
              className={`orbitpage-menu-item__image orbitpage-menu-item__image--${menu.theme.imageLayout}`}
            />
          )}
          <div className="orbitpage-menu-item__content">
            <div className="orbitpage-menu-item__title-row">
              <h3>{item.name}</h3>
              {item.featured && <Sparkles aria-label="Featured" />}
              <strong>{formatMenuPrice(item.priceMinor, menu.currency, menu.locale)}</strong>
            </div>
            {item.description && <p>{item.description}</p>}
            {item.variants.length > 0 && (
              <ul className="orbitpage-menu-item__variants">
                {item.variants.map((variant) => (
                  <li key={variant.id}>
                    <span>{variant.name}</span>
                    <strong>{formatMenuPrice(variant.priceMinor, menu.currency, menu.locale)}</strong>
                  </li>
                ))}
              </ul>
            )}
            <div className="orbitpage-menu-item__meta">
              {item.details && <span>{item.details}</span>}
              {item.dietaryTags.map((tag) => <span key={tag}><Leaf aria-hidden="true" />{tag}</span>)}
              {item.allergens.length > 0 && <span>Allergens: {item.allergens.join(', ')}</span>}
              {!item.available && <span>Currently unavailable</span>}
            </div>
          </div>
        </article>
      ))}
    </div>
  );

  return (
    <main className={`orbitpage-menu${embedded ? ' orbitpage-menu--embedded' : ''}`} style={style}>
      <div className="orbitpage-menu__shell">
        <header className="orbitpage-menu__header">
          <a className="orbitpage-menu__back" href={pageHref} aria-label="Back to the main page">
            <ArrowLeft aria-hidden="true" />
            <span>Back</span>
          </a>
          <div className="orbitpage-menu__identity">
            <p>{menu.venueType === 'restaurant' ? 'Restaurant menu' : menu.venueType === 'bar' ? 'Bar menu' : 'Café menu'}</p>
            <h1>{menu.name}</h1>
            {menu.description && <div>{menu.description}</div>}
          </div>
        </header>

        {showDirectory && (
          <div className="orbitpage-menu__directory">
            {navigableSections.length > 1 && (
              <nav className="orbitpage-menu__sections" aria-label="Menu sections">
                {navigableSections.map((section) => (
                  <a
                    className={section.parentId ? 'orbitpage-menu__section-link--nested' : undefined}
                    key={section.id}
                    href={`#menu-${section.id}`}
                    onClick={(event) => { event.preventDefault(); revealSection(section.id, section.parentId); }}
                  >
                    {section.name}
                  </a>
                ))}
              </nav>
            )}
            {menu.items.length >= 8 && (
              <div className="orbitpage-menu__tools">
                <label className="orbitpage-menu__search">
                  <Search aria-hidden="true" />
                  <span className="sr-only">{copy.search}</span>
                  <input
                    type="search"
                    value={query}
                    placeholder={copy.search}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  {query && (
                    <button type="button" aria-label={copy.clear} title={copy.clear} onClick={() => setQuery('')}>
                      <X aria-hidden="true" />
                    </button>
                  )}
                </label>
                <span className="orbitpage-menu__result-count" aria-live="polite">
                  {filteredItems.length} {filteredItems.length === 1 ? copy.product : copy.products}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="orbitpage-menu__catalog">
          {rootSections.map((section, sectionIndex) => {
            const directItems = filteredItems
              .filter((item) => item.sectionId === section.id)
              .sort((a, b) => a.position - b.position);
            const subsections = subsectionsFor(section.id).map((subsection) => ({
              ...subsection,
              items: filteredItems
                .filter((item) => item.sectionId === subsection.id)
                .sort((a, b) => a.position - b.position),
            })).filter((subsection) => subsection.items.length > 0);
            if (directItems.length === 0 && subsections.length === 0) return null;
            const sectionProductCount = directItems.length + subsections.reduce((total, subsection) => total + subsection.items.length, 0);
            const sectionOpen = isOpen(section.id, !isLongMenu || sectionIndex === 0);
            return (
              <section key={section.id} id={`menu-${section.id}`} className="orbitpage-menu__section">
                <div className="orbitpage-menu__section-heading">
                  <span>{String(sectionIndex + 1).padStart(2, '0')}</span>
                  <div>
                    <h2>
                      <button
                        type="button"
                        aria-expanded={sectionOpen}
                        aria-controls={`menu-content-${section.id}`}
                        title={sectionOpen ? copy.collapse : copy.expand}
                        onClick={() => setOpen(section.id, !sectionOpen)}
                      >
                        <span>{section.name}</span>
                        <small>{sectionProductCount}</small>
                        <ChevronDown aria-hidden="true" />
                      </button>
                    </h2>
                    {section.description && <p>{section.description}</p>}
                  </div>
                </div>
                <div
                  className="orbitpage-menu__section-content orbitpage-menu__section-content--revealed"
                  id={`menu-content-${section.id}`}
                  hidden={!sectionOpen}
                >
                  {directItems.length > 0 && renderItems(directItems)}
                  {subsections.map((subsection, subsectionIndex) => {
                    const subsectionOpen = isOpen(subsection.id, !isLongMenu || subsectionIndex === 0);
                    return (
                      <section className="orbitpage-menu__subsection" id={`menu-${subsection.id}`} key={subsection.id}>
                        <header>
                          <h3>
                            <button
                              type="button"
                              aria-expanded={subsectionOpen}
                              aria-controls={`menu-content-${subsection.id}`}
                              title={subsectionOpen ? copy.collapse : copy.expand}
                              onClick={() => setOpen(subsection.id, !subsectionOpen)}
                            >
                              <span>{subsection.name}</span>
                              <small>{subsection.items.length}</small>
                              <ChevronDown aria-hidden="true" />
                            </button>
                          </h3>
                          {subsection.description && <p>{subsection.description}</p>}
                        </header>
                        <div
                          className="orbitpage-menu__subsection-content orbitpage-menu__section-content--revealed"
                          id={`menu-content-${subsection.id}`}
                          hidden={!subsectionOpen}
                        >
                          {renderItems(subsection.items)}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {normalizedQuery && filteredItems.length === 0 && (
          <section className="orbitpage-menu__empty orbitpage-menu__empty--search" role="status">
            <Search aria-hidden="true" />
            <p>{copy.noResults}</p>
            <button type="button" onClick={() => setQuery('')}>{copy.clear}</button>
          </section>
        )}

        {menu.items.length === 0 && (
          <section className="orbitpage-menu__empty">
            <p>The menu is being prepared.</p>
          </section>
        )}

        <footer className="orbitpage-menu__footer">
          <span>Prices and availability may change. Ask the venue about allergens and dietary requirements.</span>
          <a href="https://orbitpage.com" rel="noopener noreferrer">Made with OrbitPage</a>
        </footer>
      </div>
    </main>
  );
}

import { useState, type ReactNode, type CSSProperties } from 'react';
import { ArrowLeft, ChevronDown, Leaf, Search, Sparkles, X } from 'lucide-react';
import { formatMenuPrice, type MenuSection, type MenuCatalog } from '@/lib/menu';
import { withBasePath } from '@/lib/base-path';
import { resolveSafePublicMediaUrl } from '@/lib/browser-network-policy';

interface MenuViewProps {
  menu: MenuCatalog;
  pageHref?: string;
  selectedSectionId?: string;
  showOrbitPageBadge?: boolean;
  onEditFooter?: () => void;
  onEditIdentity?: () => void;
  onEditSection?: (id: string) => void;
  onEditItem?: (id: string) => void;
  renderItemActions?: (id: string) => ReactNode;
  renderSectionActions?: (id: string) => ReactNode;
}

export function MenuView({ menu, pageHref = withBasePath('/'), selectedSectionId = '', showOrbitPageBadge = true, onEditFooter, onEditIdentity, onEditSection, onEditItem, renderItemActions, renderSectionActions }: MenuViewProps) {
  const [query, setQuery] = useState('');
  const [sectionState, setSectionState] = useState<Record<string, boolean>>({});
  const sections = [...menu.sections]
    .filter((section) => onEditSection || section.visible)
    .sort((a, b) => a.position - b.position);
  const rootSections = sections.filter((section) => !section.parentId);
  const selectedRootSection = rootSections.find((section) => section.id === selectedSectionId);
  const visibleRootSections = selectedRootSection ? [selectedRootSection] : rootSections;
  const visibleSectionIds = new Set(visibleRootSections.flatMap((section) => [
    section.id,
    ...sections.filter((candidate) => candidate.parentId === section.id).map((candidate) => candidate.id),
  ]));
  const subsectionsFor = (sectionId: string) => sections.filter((section) => section.parentId === sectionId);
  const sectionsWithItems = new Set(menu.items.map((item) => item.sectionId));
  const navigableSections = visibleRootSections.flatMap((section) => {
    const subsections = subsectionsFor(section.id).filter((subsection) => sectionsWithItems.has(subsection.id));
    const hasVisibleContent = sectionsWithItems.has(section.id) || subsections.length > 0;
    return hasVisibleContent || onEditSection ? [section, ...subsections] : [];
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
  const scopedItems = menu.items.filter((item) => visibleSectionIds.has(item.sectionId));
  const filteredItems = normalizedQuery
    ? scopedItems.filter((item) => [
      item.name, item.description, item.details, ...item.dietaryTags, ...item.allergens,
      ...item.variants.map((variant) => variant.name),
    ].some((value) => value?.toLocaleLowerCase(menu.locale).includes(normalizedQuery)))
    : scopedItems;
  const isLongMenu = scopedItems.length >= 12 || navigableSections.length >= 7;
  const showDirectory = navigableSections.length > 1 || scopedItems.length >= 8;
  const isOpen = (section: MenuSection, defaultOpen: boolean) => normalizedQuery || section.collapsible === false
    ? true
    : sectionState[section.id] ?? (onEditSection ? true : defaultOpen);
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
    ...(menu.theme.fontFamily && menu.theme.fontFamily !== 'editorial' ? { '--menu-font': menu.theme.fontFamily === 'sans' ? 'Inter, system-ui, sans-serif' : menu.theme.fontFamily === 'serif' ? 'Georgia, serif' : 'ui-monospace, monospace' } : {}),
  } as CSSProperties;

  const renderSectionTitle = (section: MenuSection, open: boolean) => {
    const collapsible = section.collapsible !== false;
    return <span className="orbitpage-menu__section-title">
      {onEditSection || collapsible ? <button type="button" aria-expanded={!onEditSection ? open : undefined} aria-controls={!onEditSection ? `menu-content-${section.id}` : undefined} title={onEditSection ? 'Edit section' : open ? copy.collapse : copy.expand} onClick={() => onEditSection ? onEditSection(section.id) : setOpen(section.id, !open)}>
        <span>{section.name}</span>{!onEditSection && <ChevronDown aria-hidden="true" />}
      </button> : <span>{section.name}</span>}
      {onEditSection && collapsible && <button className="orbitpage-menu__section-toggle" type="button" aria-label={`${open ? copy.collapse : copy.expand} ${section.name}`} aria-expanded={open} aria-controls={`menu-content-${section.id}`} onClick={() => setOpen(section.id, !open)}><ChevronDown aria-hidden="true" /></button>}
    </span>;
  };

  const renderItems = (items: MenuCatalog['items']) => (
    <div className="orbitpage-menu__items">
      {items.map((item) => (
        <div key={item.id} className={renderItemActions ? "menu-preview-item" : undefined}>
          {renderItemActions?.(item.id)}
        <article
          className={`orbitpage-menu-item${item.featured ? ' orbitpage-menu-item--featured' : ''}${!item.available ? ' orbitpage-menu-item--unavailable' : ''}`}
          role={onEditItem ? 'button' : undefined}
          tabIndex={onEditItem ? 0 : undefined}
          aria-label={onEditItem ? `Edit ${item.name}` : undefined}
          onClick={onEditItem ? () => onEditItem(item.id) : undefined}
          onKeyDown={onEditItem ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onEditItem(item.id); } } : undefined}
        >
          {resolveSafePublicMediaUrl(item.imageUrl) && (
            <img
              src={resolveSafePublicMediaUrl(item.imageUrl) || undefined}
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
        </div>
      ))}
    </div>
  );

  return (
    <main className="orbitpage-menu" style={style} data-menu-font={menu.theme.fontFamily}>
      <div className="orbitpage-menu__shell">
        <header className="orbitpage-menu__header">
          <div className="orbitpage-menu__topbar">
          <a className="orbitpage-menu__back" href={pageHref} aria-label="Back to the main page" aria-disabled={onEditIdentity ? true : undefined} tabIndex={onEditIdentity ? -1 : undefined} onClick={onEditIdentity ? event => event.preventDefault() : undefined}>
            <ArrowLeft aria-hidden="true" />
            <span>Back to main page</span>
          </a>
          {resolveSafePublicMediaUrl(menu.logoUrl) && <img className="orbitpage-menu__logo" src={resolveSafePublicMediaUrl(menu.logoUrl) || undefined} alt={menu.name} />}
          </div>
          <div className="orbitpage-menu__identity">
            <h1>{onEditIdentity ? <button className="menu-preview-edit" aria-label="Edit menu title" onClick={onEditIdentity} type="button">{menu.name}</button> : menu.name}</h1>
            {(menu.description || onEditIdentity) && <div>{onEditIdentity ? <button className="menu-preview-edit" aria-label="Edit menu description" onClick={onEditIdentity} type="button">{menu.description || (isItalian ? 'Aggiungi una descrizione' : 'Add a description')}</button> : menu.description}</div>}
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
            {scopedItems.length >= 8 && (
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
          {visibleRootSections.map((section, sectionIndex) => {
            const directItems = filteredItems
              .filter((item) => item.sectionId === section.id)
              .sort((a, b) => a.position - b.position);
            const subsections = subsectionsFor(section.id).map((subsection) => ({
              ...subsection,
              items: filteredItems
                .filter((item) => item.sectionId === subsection.id)
                .sort((a, b) => a.position - b.position),
            })).filter((subsection) => subsection.items.length > 0 || onEditSection);
            if (directItems.length === 0 && subsections.length === 0 && !onEditSection) return null;
            const sectionOpen = isOpen(section, !isLongMenu || sectionIndex === 0);
            return (
              <section key={section.id} id={`menu-${section.id}`} className="orbitpage-menu__section">
                <div className={`orbitpage-menu__section-heading${renderSectionActions ? ' menu-preview-section' : ''}`}>
                  {renderSectionActions?.(section.id)}
                  {section.showNumber !== false && <span>{String(sectionIndex + 1).padStart(2, '0')}</span>}
                  <div>
                    <h2>{renderSectionTitle(section, sectionOpen)}</h2>
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
                    const subsectionOpen = isOpen(subsection, !isLongMenu || subsectionIndex === 0);
                    return (
                      <section className="orbitpage-menu__subsection" id={`menu-${subsection.id}`} key={subsection.id}>
                        <header className={renderSectionActions ? 'menu-preview-section' : undefined}>
                          {renderSectionActions?.(subsection.id)}
                          <h3>{renderSectionTitle(subsection, subsectionOpen)}</h3>
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

        {scopedItems.length === 0 && (
          <section className="orbitpage-menu__empty">
            <p>The menu is being prepared.</p>
          </section>
        )}

        <footer className="orbitpage-menu__footer">
          {onEditFooter ? <button className="menu-preview-edit" aria-label="Edit menu footer" onClick={onEditFooter} type="button">{menu.footerText || (isItalian ? 'Testo del footer' : 'Footer text')}</button> : menu.footerText && <span>{menu.footerText}</span>}
          {showOrbitPageBadge && <a href="https://orbitpage.com" rel="noopener noreferrer" onClick={onEditFooter ? event => { event.preventDefault(); onEditFooter(); } : undefined}>Made with OrbitPage</a>}
        </footer>
      </div>
    </main>
  );
}

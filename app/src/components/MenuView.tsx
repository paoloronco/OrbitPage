import type { CSSProperties } from 'react';
import { ArrowLeft, Leaf, Sparkles } from 'lucide-react';
import { formatMenuPrice, type MenuCatalog } from '@/lib/menu';
import { withBasePath } from '@/lib/base-path';

interface MenuViewProps {
  menu: MenuCatalog;
  embedded?: boolean;
  pageHref?: string;
}

export function MenuView({ menu, embedded = false, pageHref = withBasePath('/') }: MenuViewProps) {
  const sections = [...menu.sections]
    .filter((section) => section.visible)
    .sort((a, b) => a.position - b.position);
  const style = {
    '--menu-bg': menu.theme.background,
    '--menu-surface': menu.theme.surface,
    '--menu-text': menu.theme.text,
    '--menu-muted': menu.theme.muted,
    '--menu-accent': menu.theme.accent,
    '--menu-border': menu.theme.border,
    '--menu-radius': `${menu.theme.radius}px`,
  } as CSSProperties;

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

        {sections.length > 1 && (
          <nav className="orbitpage-menu__sections" aria-label="Menu sections">
            {sections.map((section) => (
              <a key={section.id} href={`#menu-${section.id}`}>{section.name}</a>
            ))}
          </nav>
        )}

        <div className="orbitpage-menu__catalog">
          {sections.map((section) => {
            const items = menu.items
              .filter((item) => item.sectionId === section.id)
              .sort((a, b) => a.position - b.position);
            if (items.length === 0) return null;
            return (
              <section key={section.id} id={`menu-${section.id}`} className="orbitpage-menu__section">
                <div className="orbitpage-menu__section-heading">
                  <span>{String(section.position + 1).padStart(2, '0')}</span>
                  <div>
                    <h2>{section.name}</h2>
                    {section.description && <p>{section.description}</p>}
                  </div>
                </div>
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
              </section>
            );
          })}
        </div>

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

import type { CSSProperties } from "react";
import { ArrowRight, FileText, Link2, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { Card } from "@/components/ui/card";
import { withPageRootPath } from "@/lib/base-path";
import { getInternalLinksData, type InternalLinkKind } from "@/lib/link-blocks";
import { getPublicBlockPadding, getPublicBlockStyle } from "@/lib/public-block-style";
import { trackPublicLinkClick } from "@/lib/public-runtime";
import { useAppI18n } from "@/lib/i18n";
import type { LinkData } from "./LinkCard";

interface PublicInternalLinksCardProps {
  link: LinkData;
}

const destinationIcons = {
  link: Link2,
  menu: UtensilsCrossed,
  shop: ShoppingBag,
  page: FileText,
} satisfies Record<InternalLinkKind, typeof Link2>;

export const PublicInternalLinksCard = ({ link }: PublicInternalLinksCardProps) => {
  const { tr } = useAppI18n();
  const data = getInternalLinksData(link.content);
  if (data.items.length === 0) return null;

  const defaultLabel = (kind: InternalLinkKind) => ({
    link: tr("Links", "Link"),
    menu: tr("Menu", "Menu"),
    shop: tr("Shop", "Shop"),
    page: tr("Page", "Pagina"),
  })[kind];
  const style = {
    ...getPublicBlockStyle(link),
    "--internal-link-columns": data.columns,
  } as CSSProperties;

  return (
    <Card className={`public-internal-links glass-card ${getPublicBlockPadding(link.size)}`} style={style}>
      {(link.title || link.description) && (
        <header className="public-internal-links__heading">
          {link.title && (
            <h2 style={{
              ...(link.titleFontSize ? { fontSize: link.titleFontSize } : {}),
              ...(link.titleFontFamily ? { fontFamily: link.titleFontFamily } : {}),
            }}>
              {link.title}
            </h2>
          )}
          {link.description && (
            <p style={{
              ...(link.descriptionFontSize ? { fontSize: link.descriptionFontSize } : {}),
              ...(link.descriptionFontFamily ? { fontFamily: link.descriptionFontFamily } : {}),
            }}>
              {link.description}
            </p>
          )}
        </header>
      )}
      <nav
        aria-label={link.title || tr("Explore this page", "Esplora questa pagina")}
        className={`public-internal-links__items public-internal-links__items--${data.layout}`}
        data-item-style={data.itemStyle}
      >
        {data.items.map((item) => {
          const Icon = destinationIcons[item.kind];
          const label = item.label || defaultLabel(item.kind);
          const showDescription = data.layout !== "buttons" && data.showDescriptions && item.description;
          return (
            <a
              aria-label={label}
              className="public-internal-link"
              href={withPageRootPath(item.path)}
              key={item.id}
              onClick={() => trackPublicLinkClick(link.id)}
            >
              {data.showIcons && (
                <span className="public-internal-link__icon" aria-hidden="true">
                  {item.icon ? <span>{item.icon}</span> : <Icon />}
                </span>
              )}
              <span className="public-internal-link__copy">
                <strong>{label}</strong>
                {showDescription ? <small>{item.description}</small> : null}
              </span>
              {data.layout !== "buttons" && <ArrowRight className="public-internal-link__arrow" aria-hidden="true" />}
            </a>
          );
        })}
      </nav>
    </Card>
  );
};

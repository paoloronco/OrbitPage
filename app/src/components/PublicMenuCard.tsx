import type { CSSProperties } from 'react';
import { ArrowRight, UtensilsCrossed } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { trackPublicLinkClick } from '@/lib/public-runtime';
import type { LinkData } from './LinkCard';
import { useAppI18n } from '@/lib/i18n';

interface PublicMenuCardProps {
  link: LinkData;
}

const getPaddingClass = (size?: LinkData['size']) => {
  if (size === 'small') return 'p-3';
  if (size === 'large') return 'p-5 sm:p-6';
  return 'p-4';
};

export const PublicMenuCard = ({ link }: PublicMenuCardProps) => {
  const { tr } = useAppI18n();
  const unavailable = link.availability === 'unavailable';
  const customStyles: CSSProperties = {
    ...(link.backgroundColor ? { backgroundColor: link.backgroundColor } : {}),
    ...(link.textColor ? { color: link.textColor } : {}),
    ...(link.titleFontFamily ? { fontFamily: link.titleFontFamily } : {}),
  };

  return (
    <Card
      className={`public-menu-card glass-card group overflow-hidden p-0 transition-smooth ${unavailable ? 'opacity-65' : 'hover:glow-effect'}`}
      style={customStyles}
      data-orbitpage-block="menu"
    >
      <a
        href={unavailable ? undefined : link.url || '#'}
        onClick={(event) => {
          if (unavailable) {
            event.preventDefault();
            return;
          }
          if (link.url) trackPublicLinkClick(link.id);
        }}
        aria-disabled={unavailable}
        tabIndex={unavailable ? -1 : undefined}
        className={`flex min-h-[88px] items-center gap-4 ${getPaddingClass(link.size)} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${unavailable ? 'cursor-not-allowed' : ''}`}
        aria-label={link.title || 'Open menu'}
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm ring-1 ring-black/5">
          <UtensilsCrossed className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] opacity-60">
            {unavailable ? tr('Currently unavailable', 'Al momento non disponibile') : 'Menu'}
          </span>
          <span
            className="block truncate text-base font-semibold leading-tight"
            style={{
              ...(link.textColor ? { color: link.textColor } : {}),
              ...(link.titleFontSize ? { fontSize: link.titleFontSize } : {}),
              ...(link.titleFontFamily ? { fontFamily: link.titleFontFamily } : {}),
            }}
          >
            {link.title || 'View menu'}
          </span>
          {link.description && (
            <span
              className="mt-1 block line-clamp-2 text-sm opacity-70"
              style={{
                ...(link.textColor ? { color: link.textColor } : {}),
                ...(link.descriptionFontSize ? { fontSize: link.descriptionFontSize } : {}),
                ...(link.descriptionFontFamily ? { fontFamily: link.descriptionFontFamily } : {}),
              }}
            >
              {link.description}
            </span>
          )}
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 opacity-70 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
      </a>
    </Card>
  );
};

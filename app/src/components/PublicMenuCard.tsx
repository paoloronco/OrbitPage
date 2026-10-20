import { UtensilsCrossed } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { trackPublicLinkClick } from '@/lib/public-runtime';
import type { LinkData } from './LinkCard';
import { useAppI18n } from '@/lib/i18n';
import { resolveSafePublicHref } from '@/lib/browser-network-policy';
import { getPublicBlockPadding, getPublicBlockStyle } from '@/lib/public-block-style';

interface PublicMenuCardProps {
  link: LinkData;
}

export const PublicMenuCard = ({ link }: PublicMenuCardProps) => {
  const { tr } = useAppI18n();
  const unavailable = link.availability === 'unavailable';
  const safeHref = resolveSafePublicHref(link.url);

  return (
    <Card
      className={`public-menu-card glass-card group overflow-hidden p-0 transition-smooth ${unavailable ? 'opacity-65' : 'hover:glow-effect'}`}
      style={getPublicBlockStyle(link)}
      data-orbitpage-block="menu"
    >
      <a
        href={unavailable ? undefined : safeHref || undefined}
        onClick={(event) => {
          if (unavailable) {
            event.preventDefault();
            return;
          }
          if (safeHref) trackPublicLinkClick(link.id);
        }}
        aria-disabled={unavailable}
        tabIndex={unavailable ? -1 : undefined}
        className={`public-block-header min-h-[88px] ${getPublicBlockPadding(link.size)} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${unavailable ? 'cursor-not-allowed' : ''}`}
        aria-label={link.title || 'Open menu'}
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm ring-1 ring-black/5">
          <UtensilsCrossed className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="public-block-copy">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] opacity-60">
            {unavailable ? tr('Currently unavailable', 'Al momento non disponibile') : 'Menu'}
          </span>
          <span
            className="block [overflow-wrap:anywhere] text-base font-semibold leading-tight"
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
              className="mt-1 block [overflow-wrap:anywhere] text-sm opacity-70"
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
      </a>
    </Card>
  );
};

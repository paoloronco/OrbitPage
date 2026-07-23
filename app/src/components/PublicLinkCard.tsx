import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { ArrowRight, CalendarCheck, Check, Copy, Download, ExternalLink, Link2, Mail, MailPlus, MapPin, Phone, ShoppingBag, UtensilsCrossed } from "lucide-react";
import type { LinkData } from "./LinkCard";
import { internalAssetPath } from "@/lib/base-path";
import { trackPublicLinkClick } from "@/lib/public-runtime";
import { useAppI18n } from '@/lib/i18n';
import { getServiceLinkData } from '@/lib/link-blocks';
import { brandServiceColors } from '@/lib/service-brand';
import { ServiceBrandIcon } from './ServiceBrandIcon';
import { resolveSafePublicHref, resolveSafePublicMediaUrl } from '@/lib/browser-network-policy';
import { isPublicImageReference, resolvePublicImageUrl } from '@/lib/public-asset-readiness';
import { CompactLinkIcon } from './CompactLinkIcon';
import type { SocialLinkPlatform } from '@/lib/link-blocks';
import { getPublicBlockStyle, getPublicTextColor } from '@/lib/public-block-style';

const resolveCoverImageUrl = (src?: string | null): string | null => {
  const safeUrl = resolveSafePublicMediaUrl(src);
  if (!safeUrl) return null;
  return safeUrl.startsWith('/') || (!safeUrl.includes(':') && !safeUrl.startsWith('//'))
    ? internalAssetPath(safeUrl)
    : safeUrl;
};

interface PublicLinkCardProps {
  link: LinkData;
}

const ctaActionConfig = {
  book: { label: 'Book', Icon: CalendarCheck },
  contact: { label: 'Contact me', Icon: Phone },
  download: { label: 'Download', Icon: Download },
  subscribe: { label: 'Subscribe', Icon: MailPlus },
  buy: { label: 'Buy', Icon: ShoppingBag },
} as const;

const socialIconNames = new Set<SocialLinkPlatform>([
  'instagram', 'facebook', 'tiktok', 'x', 'youtube', 'linkedin', 'whatsapp', 'telegram', 'discord', 'github', 'email',
]);

const semanticIconComponents = {
  booking: CalendarCheck,
  calendar: CalendarCheck,
  contact: Phone,
  download: Download,
  external: ExternalLink,
  link: Link2,
  location: MapPin,
  mail: Mail,
  map: MapPin,
  menu: UtensilsCrossed,
  phone: Phone,
} as const;

function buildValidatedBlobUrl(blobUrl: string): string {
  try {
    const url = new URL(blobUrl);
    
    if (url.protocol !== 'blob:') {
      throw new Error('Invalid protocol');
    }
    
    return url.href;
  } catch {
    throw new Error('Invalid URL');
  }
}

export const PublicLinkCard = ({ link }: PublicLinkCardProps) => {
  const { tr } = useAppI18n();
  const iconIsImage = link.iconType === 'image' || link.iconType === 'svg' || (!link.iconType && isPublicImageReference(link.icon));
  const semanticIconName = iconIsImage ? '' : String(link.icon || '').trim().toLowerCase();
  const resolvedIconUrl = iconIsImage ? resolvePublicImageUrl(link.icon) : null;
  const [blobIconUrl, setBlobIconUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const unavailable = link.availability === 'unavailable';
  const safeHref = resolveSafePublicHref(link.url);
  const service = getServiceLinkData(link.content).service;

  useEffect(() => {
    setImageError(false);
    if (link.iconType === 'emoji') {
      setBlobIconUrl(null);
      return;
    }
    if (!resolvedIconUrl?.startsWith('blob:')) {
      setBlobIconUrl(null);
      return;
    }

    let cancelled = false;
    const loadBlobIcon = async () => {
      try {
        const response = await fetch(buildValidatedBlobUrl(resolvedIconUrl));
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          if (!cancelled) setBlobIconUrl(reader.result as string);
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error('Error loading icon:', error);
        if (!cancelled) setImageError(true);
      }
    };

    void loadBlobIcon();
    return () => { cancelled = true; };
  }, [link.iconType, resolvedIconUrl]);

  const iconUrl = resolvedIconUrl?.startsWith('blob:') ? blobIconUrl : resolvedIconUrl;
  
  const handleLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (unavailable) {
      event.preventDefault();
      return;
    }
    if (safeHref) {
      trackPublicLinkClick(link.id);
    }
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (safeHref) {
      navigator.clipboard.writeText(safeHref).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }).catch(() => {});
    }
  };

  const getSizeClasses = (size?: string) => {
    switch (size) {
      case 'small': return 'p-3';
      case 'large': return 'p-6';
      default: return 'p-4';
    }
  };

  // Add error state for images
  const [imageError, setImageError] = useState(false);
  const [coverImageError, setCoverImageError] = useState(false);
  useEffect(() => { setCoverImageError(false); }, [link.coverImage]);

  // Determine what to show in the icon area
  const renderIcon = () => {
    if (service && !link.icon) {
      return (
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white ring-1 ring-black/10"
          style={{ color: brandServiceColors[service] }}
        >
          <ServiceBrandIcon provider={service} className="h-5 w-5" />
        </div>
      );
    }

    if (link.icon && link.iconType === 'emoji') {
      return (
        <div className="public-link-icon-fallback w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
          <span className="text-lg leading-none" aria-hidden="true">{link.icon}</span>
        </div>
      );
    }

    if (semanticIconName && socialIconNames.has(semanticIconName as SocialLinkPlatform)) {
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
          <CompactLinkIcon platform={semanticIconName as SocialLinkPlatform} url={safeHref || ''} className="h-4 w-4" />
        </div>
      );
    }

    const SemanticIcon = semanticIconComponents[semanticIconName as keyof typeof semanticIconComponents];
    if (SemanticIcon) {
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
          <SemanticIcon className="h-4 w-4" aria-hidden="true" />
        </div>
      );
    }

    // If no icon or there was an error loading it, show a fallback initial
    if (!iconUrl || imageError) {
      return (
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
          <span className="text-lg leading-none opacity-70">
            {link.title ? link.title.charAt(0).toUpperCase() : '?'}
          </span>
        </div>
      );
    }
    // If we have an icon URL, render it with proper error handling. Use full-size image filling the container to avoid layout clipping.
    return (
      <div className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-full overflow-hidden">
        <img
          src={iconUrl}
          alt={link.title || 'Link icon'}
          loading="eager"
          decoding="async"
          className="public-link-icon-image w-full h-full object-cover rounded-full"
          onError={() => {
            console.error('Error loading image:', iconUrl);
            setImageError(true);
          }}
        />
      </div>
    );
  };

  const coverUrl = resolveCoverImageUrl(link.coverImage);
  const hasCoverImage = !!(coverUrl && !coverImageError);
  const isCta = link.type === 'cta';
  const ctaConfig = ctaActionConfig[link.ctaAction || 'book'];
  const effectiveTextColor = getPublicTextColor(link);
  const effectiveTextStyle = effectiveTextColor ? { color: effectiveTextColor } : undefined;

  if (isCta) {
    const { Icon } = ctaConfig;
    return (
      <Card
        className={`public-cta-card group overflow-hidden border-primary/20 bg-primary text-primary-foreground shadow-sm transition-smooth ${unavailable ? 'opacity-65' : 'hover:glow-effect'}`}
        style={getPublicBlockStyle(link)}
      >
        <a
          href={unavailable ? undefined : safeHref || undefined}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleLinkClick}
          aria-disabled={unavailable}
          tabIndex={unavailable ? -1 : undefined}
          className={`public-cta-link flex min-h-[88px] items-center gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${unavailable ? 'cursor-not-allowed' : ''}`}
          aria-label={`${ctaConfig.label}: ${link.title || 'Open action'}`}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/16 text-white ring-1 ring-white/25">
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="mb-1 inline-flex rounded-md bg-white/14 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/85">
              {unavailable ? tr('Unavailable', 'Non disponibile') : ctaConfig.label}
            </span>
            <span
              className="block line-clamp-2 text-base font-semibold leading-tight"
              style={{ ...effectiveTextStyle, ...(link.titleFontSize ? { fontSize: link.titleFontSize } : {}), ...(link.titleFontFamily ? { fontFamily: link.titleFontFamily } : {}) }}
            >
              {link.title || ctaConfig.label}
            </span>
            {link.description && (
              <span
                className="mt-1 block line-clamp-2 text-sm text-white/78"
                style={{ ...effectiveTextStyle, ...(effectiveTextColor ? { opacity: 0.78 } : {}), ...(link.descriptionFontSize ? { fontSize: link.descriptionFontSize } : {}), ...(link.descriptionFontFamily ? { fontFamily: link.descriptionFontFamily } : {}) }}
              >
                {link.description}
              </span>
            )}
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-white/75 transition-transform group-hover:translate-x-0.5" />
        </a>
      </Card>
    );
  }

  return (
    <Card
      className={`glass-card ${hasCoverImage ? 'overflow-hidden' : getSizeClasses(link.size)} transition-smooth hover:glow-effect group`}
      style={getPublicBlockStyle(link)}
    >
      {hasCoverImage && (
        <a
          href={unavailable ? undefined : safeHref || undefined}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleLinkClick}
          className="block overflow-hidden"
          tabIndex={-1}
          aria-disabled={unavailable}
          aria-hidden="true"
        >
          <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/9' }}>
            <img
              src={coverUrl!}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              onError={() => setCoverImageError(true)}
            />
          </div>
        </a>
      )}
      <div className={hasCoverImage ? getSizeClasses(link.size) : ''}>
        <div className="flex items-center justify-between gap-3">
          <a
            href={unavailable ? undefined : safeHref || undefined}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleLinkClick}
            aria-disabled={unavailable}
            tabIndex={unavailable ? -1 : undefined}
            className={`flex items-center gap-3 flex-1 min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${unavailable ? 'cursor-not-allowed opacity-65' : ''}`}
            aria-label={link.title ? `Open ${link.title}` : 'Open link'}
          >
            <div className="flex-shrink-0">
              {renderIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3
                  className="font-semibold truncate flex-1"
                  style={{ ...effectiveTextStyle, ...(link.titleFontSize ? { fontSize: link.titleFontSize } : {}), ...(link.titleFontFamily ? { fontFamily: link.titleFontFamily } : {}) }}
                >
                  {link.title || "Untitled Link"}
                </h3>
                <ExternalLink className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-smooth flex-shrink-0" />
                {unavailable ? (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{tr('Unavailable', 'Non disponibile')}</span>
                ) : null}
                {!unavailable && <button
                  onClick={handleCopy}
                  className="opacity-0 group-hover:opacity-100 transition-smooth flex-shrink-0 p-1 rounded hover:bg-primary/10"
                  title="Copy link"
                >
                  {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                </button>}
              </div>
              {link.description && (
                <p
                  className="text-sm line-clamp-2 mt-1"
                  style={{ ...effectiveTextStyle, ...(link.descriptionFontSize ? { fontSize: link.descriptionFontSize } : {}), ...(link.descriptionFontFamily ? { fontFamily: link.descriptionFontFamily } : {}) }}
                >
                  {link.description}
                </p>
              )}
              {safeHref && !link.hideUrl && (
                <p
                  className="text-xs mt-1 truncate text-muted-foreground"
                  style={effectiveTextColor ? { color: effectiveTextColor, opacity: 0.8 } : undefined}
                >
                  {link.url.replace(/^https?:\/\//, '')}
                </p>
              )}
            </div>
          </a>
        </div>
      </div>
    </Card>
  );
};

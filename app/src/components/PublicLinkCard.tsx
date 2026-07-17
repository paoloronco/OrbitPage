import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { ArrowRight, CalendarCheck, Check, Copy, Download, ExternalLink, MailPlus, Phone, ShoppingBag } from "lucide-react";
import type { LinkData } from "./LinkCard";
import { internalAssetPath } from "@/lib/base-path";
import { trackPublicLinkClick } from "@/lib/public-runtime";

const resolveCoverImageUrl = (src?: string | null): string | null => {
  if (!src) return null;
  if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http')) return src;
  return internalAssetPath(src);
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

const getIconUrl = (iconPath?: string | null) => {
  if (!iconPath) return null;
  
  // If it's a data URL or blob URL, return as is
  if (iconPath.startsWith('data:') || iconPath.startsWith('blob:')) {
    return iconPath;
  }
  
  // If it's already a full URL, return as is
  if (iconPath.startsWith('http')) {
    return iconPath;
  }
  
  // If it's an absolute internal path, prefix the active app base path.
  if (iconPath.startsWith('/')) {
    return internalAssetPath(iconPath);
  }
  
  // For relative paths, assume they're in the uploads directory
  return internalAssetPath(iconPath);
};

export const PublicLinkCard = ({ link }: PublicLinkCardProps) => {
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (link.iconType === 'emoji') {
      setIconUrl(null);
      setImageError(false);
      return;
    }

    const loadIcon = async () => {
      try {
        const url = getIconUrl(link.icon);
        
        // If it's a blob URL, convert it to a data URL
        if (url?.startsWith('blob:')) {
          const validatedUrl = buildValidatedBlobUrl(url);
          const response = await fetch(validatedUrl);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            setIconUrl(reader.result as string);
          };
          reader.readAsDataURL(blob);
        } else {
          setIconUrl(url);
        }
      } catch (error) {
        console.error('Error loading icon:', error);
        setIconUrl(null);
      }
    };

    loadIcon();
  }, [link.icon, link.iconType]);
  
  const handleLinkClick = () => {
    if (link.url) {
      trackPublicLinkClick(link.id);
    }
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (link.url) {
      navigator.clipboard.writeText(link.url).then(() => {
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

  const getCustomStyles = () => {
    const styles: React.CSSProperties = {};
    if (link.backgroundColor) {
      styles.backgroundColor = link.backgroundColor;
    }
    if (link.textColor) {
      styles.color = link.textColor;
    }
    if (link.titleFontFamily) {
      // Apply a card-level font family if provided (title/description may override)
      styles.fontFamily = link.titleFontFamily;
    }
    if (link.alignment) {
      styles.textAlign = link.alignment as any;
    }
    return styles;
  };

  // Add error state for images
  const [imageError, setImageError] = useState(false);
  const [coverImageError, setCoverImageError] = useState(false);
  useEffect(() => { setCoverImageError(false); }, [link.coverImage]);

  // Determine what to show in the icon area
  const renderIcon = () => {
    if (link.icon && link.iconType === 'emoji') {
      return (
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
          <span className="text-lg leading-none" aria-hidden="true">{link.icon}</span>
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
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover rounded-full"
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

  if (isCta) {
    const { Icon } = ctaConfig;
    return (
      <Card
        className="public-cta-card group overflow-hidden border-primary/20 bg-primary text-primary-foreground shadow-sm transition-smooth hover:glow-effect"
        style={getCustomStyles()}
      >
        <a
          href={link.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleLinkClick}
          className="public-cta-link flex min-h-[88px] items-center gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`${ctaConfig.label}: ${link.title || 'Open action'}`}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/16 text-white ring-1 ring-white/25">
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="mb-1 inline-flex rounded-md bg-white/14 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/85">
              {ctaConfig.label}
            </span>
            <span
              className="block line-clamp-2 text-base font-semibold leading-tight"
              style={{ ...(link.textColor ? { color: link.textColor } : {}), ...(link.titleFontSize ? { fontSize: link.titleFontSize } : {}), ...(link.titleFontFamily ? { fontFamily: link.titleFontFamily } : {}) }}
            >
              {link.title || ctaConfig.label}
            </span>
            {link.description && (
              <span
                className="mt-1 block line-clamp-2 text-sm text-white/78"
                style={{ ...(link.textColor ? { color: link.textColor, opacity: 0.78 } : {}), ...(link.descriptionFontSize ? { fontSize: link.descriptionFontSize } : {}), ...(link.descriptionFontFamily ? { fontFamily: link.descriptionFontFamily } : {}) }}
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
      style={getCustomStyles()}
    >
      {hasCoverImage && (
        <a
          href={link.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleLinkClick}
          className="block overflow-hidden"
          tabIndex={-1}
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
            href={link.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleLinkClick}
            className="flex items-center gap-3 flex-1 min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={link.title ? `Open ${link.title}` : 'Open link'}
          >
            <div className="flex-shrink-0">
              {renderIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3
                  className="font-semibold truncate flex-1"
                  style={{ ...(link.textColor ? { color: link.textColor } : {}), ...(link.titleFontSize ? { fontSize: link.titleFontSize } : {}), ...(link.titleFontFamily ? { fontFamily: link.titleFontFamily } : {}) }}
                >
                  {link.title || "Untitled Link"}
                </h3>
                <ExternalLink className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-smooth flex-shrink-0" />
                <button
                  onClick={handleCopy}
                  className="opacity-0 group-hover:opacity-100 transition-smooth flex-shrink-0 p-1 rounded hover:bg-primary/10"
                  title="Copy link"
                >
                  {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                </button>
              </div>
              {link.description && (
                <p
                  className="text-sm line-clamp-2 mt-1"
                  style={{ ...(link.textColor ? { color: link.textColor } : {}), ...(link.descriptionFontSize ? { fontSize: link.descriptionFontSize } : {}), ...(link.descriptionFontFamily ? { fontFamily: link.descriptionFontFamily } : {}) }}
                >
                  {link.description}
                </p>
              )}
              {link.url && !link.hideUrl && (
                <p
                  className="text-xs mt-1 truncate text-muted-foreground"
                  style={link.textColor ? { color: link.textColor, opacity: 0.8 } : undefined}
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

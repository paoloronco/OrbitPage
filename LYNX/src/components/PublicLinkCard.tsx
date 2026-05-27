import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { ExternalLink, Copy, Check } from "lucide-react";
import { LinkData } from "./LinkCard";
import { apiPath, internalAssetPath } from "@/lib/base-path";

const resolveCoverImageUrl = (src?: string | null): string | null => {
  if (!src) return null;
  if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http')) return src;
  return internalAssetPath(src);
};

interface PublicLinkCardProps {
  link: LinkData;
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
    const loadIcon = async () => {
      try {
        const url = getIconUrl(link.icon);
        
        // If it's a blob URL, convert it to a data URL
        if (url?.startsWith('blob:')) {
          const response = await fetch(url);
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
  }, [link.icon]);
  
  const handleLinkClick = () => {
    if (link.url) {
      fetch(apiPath(`/links/${encodeURIComponent(link.id)}/click`), { method: 'POST' }).catch(() => {});
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
              {link.url && (
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

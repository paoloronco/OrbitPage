import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Type, ExternalLink } from "lucide-react";
import type { LinkData } from "./LinkCard";
import { internalAssetPath } from "@/lib/base-path";
import { trackPublicLinkClick } from "@/lib/public-runtime";
import { getPublicBlockStyle, getPublicTextColor } from "@/lib/public-block-style";
import { resolveSafePublicHref, resolveSafePublicMediaUrl } from "@/lib/browser-network-policy";

const resolveCoverImageUrl = (src?: string | null): string | null => {
  const safeUrl = resolveSafePublicMediaUrl(src);
  if (!safeUrl) return null;
  return safeUrl.startsWith('/') || (!safeUrl.includes(':') && !safeUrl.startsWith('//'))
    ? internalAssetPath(safeUrl)
    : safeUrl;
};

interface PublicTextCardProps {
  link: LinkData;
}

export const PublicTextCard = ({ link }: PublicTextCardProps) => {
  const [coverImageError, setCoverImageError] = useState(false);
  useEffect(() => { setCoverImageError(false); }, [link.coverImage]);
  const safeHref = resolveSafePublicHref(link.url);

  const trackClick = () => {
    if (safeHref) {
      trackPublicLinkClick(link.id);
    }
  };

  const handleClick = () => {
    if (safeHref) {
      trackClick();
      window.open(safeHref, '_blank', 'noopener,noreferrer');
    }
  };
  const getSizeClasses = (size?: string) => {
    switch (size) {
      case 'small': return 'p-3';
      case 'large': return 'p-6';
      default: return 'p-4';
    }
  };

  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const formatContent = (content?: string) => {
    if (!content) return null;

    // Escape raw content first to prevent HTML injection
    const safe = escapeHtml(content);

    // Convert simple markdown-like syntax to HTML
    let formatted = safe
      .replace(/^\* (.+)$/gm, (_match, text) => `<li>${processLinkText(text)}</li>`)
      .replace(/^- (.+)$/gm, (_match, text) => `<li>${processLinkText(text)}</li>`)
      .replace(/^\d+\. (.+)$/gm, (_match, text) => `<li>${processLinkText(text)}</li>`)
      .replace(/\n/g, '<br/>');

    // Wrap consecutive list items in ul tags
    formatted = formatted.replace(/(<li>.*?<\/li>(\s*<br\/>*)*)+/g, (match) => {
      const listItems = match.replace(/<br\/>/g, '');
      return `<ul class="list-disc list-inside space-y-1 ml-2">${listItems}</ul>`;
    });

    return formatted;
  };

  const processLinkText = (text: string) => {
    // text is already HTML-escaped; match pattern: label(url) or label (url)
    const linkPattern = /^(.+?)\s*\(([^)]+)\)\s*$/;
    const match = text.match(linkPattern);

    if (match) {
      const label = match[1].trim();
      const rawUrl = match[2].trim();
      const fullUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
      const safeUrl = resolveSafePublicHref(fullUrl);
      if (!safeUrl || !/^https?:\/\//i.test(safeUrl)) return text;
      return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" class="hover:underline hover:text-primary transition-colors">${label} (${rawUrl})</a>`;
    }

    return text;
  };

  const coverUrl = resolveCoverImageUrl(link.coverImage);
  const iconUrl = link.iconType === 'image' || link.iconType === 'svg'
    ? resolveCoverImageUrl(link.icon)
    : null;
  const hasCoverImage = !!(coverUrl && !coverImageError);
  const readableTextColor = getPublicTextColor(link);

  return (
    <Card
      className={`glass-card ${hasCoverImage ? 'overflow-hidden' : getSizeClasses(link.size)} transition-smooth ${
        safeHref ? 'hover:glow-effect group cursor-pointer' : ''
      }`}
      onClick={hasCoverImage ? undefined : handleClick}
      style={getPublicBlockStyle(link)}
    >
      {hasCoverImage && (
        <div
          className="relative w-full overflow-hidden"
          style={{ aspectRatio: '16/9' }}
          onClick={safeHref ? handleClick : undefined}
          aria-hidden="true"
        >
          <img
            src={coverUrl!}
            alt=""
            loading="lazy"
            decoding="async"
            className={`w-full h-full object-cover transition-transform duration-300${safeHref ? ' group-hover:scale-[1.02]' : ''}`}
            onError={() => setCoverImageError(true)}
          />
        </div>
      )}
      <div
        className={hasCoverImage ? getSizeClasses(link.size) : ''}
        onClick={hasCoverImage && safeHref ? handleClick : undefined}
      >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {link.icon && (
              <div className="flex-shrink-0">
                {link.iconType === 'image' || link.iconType === 'svg' ? (
                  iconUrl ? <img src={iconUrl} alt="" className="w-5 h-5 object-cover rounded" /> : null
                ) : (
                  <span className="text-lg">{link.icon}</span>
                )}
              </div>
            )}
            {safeHref ? (
              <a
                href={safeHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => {
                  event.stopPropagation();
                  trackClick();
                }}
                className="font-semibold truncate rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                style={readableTextColor ? { color: readableTextColor } : undefined}
              >
                {link.title || "Text Card"}
              </a>
            ) : (
              <h3
                className="font-semibold truncate"
                style={readableTextColor ? { color: readableTextColor } : undefined}
              >
                {link.title || "Text Card"}
              </h3>
            )}
            {safeHref && <ExternalLink className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-smooth" />}
          </div>
          {link.textItems && link.textItems.length > 0 && (
            <ul className="text-sm leading-relaxed space-y-2 mb-3" style={readableTextColor ? { color: readableTextColor } : undefined}>
              {link.textItems.map((item, index) => {
                const itemHref = resolveSafePublicHref(item.url);
                return (
                <li key={index} className="flex">
                  <span className="mr-2" style={{ color: item.textColor || readableTextColor }}>•</span>
                  <div className="flex-1 min-w-0">
                    {/* Label on its own line */}
                    <div style={{ color: item.textColor || readableTextColor, fontSize: item.fontSize || undefined, fontFamily: item.fontFamily || link.descriptionFontFamily || undefined }}>{item.text}</div>
                    {/* URL on second indented line without wrapping */}
                    {itemHref && (
                      <a
                        href={itemHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="ml-6 block whitespace-nowrap overflow-x-auto hover:underline hover:text-primary transition-colors text-left"
                        title={item.url}
                        style={{ color: item.textColor || readableTextColor }}
                      >
                        {item.url}
                      </a>
                    )}
                  </div>
                </li>
                );
              })}
            </ul>
          )}
          {link.content && (
            <div 
              className="text-sm leading-relaxed"
              style={readableTextColor ? { color: readableTextColor } : undefined}
              dangerouslySetInnerHTML={{ __html: formatContent(link.content) }}
            />
          )}
        </div>
      </div>
      </div>
    </Card>
  );
};

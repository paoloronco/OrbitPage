import { Card } from "@/components/ui/card";
import { Type, ExternalLink } from "lucide-react";
import { LinkData } from "./LinkCard";

interface PublicTextCardProps {
  link: LinkData;
}

export const PublicTextCard = ({ link }: PublicTextCardProps) => {
  const trackClick = () => {
    if (link.url) {
      fetch('/api/links/' + link.id + '/click', { method: 'POST' }).catch(() => {});
    }
  };

  const handleClick = () => {
    if (link.url) {
      trackClick();
      window.open(link.url, '_blank');
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
    return styles;
  };

  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const isSafeUrl = (url: string) => /^https?:/i.test(url);

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
      if (!isSafeUrl(fullUrl)) return text;
      return `<a href="${escapeHtml(fullUrl)}" target="_blank" rel="noopener noreferrer" class="hover:underline hover:text-primary transition-colors">${label} (${rawUrl})</a>`;
    }

    return text;
  };

  return (
    <Card 
      className={`glass-card ${getSizeClasses(link.size)} transition-smooth ${
        link.url ? 'hover:glow-effect group cursor-pointer' : ''
      }`}
      onClick={handleClick}
      style={getCustomStyles()}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {link.icon && (
              <div className="flex-shrink-0">
                {link.iconType === 'image' || link.iconType === 'svg' ? (
                  <img src={link.icon} alt="" className="w-5 h-5 object-cover rounded" />
                ) : (
                  <span className="text-lg">{link.icon}</span>
                )}
              </div>
            )}
            {link.url ? (
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => {
                  event.stopPropagation();
                  trackClick();
                }}
                className="font-semibold truncate rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                style={link.textColor ? { color: link.textColor } : undefined}
              >
                {link.title || "Text Card"}
              </a>
            ) : (
              <h3
                className="font-semibold truncate"
                style={link.textColor ? { color: link.textColor } : undefined}
              >
                {link.title || "Text Card"}
              </h3>
            )}
            {link.url && <ExternalLink className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-smooth" />}
          </div>
          {link.textItems && link.textItems.length > 0 && (
            <ul className="text-sm leading-relaxed space-y-2 mb-3" style={link.textColor ? { color: link.textColor } : undefined}>
              {link.textItems.map((item, index) => (
                <li key={index} className="flex">
                  <span className="mr-2" style={{ color: item.textColor || link.textColor }}>•</span>
                  <div className="flex-1 min-w-0">
                    {/* Label on its own line */}
                    <div style={{ color: item.textColor || link.textColor, fontSize: item.fontSize || undefined, fontFamily: item.fontFamily || link.descriptionFontFamily || undefined }}>{item.text}</div>
                    {/* URL on second indented line without wrapping */}
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="ml-6 block whitespace-nowrap overflow-x-auto hover:underline hover:text-primary transition-colors text-left"
                        title={item.url}
                        style={{ color: item.textColor || link.textColor }}
                      >
                        {item.url}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {link.content && (
            <div 
              className="text-sm leading-relaxed"
              style={link.textColor ? { color: link.textColor } : undefined}
              dangerouslySetInnerHTML={{ __html: formatContent(link.content) }}
            />
          )}
        </div>
      </div>
    </Card>
  );
};

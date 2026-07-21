import type { CSSProperties } from "react";
import { Card } from "@/components/ui/card";
import type { LinkData } from "./LinkCard";
import { getSocialRowData } from "@/lib/link-blocks";
import { CompactLinkIcon } from "./CompactLinkIcon";
import { detectCompactLinkPlatform, getCompactLinkBrandStyle, getSafeCompactLinkHref } from "@/lib/compact-links";
import { getPublicAccentStyle, getPublicBlockPadding, getPublicBlockStyle, getPublicIconContent } from "@/lib/public-block-style";
import { Share2 } from "lucide-react";

interface PublicSocialRowCardProps {
  link: LinkData;
}

export const PublicSocialRowCard = ({ link }: PublicSocialRowCardProps) => {
  const data = getSocialRowData(link.content);
  const { items = [], layout = "grid", iconStyle = "theme", columns = 2, boxed = true, showTitle = true, showLabels = true } = data;
  const cardStyle = boxed ? getPublicBlockStyle(link) : ({ color: getPublicBlockStyle(link).color } as CSSProperties);
  const gridStyle = layout === "grid" ? { "--compact-link-columns": columns } as CSSProperties : undefined;

  return (
    <Card className={`public-compact-links glass-card p-0 ${boxed ? "" : "public-compact-links--transparent"}`} style={cardStyle}>
      <div className={`${boxed ? getPublicBlockPadding(link.size) : "py-1"} ${showTitle ? "space-y-3" : ""}`}>
        {showTitle && (
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/15" style={getPublicAccentStyle(link)}>
              {getPublicIconContent(link, <Share2 className="h-4 w-4" />)}
            </span>
            <p
              className="text-sm font-semibold leading-tight text-muted-foreground"
              style={{
                ...(link.textColor ? { color: link.textColor, opacity: 0.82 } : {}),
                ...(link.titleFontSize ? { fontSize: link.titleFontSize } : {}),
                ...(link.titleFontFamily ? { fontFamily: link.titleFontFamily } : {}),
              }}
            >
              {link.title || "Quick links"}
            </p>
          </div>
        )}

        {items.length > 0 ? (
          <div className={`public-compact-links__items public-compact-links__items--${layout}`} style={gridStyle}>
            {items.map((item) => {
              const platform = item.platform === "auto" || !item.platform ? detectCompactLinkPlatform(item.url) : item.platform;
              const isInternal = platform === "page" || item.url.startsWith("/") || item.url.startsWith("#");
              const iconStyleValue = iconStyle === "brand" ? getCompactLinkBrandStyle(platform, item.url) : undefined;
              const safeHref = getSafeCompactLinkHref(item.url);
              return (
                <a
                  key={`${item.label}-${item.url}`}
                  href={safeHref || undefined}
                  target={isInternal ? undefined : "_blank"}
                  rel={isInternal ? undefined : "noopener noreferrer"}
                  className={`public-compact-link public-compact-link--${layout} public-compact-link--${iconStyle} ${safeHref ? "" : "public-compact-link--disabled"}`}
                  aria-label={!showLabels ? item.label : undefined}
                  aria-disabled={!safeHref || undefined}
                >
                  <span className="public-compact-link__icon" style={iconStyleValue}>
                    <CompactLinkIcon platform={platform} url={item.url} customIcon={item.icon} />
                  </span>
                  {(showLabels || layout !== "icons") && <span className="public-compact-link__label">{item.label}</span>}
                </a>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/80 bg-background/25 px-4 py-3 text-center text-sm font-medium text-muted-foreground">
            Add links from edit
          </div>
        )}
      </div>
    </Card>
  );
};

import type { CSSProperties } from "react";
import { Card } from "@/components/ui/card";
import type { LinkData } from "./LinkCard";
import { getSocialRowData } from "@/lib/link-blocks";
import { CompactLinkIcon } from "./CompactLinkIcon";
import { detectCompactLinkPlatform, getCompactLinkAccessibleLabel, getCompactLinkBrandStyle, getSafeCompactLinkHref } from "@/lib/compact-links";
import { getPublicBlockStyle } from "@/lib/public-block-style";

interface PublicSocialRowCardProps {
  link: LinkData;
}

export const PublicSocialRowCard = ({ link }: PublicSocialRowCardProps) => {
  const data = getSocialRowData(link.content);
  const { items = [], iconStyle = "brand", showLabels = false } = data;
  const layout = "icons";
  const cardStyle = { color: getPublicBlockStyle(link).color } as CSSProperties;

  return (
    <Card className="public-compact-links public-compact-links--transparent glass-card p-0" style={cardStyle}>
      <div className="py-1">
        {items.length > 0 ? (
          <div className={`public-compact-links__items public-compact-links__items--${layout}`}>
            {items.map((item) => {
              const platform = item.platform === "auto" || !item.platform ? detectCompactLinkPlatform(item.url) : item.platform;
              const isInternal = platform === "page" || item.url.startsWith("/") || item.url.startsWith("#");
              const iconStyleValue = iconStyle === "brand" ? getCompactLinkBrandStyle(platform, item.url) : undefined;
              const safeHref = getSafeCompactLinkHref(item.url);
              const accessibleLabel = getCompactLinkAccessibleLabel(platform, item.url, item.label);
              return (
                <a
                  key={`${item.label}-${item.url}`}
                  href={safeHref || undefined}
                  target={isInternal ? undefined : "_blank"}
                  rel={isInternal ? undefined : "noopener noreferrer"}
                  className={`public-compact-link public-compact-link--${layout} public-compact-link--${iconStyle} ${safeHref ? "" : "public-compact-link--disabled"}`}
                  aria-label={!showLabels ? accessibleLabel : undefined}
                  aria-disabled={!safeHref || undefined}
                >
                  <span className="public-compact-link__icon" style={iconStyleValue}>
                    <CompactLinkIcon platform={platform} url={item.url} customIcon={item.icon} />
                  </span>
                  {showLabels && item.label && <span className="public-compact-link__label">{item.label}</span>}
                </a>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/80 bg-background/25 px-4 py-3 text-center text-sm font-medium text-muted-foreground">
            Add your first quick link
          </div>
        )}
      </div>
    </Card>
  );
};

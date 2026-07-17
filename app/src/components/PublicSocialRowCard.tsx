import { Card } from "@/components/ui/card";
import type { LinkData } from "./LinkCard";
import { getSocialRowData } from "@/lib/link-blocks";
import { ArrowUpRight, Share2 } from "lucide-react";
import { getPublicAccentStyle, getPublicBlockPadding, getPublicBlockStyle, getPublicIconContent } from "@/lib/public-block-style";

interface PublicSocialRowCardProps {
  link: LinkData;
}

export const PublicSocialRowCard = ({ link }: PublicSocialRowCardProps) => {
  const { items = [] } = getSocialRowData(link.content);
  const hasItems = items.length > 0;

  const cardStyle = getPublicBlockStyle(link);

  return (
    <Card className="glass-card p-0" style={cardStyle}>
      <div className={`space-y-3 ${getPublicBlockPadding(link.size)}`}>
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
            {link.title || "Social links"}
          </p>
        </div>
        {hasItems ? (
          <div className="public-social-grid grid gap-2">
            {items.map((item) => (
              <a
                key={`${item.label}-${item.url}`}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border/70 bg-background/35 px-3 py-2 text-center text-sm font-medium transition-smooth hover:border-primary/45 hover:bg-primary/8"
              >
                <span className="truncate">{item.label}</span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-primary" style={getPublicAccentStyle(link)} />
              </a>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/80 bg-background/25 px-4 py-3 text-center text-sm font-medium text-muted-foreground">
            Add social links from edit
          </div>
        )}
      </div>
    </Card>
  );
};

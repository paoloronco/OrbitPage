import { Card } from "@/components/ui/card";
import type { LinkData } from "./LinkCard";
import { getCalloutData } from "@/lib/link-blocks";
import { apiPath } from "@/lib/base-path";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { getPublicAccentStyle, getPublicBlockGap, getPublicBlockPadding, getPublicBlockStyle, getPublicButtonStyle, getPublicIconContent, getPublicIconSize } from "@/lib/public-block-style";

interface PublicCalloutCardProps {
  link: LinkData;
}

export const PublicCalloutCard = ({ link }: PublicCalloutCardProps) => {
  const { badge, buttonLabel } = getCalloutData(link.content);
  const cardStyle = getPublicBlockStyle(link);

  const handleOpen = () => {
    if (link.url) {
      fetch(apiPath(`/links/${encodeURIComponent(link.id)}/click`), { method: 'POST' }).catch(() => {});
      window.open(link.url, "_blank", "noopener,noreferrer");
    }
  };

  if (!link.title && !link.description) {
    return null;
  }

  return (
    <Card
      className="glass-card group relative overflow-hidden border-primary/25 bg-primary/8 p-0 transition-smooth hover:border-primary/45 hover:shadow-lg"
      style={cardStyle}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-primary/60" />
      <div className={`flex ${getPublicBlockGap(link.size)} ${getPublicBlockPadding(link.size)}`}>
        <div className={`flex ${getPublicIconSize(link.size)} shrink-0 items-center justify-center rounded-lg bg-primary/14 text-primary ring-1 ring-primary/20`} style={getPublicAccentStyle(link)}>
          {getPublicIconContent(link, <Sparkles className="h-5 w-5" />)}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          {badge ? (
            <span className="inline-flex rounded-full bg-primary/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary" style={getPublicAccentStyle(link)}>
              {badge}
            </span>
          ) : null}
          {link.title && (
            <p
              className="text-base font-semibold leading-tight"
              style={{
                ...(link.titleFontSize ? { fontSize: link.titleFontSize } : {}),
                ...(link.titleFontFamily ? { fontFamily: link.titleFontFamily } : {}),
              }}
            >
              {link.title}
            </p>
          )}
          {link.description && (
            <p
              className="text-sm leading-relaxed text-muted-foreground"
              style={{
                ...(link.textColor ? { color: link.textColor, opacity: 0.82 } : {}),
                ...(link.descriptionFontSize ? { fontSize: link.descriptionFontSize } : {}),
                ...(link.descriptionFontFamily ? { fontFamily: link.descriptionFontFamily } : {}),
              }}
            >
              {link.description}
            </p>
          )}
        {link.url ? (
          <button
            type="button"
            onClick={handleOpen}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-smooth hover:bg-primary/90"
              style={getPublicButtonStyle(link)}
          >
            {buttonLabel || "Open"}
              <ArrowUpRight className="h-4 w-4" />
          </button>
        ) : null}
        </div>
      </div>
    </Card>
  );
};

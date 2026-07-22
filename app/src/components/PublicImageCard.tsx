import { useState } from "react";
import { Card } from "@/components/ui/card";
import type { LinkData } from "./LinkCard";
import { internalAssetPath } from "@/lib/base-path";
import { trackPublicLinkClick } from "@/lib/public-runtime";
import { ArrowUpRight, ImageOff } from "lucide-react";
import { getPublicBlockPadding, getPublicBlockStyle } from "@/lib/public-block-style";
import { resolveSafePublicHref, resolveSafePublicMediaUrl } from "@/lib/browser-network-policy";

interface PublicImageCardProps {
  link: LinkData;
}

const resolveImageUrl = (src?: string | null) => {
  const safeUrl = resolveSafePublicMediaUrl(src);
  if (!safeUrl) return null;
  return safeUrl.startsWith("/") || (!safeUrl.includes(":") && !safeUrl.startsWith("//"))
    ? internalAssetPath(safeUrl)
    : safeUrl;
};

export const PublicImageCard = ({ link }: PublicImageCardProps) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = resolveImageUrl(link.coverImage || link.url);
  const safeHref = resolveSafePublicHref(link.url);
  const hasCaption = Boolean(link.title || link.description);
  const cardStyle = getPublicBlockStyle(link);

  const trackClick = () => {
    if (!safeHref) return;
    trackPublicLinkClick(link.id);
  };

  if (!imageUrl) {
    return null;
  }

  return (
    <Card className="glass-card group overflow-hidden p-0 transition-smooth hover:shadow-lg" style={cardStyle}>
      <button
        type="button"
        className="block w-full text-left disabled:cursor-default"
        onClick={() => {
          if (safeHref) {
            trackClick();
            window.open(safeHref, "_blank", "noopener,noreferrer");
          }
        }}
        disabled={!safeHref}
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted/35">
          {imageError ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <ImageOff className="h-6 w-6" />
              <span className="text-sm">Image unavailable</span>
            </div>
          ) : (
            <img
              src={imageUrl}
              alt={link.coverImageAlt || link.title || "Image block"}
              onError={() => setImageError(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              loading="lazy"
              decoding="async"
            />
          )}
          {safeHref ? (
            <span className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white opacity-90 ring-1 ring-white/20 backdrop-blur-sm transition-smooth group-hover:bg-primary">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          ) : null}
        </div>
      </button>
      {hasCaption ? (
        <div className={getPublicBlockPadding(link.size)} style={imageError ? { opacity: 0.75 } : undefined}>
          {link.title ? (
            <p
              className="text-sm font-semibold leading-tight"
              style={{
                ...(link.titleFontSize ? { fontSize: link.titleFontSize } : {}),
                ...(link.titleFontFamily ? { fontFamily: link.titleFontFamily } : {}),
              }}
            >
              {link.title}
            </p>
          ) : null}
          {link.description ? (
            <p
              className="mt-1 text-sm leading-relaxed text-muted-foreground"
              style={{
                ...(link.textColor ? { color: link.textColor, opacity: 0.78 } : {}),
                ...(link.descriptionFontSize ? { fontSize: link.descriptionFontSize } : {}),
                ...(link.descriptionFontFamily ? { fontFamily: link.descriptionFontFamily } : {}),
              }}
            >
              {link.description}
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
};

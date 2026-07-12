import { Card } from "@/components/ui/card";
import type { LinkData } from "./LinkCard";
import { apiPath } from "@/lib/base-path";
import { getMapData } from "@/lib/link-blocks";
import { ArrowUpRight, MapPinned, Navigation } from "lucide-react";
import { getPublicBlockPadding, getPublicBlockStyle, getPublicButtonStyle, getPublicIconContent } from "@/lib/public-block-style";

interface PublicMapCardProps {
  link: LinkData;
}

const getMapQuery = (placeName?: string, address?: string, fallbackTitle?: string) => (
  [placeName, address].filter(Boolean).join(", ") || fallbackTitle || ""
).trim();

const buildGoogleMapsEmbedUrl = (mapUrl?: string, query?: string) => {
  const embedQuery = query || mapUrl || "";
  if (!embedQuery) return "";

  return `https://maps.google.com/maps?hl=it&z=14&ie=UTF8&iwloc=B&output=embed&q=${encodeURIComponent(embedQuery)}`;
};

export const PublicMapCard = ({ link }: PublicMapCardProps) => {
  const { placeName, address, mapUrl } = getMapData(link.content);
  const mapQuery = getMapQuery(placeName, address, link.title);
  const resolvedMapUrl = mapUrl || (address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : mapQuery
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
    : "");
  const embedUrl = buildGoogleMapsEmbedUrl(mapUrl, mapQuery);

  const handleOpen = () => {
    if (resolvedMapUrl) {
      fetch(apiPath(`/links/${encodeURIComponent(link.id)}/click`), { method: 'POST' }).catch(() => {});
      window.open(resolvedMapUrl, "_blank", "noopener,noreferrer");
    }
  };

  const hasContent = Boolean(placeName || address || mapUrl || link.title);
  if (!hasContent) {
    return null;
  }
  const cardStyle = getPublicBlockStyle(link);

  return (
    <Card className="glass-card overflow-hidden p-0" style={cardStyle}>
      <div className={`relative overflow-hidden bg-muted/30 ${link.size === "small" ? "h-32" : link.size === "large" ? "h-52" : "h-40"}`}>
        {embedUrl ? (
          <iframe
            title={placeName || address || link.title || "Map preview"}
            src={embedUrl}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-full w-full border-0"
          />
        ) : (
          <div className="absolute inset-0 opacity-55 [background-image:linear-gradient(90deg,hsl(var(--primary)/.16)_1px,transparent_1px),linear-gradient(0deg,hsl(var(--primary)/.16)_1px,transparent_1px)] [background-size:22px_22px]" />
        )}
        <div className="pointer-events-none absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-2 ring-background/70" style={getPublicButtonStyle(link)}>
          {getPublicIconContent(link, <MapPinned className="h-4 w-4" />)}
        </div>
      </div>
      <div className={`space-y-3 ${getPublicBlockPadding(link.size)}`}>
        <div>
          <p
            className="text-base font-semibold leading-tight"
            style={{
              ...(link.titleFontSize ? { fontSize: link.titleFontSize } : {}),
              ...(link.titleFontFamily ? { fontFamily: link.titleFontFamily } : {}),
            }}
          >
            {placeName || link.title || "Map"}
          </p>
          {address ? (
            <p
              className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground"
              style={{
                ...(link.textColor ? { color: link.textColor, opacity: 0.78 } : {}),
                ...(link.descriptionFontSize ? { fontSize: link.descriptionFontSize } : {}),
                ...(link.descriptionFontFamily ? { fontFamily: link.descriptionFontFamily } : {}),
              }}
            >
              {address}
            </p>
          ) : null}
        </div>
        {resolvedMapUrl ? (
          <button
            type="button"
            onClick={handleOpen}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-smooth hover:bg-primary/90"
            style={getPublicButtonStyle(link)}
          >
            <Navigation className="h-4 w-4" />
            Open map
            <ArrowUpRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </Card>
  );
};

import { Card } from "@/components/ui/card";
import { LinkData } from "./LinkCard";
import { apiPath } from "@/lib/base-path";
import { getMapData } from "@/lib/link-blocks";
import { ArrowUpRight, MapPinned, Navigation } from "lucide-react";

interface PublicMapCardProps {
  link: LinkData;
}

export const PublicMapCard = ({ link }: PublicMapCardProps) => {
  const { placeName, address, mapUrl } = getMapData(link.content);
  const resolvedMapUrl = mapUrl || (address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : "");

  const handleOpen = () => {
    if (resolvedMapUrl) {
      fetch(apiPath(`/links/${encodeURIComponent(link.id)}/click`), { method: 'POST' }).catch(() => {});
      window.open(resolvedMapUrl, "_blank", "noopener,noreferrer");
    }
  };

  const hasContent = Boolean(placeName || address);
  if (!hasContent) {
    return null;
  }
  const cardStyle = {
    ...(link.backgroundColor ? { backgroundColor: link.backgroundColor } : {}),
    ...(link.textColor ? { color: link.textColor } : {}),
    ...(link.titleFontFamily ? { fontFamily: link.titleFontFamily } : {}),
  };

  return (
    <Card className="glass-card overflow-hidden p-0" style={cardStyle}>
      <div className="relative h-24 overflow-hidden bg-primary/10">
        <div className="absolute inset-0 opacity-55 [background-image:linear-gradient(90deg,hsl(var(--primary)/.16)_1px,transparent_1px),linear-gradient(0deg,hsl(var(--primary)/.16)_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background/60">
          <MapPinned className="h-5 w-5" />
        </div>
      </div>
      <div className="space-y-3 p-4 sm:p-5">
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

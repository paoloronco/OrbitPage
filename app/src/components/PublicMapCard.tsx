import { Card } from "@/components/ui/card";
import type { LinkData } from "./LinkCard";
import { getMapData } from "@/lib/link-blocks";
import { trackPublicLinkClick } from "@/lib/public-runtime";
import { ArrowUpRight, MapPinned, Navigation } from "lucide-react";
import { getPublicBlockPadding, getPublicBlockStyle, getPublicButtonStyle, getPublicIconContent } from "@/lib/public-block-style";
import {
  extractMapCoordinates,
  getMapQuery,
  getSafeMapOpenUrl,
  toMapCoordinates,
  type MapCoordinates,
} from "@/lib/map-location";

interface PublicMapCardProps {
  link: LinkData;
}

const MapLocationFallback = ({ label }: { label: string }) => (
  <div className="absolute inset-0 overflow-hidden bg-slate-100 text-slate-600">
    <div className="absolute -left-10 top-7 h-3 w-[70%] rotate-[-12deg] rounded-full bg-white shadow-sm" />
    <div className="absolute -right-12 bottom-9 h-4 w-[78%] rotate-[9deg] rounded-full bg-white shadow-sm" />
    <div className="absolute left-[18%] top-0 h-full w-3 rotate-[18deg] bg-white shadow-sm" />
    <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-500 text-white shadow-lg ring-4 ring-white">
        <MapPinned className="h-6 w-6" />
      </span>
      <span className="mt-2 block max-w-52 truncate rounded-md bg-white/90 px-2 py-1 text-xs font-semibold shadow-sm">
        {label || "Map location"}
      </span>
    </div>
  </div>
);

const getOpenStreetMapEmbedUrl = ({ lat, lon }: MapCoordinates) => {
  const latitudeSpan = 0.012;
  const longitudeSpan = latitudeSpan / Math.max(Math.cos(lat * Math.PI / 180), 0.35);
  const params = new URLSearchParams({
    bbox: [
      lon - longitudeSpan,
      lat - latitudeSpan,
      lon + longitudeSpan,
      lat + latitudeSpan,
    ].join(","),
    layer: "mapnik",
    marker: `${lat},${lon}`,
  });
  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
};

const RealMapPreview = ({ coordinates, label }: { coordinates: MapCoordinates; label: string }) => (
  <div className="absolute inset-0 overflow-hidden bg-slate-200">
    <iframe
      src={getOpenStreetMapEmbedUrl(coordinates)}
      title={`Map preview for ${label}`}
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      className="absolute inset-0 h-full w-full border-0"
    />
    <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-slate-950/10" />
  </div>
);

export const PublicMapCard = ({ link }: PublicMapCardProps) => {
  const { placeName, address, mapUrl, latitude, longitude } = getMapData(link.content);
  const mapQuery = getMapQuery(placeName, address, link.title, mapUrl);
  const coordinates = toMapCoordinates(latitude, longitude)
    || extractMapCoordinates(mapUrl)
    || extractMapCoordinates(address)
    || extractMapCoordinates(placeName);
  const resolvedMapUrl = getSafeMapOpenUrl(mapUrl, mapQuery);

  const handleOpen = () => {
    if (resolvedMapUrl) {
      trackPublicLinkClick(link.id);
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
        {coordinates ? (
          <RealMapPreview coordinates={coordinates} label={mapQuery || placeName || address || link.title || "Map"} />
        ) : (
          <MapLocationFallback label={mapQuery || placeName || address || link.title || "Map"} />
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

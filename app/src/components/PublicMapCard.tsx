import { useEffect, useMemo, useState } from "react";
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

const extractLatLng = (value?: string) => {
  if (!value) return null;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }
  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (match) return { lat: match[1], lon: match[2] };
  }

  return null;
};

const buildStaticMapUrl = (lat: string, lon: string, size = "800x360") =>
  `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=14&size=${size}&maptype=mapnik&markers=${lat},${lon},red-pushpin`;

const escapeSvgText = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const buildFallbackMapArtwork = (query: string) => {
  const label = escapeSvgText(query || "Map");
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="360" viewBox="0 0 800 360">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#eef2ff"/>
          <stop offset="1" stop-color="#dbeafe"/>
        </linearGradient>
        <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse">
          <path d="M44 0H0V44" fill="none" stroke="#93a4bf" stroke-opacity=".32" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="800" height="360" fill="url(#bg)"/>
      <rect width="800" height="360" fill="url(#grid)"/>
      <path d="M-40 260C96 196 182 236 292 184s210-142 342-94 176 18 242-26" fill="none" stroke="#60a5fa" stroke-width="28" stroke-linecap="round" stroke-opacity=".5"/>
      <path d="M84 84h196m-82 0v170m206-130h248m-80-52v208M126 286h566" fill="none" stroke="#64748b" stroke-width="8" stroke-linecap="round" stroke-opacity=".45"/>
      <circle cx="400" cy="180" r="30" fill="#ef4444"/>
      <circle cx="400" cy="180" r="12" fill="#fff"/>
      <text x="400" y="318" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="#1e293b">${label}</text>
    </svg>
  `)}`;
};

export const PublicMapCard = ({ link }: PublicMapCardProps) => {
  const { placeName, address, mapUrl } = getMapData(link.content);
  const mapQuery = getMapQuery(placeName, address, link.title);
  const [staticMapUrl, setStaticMapUrl] = useState("");
  const [mapPreviewFailed, setMapPreviewFailed] = useState(false);
  const resolvedMapUrl = mapUrl || (address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : mapQuery
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
    : "");
  const fallbackArtwork = useMemo(() => buildFallbackMapArtwork(mapQuery), [mapQuery]);

  useEffect(() => {
    let cancelled = false;
    setMapPreviewFailed(false);

    const directCoordinates = extractLatLng(mapUrl) || extractLatLng(address) || extractLatLng(placeName);
    if (directCoordinates) {
      setStaticMapUrl(buildStaticMapUrl(directCoordinates.lat, directCoordinates.lon));
      return () => {
        cancelled = true;
      };
    }

    if (!mapQuery) {
      setStaticMapUrl("");
      return () => {
        cancelled = true;
      };
    }

    const controller = new AbortController();
    fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=it&q=${encodeURIComponent(mapQuery)}`, {
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Map lookup failed")))
      .then((results: Array<{ lat?: string; lon?: string }>) => {
        if (cancelled) return;
        const result = results[0];
        setStaticMapUrl(result?.lat && result?.lon ? buildStaticMapUrl(result.lat, result.lon) : "");
      })
      .catch(() => {
        if (!cancelled) setStaticMapUrl("");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [address, mapQuery, mapUrl, placeName]);

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
        <img
          src={!mapPreviewFailed && staticMapUrl ? staticMapUrl : fallbackArtwork}
          alt={mapQuery ? `Map preview for ${mapQuery}` : "Map preview"}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setMapPreviewFailed(true)}
        />
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

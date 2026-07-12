import { useEffect, useState } from "react";
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

interface MapCoordinates {
  lat: number;
  lon: number;
}

const toCoordinate = (lat?: string, lon?: string): MapCoordinates | null => {
  if (!lat || !lon) return null;
  const parsedLat = Number.parseFloat(lat);
  const parsedLon = Number.parseFloat(lon);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) return null;
  if (parsedLat < -90 || parsedLat > 90 || parsedLon < -180 || parsedLon > 180) return null;
  return { lat: parsedLat, lon: parsedLon };
};

const extractLatLng = (value?: string): MapCoordinates | null => {
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
    const coordinate = toCoordinate(match?.[1], match?.[2]);
    if (coordinate) return coordinate;
  }

  return null;
};

const TILE_SIZE = 256;
const DEFAULT_MAP_ZOOM = 14;

const lonToTile = (lon: number, zoom: number) =>
  ((lon + 180) / 360) * Math.pow(2, zoom);

const latToTile = (lat: number, zoom: number) => {
  const rad = lat * Math.PI / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom);
};

const getTileUrl = (zoom: number, x: number, y: number) => {
  const subdomain = ["a", "b", "c"][Math.abs(x + y) % 3];
  return `https://${subdomain}.tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
};

const RealMapPreview = ({ coordinates, label }: { coordinates: MapCoordinates; label: string }) => {
  const zoom = DEFAULT_MAP_ZOOM;
  const xFloat = lonToTile(coordinates.lon, zoom);
  const yFloat = latToTile(coordinates.lat, zoom);
  const centerX = Math.floor(xFloat);
  const centerY = Math.floor(yFloat);
  const markerX = (xFloat - (centerX - 1)) * TILE_SIZE;
  const markerY = (yFloat - (centerY - 1)) * TILE_SIZE;
  const tiles = [-1, 0, 1].flatMap((row) =>
    [-1, 0, 1].map((col) => ({
      key: `${centerX + col}-${centerY + row}`,
      x: centerX + col,
      y: centerY + row,
      left: (col + 1) * TILE_SIZE,
      top: (row + 1) * TILE_SIZE,
    }))
  );

  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-200">
      <div
        className="absolute"
        style={{
          left: `calc(50% - ${markerX}px)`,
          top: `calc(50% - ${markerY}px)`,
          width: TILE_SIZE * 3,
          height: TILE_SIZE * 3,
        }}
      >
        {tiles.map((tile) => (
          <img
            key={tile.key}
            src={getTileUrl(zoom, tile.x, tile.y)}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="absolute select-none"
            style={{
              left: tile.left,
              top: tile.top,
              width: TILE_SIZE,
              height: TILE_SIZE,
            }}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,transparent_38%,rgba(15,23,42,0.1)_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white shadow-[0_10px_24px_rgba(15,23,42,0.32)] ring-4 ring-white">
          <MapPinned className="h-5 w-5" />
          <span className="absolute left-1/2 top-full h-3 w-3 -translate-x-1/2 -translate-y-1 rotate-45 bg-red-500" />
        </div>
      </div>
      <span className="sr-only">Map preview for {label}</span>
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-1 right-1 rounded bg-white/85 px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
        onClick={(event) => event.stopPropagation()}
      >
        © OpenStreetMap
      </a>
    </div>
  );
};

export const PublicMapCard = ({ link }: PublicMapCardProps) => {
  const { placeName, address, mapUrl } = getMapData(link.content);
  const mapQuery = getMapQuery(placeName, address, link.title);
  const [coordinates, setCoordinates] = useState<MapCoordinates | null>(null);
  const [isResolvingMap, setIsResolvingMap] = useState(false);
  const resolvedMapUrl = mapUrl || (address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : mapQuery
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
    : "");

  useEffect(() => {
    let cancelled = false;

    const directCoordinates = extractLatLng(mapUrl) || extractLatLng(address) || extractLatLng(placeName);
    if (directCoordinates) {
      setCoordinates(directCoordinates);
      setIsResolvingMap(false);
      return () => {
        cancelled = true;
      };
    }

    if (!mapQuery) {
      setCoordinates(null);
      setIsResolvingMap(false);
      return () => {
        cancelled = true;
      };
    }

    const controller = new AbortController();
    setIsResolvingMap(true);
    fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=it&q=${encodeURIComponent(mapQuery)}`, {
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Map lookup failed")))
      .then((results: Array<{ lat?: string; lon?: string }>) => {
        if (cancelled) return;
        const result = results[0];
        setCoordinates(toCoordinate(result?.lat, result?.lon));
        setIsResolvingMap(false);
      })
      .catch(() => {
        if (!cancelled) {
          setCoordinates(null);
          setIsResolvingMap(false);
        }
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
        {coordinates ? (
          <RealMapPreview coordinates={coordinates} label={mapQuery || placeName || address || link.title || "Map"} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-100 text-slate-500">
            <MapPinned className="h-8 w-8" />
            <span className="text-xs font-semibold uppercase tracking-[0.14em]">
              {isResolvingMap ? "Loading real map" : "Map preview unavailable"}
            </span>
          </div>
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

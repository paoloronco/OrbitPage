export interface MapCoordinates {
  lat: number;
  lon: number;
}

const toFiniteCoordinate = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value || ''));
  return Number.isFinite(parsed) ? parsed : null;
};

export const toMapCoordinates = (latitude?: unknown, longitude?: unknown): MapCoordinates | null => {
  const lat = toFiniteCoordinate(latitude);
  const lon = toFiniteCoordinate(longitude);
  if (lat === null || lon === null) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
};

export const extractMapCoordinates = (value?: string): MapCoordinates | null => {
  if (!value) return null;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Keep the original value when it contains malformed escape sequences.
  }

  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    const coordinates = toMapCoordinates(match?.[1], match?.[2]);
    if (coordinates) return coordinates;
  }
  return null;
};

const cleanPathQuery = (value: string) => value
  .replace(/\+/g, ' ')
  .replace(/[_-]+/g, ' ')
  .trim();

export const getMapUrlQuery = (mapUrl?: string): string => {
  if (!mapUrl) return '';
  try {
    const url = new URL(mapUrl);
    for (const key of ['q', 'query', 'destination', 'daddr', 'address']) {
      const value = url.searchParams.get(key)?.trim();
      if (value && !extractMapCoordinates(value)) return value;
    }

    const pathMatch = url.pathname.match(/\/(?:place|search)\/([^/@]+)/i);
    return pathMatch?.[1] ? cleanPathQuery(decodeURIComponent(pathMatch[1])) : '';
  } catch {
    return '';
  }
};

export const getMapQuery = (
  placeName?: string,
  address?: string,
  fallbackTitle?: string,
  mapUrl?: string,
) => (
  [placeName, address].filter(Boolean).join(', ') || getMapUrlQuery(mapUrl) || fallbackTitle || ''
).trim();

export const getMapResolutionSource = (placeName?: string, address?: string, mapUrl?: string) =>
  [placeName, address, mapUrl].map((value) => String(value || '').trim()).join('|');

export const getSafeMapOpenUrl = (mapUrl?: string, query?: string): string => {
  if (mapUrl) {
    try {
      const parsed = new URL(mapUrl);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.toString();
    } catch {
      // Fall through to the provider-neutral search URL.
    }
  }
  return query ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}` : '';
};

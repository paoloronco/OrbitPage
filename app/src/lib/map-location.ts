import { resolveSafeBrowserHttpUrl } from './browser-network-policy';

import { getMapUrlQuery } from '../../packages/map-location.js';
export { toMapCoordinates, extractMapCoordinates, getMapUrlQuery, getMapPreviewUrl } from '../../packages/map-location.js';
export type { MapCoordinates } from '../../packages/map-location.js';

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
    const safeUrl = resolveSafeBrowserHttpUrl(mapUrl, typeof window !== 'undefined' ? window.location.href : 'https://orbitpage.invalid/');
    if (safeUrl && /^https?:\/\//i.test(mapUrl)) return safeUrl.toString();
  }
  return query ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}` : '';
};

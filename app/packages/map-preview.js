import { extractMapCoordinates, getMapPreviewUrl, normalizeSupportedMapUrl } from './map-location.js';

const cache = new Map();
const TTL = 30 * 24 * 60 * 60 * 1000;

export async function resolveMapPreview({ query = '', mapUrl = '' }) {
  query = query.trim();
  mapUrl = mapUrl.trim();
  if ((!query && !mapUrl) || query.length > 700 || mapUrl.length > 2048) throw new Error('A valid map location is required.');
  const key = JSON.stringify([query, mapUrl]);
  const cached = cache.get(key);
  if (cached?.expiresAt > Date.now()) return cached.value;

  let resolvedUrl = mapUrl;
  let coordinates = extractMapCoordinates(mapUrl) || extractMapCoordinates(query);
  for (let hop = 0; !coordinates && hop < 5; hop++) {
    const url = normalizeSupportedMapUrl(resolvedUrl);
    if (!url || !['maps.app.goo.gl', 'goo.gl'].includes(url.hostname)) break;
    const path = url.pathname.match(url.hostname === 'goo.gl' ? /^\/maps\/([a-zA-Z0-9_-]{1,256})$/ : /^\/([a-zA-Z0-9_-]{1,256})$/);
    if (!path) throw new Error('Invalid map short URL.');
    const target = url.hostname === 'goo.gl' ? `https://goo.gl/maps/${path[1]}` : `https://maps.app.goo.gl/${path[1]}`;
    const response = await fetch(target, {
      redirect: 'manual', signal: AbortSignal.timeout(6_000),
      headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'OrbitPage (+https://orbitpage.com; contact: contact@orbitpage.com)' },
    });
    const location = response.headers.get('location');
    await response.body?.cancel().catch(() => undefined);
    if (!response.ok && (response.status < 300 || response.status >= 400)) throw new Error('Map short URL could not be opened.');
    if (!location) throw new Error('Map short URL did not resolve.');
    const next = normalizeSupportedMapUrl(new URL(location, url).toString());
    if (!next) throw new Error('Map redirect left the supported providers.');
    resolvedUrl = next.toString();
    coordinates = extractMapCoordinates(resolvedUrl);
    if (hop === 4 && ['maps.app.goo.gl', 'goo.gl'].includes(next.hostname)) throw new Error('Map redirect limit exceeded.');
  }
  if (!getMapPreviewUrl(resolvedUrl, query, coordinates)) throw new Error('The map location could not be found.');
  const value = {
    ...(coordinates ? { lat: String(coordinates.lat), lon: String(coordinates.lon) } : {}),
    resolvedUrl, displayName: query || mapUrl,
    source: resolvedUrl !== mapUrl ? 'redirect' : coordinates ? 'coordinates' : 'embed',
  };
  if (cache.size >= 500) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expiresAt: Date.now() + TTL });
  return value;
}

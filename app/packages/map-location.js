export function toMapCoordinates(latitude, longitude) {
  const lat = Number(String(latitude ?? '').trim());
  const lon = Number(String(longitude ?? '').trim());
  if (latitude == null || longitude == null || String(latitude).trim() === '' || String(longitude).trim() === '') return null;
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

export function extractMapCoordinates(value = '') {
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { /* Keep malformed escapes unchanged. */ }
  // A selected place takes precedence over the map's viewport centre.
  for (const pattern of [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll|destination|daddr)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?=&|#|$)/,
    /^\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\s*$/,
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
  ]) {
    const match = decoded.match(pattern);
    if (!match) continue;
    const reversed = pattern.source.startsWith('!2d');
    const coordinates = toMapCoordinates(match[reversed ? 2 : 1], match[reversed ? 1 : 2]);
    if (coordinates) return coordinates;
  }
  try {
    const url = new URL(value);
    return toMapCoordinates(url.searchParams.get('mlat'), url.searchParams.get('mlon'))
      || toMapCoordinates(...(url.hash.match(/map=\d+\/(-?[\d.]+)\/(-?[\d.]+)/)?.slice(1) || []));
  } catch { return null; }
}

export function getMapUrlQuery(value = '') {
  try {
    const url = new URL(value);
    for (const key of ['q', 'query', 'destination', 'daddr', 'address']) {
      const query = url.searchParams.get(key)?.trim();
      if (query && !extractMapCoordinates(query)) return query;
    }
    const place = url.pathname.match(/\/(?:place|search)\/([^/@]+)/i)?.[1];
    return place ? decodeURIComponent(place).replace(/\+/g, ' ').trim() : '';
  } catch { return ''; }
}

export function normalizeSupportedMapUrl(value = '') {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
    const host = url.hostname.toLowerCase();
    const short = host === 'maps.app.goo.gl' || (host === 'goo.gl' && url.pathname.startsWith('/maps/'));
    const osm = host === 'openstreetmap.org' || host === 'www.openstreetmap.org';
    const google = ['com', 'it', 'co.uk', 'fr', 'de', 'es', 'pt', 'nl', 'pl', 'ca', 'com.au', 'co.jp', 'co.kr', 'com.br', 'com.mx', 'ch', 'at', 'be', 'ie']
      .some(suffix => host === `maps.google.${suffix}` || ([`google.${suffix}`, `www.google.${suffix}`].includes(host) && /^\/maps(?:\/|$)/.test(url.pathname)));
    return short || osm || google ? url : null;
  } catch { return null; }
}

export function getMapPreviewUrl(mapUrl = '', query = '', coordinates = null) {
  const url = normalizeSupportedMapUrl(mapUrl);
  if (url?.pathname === '/maps/embed' && url.searchParams.get('pb') && /^(www\.)?google\./.test(url.hostname)) {
    return `https://www.google.com/maps/embed?${new URLSearchParams({ pb: url.searchParams.get('pb') })}`;
  }
  coordinates = extractMapCoordinates(mapUrl) || coordinates;
  if (coordinates) {
    const { lat, lon } = coordinates;
    const span = 0.012 / Math.max(Math.cos(lat * Math.PI / 180), 0.35);
    const params = new URLSearchParams({
      bbox: [Math.max(-180, lon - span), Math.max(-90, lat - 0.012), Math.min(180, lon + span), Math.min(90, lat + 0.012)].join(','),
      layer: 'mapnik', marker: `${lat},${lon}`,
    });
    return `https://www.openstreetmap.org/export/embed.html?${params}`;
  }
  if (url && ['maps.app.goo.gl', 'goo.gl'].includes(url.hostname)) return '';
  if (url?.searchParams.get('cid')?.match(/^\d+$/)) {
    return `https://www.google.com/maps?${new URLSearchParams({ cid: url.searchParams.get('cid'), output: 'embed' })}`;
  }
  const lookup = getMapUrlQuery(url?.toString()) || query.trim();
  // shortcut: Google's website embed has no API SLA; use Maps Embed API if a contracted service is required.
  return lookup ? `https://www.google.com/maps?${new URLSearchParams({ q: lookup, output: 'embed' })}` : '';
}

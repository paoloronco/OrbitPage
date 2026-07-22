const normalizeHostname = (hostname: string): string =>
  hostname.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');

const parseIpv4 = (hostname: string): number[] | null => {
  const parts = hostname.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const values = parts.map(Number);
  return values.every((value) => value >= 0 && value <= 255) ? values : null;
};

export const isPrivateBrowserHostname = (hostname: string): boolean => {
  const normalized = normalizeHostname(hostname);
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized === 'home.arpa' ||
    normalized.endsWith('.home.arpa')
  ) {
    return true;
  }

  const ipv4 = parseIpv4(normalized);
  if (ipv4) {
    const [first, second] = ipv4;
    return first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168);
  }

  if (normalized === '::' || normalized === '::1') return true;
  if (/^(?:fc|fd)[0-9a-f]{2}:/i.test(normalized)) return true;
  return /^fe[89ab][0-9a-f]:/i.test(normalized);
};

/**
 * Public pages must never contact software or devices on the visitor's machine.
 * Local development may still connect between localhost ports.
 */
export const resolveSafeBrowserHttpUrl = (value: string, currentHref: string): URL | null => {
  try {
    const current = new URL(currentHref);
    const target = new URL(value, current);
    if (target.protocol !== 'http:' && target.protocol !== 'https:') return null;
    if (target.username || target.password) return null;
    if (!isPrivateBrowserHostname(current.hostname) && isPrivateBrowserHostname(target.hostname)) return null;
    return target;
  } catch {
    return null;
  }
};

const getCurrentBrowserHref = (): string =>
  typeof window !== 'undefined' ? window.location.href : 'https://orbitpage.invalid/';

const hasAsciiControlCharacter = (value: string): boolean =>
  [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127;
  });

export const resolveSafePublicHref = (value?: string | null, currentHref = getCurrentBrowserHref()): string | null => {
  const candidate = String(value || '').trim();
  if (!candidate || hasAsciiControlCharacter(candidate)) return null;
  if (candidate.startsWith('#')) return encodeURI(`#${candidate.slice(1)}`);
  if (/^\/(?!\/)/.test(candidate)) return encodeURI(`/${candidate.replace(/^\/+/, '')}`);

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      const safeUrl = resolveSafeBrowserHttpUrl(candidate, currentHref);
      return safeUrl ? encodeURI(candidate) : null;
    }
    if (parsed.protocol === 'mailto:' && !parsed.username && !parsed.password) {
      return encodeURI(`mailto:${parsed.pathname}${parsed.search}${parsed.hash}`);
    }
    if (parsed.protocol === 'tel:' && !parsed.username && !parsed.password) {
      return encodeURI(`tel:${parsed.pathname}${parsed.search}${parsed.hash}`);
    }
    return null;
  } catch {
    return null;
  }
};

export const resolveSafePublicMediaUrl = (value?: string | null, currentHref = getCurrentBrowserHref()): string | null => {
  const candidate = String(value || '').trim();
  if (!candidate) return null;
  const dataImage = candidate.match(/^data:image\/(png|jpe?g|gif|webp);base64,([a-z0-9+/=\s]+)$/i);
  if (dataImage) {
    const mediaType = dataImage[1].toLowerCase() === 'jpg' ? 'jpeg' : dataImage[1].toLowerCase();
    return encodeURI(`data:image/${mediaType};base64,${dataImage[2].replace(/\s+/g, '')}`);
  }
  if (candidate.startsWith('blob:')) {
    try {
      const parsed = new URL(candidate);
      return parsed.protocol === 'blob:' ? encodeURI(`blob:${parsed.pathname}${parsed.search}${parsed.hash}`) : null;
    } catch {
      return null;
    }
  }
  if (/^\/(?!\/)/.test(candidate)) return encodeURI(`/${candidate.replace(/^\/+/, '')}`);
  if (!candidate.includes(':') && !candidate.startsWith('//')) return encodeURI(candidate.replace(/^\/+/, ''));
  const safeUrl = resolveSafeBrowserHttpUrl(candidate, currentHref);
  return safeUrl ? encodeURI(candidate) : null;
};

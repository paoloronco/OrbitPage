declare global {
  interface Window {
    __ORBITPAGE_BASE_PATH__?: string;
  }
}

export const normalizeBasePath = (value?: string | null): string => {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === '/') return '';
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, '');
};

export const getConfiguredBasePath = (): string =>
  normalizeBasePath(
    typeof window !== 'undefined'
      ? window.__ORBITPAGE_BASE_PATH__ || import.meta.env.VITE_BASE_PATH
      : import.meta.env.VITE_BASE_PATH,
  );

export const getActiveBasePath = (): string => {
  const basePath = getConfiguredBasePath();
  if (!basePath || typeof window === 'undefined') return '';

  const { pathname } = window.location;
  return pathname === basePath || pathname.startsWith(`${basePath}/`) ? basePath : '';
};

export const withBasePath = (path = '/'): string => {
  if (/^(?:[a-z][a-z\d+\-.]*:|\/\/)/i.test(path)) return path;

  const basePath = getActiveBasePath();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (basePath && (normalizedPath === basePath || normalizedPath.startsWith(`${basePath}/`))) {
    return normalizedPath;
  }
  return `${basePath}${normalizedPath}` || '/';
};

export const apiPath = (path = ''): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined') {
    const apiBase = new URLSearchParams(window.location.search).get('apiBase');
    if (apiBase) {
      try {
        const url = new URL(apiBase);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          return `${url.toString().replace(/\/$/, '')}${normalizedPath}`;
        }
      } catch {
        // Fall back to the local API path below.
      }
    }
  }
  return `${withBasePath('/api')}${normalizedPath}`;
};

export const internalAssetPath = (path?: string | null): string | null => {
  if (!path) return null;
  if (/^(?:[a-z][a-z\d+\-.]*:|\/\/|data:|blob:)/i.test(path)) return path;
  return withBasePath(path.startsWith('/') ? path : `/uploads/${path.replace(/^\/+/, '')}`);
};

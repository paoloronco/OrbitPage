import { resolveSafeBrowserHttpUrl } from './browser-network-policy';
import { isHostedRuntime } from './runtime-mode';

declare global {
  interface Window {
    __ORBITPAGE_BASE_PATH__?: string;
    __ORBITPAGE_API_BASE__?: string;
    __ORBITPAGE_CONSENT_SCOPE__?: string;
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

export const getConsentScope = (): string => {
  if (typeof window === 'undefined') return '';
  const configured = window.__ORBITPAGE_CONSENT_SCOPE__?.trim();
  if (configured) return configured;
  return getActiveBasePath().split('/').filter(Boolean)[0] || '';
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

/**
 * Hosted public snapshots use the tenant slug as their navigation base, while
 * the shared application and brand files live under `/orbitpage-runtime`.
 */
export const withRuntimeAssetPath = (path = '/'): string => {
  if (/^(?:[a-z][a-z\d+\-.]*:|\/\/)/i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined' && '__ORBITPAGE_STATIC_SNAPSHOT__' in window) {
    return `/orbitpage-runtime${normalizedPath}`;
  }
  return withBasePath(normalizedPath);
};

/** Resolve legal and consent routes against the root page, not an optional subpage. */
export const withTenantBasePath = (path = '/'): string => {
  if (/^(?:[a-z][a-z\d+\-.]*:|\/\/)/i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const activeBase = getActiveBasePath();
  const scope = getConsentScope();
  if (!activeBase || !scope) return normalizedPath;
  const tenantBase = activeBase === `/${scope}` || activeBase.startsWith(`/${scope}/`)
    ? `/${scope}`
    : activeBase;
  if (normalizedPath === tenantBase || normalizedPath.startsWith(`${tenantBase}/`)) return normalizedPath;
  return `${tenantBase}${normalizedPath}`;
};

export const apiPath = (path = ''): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined') {
    const hosted = isHostedRuntime();
    const staticSnapshot = Boolean(window.__ORBITPAGE_STATIC_SNAPSHOT__);
    const apiBase = hosted || staticSnapshot
      ? window.__ORBITPAGE_API_BASE__
      : null;
    if (apiBase) {
      const url = resolveSafeBrowserHttpUrl(apiBase, window.location.href);
      if (url) return `${url.toString().replace(/\/$/, '')}${normalizedPath}`;
    }
  }
  return `${withBasePath('/api')}${normalizedPath}`;
};

export const internalAssetPath = (path?: string | null): string | null => {
  if (!path) return null;
  if (/^(?:[a-z][a-z\d+\-.]*:|\/\/|data:|blob:)/i.test(path)) return path;
  return withBasePath(path.startsWith('/') ? path : `/uploads/${path.replace(/^\/+/, '')}`);
};

import { apiPath } from './base-path';

export const hasStaticPublicSnapshot = () =>
  typeof window !== 'undefined' && Boolean(
    (window as Window & { __ORBITPAGE_STATIC_SNAPSHOT__?: unknown }).__ORBITPAGE_STATIC_SNAPSHOT__,
  );

export const trackPublicLinkClick = (id: string) => {
  // Managed pages are static snapshots. Until click aggregation lives at the
  // edge, do not turn public traffic into no-op Vercel Function requests.
  if (!id || hasStaticPublicSnapshot()) return;
  fetch(apiPath(`/links/${encodeURIComponent(id)}/click`), { method: 'POST' }).catch(() => {});
};

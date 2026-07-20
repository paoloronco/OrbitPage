import { apiPath, withBasePath } from './base-path';

export const hasStaticPublicSnapshot = () =>
  typeof window !== 'undefined' && Boolean(
    (window as Window & { __ORBITPAGE_STATIC_SNAPSHOT__?: unknown }).__ORBITPAGE_STATIC_SNAPSHOT__,
  );

export const trackPublicLinkClick = (id: string) => {
  if (!id) return;
  if (hasStaticPublicSnapshot()) {
    sendManagedAnalyticsEvent('click', id);
    return;
  }
  fetch(apiPath(`/links/${encodeURIComponent(id)}/click`), { method: 'POST' }).catch(() => {});
};

type ManagedAnalyticsEvent = 'view' | 'click';
const VISITOR_STORAGE_PREFIX = 'orbitpage_page_visitor_v1:';
const VIEW_SESSION_PREFIX = 'orbitpage_page_view_v1:';

function visitorId() {
  const key = `${VISITOR_STORAGE_PREFIX}${window.location.hostname}${withBasePath('/')}`;
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function managedAnalyticsPayload(event: ManagedAnalyticsEvent, linkId?: string) {
  const params = new URLSearchParams(window.location.search);
  return {
    event,
    visitorId: visitorId(),
    linkId: linkId || '',
    referrer: document.referrer || '',
    path: window.location.pathname,
    utmSource: params.get('utm_source') || '',
    utmMedium: params.get('utm_medium') || '',
    utmCampaign: params.get('utm_campaign') || '',
  };
}

function sendManagedAnalyticsEvent(event: ManagedAnalyticsEvent, linkId?: string) {
  if (typeof window === 'undefined' || !hasStaticPublicSnapshot()) return;
  fetch(withBasePath('/_orbitpage/event'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(managedAnalyticsPayload(event, linkId)),
    credentials: 'omit',
    keepalive: true,
  }).catch(() => {});
}

export function trackPublicPageView() {
  if (typeof window === 'undefined' || !hasStaticPublicSnapshot()) return;
  const sessionKey = `${VIEW_SESSION_PREFIX}${window.location.pathname}${window.location.search}`;
  try {
    if (window.sessionStorage.getItem(sessionKey)) return;
    window.sessionStorage.setItem(sessionKey, '1');
  } catch {
    // Tracking can still proceed when browser storage is unavailable.
  }
  sendManagedAnalyticsEvent('view');
}

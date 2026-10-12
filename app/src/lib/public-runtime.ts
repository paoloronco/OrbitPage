import { apiPath, withBasePath } from './base-path';
import { consentManager } from './consent-manager';

export const hasStaticPublicSnapshot = () =>
  typeof window !== 'undefined' && Boolean(
    (window as Window & { __ORBITPAGE_STATIC_SNAPSHOT__?: unknown }).__ORBITPAGE_STATIC_SNAPSHOT__,
  );

export const trackPublicLinkClick = (id: string) => {
  if (!id) return;
  if (hasStaticPublicSnapshot()) {
    if (!consentManager.isGranted('analytics')) return;
    sendManagedAnalyticsEvent('click', id);
    return;
  }
  fetch(apiPath(`/links/${encodeURIComponent(id)}/click`), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(managedAnalyticsPayload('click', id)),
    keepalive: true,
  }).catch(() => {});
};

type ManagedAnalyticsEvent = 'view' | 'click' | 'engagement';
const VISITOR_STORAGE_PREFIX = 'orbitpage_page_visitor_v1:';
const VIEW_SESSION_PREFIX = 'orbitpage_page_view_v1:';
const DURATION_PREFIX = 'orbitpage_page_duration_v1:';
const viewSessionKey = () => `${VIEW_SESSION_PREFIX}${window.location.pathname}${window.location.search}`;

function readSessionId() {
  if (!consentManager.isGranted('analytics')) return undefined;
  try { return window.sessionStorage.getItem(viewSessionKey()) || undefined; } catch { return undefined; }
}

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
    capability: (window as Window & { __ORBITPAGE_ANALYTICS_CAPABILITY__?: string }).__ORBITPAGE_ANALYTICS_CAPABILITY__ || '',
    visitorId: consentManager.isGranted('analytics') ? visitorId() : '',
    sessionId: readSessionId(),
    linkId: linkId || '',
    referrer: document.referrer || '',
    path: window.location.pathname,
    utmSource: params.get('utm_source') || '',
    utmMedium: params.get('utm_medium') || '',
    utmCampaign: params.get('utm_campaign') || '',
  };
}

function sendManagedAnalyticsEvent(event: ManagedAnalyticsEvent, linkId?: string) {
  if (typeof window === 'undefined') return;
  fetch(hasStaticPublicSnapshot() ? withBasePath('/_orbitpage/event') : apiPath('/analytics/events'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(managedAnalyticsPayload(event, linkId)),
    credentials: 'omit',
    keepalive: true,
  }).catch(() => {});
}

export function trackPublicPageView() {
  if (typeof window === 'undefined') return;
  if (!consentManager.isGranted('analytics')) return;
  const sessionKey = viewSessionKey();
  try {
    if ((window.sessionStorage.getItem(sessionKey) || '').length >= 8) return;
    window.sessionStorage.setItem(sessionKey, crypto.randomUUID());
  } catch {
    // Tracking can still proceed when browser storage is unavailable.
  }
  sendManagedAnalyticsEvent('view');
}

export function startPublicPageEngagement() {
  if (typeof window === 'undefined' || /(?:^|\/)(?:admin|dashboard)(?:\/|$)/.test(window.location.pathname)) return;
  const endpoint = hasStaticPublicSnapshot() ? withBasePath('/_orbitpage/event') : apiPath('/analytics/events');
  const storageKey = `${DURATION_PREFIX}${window.location.pathname}${window.location.search}`;
  let payload: ReturnType<typeof managedAnalyticsPayload> | null = null;
  let totalMilliseconds = 0;
  let lastSentSeconds = 0;
  let activeSince: number | null = null;
  const resume = () => {
    if (!consentManager.isGranted('analytics') || document.visibilityState !== 'visible') { activeSince = null; return; }
    trackPublicPageView();
    payload = managedAnalyticsPayload('engagement');
    if (!payload.sessionId || payload.sessionId.length < 8) return;
    if (!lastSentSeconds) {
      try { lastSentSeconds = Math.max(0, Math.min(14_400, Number(window.sessionStorage.getItem(storageKey)) || 0)); } catch { /* Duration still works within this document. */ }
      totalMilliseconds = lastSentSeconds * 1000;
    }
    activeSince = performance.now();
  };
  const flush = () => {
    if (!consentManager.isGranted('analytics')) { activeSince = null; totalMilliseconds = lastSentSeconds * 1000; return; }
    if (!payload?.sessionId || activeSince === null) return;
    const now = performance.now();
    // Bound stalled timers; hidden/suspended tabs must not add hours of phantom activity.
    totalMilliseconds = Math.min(14_400_000, totalMilliseconds + Math.min(60_000, Math.max(0, now - activeSince)));
    activeSince = document.visibilityState === 'visible' ? now : null;
    const durationSeconds = Math.floor(totalMilliseconds / 1000);
    const activeSeconds = durationSeconds - lastSentSeconds;
    if (activeSeconds < 1) return;
    const engagementStart = lastSentSeconds === 0;
    lastSentSeconds = durationSeconds;
    try { window.sessionStorage.setItem(storageKey, String(durationSeconds)); } catch { /* Optional browser persistence. */ }
    fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, durationSeconds, activeSeconds, engagementStart }), credentials: 'omit', keepalive: true }).catch(() => {});
  };
  const visibility = () => { if (document.visibilityState === 'visible') resume(); else flush(); };
  const pageHide = () => { flush(); activeSince = null; };
  const off = consentManager.onConsentChange(() => {
    activeSince = null;
    totalMilliseconds = lastSentSeconds * 1000;
    resume();
  });
  resume();
  const timer = setInterval(flush, 30_000);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', pageHide);
  window.addEventListener('pageshow', resume);
  return () => {
    pageHide(); off(); clearInterval(timer);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pagehide', pageHide);
    window.removeEventListener('pageshow', resume);
  };
}

import type { ManagedAnalyticsReport } from './api-client';

export function formatAnalyticsDuration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—';
  const rounded = Math.round(seconds);
  return rounded >= 60 ? `${Math.floor(rounded / 60)}m ${rounded % 60}s` : `${rounded}s`;
}

export function completeAnalyticsTrend(trend: ManagedAnalyticsReport['trend'], days: number, today = new Date().toISOString().slice(0, 10)) {
  if (!trend.length) return [];
  const entries = new Map(trend.map(entry => [entry.date, entry]));
  const end = new Date(`${today}T00:00:00Z`);
  const count = Math.min(90, Math.max(1, Math.trunc(days)));
  return Array.from({ length: count + 1 }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(date.getUTCDate() - count + index);
    const key = date.toISOString().slice(0, 10);
    return entries.get(key) || { date: key, visits: 0, visitors: 0, clicks: 0, durationSeconds: null, aiVisits: 0, aiSearchVisits: 0 };
  });
}

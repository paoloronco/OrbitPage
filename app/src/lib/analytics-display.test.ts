import { describe, expect, it } from 'vitest';
import { completeAnalyticsTrend, formatAnalyticsDuration } from './analytics-display';

describe('analytics presentation', () => {
  it('pads quiet UTC days with zero counts, while keeping unmeasured duration unknown', () => {
    const trend = completeAnalyticsTrend([{ date: '2026-10-12', visits: 3, visitors: 2, clicks: 1, durationSeconds: 75 }], 7, '2026-10-12');
    expect(trend).toHaveLength(8);
    expect(trend[0]).toMatchObject({ date: '2026-10-05', visits: 0, durationSeconds: null });
    expect(trend.at(-1)).toMatchObject({ visits: 3, durationSeconds: 75 });
    expect(completeAnalyticsTrend([], 30)).toEqual([]);
  });
  it('distinguishes unknown duration from real zero and formats measured seconds', () => {
    expect(formatAnalyticsDuration(null)).toBe('—');
    expect(formatAnalyticsDuration(NaN)).toBe('—');
    expect(formatAnalyticsDuration(0)).toBe('0s');
    expect(formatAnalyticsDuration(75)).toBe('1m 15s');
  });
});

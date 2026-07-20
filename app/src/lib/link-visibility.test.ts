import { describe, expect, it, vi, afterEach } from 'vitest';

import { isLinkVisibleNow } from './link-visibility';

describe('link visibility', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('hides draft, expired, and out-of-window links', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T10:30:00.000Z'));

    expect(isLinkVisibleNow({ id: 'a', title: 'A', description: '', url: '', status: 'draft' })).toBe(false);
    expect(isLinkVisibleNow({ id: 'b', title: 'B', description: '', url: '', status: 'expired' })).toBe(false);
    expect(isLinkVisibleNow({ id: 'c', title: 'C', description: '', url: '', status: 'live', startDate: '2026-07-11' })).toBe(false);
    expect(isLinkVisibleNow({ id: 'd', title: 'D', description: '', url: '', status: 'live', startDate: '2026-07-10', startTime: '11:00' })).toBe(false);
    expect(isLinkVisibleNow({ id: 'e', title: 'E', description: '', url: '', status: 'live', startDate: '2026-07-10', startTime: '09:00', endDate: '2026-07-10', endTime: '12:00' })).toBe(true);
  });

  it('applies the same publication window to native menu cards', () => {
    const menu = { type: 'menu', status: 'live' as const, startDate: '2026-07-20', endDate: '2026-07-21', timezone: 'Europe/Rome' };
    expect(isLinkVisibleNow(menu, new Date('2026-07-19T12:00:00.000Z'))).toBe(false);
    expect(isLinkVisibleNow(menu, new Date('2026-07-20T12:00:00.000Z'))).toBe(true);
    expect(isLinkVisibleNow(menu, new Date('2026-07-22T12:00:00.000Z'))).toBe(false);
  });
});

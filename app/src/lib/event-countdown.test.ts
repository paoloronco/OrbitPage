import { describe, expect, it } from 'vitest';

import { countdownParts, eventDateTime } from './event-countdown';

describe('event countdown', () => {
  it('converts a local event time through its IANA timezone', () => {
    expect(eventDateTime('2026-07-20', '21:30', 'Europe/Rome')?.toISOString()).toBe('2026-07-20T19:30:00.000Z');
  });

  it('returns stable countdown units and stops after the event starts', () => {
    const target = new Date('2026-07-22T03:04:05.000Z');
    expect(countdownParts(target, new Date('2026-07-20T01:02:03.000Z'))).toEqual({ days: 2, hours: 2, minutes: 2, seconds: 2 });
    expect(countdownParts(target, target)).toBeNull();
  });
});

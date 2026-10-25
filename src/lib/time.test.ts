import { describe, expect, test } from 'bun:test';
import { countdown, dayKey, zonedMidnight } from './time';

test('dayKey uses Ulaanbaatar time (UTC+8)', () => {
  expect(dayKey(new Date('2026-10-21T15:59:00Z'))).toBe('2026-10-21'); // 23:59 UB
  expect(dayKey(new Date('2026-10-21T16:01:00Z'))).toBe('2026-10-22'); // 00:01 UB
});

describe('zonedMidnight', () => {
  test('is 00:00 wall-clock time in the given zone', () => {
    expect(new Date(zonedMidnight('2026-12-05')).toISOString()).toBe('2026-12-04T16:00:00.000Z');
    expect(new Date(zonedMidnight('2026-12-05', 'UTC')).toISOString()).toBe('2026-12-05T00:00:00.000Z');
    expect(new Date(zonedMidnight('2026-07-01', 'America/New_York')).toISOString()).toBe(
      '2026-07-01T04:00:00.000Z',
    );
  });

  test('handles a DST change on the day before', () => {
    // New York leaves DST on 2026-11-01: midnight of Nov 2 is EST (UTC-5)
    expect(new Date(zonedMidnight('2026-11-02', 'America/New_York')).toISOString()).toBe(
      '2026-11-02T05:00:00.000Z',
    );
  });

  test('rejects malformed dates', () => {
    expect(Number.isNaN(zonedMidnight('2026-13-40'))).toBe(true);
    expect(Number.isNaN(zonedMidnight(''))).toBe(true);
  });
});

describe('countdown', () => {
  test('counts to local midnight of the test day, not 08:00 and not UTC', () => {
    const now = Date.parse('2026-10-25T15:05:00Z'); // 23:05 in Ulaanbaatar
    expect(countdown('2026-12-05', now)).toEqual({ d: 40, h: 0, m: 55 });
  });

  test('uses the student time zone when given', () => {
    const now = Date.parse('2026-11-01T04:00:00Z'); // 00:00 EDT, Nov 1 is 25 h long
    expect(countdown('2026-11-02', now, 'America/New_York')).toEqual({ d: 1, h: 1, m: 0 });
  });

  test('is null once the day has started or the date is invalid', () => {
    expect(countdown('2026-12-05', Date.parse('2026-12-04T16:00:00Z'))).toBeNull();
    expect(countdown('2026-12-05', Date.parse('2026-12-05T03:00:00Z'))).toBeNull();
    expect(countdown('nope', Date.now())).toBeNull();
  });
});

test('isoWeekId', async () => {
  const { isoWeekId } = await import('./time');
  expect(isoWeekId('2026-10-26')).toBe('2026-W44'); // Monday
  expect(isoWeekId('2026-10-25')).toBe('2026-W43'); // Sunday
  expect(isoWeekId('2027-01-01')).toBe('2026-W53');
  expect(isoWeekId('2024-12-30')).toBe('2025-W01');
});

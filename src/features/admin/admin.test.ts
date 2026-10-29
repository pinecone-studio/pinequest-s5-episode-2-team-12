import { expect, test } from 'bun:test';
import { feedbackFilter } from './lib/filters';
import { formatDateTime, formatDay, shortDay } from './lib/format';
import { adminFailure } from './queries';

test('feedback filter: known values pass, anything else falls back to new', () => {
  expect(feedbackFilter('approved')).toBe('approved');
  expect(feedbackFilter('all')).toBe('all');
  expect(feedbackFilter(undefined)).toBe('new');
  expect(feedbackFilter('drop table')).toBe('new');
  expect(feedbackFilter(['approved'])).toBe('new');
});

test('database errors map to what the admin should do', () => {
  expect(adminFailure({ code: 'PGRST202' })).toBe('not_installed');
  expect(adminFailure({ code: '42501', message: 'forbidden' })).toBe('forbidden');
  expect(adminFailure({ code: 'P0001', message: 'forbidden' })).toBe('forbidden');
  expect(adminFailure({ code: '08006', message: 'connection lost' })).toBe('database_error');
});

test('dates are shown in Ulaanbaatar time', () => {
  // 18:30 UTC is 02:30 the next day in Ulaanbaatar (UTC+8)
  expect(formatDay('2026-10-27T18:30:00Z')).toBe('2026-10-28');
  expect(formatDateTime('2026-10-27T18:30:00Z')).toBe('2026-10-28 02:30');
  expect(shortDay('2026-10-28')).toBe('10/28');
});

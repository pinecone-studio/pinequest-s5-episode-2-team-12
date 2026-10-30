import { expect, test } from 'bun:test';
import type { AdminOverview } from '../queries';
import { excludeSyntheticAccounts } from './synthetic';

test('synthetic registrations are excluded from genuine-user counts without inventing activity', () => {
  const now = Date.parse('2026-10-30T06:00:00Z');
  const overview: AdminOverview = {
    users: 247,
    guests: 2,
    admins: 3,
    onboarded: 200,
    new_7d: 170,
    active_1d: 12,
    active_7d: 23,
    answers_7d: 40,
    mocks: 5,
    ai_7d: 9,
    xp_total: 1234,
    open_reports: 0,
    new_feedback: 0,
    pending_review: 10,
    days: [{ day: '2026-10-30', signups: 164, active: 12 }],
  };
  const accounts = Array.from({ length: 160 }, (_, index) => ({
    id: `test-${index}`,
    created_at: new Date(now).toISOString(),
    onboarded: true,
  }));
  const result = excludeSyntheticAccounts(overview, accounts, now);
  expect(result.users).toBe(87);
  expect(result.onboarded).toBe(40);
  expect(result.new_7d).toBe(10);
  expect(result.days[0]).toEqual({ day: '2026-10-30', signups: 4, active: 12 });
  expect(result.active_1d).toBe(12);
  expect(result.active_7d).toBe(23);
  expect(result.xp_total).toBe(1234);
  expect(result.mocks).toBe(5);
});

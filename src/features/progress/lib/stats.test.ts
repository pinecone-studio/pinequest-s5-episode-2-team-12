import { expect, test } from 'bun:test';
import { statsFromXp, streakOf } from './stats';

test('streak counts consecutive days ending today', () => {
  expect(streakOf(['2026-10-23', '2026-10-24', '2026-10-25'], '2026-10-25')).toBe(3);
});

test('streak survives until the end of today when yesterday was studied', () => {
  expect(streakOf(['2026-10-23', '2026-10-24'], '2026-10-25')).toBe(2);
});

test('a missed day resets the streak', () => {
  expect(streakOf(['2026-10-20', '2026-10-21', '2026-10-25'], '2026-10-25')).toBe(1);
  expect(streakOf(['2026-10-20'], '2026-10-25')).toBe(0);
});

test('stats sum XP and group days in Asia/Ulaanbaatar', () => {
  // 2026-10-24T17:30Z is already 01:30 on the 25th in Ulaanbaatar (UTC+8)
  const s = statsFromXp(
    [
      { amount: 40, at: '2026-10-24T03:00:00Z' },
      { amount: 10, at: '2026-10-24T17:30:00Z' },
    ],
    '2026-10-25',
  );
  expect(s.xp).toBe(50);
  expect(s.days).toEqual(['2026-10-24', '2026-10-25']);
  expect(s.streak).toBe(2);
  expect(s.level).toBe(1);
});

test('streak freezes bridge single missed days', async () => {
  const { streakOf } = await import('./stats');
  const days = ['2026-10-20', '2026-10-21', '2026-10-23', '2026-10-24', '2026-10-26'];
  expect(streakOf(days, '2026-10-26')).toBe(1);
  expect(streakOf(days, '2026-10-26', 1)).toBe(3);
  expect(streakOf(days, '2026-10-26', 2)).toBe(5);
  // a freeze never starts a streak from nothing
  expect(streakOf(['2026-10-20'], '2026-10-26', 5)).toBe(0);
});

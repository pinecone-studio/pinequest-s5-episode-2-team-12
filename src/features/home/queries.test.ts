import { expect, test } from 'bun:test';
import { getProfile } from './queries';

test('demo profile without Supabase', async () => {
  const p = await getProfile();
  expect(p.onboarded).toBe(true);
  expect(p.target).toBe(700);
});

test('profile rows map snake_case columns and fill defaults', async () => {
  const { profileFromRow } = await import('./queries');
  const p = profileFromRow({
    id: 'u1',
    name: null,
    onboarded: true,
    confidence: null,
    sat_exp: null,
    desmos: null,
    target: null,
    exam_date: '2027-03-06',
    start: null,
    tz: null,
    hide_public: true,
    friends_only: null,
  });
  expect(p).toMatchObject({ name: '', examDate: '2027-03-06', target: 700, tz: 'Asia/Ulaanbaatar' });
  expect(p.hidePublic).toBe(true);
  expect(p.friendsOnly).toBe(false);
});

import { expect, mock, test } from 'bun:test';

// Bun keeps module mocks across files, so mock everything components import from next/navigation.
mock.module('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {} }),
  usePathname: () => '/admin/users/u1',
}));
mock.module('../actions', () => ({
  grantGems: async () => ({ ok: true }),
  setUserRole: async () => ({ ok: true }),
}));

const { render, screen } = await import('@/test/render');
const { UserDetailView } = await import('./UserDetailView');
type Detail = Parameters<typeof UserDetailView>[0]['detail'];

const now = new Date().toISOString();
const detail: Detail = {
  profile: {
    id: 'u1',
    email: 'nandin@example.com',
    anonymous: false,
    email_confirmed: true,
    created_at: '2026-10-28T06:06:30Z',
    last_sign_in_at: null,
    username: 'nandin',
    name: 'Нандин',
    role: 'student',
    avatar_id: null,
    aimag: 'Улаанбаатар',
    school: null,
    onboarded: true,
    sat_exp: 'taken',
    last_math_score: 610,
    target: 720,
    exam_date: '2026-12-05',
    confidence: 4,
    desmos: 'often',
    study_minutes: 45,
    start: 'desmos',
    friend_code: 'ABCD2345',
    hide_public: false,
    friends_only: true,
  },
  xp_rows: [
    { amount: 30, at: now },
    { amount: 20, at: now },
  ],
  freezes: 0,
  gems: 79,
  answers: { total: 20, correct: 15, week: 4 },
  roadmap: { level: 'mid', current_stop: 3, done: 2, stars: 5 },
  mocks: [{ id: 'm1', kind: 'full', score: 640, finished_at: now }],
  counts: { cards: 12, mistakes_open: 3, friends: 2, badges: 1, ai_week: 6, reports_made: 0 },
  reports: [
    {
      id: 'r1',
      reason: 'name',
      context: 'leaderboard',
      resolved: false,
      created_at: now,
      reporter_name: 'Sesame',
    },
  ],
  recent_xp: [{ amount: 30, reason: 'stop', at: now }],
};

test('shows who the student is, their onboarding answers and how they are doing', () => {
  render(<UserDetailView detail={detail} me="admin-1" />);
  expect(screen.getByRole('heading', { name: 'Нандин' })).toBeTruthy();
  expect(screen.getByText('@nandin · nandin@example.com')).toBeTruthy();
  // onboarding answers, in the onboarding wording
  expect(screen.getByText('Албан ёсны Digital SAT өгсөн')).toBeTruthy();
  expect(screen.getByText('610')).toBeTruthy();
  expect(screen.getByText('45 минут')).toBeTruthy();
  // progress: 50 XP today → streak 1, 75% of 20 answers
  expect(screen.getByText('50 XP')).toBeTruthy();
  expect(screen.getByText('75% зөв')).toBeTruthy();
  expect(screen.getByText('💎 79')).toBeTruthy();
  expect(screen.getByText('2 зогсоол · 5 од')).toBeTruthy();
  expect(screen.getByText('640')).toBeTruthy();
  // a missing school reads «not set»; the open report is listed
  expect(screen.getAllByText('Оруулаагүй').length).toBeGreaterThan(0);
  expect(screen.getByText('Зохисгүй нэр')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Админ болгох' })).toBeTruthy();
});

test('an admin viewing their own page gets no remove-admin button', () => {
  render(<UserDetailView detail={{ ...detail, profile: { ...detail.profile, role: 'admin' } }} me="u1" />);
  expect(screen.queryByRole('button', { name: 'Админ эрх хасах' })).toBeNull();
});

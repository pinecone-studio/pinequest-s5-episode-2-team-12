import { expect, test } from 'bun:test';
import { OnboardingSchema, onboardingRow } from './schema';

const answer = {
  name: '  Saraa  ',
  satExp: 'none',
  lastMathScore: null,
  target: 700,
  examDate: '',
  confidence: 3,
  desmos: 'little',
  studyMinutes: 30,
  start: 'foundations',
};
test('onboarding validates Math-only scores, calendar dates, and study preferences', () => {
  expect(OnboardingSchema.parse(answer).name).toBe('Saraa');
  for (const patch of [
    { name: '' },
    { target: 1600 },
    { target: 705 },
    { examDate: '2027-02-30' },
    { examDate: '2020-01-01' },
    { studyMinutes: 1000 },
    { confidence: 6 },
    { lastMathScore: 500 },
    { id: 'another-user' },
  ]) {
    expect(OnboardingSchema.safeParse({ ...answer, ...patch }).success).toBe(false);
  }
  expect(OnboardingSchema.safeParse({ ...answer, satExp: 'taken', lastMathScore: 650 }).success).toBe(true);
});
test('the completion row binds answers to the authenticated user and marks completion atomically', () => {
  const row = onboardingRow('authenticated-user', OnboardingSchema.parse(answer));
  expect(row).toMatchObject({
    id: 'authenticated-user',
    name: 'Saraa',
    onboarded: true,
    exam_date: null,
    study_minutes: 30,
    target: 700,
  });
});

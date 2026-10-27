import { expect, test } from 'bun:test';
import { PHASES } from '@/mocks/meta';
import { buildPlan } from './demo-plan';

const base = { today: '2026-10-23', current: 600, target: 750, hoursPerDay: 1.5 };

test('phase weeks add up to the weeks left, each phase at least one week', () => {
  const plan = buildPlan({ ...base, examDate: '2026-12-05' }, PHASES);
  expect(plan.weeks).toBe(6);
  expect(plan.phases.reduce((a, p) => a + p.weeks, 0)).toBe(6);
  expect(plan.phases.every((p) => p.weeks >= 1)).toBe(true);
  expect(plan.phases[0].from).toBe('2026-10-23');
  // weak topics (the biggest share) get the most weeks; the last phase ends the day before the exam
  const weeksOf = (n: string) => plan.phases.find((p) => p.n === n)?.weeks ?? 0;
  expect(weeksOf('Сул сэдэв')).toBe(Math.max(...plan.phases.map((p) => p.weeks)));
  expect(plan.phases.at(-1)?.to).toBe('2026-12-04');
  expect(plan.gain).toBe(150);
  expect(plan.totalHours).toBe(Math.round(43 * 1.5));
});

test('long and very short plans still add up', () => {
  const long = buildPlan({ ...base, examDate: '2027-06-05' }, PHASES);
  expect(long.phases.reduce((a, p) => a + p.weeks, 0)).toBe(long.weeks);
  const short = buildPlan({ ...base, examDate: '2026-11-07' }, PHASES);
  expect(short.weeks).toBe(2);
  expect(short.phases.reduce((a, p) => a + p.weeks, 0)).toBe(2);
});

test('no negative gain when the target is below the current score', () => {
  expect(buildPlan({ ...base, examDate: '2026-12-05', target: 500 }, PHASES).gain).toBe(0);
});

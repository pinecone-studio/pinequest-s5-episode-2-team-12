// Fixed practice tests («Practice Test 1, 2…»): full-length forms built like the digital SAT Math section in
// Bluebook — one module 1 and two prepared module 2s (harder / easier), picked by the module-1 result.
// Every question is an ORIGINAL Suprep item (content/mock/*.json); no College Board test content is copied.
// Server-only: the files carry answers.
import { ROADMAP } from '@/features/roadmap/config';
import type { Question } from '@/types';
import pt1 from '../../../content/mock/practice-test-1.json';
import pt2 from '../../../content/mock/practice-test-2.json';
import type { Route } from './lib/mock';

export type PracticeTest = {
  id: string;
  /** Shown as «Practice Test {no}». */
  no: number;
  module1: Question[];
  hard: Question[];
  easy: Question[];
};

/** What the browser may know about a practice test (no questions). */
export type PracticeTestMeta = { id: string; no: number };

export const PRACTICE_TESTS: PracticeTest[] = [pt1, pt2] as unknown as PracticeTest[];

export const formQuestions = (f: PracticeTest): Question[] => [...f.module1, ...f.hard, ...f.easy];

/** Every question of every practice test (for grading, review and the mistakes notebook). */
export const allFormQuestions = (): Question[] => PRACTICE_TESTS.flatMap(formQuestions);

const servable = (f: PracticeTest, allowUnreviewed: boolean) =>
  allowUnreviewed || formQuestions(f).every((q) => q.reviewed === true);

/** Practice tests that can be served (a test is listed only when all of its questions passed review). */
export function availableForms(allowUnreviewed: boolean = ROADMAP.allowUnreviewed): PracticeTestMeta[] {
  return PRACTICE_TESTS.filter((f) => servable(f, allowUnreviewed)).map(({ id, no }) => ({ id, no }));
}

export function formById(
  id: string | undefined,
  allowUnreviewed: boolean = ROADMAP.allowUnreviewed,
): PracticeTest | undefined {
  const f = PRACTICE_TESTS.find((x) => x.id === id);
  return f && servable(f, allowUnreviewed) ? f : undefined;
}

export const module2Of = (f: PracticeTest, route: Route): string[] => f[route].map((q) => q.id);

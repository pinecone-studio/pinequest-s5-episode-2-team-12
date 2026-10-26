// Grading a whole submission (placement test or stop attempt) with the same validation in demo mode and in the
// server actions. The server never trusts the browser's "correct" flags: it re-grades from the stored answers.
import type { Question } from '@/types';
import type { PlacementAnswer, PlacementResult, ProblemAttempt, RoadmapState } from '../types';
import { isCorrect } from './grade';
import { type Graded, gradePlacement, module1, module2, routeModule2 } from './placement';
import { type AttemptResult, scoreAttempt } from './scoring';
import { masteryAt, setLengthAt } from './state';
import { canOpenStop, isDone } from './unlock';

export type SubmittedAnswer = { qid: string; answer: string; timeMs: number; hintUsed?: boolean };

const clampMs = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(3_600_000, Math.round(n))) : 0);
const cleanAnswer = (s: unknown) => (typeof s === 'string' ? s.slice(0, 40) : '');

export type PlacementGrade = { result: PlacementResult; graded: Graded[]; attempts: ProblemAttempt[] };

/** Validates that module 1, the route and module 2 are exactly what the rules produce, then grades. */
export function gradePlacementSubmission(
  items: readonly Question[],
  answers: readonly SubmittedAnswer[],
  at = new Date().toISOString(),
): PlacementGrade | { error: string } {
  let m1: Question[];
  try {
    m1 = module1(items);
  } catch {
    return { error: 'placement_unavailable' };
  }
  if (answers.length !== 26) return { error: 'invalid_input' };
  const first = answers.slice(0, 13);
  if (first.some((a, i) => a.qid !== m1[i].id)) return { error: 'invalid_input' };
  const g1 = first.map((a, i) => ({ q: m1[i], correct: isCorrect(m1[i], cleanAnswer(a.answer)) }));
  const route = routeModule2(g1.filter((g) => g.correct).length);
  let m2: Question[];
  try {
    m2 = module2(items, route);
  } catch {
    return { error: 'placement_unavailable' };
  }
  const second = answers.slice(13);
  if (second.some((a, i) => a.qid !== m2[i].id)) return { error: 'invalid_input' };
  const g2 = second.map((a, i) => ({ q: m2[i], correct: isCorrect(m2[i], cleanAnswer(a.answer)) }));
  const graded = [...g1, ...g2];
  const placementAnswers: PlacementAnswer[] = answers.map((a, i) => ({
    qid: a.qid,
    answer: cleanAnswer(a.answer),
    correct: graded[i].correct,
    timeMs: clampMs(a.timeMs),
  }));
  const ts = Date.parse(at);
  return {
    result: gradePlacement(graded, placementAnswers, route, at),
    graded,
    attempts: graded.map((g, i) => ({
      qid: g.q.id,
      topicId: g.q.topicId ?? 0,
      correct: g.correct,
      hintUsed: false,
      timeMs: placementAnswers[i].timeMs,
      at: ts,
    })),
  };
}

export type StopGrade = { result: AttemptResult; correct: number; total: number; attempts: ProblemAttempt[] };

export function gradeStopSubmission(
  state: RoadmapState,
  no: number,
  testOut: boolean,
  pool: readonly Question[],
  answers: readonly SubmittedAnswer[],
  at = Date.now(),
): StopGrade | { error: string } {
  if (!state.placement) return { error: 'locked' };
  if (!canOpenStop(state.stops, no)) return { error: 'locked' };
  const done = isDone(state.stops.find((p) => p.no === no));
  if (testOut && (done || masteryAt(state, no) !== 'strong')) return { error: 'invalid_input' };
  const total = setLengthAt(state, no, testOut);
  if (answers.length !== total) return { error: 'invalid_input' };
  const byId = new Map(pool.filter((q) => q.topicId === no).map((q) => [q.id, q]));
  const qs = answers.map((a) => byId.get(a.qid));
  if (qs.some((q) => !q)) return { error: 'invalid_input' };
  const attempts: ProblemAttempt[] = answers.map((a, i) => ({
    qid: a.qid,
    topicId: no,
    correct: isCorrect(qs[i]!, cleanAnswer(a.answer)),
    hintUsed: Boolean(a.hintUsed),
    timeMs: clampMs(a.timeMs),
    at,
  }));
  const correct = attempts.filter((a) => a.correct).length;
  const hintsUsed = attempts.filter((a) => a.hintUsed).length;
  return { result: scoreAttempt({ correct, total, hintsUsed, testOut }), correct, total, attempts };
}

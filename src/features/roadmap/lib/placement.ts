// Placement test («Түвшин тогтоох тест»): two adaptive modules like the digital SAT.
// Module 1 = one medium item per module-1 topic; module 2 = easy or hard item per remaining topic,
// chosen by the module-1 result. Across both modules each of the 26 topics appears exactly once.
import type { Domain, Question } from '@/types';
import { DIFFICULTY_OF, ROADMAP } from '../config';
import { TOPICS, topicById } from '../topics';
import type { Difficulty, Mastery, PlacementAnswer, PlacementLevel, PlacementResult } from '../types';

const P = ROADMAP.placement;
type Route = 'easy' | 'hard';

const diff = (q: Question): Difficulty => DIFFICULTY_OF[q.difficulty];

function pick(items: readonly Question[], topicId: number, d: Difficulty): Question {
  const q = items.find((x) => x.topicId === topicId && x.pool === 'placement' && diff(x) === d);
  if (!q) throw new Error(`placement: no ${d} item for topic ${topicId}`);
  return q;
}

export function module1(items: readonly Question[]): Question[] {
  return P.module1Topics.map((t) => pick(items, t, 'medium'));
}

export function routeModule2(module1Correct: number): Route {
  return module1Correct >= P.hardRouteAt ? 'hard' : 'easy';
}

export function module2(items: readonly Question[], route: Route): Question[] {
  return P.module2Topics.map((t) => pick(items, t, route));
}

/** Highest possible weighted points (the hard route); the easy route can therefore not reach Сайн. */
export function maxPoints(): number {
  return P.module1Topics.length * P.weights.medium + P.module2Topics.length * P.weights.hard;
}

export type Graded = { q: Question; correct: boolean };

/** Weighted score 0..1: harder questions count more, normalised by the hard-route maximum. */
export function weightedScore(graded: readonly Graded[]): number {
  const earned = graded.reduce((n, g) => n + (g.correct ? P.weights[diff(g.q)] : 0), 0);
  return Math.min(1, earned / maxPoints());
}

export function levelOf(score: number): PlacementLevel {
  if (score < P.thresholds.weak) return 'weak';
  if (score > P.thresholds.strong) return 'strong';
  return 'mid';
}

/** Correct on hard → strong; correct on easy/medium → ok; wrong → weak. */
export function masteryOf(graded: readonly Graded[]): Record<number, Mastery> {
  const out: Record<number, Mastery> = {};
  for (const t of TOPICS) out[t.id] = 'weak';
  for (const { q, correct } of graded) {
    if (!q.topicId) continue;
    out[q.topicId] = !correct ? 'weak' : diff(q) === 'hard' ? 'strong' : 'ok';
  }
  return out;
}

/** Skipping the test: level Дунд, every topic «ok». */
export function skippedResult(at = new Date().toISOString()): PlacementResult {
  return {
    skipped: true,
    module2: null,
    score: 0,
    level: 'mid',
    mastery: Object.fromEntries(TOPICS.map((t) => [t.id, 'ok' as Mastery])),
    answers: [],
    finishedAt: at,
  };
}

export function gradePlacement(
  graded: readonly Graded[],
  answers: PlacementAnswer[],
  route: Route,
  at = new Date().toISOString(),
): PlacementResult {
  const score = weightedScore(graded);
  return {
    skipped: false,
    module2: route,
    score,
    level: levelOf(score),
    mastery: masteryOf(graded),
    answers,
    finishedAt: at,
  };
}

/** The n weakest topics: wrong answers first (a miss on an easy item is weakest), then «ok» topics. */
export function weakestTopics(graded: readonly Graded[], n = 3): number[] {
  const rank = (g: Graded) =>
    (g.correct ? 10 : 0) + (g.correct ? P.weights[diff(g.q)] : -P.weights[diff(g.q)]);
  return [...graded]
    .filter((g) => g.q.topicId)
    .sort((a, b) => rank(a) - rank(b) || a.q.topicId! - b.q.topicId!)
    .slice(0, n)
    .map((g) => g.q.topicId!);
}

export function domainBreakdown(
  graded: readonly Graded[],
): Record<Domain, { correct: number; total: number }> {
  const out: Record<Domain, { correct: number; total: number }> = {
    alg: { correct: 0, total: 0 },
    adv: { correct: 0, total: 0 },
    psda: { correct: 0, total: 0 },
    geo: { correct: 0, total: 0 },
  };
  for (const { q, correct } of graded) {
    const d = (q.topicId && topicById(q.topicId)?.domain) || q.domain;
    out[d].total++;
    if (correct) out[d].correct++;
  }
  return out;
}

/**
 * A retake replaces the level, and the mastery of topics whose stop is not finished yet.
 * Finished stops keep their mastery (they are already passed).
 */
export function applyRetake(
  mastery: Record<number, Mastery>,
  result: PlacementResult,
  finishedTopics: ReadonlySet<number>,
): Record<number, Mastery> {
  const out = { ...mastery };
  for (const t of TOPICS) if (!finishedTopics.has(t.id)) out[t.id] = result.mastery[t.id] ?? out[t.id];
  return out;
}

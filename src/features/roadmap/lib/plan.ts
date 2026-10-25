// The stop panel's «Танд» numbers: mastery (placement + attempts), the problem set for this student, time,
// XP, and what unlocks a locked stop. Pure (plan.test.ts).
import { ROADMAP } from '../config';
import { STOPS } from '../stops';
import type { Difficulty, Mastery, ProblemAttempt, RoadmapState } from '../types';
import { splitCounts } from './select-problems';
import { masteryAt, setLengthAt } from './state';
import { isDone } from './unlock';

export type StopPlan = {
  total: number;
  mix: Record<Difficulty, number>;
  minutes: number;
  /** XP for passing, and with all three stars. */
  xp: { pass: number; max: number };
};

export function stopPlan(s: RoadmapState, no: number): StopPlan {
  const total = setLengthAt(s, no);
  const mix = splitCounts(total, ROADMAP.mix[s.level]);
  const minutes = Math.max(
    1,
    Math.round(
      (Object.keys(mix) as Difficulty[]).reduce((sum, d) => sum + mix[d] * ROADMAP.minutesPer[d], 0),
    ),
  );
  const x = ROADMAP.xp;
  return { total, mix, minutes, xp: { pass: x.stopPass + x.perStar, max: x.stopPass + x.perStar * 3 } };
}

/**
 * What the panel calls the student's level on a topic: the placement mastery, moved by their own attempts
 * (a strong best score lifts it, a weak one lowers it). `source` says where the number came from.
 */
export function topicMastery(
  s: RoadmapState,
  no: number,
): { mastery: Mastery; source: 'placement' | 'attempts' | 'default' } {
  const p = s.stops.find((x) => x.no === no);
  const base = masteryAt(s, no);
  if (p && p.attempts > 0) {
    if (p.best >= ROADMAP.strongBest) return { mastery: 'strong', source: 'attempts' };
    if (p.best <= ROADMAP.weakBest) return { mastery: 'weak', source: 'attempts' };
    return { mastery: base === 'weak' ? 'ok' : base, source: 'attempts' };
  }
  return { mastery: base, source: s.placement && !s.placement.skipped ? 'placement' : 'default' };
}

/** The earliest unfinished stop before `no` — finishing it is what unlocks `no` next. null if none. */
export function blockingStop(s: RoadmapState, no: number): number | null {
  const done = new Map(s.stops.map((p) => [p.no, p]));
  return STOPS.find((x) => x.no < no && !isDone(done.get(x.no)))?.no ?? null;
}

/** Wrong answers on a topic in the history (for the panel's link to the mistake notebook). */
export function missedOn(history: readonly ProblemAttempt[], topicId: number): number {
  return new Set(history.filter((h) => h.topicId === topicId && !h.correct).map((h) => h.qid)).size;
}

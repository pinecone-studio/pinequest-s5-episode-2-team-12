// Roadmap state transitions shared by the demo store (localStorage) and the server actions (Supabase).
import { ROADMAP } from '../config';
import { FINAL_BADGE, REGIONS, STOPS, stopByNo } from '../stops';
import { TOPICS } from '../topics';
import type { Mastery, PlacementResult, RegionId, RoadmapState, StopProgress } from '../types';
import { applyRetake } from './placement';
import { type AttemptResult, mergeAttempt, xpFor } from './scoring';
import { setLengthFor } from './select-problems';
import { allDone, emptyProgress, isDone, newlyCompletedRegions } from './unlock';

export function initialState(): RoadmapState {
  return {
    placement: null,
    mastery: Object.fromEntries(TOPICS.map((t) => [t.id, 'ok' as Mastery])),
    level: 'mid',
    stops: emptyProgress(),
    regionsDone: [],
  };
}

/** The roadmap opens once the placement test is finished or skipped. */
export const isOpen = (s: RoadmapState) => s.placement !== null;

export function withPlacement(s: RoadmapState, result: PlacementResult): RoadmapState {
  const finished = new Set(s.stops.filter(isDone).map((p) => p.no));
  // a skip after a real test must not wipe its mastery
  if (result.skipped && s.placement && !s.placement.skipped) return s;
  return {
    ...s,
    placement: result,
    level: result.level,
    mastery: s.placement ? applyRetake(s.mastery, result, finished) : { ...result.mastery },
  };
}

export type AttemptOutcome = {
  state: RoadmapState;
  xp: number;
  /** Badge ids earned by this attempt (regions, final). */
  badges: string[];
  regions: RegionId[];
  finishedAll: boolean;
};

export function withAttempt(s: RoadmapState, no: number, result: AttemptResult, at: string): AttemptOutcome {
  const before = s.stops;
  const stops: StopProgress[] = before.map((p) => (p.no === no ? mergeAttempt(p, result, at) : p));
  const regions = newlyCompletedRegions(before, stops).filter((r) => !s.regionsDone.includes(r));
  const finishedAll = !allDone(before) && allDone(stops);
  const badges = [
    ...regions.map((r) => REGIONS.find((x) => x.id === r)!.badge),
    ...(finishedAll ? [FINAL_BADGE] : []),
  ];
  const xp = xpFor(result) + regions.length * ROADMAP.xp.region + (finishedAll ? ROADMAP.xp.final : 0);
  return {
    state: { ...s, stops, regionsDone: [...s.regionsDone, ...regions] },
    xp,
    badges,
    regions,
    finishedAll,
  };
}

/** Mastery of the topic taught at a stop. */
export function masteryAt(s: RoadmapState, no: number): Mastery {
  return s.mastery[no] ?? 'ok';
}

export function setLengthAt(s: RoadmapState, no: number, testOut = false): number {
  return setLengthFor(masteryAt(s, no), testOut);
}

/** Runtime guard for state read back from storage or the DB. */
export function isRoadmapState(x: unknown): x is RoadmapState {
  if (!x || typeof x !== 'object') return false;
  const s = x as RoadmapState;
  return (
    Array.isArray(s.stops) &&
    s.stops.length === STOPS.length &&
    s.stops.every((p) => typeof p?.no === 'number' && stopByNo(p.no) && typeof p.attempts === 'number') &&
    typeof s.mastery === 'object' &&
    ['weak', 'mid', 'strong'].includes(s.level) &&
    Array.isArray(s.regionsDone)
  );
}

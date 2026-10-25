// Supabase rows ↔ RoadmapState. Pure so the mapping is unit-tested without a database.
import type {
  Mastery,
  PlacementLevel,
  PlacementResult,
  RegionId,
  RoadmapState,
  StopProgress,
} from '../types';
import { initialState } from './state';
import { frontier } from './unlock';

export type ProgressRow = {
  level: PlacementLevel;
  mastery: Record<string, Mastery>;
  current_stop: number;
  regions_done: string[];
};
export type StopRow = {
  stop_no: number;
  status: 'current' | 'completed' | 'tested-out';
  best: number | string;
  stars: number;
  attempts: number;
  tested_out: boolean;
  completed_at: string | null;
};
export type PlacementRow = {
  skipped: boolean;
  module2: 'easy' | 'hard' | null;
  score: number | string;
  level: PlacementLevel;
  mastery: Record<string, Mastery>;
  answers: PlacementResult['answers'];
  finished_at: string;
};

const numKeys = (m: Record<string, Mastery>) =>
  Object.fromEntries(Object.entries(m ?? {}).map(([k, v]) => [Number(k), v])) as Record<number, Mastery>;

export function placementFromRow(r: PlacementRow): PlacementResult {
  return {
    skipped: r.skipped,
    module2: r.module2,
    score: Number(r.score),
    level: r.level,
    mastery: numKeys(r.mastery),
    answers: r.answers ?? [],
    finishedAt: r.finished_at,
  };
}

export function stateFromRows(
  progress: ProgressRow | null,
  stops: readonly StopRow[],
  placement: PlacementRow | null,
): RoadmapState {
  const base = initialState();
  if (!progress) return { ...base, placement: placement ? placementFromRow(placement) : null };
  const byNo = new Map(stops.map((s) => [s.stop_no, s]));
  const merged: StopProgress[] = base.stops.map((p) => {
    const r = byNo.get(p.no);
    if (!r) return p;
    return {
      no: p.no,
      best: Number(r.best),
      stars: Math.max(0, Math.min(3, r.stars)) as StopProgress['stars'],
      attempts: r.attempts,
      testedOut: r.tested_out,
      completedAt: r.completed_at,
    };
  });
  return {
    placement: placement ? placementFromRow(placement) : null,
    mastery: { ...base.mastery, ...numKeys(progress.mastery) },
    level: progress.level,
    stops: merged,
    regionsDone: progress.regions_done as RegionId[],
  };
}

export function progressRow(userId: string, s: RoadmapState) {
  return {
    user_id: userId,
    level: s.level,
    mastery: s.mastery,
    current_stop: frontier(s.stops) ?? 27,
    regions_done: s.regionsDone,
    updated_at: new Date().toISOString(),
  };
}

export function stopRow(userId: string, p: StopProgress): StopRow & { user_id: string } {
  return {
    user_id: userId,
    stop_no: p.no,
    status: p.completedAt ? (p.testedOut ? 'tested-out' : 'completed') : 'current',
    best: p.best,
    stars: p.stars,
    attempts: p.attempts,
    tested_out: p.testedOut,
    completed_at: p.completedAt,
  };
}

// Stop statuses, the current position and region progress. Unlocking is linear: stop N+1 opens when
// stop N is completed or tested out. Pure functions over StopProgress[].
import { ROADMAP } from '../config';
import { REGIONS, STOPS, stopsInRegion } from '../stops';
import type { PlacementResult, Region, RegionId, StopProgress, StopStatus } from '../types';

export function emptyProgress(): StopProgress[] {
  return STOPS.map((s) => ({
    no: s.no,
    best: 0,
    stars: 0,
    attempts: 0,
    testedOut: false,
    completedAt: null,
  }));
}

export const isDone = (p: StopProgress | undefined) => Boolean(p?.completedAt);

function byNo(progress: readonly StopProgress[]) {
  return new Map(progress.map((p) => [p.no, p]));
}

/**
 * locked     — an earlier stop is unfinished (or the roadmap is still closed)
 * available  — the next stop, not started yet («Эхлэх»)
 * current    — the next stop, started («Үргэлжлүүлэх»)
 * completed  — passed
 * tested-out — passed through «Шалгалтаар давах»
 */
export function stopStatuses(progress: readonly StopProgress[], open = true): Record<number, StopStatus> {
  const map = byNo(progress);
  const out: Record<number, StopStatus> = {};
  let frontierSeen = false;
  for (const s of STOPS) {
    const p = map.get(s.no);
    if (!open) out[s.no] = 'locked';
    else if (isDone(p)) out[s.no] = p?.testedOut ? 'tested-out' : 'completed';
    else if (!frontierSeen) {
      frontierSeen = true;
      out[s.no] = (p?.attempts ?? 0) > 0 ? 'current' : 'available';
    } else out[s.no] = 'locked';
  }
  return out;
}

/** The first unfinished stop (the student's position), or null when all 26 are done. */
export function frontier(progress: readonly StopProgress[]): number | null {
  const map = byNo(progress);
  return STOPS.find((s) => !isDone(map.get(s.no)))?.no ?? null;
}

export function canOpenStop(progress: readonly StopProgress[], no: number): boolean {
  const map = byNo(progress);
  const i = STOPS.findIndex((s) => s.no === no);
  return i >= 0 && STOPS.slice(0, i).every((s) => isDone(map.get(s.no)));
}

export function regionProgress(
  progress: readonly StopProgress[],
  id: RegionId,
): { done: number; total: number } {
  const map = byNo(progress);
  const stops = stopsInRegion(id);
  return { done: stops.filter((s) => isDone(map.get(s.no))).length, total: stops.length };
}

/** The region the student is travelling through now (header «Дараагийн бүс»); null when finished. */
export function activeRegion(
  progress: readonly StopProgress[],
): (Region & { done: number; total: number }) | null {
  const no = frontier(progress);
  if (no === null) return null;
  const region = REGIONS.find((r) => r.id === STOPS.find((s) => s.no === no)?.region)!;
  return { ...region, ...regionProgress(progress, region.id) };
}

export function completedRegions(progress: readonly StopProgress[]): RegionId[] {
  return REGIONS.filter((r) => {
    const { done, total } = regionProgress(progress, r.id);
    return done === total;
  }).map((r) => r.id);
}

/** Regions finished by `after` that were not finished in `before` (→ award their badges). */
export function newlyCompletedRegions(
  before: readonly StopProgress[],
  after: readonly StopProgress[],
): RegionId[] {
  const had = new Set(completedRegions(before));
  return completedRegions(after).filter((r) => !had.has(r));
}

export function allDone(progress: readonly StopProgress[]): boolean {
  return frontier(progress) === null;
}

/** A retake opens 30 days after the last placement, or once a region was finished after it (configurable). */
export function canRetake(
  placement: PlacementResult | null,
  progress: readonly StopProgress[],
  now = Date.now(),
): boolean {
  if (!placement || placement.skipped) return true;
  const taken = Date.parse(placement.finishedAt);
  if (now - taken >= ROADMAP.placement.retake.days * 86_400_000) return true;
  if (!ROADMAP.placement.retake.afterRegion) return false;
  const map = byNo(progress);
  return REGIONS.some((r) => {
    const stops = stopsInRegion(r.id).map((s) => map.get(s.no));
    if (!stops.every(isDone)) return false;
    const finished = Math.max(...stops.map((p) => Date.parse(p!.completedAt!)));
    return finished > taken;
  });
}

import type { LocalRoadmap } from '@/features/roadmap/lib/local-store';
import { skippedResult } from '@/features/roadmap/lib/placement';
import { initialState, withPlacement } from '@/features/roadmap/lib/state';
import { REGIONS, stopsInRegion } from '@/features/roadmap/stops';
import { TUYA_XP } from './profile';

export function tuyaRoadmap(now = Date.now()): LocalRoadmap {
  const at = new Date(now - 86400000).toISOString();
  const state = withPlacement(initialState(), skippedResult(at));
  // Nine completed stops make the first ten levels accessible, with level 10 current.
  state.stops = state.stops.map((p) =>
    p.no < 10 ? { ...p, best: 0.9, stars: 2, attempts: 1, completedAt: at } : p,
  );
  state.regionsDone = REGIONS.filter((r) => stopsInRegion(r.id).every((s) => s.no < 10)).map((r) => r.id);
  return {
    state,
    xp: TUYA_XP,
    history: [],
    badges: REGIONS.filter((r) => state.regionsDone.includes(r.id)).map((r) => r.badge),
  };
}

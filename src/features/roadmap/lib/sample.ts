// Sample state for /roadmap?demo=states: shows every card state at once (design review, screenshots).
import type { RoadmapState } from '../types';
import { skippedResult } from './placement';
import { initialState, withPlacement } from './state';

export function sampleState(): RoadmapState {
  const s = withPlacement(initialState(), {
    ...skippedResult('2026-10-01T00:00:00Z'),
    skipped: false,
    level: 'mid',
  });
  const at = '2026-10-20T10:00:00Z';
  const done: Record<number, [number, 0 | 1 | 2 | 3, boolean]> = {
    1: [1, 3, false],
    2: [0.9, 2, false],
    3: [1, 0, true],
    4: [0.8, 1, false],
  };
  return {
    ...s,
    mastery: { ...s.mastery, 5: 'weak', 3: 'strong' },
    stops: s.stops.map((p) => {
      const d = done[p.no];
      if (d) return { ...p, best: d[0], stars: d[1], testedOut: d[2], attempts: 1, completedAt: at };
      if (p.no === 5) return { ...p, best: 0.5, attempts: 2 };
      return p;
    }),
  };
}

/** In the sample the stop after the current one is shown as «available» so all five states appear. */
export const SAMPLE_AVAILABLE = 6;

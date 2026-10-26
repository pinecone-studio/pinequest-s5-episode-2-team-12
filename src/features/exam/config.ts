// Full mock exam («Mock тест») tunables. Shaped like the digital SAT Math section: two 22-question,
// 35-minute modules, the second one adaptive. Logic in lib/ reads only from here.
import type { Domain } from '@/types';

type Mix = { easy: number; medium: number; hard: number };

export const MOCK = {
  questionsPerModule: 22,
  moduleMinutes: 35,
  breakMinutes: 10,
  /** Questions per domain in each module (≈ SAT shares: Algebra 35%, Advanced 35%, PSDA 15%, Geo 15%). */
  domainCounts: { alg: 8, adv: 8, psda: 3, geo: 3 } satisfies Record<Domain, number>,
  /** Difficulty mix of module 1 and of each module-2 route. */
  mix: {
    module1: { easy: 0.3, medium: 0.4, hard: 0.3 },
    hard: { easy: 0.1, medium: 0.4, hard: 0.5 },
    easy: { easy: 0.5, medium: 0.4, hard: 0.1 },
  } satisfies Record<'module1' | 'hard' | 'easy', Mix>,
  /** Module-1 correct answers needed for the harder module 2. */
  hardRouteAt: 13,
  /** Points per correct answer by difficulty, for the estimate. */
  weights: { 1: 1, 2: 2, 3: 3 } as Record<1 | 2 | 3, number>,
  /**
   * The estimate maps points to 200–800 against a reference full-marks form (module 1 + hard route), so an
   * easy-route student cannot reach 800 — like the real adaptive test. It is an estimate, not an SAT score.
   */
  scale: { min: 200, max: 800, round: 10 },
  /** Server timing: submissions this late after the deadline are rejected; faster than this is flagged. */
  graceMs: 5_000,
  minMsPerAnswer: 3_000,
} as const;

export const DOMAINS: Domain[] = ['alg', 'adv', 'psda', 'geo'];

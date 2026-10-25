// Every tunable of the roadmap in one place. Logic in lib/ reads only from here.
import type { Difficulty, Mastery, PlacementLevel } from './types';

export const ROADMAP = {
  placement: {
    /** Total minutes for both modules (no break). */
    minutes: 35,
    /** Module 1: one medium question per topic listed here (covers all 4 domains). */
    module1Topics: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 22, 24, 26],
    /** Module 2: the other 13 topics, easy or hard variant. */
    module2Topics: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 21, 23, 25],
    /** Correct answers in module 1 needed for the hard module 2. */
    hardRouteAt: 8,
    /** Points per correct answer by difficulty. */
    weights: { easy: 1, medium: 2, hard: 3 } satisfies Record<Difficulty, number>,
    /** score < weak → Сул; score > strong → Сайн; otherwise Дунд. Score is 0..1. */
    thresholds: { weak: 0.4, strong: 0.75 },
    retake: { days: 30, afterRegion: true },
  },

  /** Difficulty mix of a stop's problem set by overall level (shares sum to 1). */
  mix: {
    weak: { easy: 0.6, medium: 0.3, hard: 0.1 },
    mid: { easy: 0.3, medium: 0.5, hard: 0.2 },
    strong: { easy: 0.1, medium: 0.4, hard: 0.5 },
  } satisfies Record<PlacementLevel, Record<Difficulty, number>>,

  /** Problems per set by topic mastery. */
  setLength: { weak: 10, ok: 8, strong: 6 } satisfies Record<Mastery, number>,
  /** Intro opens automatically for these mastery levels. */
  autoIntro: ['weak'] as Mastery[],
  testOut: { count: 3, difficulty: 'hard' as Difficulty },

  /** Share correct needed to pass; star thresholds. 3★ also needs no hints. */
  pass: 0.8,
  stars: { two: 0.9, three: 1 },
  /** Wrongly answered questions are this many times more likely to be drawn again. */
  missedWeight: 3,

  xp: { placement: 30, stopPass: 40, perStar: 10, testOut: 20, attempt: 5, region: 50, final: 100 },

  /** Serve unreviewed questions. Always on in development/tests; production needs reviewed: true. */
  allowUnreviewed: process.env.NODE_ENV !== 'production' || process.env.ROADMAP_ALLOW_UNREVIEWED === '1',
} as const;

export const LEVEL_LABEL: Record<PlacementLevel, string> = { weak: 'Сул', mid: 'Дунд', strong: 'Сайн' };
export const MASTERY_LABEL: Record<Mastery, string> = { weak: 'Сул', ok: 'Дунд', strong: 'Сайн' };
export const DIFFICULTY_OF: Record<1 | 2 | 3, Difficulty> = { 1: 'easy', 2: 'medium', 3: 'hard' };
export const DIFFICULTY_NUM: Record<Difficulty, 1 | 2 | 3> = { easy: 1, medium: 2, hard: 3 };

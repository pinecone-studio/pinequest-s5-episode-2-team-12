// Scoring of one stop attempt: pass, stars, XP, and merging into the saved StopProgress.
import { ROADMAP } from '../config';
import type { StopProgress } from '../types';

export type AttemptInput = { correct: number; total: number; hintsUsed: number; testOut?: boolean };
export type AttemptResult = { share: number; passed: boolean; stars: 0 | 1 | 2 | 3; testOut: boolean };

export function starsFor(share: number, hintsUsed: number): 0 | 1 | 2 | 3 {
  if (share < ROADMAP.pass) return 0;
  if (share >= ROADMAP.stars.three && hintsUsed === 0) return 3;
  if (share >= ROADMAP.stars.two) return 2;
  return 1;
}

export function scoreAttempt({ correct, total, hintsUsed, testOut = false }: AttemptInput): AttemptResult {
  const share = total > 0 ? Math.max(0, Math.min(1, correct / total)) : 0;
  if (testOut) {
    // test-out passes only with every hard problem right; it earns the check mark, not stars
    return { share, passed: total > 0 && correct === total, stars: 0, testOut: true };
  }
  const stars = starsFor(share, hintsUsed);
  return { share, passed: stars > 0, stars, testOut: false };
}

/** XP for an attempt. Failing still earns a little so practice counts toward the streak and league. */
export function xpFor(result: AttemptResult): number {
  const x = ROADMAP.xp;
  if (!result.passed) return x.attempt;
  if (result.testOut) return x.testOut;
  return x.stopPass + x.perStar * result.stars;
}

/** Correct answers needed to pass a set of `total` problems (for the «3/8» ring). */
export const neededToPass = (total: number) => Math.ceil(total * ROADMAP.pass - 1e-9);

export function mergeAttempt(prev: StopProgress, result: AttemptResult, at: string): StopProgress {
  return {
    no: prev.no,
    best: Math.max(prev.best, result.share),
    stars: Math.max(prev.stars, result.stars) as StopProgress['stars'],
    attempts: prev.attempts + 1,
    testedOut: prev.testedOut || (result.passed && result.testOut && !prev.completedAt),
    completedAt: prev.completedAt ?? (result.passed ? at : null),
  };
}

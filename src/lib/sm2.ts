// Spaced repetition (SM-2 style) with four grades, shared by flashcards and the mistake notebook.
//   Дахин (again) · Хэцүү (hard) · Зүгээр (good) · Амархан (easy)
// Pure (sm2.test.ts). Times are epoch ms; intervals are days.
import { DAY_MS } from './time';

export type Grade = 'again' | 'hard' | 'good' | 'easy';
export const GRADES: Grade[] = ['again', 'hard', 'good', 'easy'];

export type ReviewState = {
  /** Successful reviews in a row. */
  reps: number;
  /** Days until the next review. */
  interval: number;
  /** Ease factor, ≥ 1.3. */
  ease: number;
  due: number;
  lapses: number;
};

export const SM2 = {
  startEase: 2.5,
  minEase: 1.3,
  /** A failed card comes back in the same session. */
  relearnMs: 10 * 60_000,
  /** First intervals for good / easy. */
  firstGood: 1,
  secondGood: 3,
  firstEasy: 3,
  easyBonus: 1.3,
  hardFactor: 1.2,
  maxInterval: 365,
};

export function newState(now: number): ReviewState {
  return { reps: 0, interval: 0, ease: SM2.startEase, due: now, lapses: 0 };
}

const clampEase = (e: number) => Math.max(SM2.minEase, Math.round(e * 100) / 100);
const clampDays = (d: number) => Math.min(SM2.maxInterval, Math.max(1, Math.round(d)));

export function review(s: ReviewState, grade: Grade, now: number): ReviewState {
  if (grade === 'again') {
    return {
      reps: 0,
      interval: 0,
      ease: clampEase(s.ease - 0.2),
      due: now + SM2.relearnMs,
      lapses: s.lapses + 1,
    };
  }
  let interval: number;
  let ease = s.ease;
  if (grade === 'hard') {
    interval = s.reps === 0 ? 1 : clampDays(s.interval * SM2.hardFactor);
    ease -= 0.15;
  } else if (grade === 'good') {
    interval = s.reps === 0 ? SM2.firstGood : s.reps === 1 ? SM2.secondGood : clampDays(s.interval * s.ease);
  } else {
    interval = s.reps === 0 ? SM2.firstEasy : clampDays(s.interval * s.ease * SM2.easyBonus);
    ease += 0.15;
  }
  interval = clampDays(interval);
  return {
    reps: s.reps + 1,
    interval,
    ease: clampEase(ease),
    due: now + interval * DAY_MS,
    lapses: s.lapses,
  };
}

export const isDue = (s: ReviewState | undefined, now: number) => !s || s.due <= now;

/** Next interval a grade would give, for the button captions («1 өдөр», «3 өдөр»…). */
export function preview(s: ReviewState, now: number): Record<Grade, number> {
  return Object.fromEntries(GRADES.map((g) => [g, review(s, g, now).interval])) as Record<Grade, number>;
}

/** The old Leitner boxes (features/cards/lib/leitner.ts: 0–4) carried over to SM-2. */
export function fromLeitner(box: number, due: number): ReviewState {
  const days = [0, 1, 3, 7, 14][Math.max(0, Math.min(4, box))];
  return { reps: Math.max(0, box), interval: days, ease: SM2.startEase, due, lapses: 0 };
}

// «Өдрийн сорил»: the same 5 questions for every student on a day, picked from the date. Questions are
// served one at a time and the server's clock times each answer (served → answered). Pure (daily.test.ts).
import { isCorrect } from '@/features/roadmap/lib/grade';
import { seeded } from '@/features/roadmap/lib/select-problems';
import type { Domain, Question } from '@/types';

export const DAILY = {
  size: 5,
  /** One question per domain, then a fifth from any domain; difficulties in this order. */
  domains: ['alg', 'adv', 'psda', 'geo'] as Domain[],
  difficulties: [1, 2, 2, 3, 3] as (1 | 2 | 3)[],
  perQuestionMs: 3 * 60_000,
  graceMs: 5_000,
  points: 100,
  /** Up to this bonus per correct answer for speed: full under fastMs, nothing past perQuestionMs. */
  speedBonus: 50,
  fastMs: 30_000,
  minMsPerAnswer: 3_000,
};

export type DailyAnswer = { qid: string; answer: string; correct: boolean; timeMs: number };
export type DailyAttempt = {
  day: string;
  ids: string[];
  answers: DailyAnswer[];
  /** When the current question was served (server clock), ISO. */
  servedAt: string;
  startedAt: string;
  finishedAt: string | null;
  correct: number;
  score: number;
  timeMs: number;
  flagged: boolean;
};

/** Deterministic number from a YYYY-MM-DD string (same seed for everyone that day). */
export function daySeed(day: string): number {
  let h = 2166136261;
  for (const ch of day) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function dailyIds(day: string, pool: readonly Question[]): string[] {
  const rng = seeded(daySeed(day));
  const picked: string[] = [];
  const pickFrom = (domain: Domain | null, difficulty: 1 | 2 | 3) => {
    const candidates = pool.filter(
      (q) => (!domain || q.domain === domain) && q.difficulty === difficulty && !picked.includes(q.id),
    );
    const list = candidates.length ? candidates : pool.filter((q) => !picked.includes(q.id));
    picked.push(list[Math.floor(rng() * list.length)].id);
  };
  const order = [...DAILY.domains].sort(() => rng() - 0.5);
  for (const [i, d] of DAILY.difficulties.entries()) pickFrom(order[i] ?? null, d);
  return picked;
}

export function pointsFor(correct: boolean, timeMs: number): number {
  if (!correct) return 0;
  const { fastMs, perQuestionMs, speedBonus, points } = DAILY;
  const f = timeMs <= fastMs ? 1 : Math.max(0, 1 - (timeMs - fastMs) / (perQuestionMs - fastMs));
  return points + Math.round(speedBonus * f);
}

export function startDaily(day: string, pool: readonly Question[], now: number): DailyAttempt {
  const at = new Date(now).toISOString();
  return {
    day,
    ids: dailyIds(day, pool),
    answers: [],
    servedAt: at,
    startedAt: at,
    finishedAt: null,
    correct: 0,
    score: 0,
    timeMs: 0,
    flagged: false,
  };
}

/** Grades the current question at server time `now`; a late answer counts as wrong. */
export function answerDaily(
  a: DailyAttempt,
  answer: string,
  bank: ReadonlyMap<string, Question>,
  now: number,
): { attempt: DailyAttempt; last: DailyAnswer } | { error: 'finished' } {
  if (a.finishedAt || a.answers.length >= a.ids.length) return { error: 'finished' };
  const qid = a.ids[a.answers.length];
  const q = bank.get(qid);
  const timeMs = Math.max(0, now - Date.parse(a.servedAt));
  const late = timeMs > DAILY.perQuestionMs + DAILY.graceMs;
  const correct = Boolean(q && !late && answer && isCorrect(q, answer.slice(0, 40)));
  const last: DailyAnswer = {
    qid,
    answer: answer.slice(0, 40),
    correct,
    timeMs: Math.min(timeMs, DAILY.perQuestionMs),
  };
  const answers = [...a.answers, last];
  const done = answers.length >= a.ids.length;
  const times = answers.map((x) => x.timeMs).sort((x, y) => x - y);
  return {
    last,
    attempt: {
      ...a,
      answers,
      servedAt: new Date(now).toISOString(),
      finishedAt: done ? new Date(now).toISOString() : null,
      correct: answers.filter((x) => x.correct).length,
      score: answers.reduce((s, x) => s + pointsFor(x.correct, x.timeMs), 0),
      timeMs: answers.reduce((s, x) => s + x.timeMs, 0),
      flagged: done && times[Math.floor(times.length / 2)] < DAILY.minMsPerAnswer,
    },
  };
}

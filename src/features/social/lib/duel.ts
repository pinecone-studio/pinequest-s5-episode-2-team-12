// 1-v-1 duels, asynchronous (v1): both students get the same questions in the same order under the same
// time limit; results show when both have finished or the 24 hours run out. Questions are served one at a
// time and timed by the server. A live (Realtime) mode can reuse this: `mode` is stored per duel.
// Pure (social.test.ts).
import { isCorrect } from '@/features/roadmap/lib/grade';
import { seeded } from '@/features/roadmap/lib/select-problems';
import type { Question } from '@/types';

export const DUEL = {
  sizes: [5, 10] as const,
  msPerQuestion: 90_000,
  graceMs: 5_000,
  openMs: 24 * 3_600_000,
  minMsPerAnswer: 3_000,
};

export type DuelSize = (typeof DUEL.sizes)[number];
export type Duel = {
  id: string;
  challenger: string;
  opponent: string;
  /** Roadmap topic 1–26, or null for a mixed set. */
  topicId: number | null;
  size: DuelSize;
  ids: string[];
  timeLimitMs: number;
  createdAt: string;
  expiresAt: string;
  mode: 'async' | 'live';
};
export type RunAnswer = { qid: string; answer: string; correct: boolean; timeMs: number };
export type Run = {
  userId: string;
  startedAt: string;
  servedAt: string;
  answers: RunAnswer[];
  finishedAt: string | null;
  correct: number;
  timeMs: number;
  flagged: boolean;
};

const iso = (ms: number) => new Date(ms).toISOString();

/** The frozen question list: mixed duels balance difficulty; topic duels draw only that topic. */
export function pickDuelQuestions(
  pool: readonly Question[],
  topicId: number | null,
  size: DuelSize,
  seed: number,
): string[] {
  const rng = seeded(seed);
  const from = topicId ? pool.filter((q) => q.topicId === topicId) : pool;
  const shuffled = [...from].sort(() => rng() - 0.5);
  const pick: Question[] = [];
  for (const d of [1, 2, 3, 2, 3, 1, 2, 3, 2, 3] as const) {
    if (pick.length >= size) break;
    const q =
      shuffled.find((x) => x.difficulty === d && !pick.includes(x)) ??
      shuffled.find((x) => !pick.includes(x));
    if (q) pick.push(q);
  }
  return pick.map((q) => q.id);
}

export function createDuel(input: {
  id: string;
  challenger: string;
  opponent: string;
  topicId: number | null;
  size: DuelSize;
  pool: readonly Question[];
  now: number;
  seed?: number;
}): Duel {
  return {
    id: input.id,
    challenger: input.challenger,
    opponent: input.opponent,
    topicId: input.topicId,
    size: input.size,
    ids: pickDuelQuestions(input.pool, input.topicId, input.size, input.seed ?? input.now),
    timeLimitMs: input.size * DUEL.msPerQuestion,
    createdAt: iso(input.now),
    expiresAt: iso(input.now + DUEL.openMs),
    mode: 'async',
  };
}

export function startRun(userId: string, now: number): Run {
  return {
    userId,
    startedAt: iso(now),
    servedAt: iso(now),
    answers: [],
    finishedAt: null,
    correct: 0,
    timeMs: 0,
    flagged: false,
  };
}

/** Grades the current question at server time; after the duel's total time limit nothing more counts. */
export function answerRun(
  duel: Duel,
  run: Run,
  answer: string,
  bank: ReadonlyMap<string, Question>,
  now: number,
): { run: Run; last: RunAnswer } | { error: 'finished' | 'expired' } {
  if (run.finishedAt) return { error: 'finished' };
  if (now > Date.parse(duel.expiresAt)) return { error: 'expired' };
  const qid = duel.ids[run.answers.length];
  const q = bank.get(qid);
  const overTime = now - Date.parse(run.startedAt) > duel.timeLimitMs + DUEL.graceMs;
  const timeMs = Math.max(0, now - Date.parse(run.servedAt));
  const correct = Boolean(q && !overTime && answer && isCorrect(q, answer.slice(0, 40)));
  const last: RunAnswer = { qid, answer: answer.slice(0, 40), correct, timeMs };
  const answers = [...run.answers, last];
  const done = answers.length >= duel.ids.length || overTime;
  const sorted = answers.map((a) => a.timeMs).sort((a, b) => a - b);
  return {
    last,
    run: {
      ...run,
      answers,
      servedAt: iso(now),
      finishedAt: done ? iso(now) : null,
      correct: answers.filter((a) => a.correct).length,
      timeMs: Math.min(
        duel.timeLimitMs,
        answers.reduce((s, a) => s + a.timeMs, 0),
      ),
      flagged: done && answers.length >= 3 && sorted[Math.floor(sorted.length / 2)] < DUEL.minMsPerAnswer,
    },
  };
}

export type DuelOutcome = {
  status: 'open' | 'waiting' | 'done' | 'expired';
  /** Results are shown only when both finished, or after expiry. */
  reveal: boolean;
  winner: string | 'draw' | null;
  /** Won because the other side never finished or was flagged. */
  forfeit: boolean;
};

/** Who won: more correct, then less total time. Flagged runs and unfinished runs (after expiry) lose. */
export function duelOutcome(duel: Duel, a: Run | null, b: Run | null, now: number): DuelOutcome {
  const runs = [a, b].filter((r): r is Run => r !== null);
  const finished = runs.filter((r) => r.finishedAt);
  const expired = now > Date.parse(duel.expiresAt);
  if (!expired && finished.length < 2)
    return { status: runs.length ? 'waiting' : 'open', reveal: false, winner: null, forfeit: false };
  const valid = finished.filter((r) => !r.flagged);
  if (valid.length === 0)
    return { status: expired ? 'expired' : 'done', reveal: true, winner: null, forfeit: false };
  if (valid.length === 1)
    return { status: expired ? 'expired' : 'done', reveal: true, winner: valid[0].userId, forfeit: true };
  const [x, y] = valid;
  const winner =
    x.correct !== y.correct
      ? x.correct > y.correct
        ? x.userId
        : y.userId
      : x.timeMs !== y.timeMs
        ? x.timeMs < y.timeMs
          ? x.userId
          : y.userId
        : 'draw';
  return { status: 'done', reveal: true, winner, forfeit: false };
}

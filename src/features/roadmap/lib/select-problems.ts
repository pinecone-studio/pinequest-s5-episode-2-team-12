// selectProblems: which questions a stop serves. Pure and deterministic for a given rng.
//  - set length from the topic's mastery (weak 10 · ok 8 · strong 6), or 3 hard for a test-out
//  - difficulty split from the overall level's mix (largest remainder rounding)
//  - prefers questions the student has not seen, then ones they got wrong (missedWeight), then the rest
//  - when a difficulty runs short it borrows from the neighbouring one; repeats only as a last resort
import { DIFFICULTY_OF, ROADMAP } from '../config';
import type { Difficulty, Mastery, PlacementLevel, ProblemAttempt } from '../types';

export type QuestionMeta = { id: string; topicId: number; difficulty: 1 | 2 | 3 };
export type Rng = () => number;

/** Small seeded PRNG (mulberry32) so tests and retries are reproducible. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ORDER: Difficulty[] = ['easy', 'medium', 'hard'];
const NEIGHBOURS: Record<Difficulty, Difficulty[]> = {
  easy: ['medium', 'hard'],
  medium: ['easy', 'hard'],
  hard: ['medium', 'easy'],
};

/** Split `n` by shares with largest-remainder rounding; ties go to the harder difficulty last. */
export function splitCounts(n: number, mix: Record<Difficulty, number>): Record<Difficulty, number> {
  const exact = ORDER.map((d) => mix[d] * n);
  const counts = exact.map(Math.floor);
  let left = n - counts.reduce((a, b) => a + b, 0);
  const byRemainder = ORDER.map((_, i) => i).sort(
    (a, b) => exact[b] - counts[b] - (exact[a] - counts[a]) || a - b,
  );
  for (const i of byRemainder) {
    if (left <= 0) break;
    counts[i]++;
    left--;
  }
  return { easy: counts[0], medium: counts[1], hard: counts[2] };
}

function weightOf(id: string, history: Map<string, { seen: number; lastCorrect: boolean }>): number {
  const h = history.get(id);
  if (!h) return 4;
  return h.lastCorrect ? 1 : ROADMAP.missedWeight;
}

/** Weighted sampling without replacement. */
function draw(cands: QuestionMeta[], k: number, w: (q: QuestionMeta) => number, rng: Rng): QuestionMeta[] {
  const pool = [...cands];
  const out: QuestionMeta[] = [];
  while (out.length < k && pool.length) {
    const total = pool.reduce((s, q) => s + w(q), 0);
    let r = rng() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) {
      r -= w(pool[i]);
      if (r < 0) break;
    }
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

export type SelectInput = {
  topicId: number;
  level: PlacementLevel;
  mastery: Mastery;
  /** All servable stop questions (any topic; filtered here). */
  pool: readonly QuestionMeta[];
  history: readonly ProblemAttempt[];
  rng?: Rng;
  testOut?: boolean;
};

export function setLengthFor(mastery: Mastery, testOut = false): number {
  return testOut ? ROADMAP.testOut.count : ROADMAP.setLength[mastery];
}

export function selectProblems({
  topicId,
  level,
  mastery,
  pool,
  history,
  rng = Math.random,
  testOut = false,
}: SelectInput): string[] {
  const topic = pool.filter((q) => q.topicId === topicId);
  if (!topic.length) return [];
  const n = setLengthFor(mastery, testOut);
  const want: Record<Difficulty, number> = testOut
    ? { easy: 0, medium: 0, hard: 0, [ROADMAP.testOut.difficulty]: n }
    : splitCounts(n, ROADMAP.mix[level]);

  const hist = new Map<string, { seen: number; lastCorrect: boolean }>();
  for (const a of [...history].sort((x, y) => x.at - y.at)) {
    if (a.topicId !== topicId) continue;
    hist.set(a.qid, { seen: (hist.get(a.qid)?.seen ?? 0) + 1, lastCorrect: a.correct });
  }
  const w = (q: QuestionMeta) => weightOf(q.id, hist);
  const byDiff = (d: Difficulty) => topic.filter((q) => DIFFICULTY_OF[q.difficulty] === d);

  const picked: QuestionMeta[] = [];
  const taken = new Set<string>();
  const take = (qs: QuestionMeta[]) => {
    for (const q of qs) {
      picked.push(q);
      taken.add(q.id);
    }
  };

  const shortage: { d: Difficulty; k: number }[] = [];
  for (const d of ORDER) {
    const got = draw(byDiff(d), want[d], w, rng);
    take(got);
    if (got.length < want[d]) shortage.push({ d, k: want[d] - got.length });
  }
  // borrow from the neighbouring difficulty
  for (const { d, k } of shortage) {
    let need = k;
    for (const nd of NEIGHBOURS[d]) {
      if (!need) break;
      const got = draw(
        byDiff(nd).filter((q) => !taken.has(q.id)),
        need,
        w,
        rng,
      );
      take(got);
      need -= got.length;
    }
  }
  // last resort: repeat questions of this topic (small seed pools)
  while (picked.length < n) {
    const preferred = testOut ? byDiff(ROADMAP.testOut.difficulty) : topic;
    const src = preferred.length ? preferred : topic;
    take(draw(src, 1, w, rng));
  }

  // easy → hard, like an SAT module
  return picked
    .map((q, i) => ({ q, i }))
    .sort((a, b) => a.q.difficulty - b.q.difficulty || a.i - b.i)
    .map(({ q }) => q.id);
}

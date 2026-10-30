// The mock exam engine: building modules, grading, the adaptive route, the score estimate and comparing two
// attempts. Pure functions shared by the server actions and the demo (localStorage) path. Tests: mock.test.ts.
import { isCorrect } from '@/features/roadmap/lib/grade';
import { type Rng, splitCounts } from '@/features/roadmap/lib/select-problems';
import type { Domain, Question } from '@/types';
import { DOMAINS, MOCK } from '../config';

export type Route = 'hard' | 'easy';

export type MockAnswer = { qid: string; answer: string; correct: boolean; timeMs: number };
export type MockModule = {
  no: 1 | 2;
  ids: string[];
  answers: MockAnswer[];
  startedAt: string;
  endsAt: string;
  submittedAt: string | null;
};
export type DomainScore = { correct: number; total: number };
export type MockAttempt = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  route: Route | null;
  modules: MockModule[];
  /** Estimated 200–800 («тооцоолсон оноо»), set when finished. */
  score: number | null;
  raw: { correct: number; total: number };
  domains: Record<Domain, DomainScore>;
  /** Seconds actually spent on the two modules. */
  timeUsedSec: number;
  /** Impossible timing (answers faster than a person can read); hidden from leaderboards. */
  flagged: boolean;
  /** Group mock session: a fixed form and a clock everyone shares (no adaptive module 2). */
  groupId?: string;
  /** Fixed practice test (forms.ts): module 1 and both module 2s are prepared, the route still adapts. */
  formId?: string;
};

/** What the browser gets during the exam: no answer, explanation, hint or Desmos solution. */
export type PublicQuestion = Pick<
  Question,
  'id' | 'domain' | 'prompt' | 'mn' | 'choices' | 'format' | 'figure'
>;

export function toPublic(q: Question): PublicQuestion {
  return {
    id: q.id,
    domain: q.domain,
    prompt: q.prompt,
    mn: q.mn,
    choices: q.choices,
    format: q.format ?? (q.choices ? 'mcq' : 'spr'),
    figure: q.figure,
  };
}

const DIFF = { easy: 1, medium: 2, hard: 3 } as const;

function shuffle<T>(xs: readonly T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Picks one module: `MOCK.domainCounts` per domain, split by the difficulty mix, preferring questions not in
 * `seen` (earlier attempts) and never repeating one in `exclude` (this attempt). When a difficulty runs short
 * it borrows from the others; seen questions are used only once unseen ones run out.
 * Questions come out grouped easy → hard within each domain, domains interleaved, like a real module.
 */
export function buildModule({
  pool,
  mix,
  exclude = new Set(),
  seen = new Set(),
  rng,
}: {
  pool: readonly Question[];
  mix: { easy: number; medium: number; hard: number };
  exclude?: ReadonlySet<string>;
  seen?: ReadonlySet<string>;
  rng: Rng;
}): string[] {
  const picked: Question[] = [];
  for (const domain of DOMAINS) {
    const want = splitCounts(MOCK.domainCounts[domain], mix);
    const candidates = pool.filter((q) => q.domain === domain && !exclude.has(q.id));
    const ordered = (d: 1 | 2 | 3) => {
      const of = candidates.filter((q) => q.difficulty === d);
      return [
        ...shuffle(
          of.filter((q) => !seen.has(q.id)),
          rng,
        ),
        ...shuffle(
          of.filter((q) => seen.has(q.id)),
          rng,
        ),
      ];
    };
    const byDiff = { 1: ordered(1), 2: ordered(2), 3: ordered(3) };
    const taken: Question[] = [];
    let short = 0;
    for (const key of ['easy', 'medium', 'hard'] as const) {
      const list = byDiff[DIFF[key]];
      const n = Math.min(want[key], list.length);
      taken.push(...list.splice(0, n));
      short += want[key] - n;
    }
    // borrow from whatever is left, unseen first
    if (short > 0) {
      const rest = [...byDiff[2], ...byDiff[1], ...byDiff[3]].sort(
        (a, b) => Number(seen.has(a.id)) - Number(seen.has(b.id)),
      );
      taken.push(...rest.slice(0, short));
    }
    picked.push(...taken.sort((a, b) => a.difficulty - b.difficulty));
  }
  // interleave domains so a module does not start with eight algebra items in a row
  const lanes = DOMAINS.map((d) => picked.filter((q) => q.domain === d));
  const out: string[] = [];
  for (let i = 0; out.length < picked.length; i++)
    for (const lane of lanes) if (lane[i]) out.push(lane[i].id);
  return out;
}

export function routeFor(module1Correct: number): Route {
  return module1Correct >= MOCK.hardRouteAt ? 'hard' : 'easy';
}

/** Grades the submitted answers of one module against the bank; unanswered questions count as wrong. */
export function gradeModule(
  ids: readonly string[],
  submitted: readonly { qid: string; answer: string; timeMs: number }[],
  bank: ReadonlyMap<string, Question>,
): MockAnswer[] {
  const by = new Map(submitted.map((a) => [a.qid, a]));
  return ids.map((qid) => {
    const a = by.get(qid);
    const q = bank.get(qid);
    const answer = (a?.answer ?? '').slice(0, 40);
    return {
      qid,
      answer,
      correct: Boolean(q && answer && isCorrect(q, answer)),
      timeMs: Math.max(0, Math.min(MOCK.moduleMinutes * 60_000, Math.round(a?.timeMs ?? 0))),
    };
  });
}

/** Expected points of a full-marks reference form: module 1 plus the hard route. */
function referencePoints(): number {
  const per = (mix: { easy: number; medium: number; hard: number }) =>
    DOMAINS.reduce((sum, d) => {
      const c = splitCounts(MOCK.domainCounts[d], mix);
      return sum + c.easy * MOCK.weights[1] + c.medium * MOCK.weights[2] + c.hard * MOCK.weights[3];
    }, 0);
  return per(MOCK.mix.module1) + per(MOCK.mix.hard);
}

/** Estimated score 200–800 from difficulty-weighted points (see MOCK.scale). */
export function estimateScore(answers: readonly MockAnswer[], bank: ReadonlyMap<string, Question>): number {
  const points = answers.reduce(
    (s, a) => s + (a.correct ? MOCK.weights[bank.get(a.qid)?.difficulty ?? 2] : 0),
    0,
  );
  const { min, max, round } = MOCK.scale;
  const raw = min + ((max - min) * points) / referencePoints();
  return Math.max(min, Math.min(max, Math.round(raw / round) * round));
}

export function domainScores(
  answers: readonly MockAnswer[],
  bank: ReadonlyMap<string, Question>,
): Record<Domain, DomainScore> {
  const out = Object.fromEntries(DOMAINS.map((d) => [d, { correct: 0, total: 0 }])) as Record<
    Domain,
    DomainScore
  >;
  for (const a of answers) {
    const d = bank.get(a.qid)?.domain;
    if (!d) continue;
    out[d].total++;
    if (a.correct) out[d].correct++;
  }
  return out;
}

/** True when the answers came in faster than anyone can read the questions. */
export function looksImpossible(answers: readonly MockAnswer[]): boolean {
  const answered = answers.filter((a) => a.answer);
  if (answered.length < 5) return false;
  const times = answered.map((a) => a.timeMs).sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  return median < MOCK.minMsPerAnswer;
}

/** Fills the totals of a finished attempt. */
export function finishAttempt(a: MockAttempt, bank: ReadonlyMap<string, Question>, at: string): MockAttempt {
  const answers = a.modules.flatMap((m) => m.answers);
  const timeUsedSec = Math.round(
    a.modules.reduce((s, m) => {
      const end = m.submittedAt ? Date.parse(m.submittedAt) : Date.parse(m.endsAt);
      return s + Math.max(0, Math.min(end, Date.parse(m.endsAt)) - Date.parse(m.startedAt));
    }, 0) / 1000,
  );
  return {
    ...a,
    finishedAt: at,
    score: estimateScore(answers, bank),
    raw: { correct: answers.filter((x) => x.correct).length, total: answers.length },
    domains: domainScores(answers, bank),
    timeUsedSec,
    flagged: looksImpossible(answers),
  };
}

export type TopicChange = { topicId: number; before: number; after: number };
export type Comparison = {
  scoreDelta: number;
  domainDeltas: Record<Domain, number>;
  improved: TopicChange[];
  worse: TopicChange[];
};

/** Share correct per roadmap topic in an attempt (topics with fewer than `min` questions are skipped). */
export type TopicOf = (qid: string) => number | undefined;

export function topicShares(
  a: MockAttempt,
  topicOf: TopicOf,
  min = 1,
): Map<number, { correct: number; total: number }> {
  const m = new Map<number, { correct: number; total: number }>();
  for (const x of a.modules.flatMap((mod) => mod.answers)) {
    const t = topicOf(x.qid);
    if (!t) continue;
    const cur = m.get(t) ?? { correct: 0, total: 0 };
    cur.total++;
    if (x.correct) cur.correct++;
    m.set(t, cur);
  }
  for (const [k, v] of m) if (v.total < min) m.delete(k);
  return m;
}

const share = (d: DomainScore) => (d.total ? d.correct / d.total : 0);

/**
 * `current` compared with an earlier `previous` attempt: score delta, per-domain share delta (−1..1), and
 * topics that moved by at least `threshold` (both attempts must have the topic).
 */
export function compareAttempts(
  current: MockAttempt,
  previous: MockAttempt,
  topicOf: TopicOf,
  threshold = 0.25,
): Comparison {
  const domainDeltas = Object.fromEntries(
    DOMAINS.map((d) => [d, Math.round((share(current.domains[d]) - share(previous.domains[d])) * 100) / 100]),
  ) as Record<Domain, number>;
  const now = topicShares(current, topicOf);
  const before = topicShares(previous, topicOf);
  const changes: TopicChange[] = [];
  for (const [topicId, n] of now) {
    const b = before.get(topicId);
    if (!b) continue;
    changes.push({ topicId, before: b.correct / b.total, after: n.correct / n.total });
  }
  const delta = (c: TopicChange) => c.after - c.before;
  return {
    scoreDelta: (current.score ?? 0) - (previous.score ?? 0),
    domainDeltas,
    improved: changes.filter((c) => delta(c) >= threshold).sort((a, b) => delta(b) - delta(a)),
    worse: changes.filter((c) => delta(c) <= -threshold).sort((a, b) => delta(a) - delta(b)),
  };
}

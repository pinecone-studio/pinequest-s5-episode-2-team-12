// The mock exam as steps on a MockAttempt: start → submit module 1 (route + module 2) → begin module 2 →
// submit module 2 (finish). Server-only (it reads answers from the bank); used by actions.ts for both the
// signed-in path (attempt stored on the exams row) and demo mode (the browser keeps the attempt).

import { ROADMAP } from '@/features/roadmap/config';
import { placementPool, stopPool } from '@/features/roadmap/content/bank';
import { type Rng, seeded } from '@/features/roadmap/lib/select-problems';
import type { Domain, Question } from '@/types';
import { DOMAINS, MOCK } from './config';
import {
  buildModule,
  finishAttempt,
  gradeModule,
  type MockAttempt,
  type MockModule,
  type PublicQuestion,
  routeFor,
  toPublic,
} from './lib/mock';

let cached: { pool: Question[]; bank: Map<string, Question> } | null = null;

/** Every servable question (review gate as in the roadmap), by id. */
export function mockBank() {
  if (!cached) {
    const pool = [...stopPool(undefined, ROADMAP.allowUnreviewed), ...placementPool(ROADMAP.allowUnreviewed)];
    cached = { pool, bank: new Map(pool.map((q) => [q.id, q])) };
  }
  return cached;
}

const iso = (ms: number) => new Date(ms).toISOString();
const emptyDomains = () =>
  Object.fromEntries(DOMAINS.map((d) => [d, { correct: 0, total: 0 }])) as Record<
    Domain,
    { correct: number; total: number }
  >;

export function publicQuestions(ids: readonly string[]): PublicQuestion[] {
  const { bank } = mockBank();
  return ids
    .map((id) => bank.get(id))
    .filter((q): q is Question => Boolean(q))
    .map(toPublic);
}

export function startAttempt(
  id: string,
  seen: ReadonlySet<string>,
  now: number,
  rng: Rng = seeded(now),
): MockAttempt {
  const { pool } = mockBank();
  const ids = buildModule({ pool, mix: MOCK.mix.module1, seen, rng });
  const module1: MockModule = {
    no: 1,
    ids,
    answers: [],
    startedAt: iso(now),
    endsAt: iso(now + MOCK.moduleMinutes * 60_000),
    submittedAt: null,
  };
  return {
    id,
    startedAt: iso(now),
    finishedAt: null,
    route: null,
    modules: [module1],
    score: null,
    raw: { correct: 0, total: 0 },
    domains: emptyDomains(),
    timeUsedSec: 0,
    flagged: false,
  };
}

export type Submitted = { qid: string; answer: string; timeMs: number }[];
export type StepError = 'wrong_module' | 'finished' | 'late';

/**
 * Grades module `no`. Answers that arrive later than the deadline plus MOCK.graceMs are discarded (the
 * module closes with what the server already had: nothing). Module 1 also picks the route and module 2's
 * questions (not started yet: its clock begins in `beginModule2`).
 */
export function submitModule(
  a: MockAttempt,
  no: 1 | 2,
  submitted: Submitted,
  now: number,
  seen: ReadonlySet<string> = new Set(),
  rng: Rng = seeded(now + 1),
): { attempt: MockAttempt; late: boolean } | { error: StepError } {
  if (a.finishedAt) return { error: 'finished' };
  const mod = a.modules.find((m) => m.no === no);
  if (!mod || mod.submittedAt) return { error: 'wrong_module' };
  if (no === 2 && !a.modules[0].submittedAt) return { error: 'wrong_module' };
  const { pool, bank } = mockBank();
  const late = now > Date.parse(mod.endsAt) + MOCK.graceMs;
  const graded: MockModule = {
    ...mod,
    answers: gradeModule(mod.ids, late ? [] : submitted, bank),
    submittedAt: iso(Math.min(now, Date.parse(mod.endsAt))),
  };
  let next: MockAttempt = { ...a, modules: a.modules.map((m) => (m.no === no ? graded : m)) };
  if (no === 1) {
    const route = routeFor(graded.answers.filter((x) => x.correct).length);
    const ids = buildModule({ pool, mix: MOCK.mix[route], exclude: new Set(mod.ids), seen, rng });
    next = {
      ...next,
      route,
      modules: [
        graded,
        // placeholder clock; beginModule2 sets the real one when the break ends
        {
          no: 2,
          ids,
          answers: [],
          startedAt: graded.submittedAt!,
          endsAt: graded.submittedAt!,
          submittedAt: null,
        },
      ],
    };
  } else {
    next = finishAttempt(next, bank, iso(now));
  }
  return { attempt: next, late };
}

/** Starts module 2's clock (after the break, which may be cut short but not extended past MOCK.breakMinutes). */
export function beginModule2(a: MockAttempt, now: number): { attempt: MockAttempt } | { error: StepError } {
  const [m1, m2] = a.modules;
  if (!m1?.submittedAt || !m2 || m2.submittedAt) return { error: 'wrong_module' };
  if (Date.parse(m2.endsAt) > Date.parse(m2.startedAt)) return { attempt: a }; // already begun
  const breakEnd = Date.parse(m1.submittedAt) + MOCK.breakMinutes * 60_000;
  const start = Math.min(now, breakEnd);
  return {
    attempt: {
      ...a,
      modules: [m1, { ...m2, startedAt: iso(start), endsAt: iso(start + MOCK.moduleMinutes * 60_000) }],
    },
  };
}

/** Question ids a student has already met in finished attempts (to prefer fresh ones next time). */
export function seenIds(attempts: readonly MockAttempt[]): Set<string> {
  return new Set(attempts.flatMap((a) => a.modules.flatMap((m) => m.ids)));
}

// Adaptive practice: an Elo rating per SAT domain, like chess ratings. Every answer moves the student's rating
// toward their real level; the next question is the one they get right with about TARGET probability — hard
// enough to learn from, easy enough not to give up. Weak domains are chosen more often.
import type { Domain, Question } from '@/types';

export const START_RATING = 1400;
/** Question rating from its difficulty (1 easy, 2 medium, 3 hard). */
export const QUESTION_RATING: Record<1 | 2 | 3, number> = { 1: 1200, 2: 1450, 3: 1700 };
/** Chance of a right answer the picker aims for. */
export const TARGET = 0.7;

export type Rating = { r: number; n: number };
export type Ratings = Partial<Record<Domain, Rating>>;

export const DOMAINS: readonly Domain[] = ['alg', 'adv', 'psda', 'geo'];
export const DOMAIN_NAMES: Record<Domain, string> = {
  alg: 'Алгебр',
  adv: 'Ахисан математик',
  psda: 'Өгөгдөл, магадлал',
  geo: 'Геометр, тригонометр',
};

export const ratingOf = (ratings: Ratings, d: Domain): Rating => ratings[d] ?? { r: START_RATING, n: 0 };

/** Probability that a student rated `student` answers a question rated `question` correctly. */
export function expected(student: number, question: number): number {
  return 1 / (1 + 10 ** ((question - student) / 400));
}

/** Big steps while the rating is new (first answers say a lot), smaller once it has settled. */
export const kFactor = (n: number) => (n < 5 ? 64 : n < 20 ? 40 : 24);

/** The ratings after one answer. Only the question's domain changes. */
export function update(
  ratings: Ratings,
  q: Pick<Question, 'domain' | 'difficulty'>,
  correct: boolean,
): Ratings {
  const cur = ratingOf(ratings, q.domain);
  const e = expected(cur.r, QUESTION_RATING[q.difficulty]);
  const r = Math.round(cur.r + kFactor(cur.n) * ((correct ? 1 : 0) - e));
  return { ...ratings, [q.domain]: { r: Math.max(600, Math.min(2400, r)), n: cur.n + 1 } };
}

/**
 * The next question: not yet seen in this session, from a weak domain more often, at the difficulty whose
 * expected success is closest to TARGET. `rng` only breaks ties, so the order is not the same every time.
 */
export function pickNext(
  pool: Question[],
  ratings: Ratings,
  seen: ReadonlySet<string>,
  rng: () => number = Math.random,
): Question | null {
  const fresh = pool.filter((q) => !seen.has(q.id));
  if (!fresh.length) return null;
  const present = DOMAINS.filter((d) => fresh.some((q) => q.domain === d));
  // weakest domain gets the most weight: weight ∝ how far below the best rating it is (+ a floor)
  const best = Math.max(...present.map((d) => ratingOf(ratings, d).r));
  const weights = present.map((d) => 100 + (best - ratingOf(ratings, d).r));
  let x = rng() * weights.reduce((s, w) => s + w, 0);
  let domain = present[0] as Domain;
  for (const [i, d] of present.entries()) {
    x -= weights[i] as number;
    if (x <= 0) {
      domain = d;
      break;
    }
  }
  const r = ratingOf(ratings, domain).r;
  const inDomain = fresh.filter((q) => q.domain === domain);
  const gap = (q: Question) => Math.abs(expected(r, QUESTION_RATING[q.difficulty]) - TARGET);
  const bestGap = Math.min(...inDomain.map(gap));
  const closest = inDomain.filter((q) => gap(q) - bestGap < 1e-9);
  return closest[Math.floor(rng() * closest.length)] ?? null;
}

/** A rough SAT Math section score (200–800) from the ratings — a motivation number, not a prediction. */
export function satEstimate(ratings: Ratings): number | null {
  const rated = DOMAINS.map((d) => ratings[d]).filter((x): x is Rating => !!x && x.n >= 3);
  if (rated.length < 2) return null;
  const avg = rated.reduce((s, x) => s + x.r, 0) / rated.length;
  const score = 200 + ((avg - 900) / (1900 - 900)) * 600;
  return Math.round(Math.max(200, Math.min(800, score)) / 10) * 10;
}

const KEY = 'suuprep.elo.v1';

/** Ratings saved in this browser. Storage can be blocked (private mode): then ratings just start fresh. */
export function loadRatings(): Ratings {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Ratings) : {};
    const out: Ratings = {};
    for (const d of DOMAINS) {
      const v = parsed[d];
      if (v && Number.isFinite(v.r) && Number.isFinite(v.n)) out[d] = { r: v.r, n: v.n };
    }
    return out;
  } catch {
    return {};
  }
}

export function saveRatings(ratings: Ratings): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(ratings));
  } catch {
    // storage full or blocked: ratings live for this session only
  }
}

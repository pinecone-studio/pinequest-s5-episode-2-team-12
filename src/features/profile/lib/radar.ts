// Skill radar: strengths and weaknesses from every answered problem (roadmap stops, placement, mocks).
// 8 axes = clusters of the 26 roadmap topics (each cluster inside one SAT domain, so the 4-domain view is a
// clean roll-up). Recent answers count more (half-life), harder ones a little more, and a Beta(1, 1) prior
// keeps one lucky answer from reading as 100%. Pure (radar.test.ts).
import type { Domain } from '@/types';

export type Cluster = { id: string; domain: Domain; topics: number[] };

export const CLUSTERS: Cluster[] = [
  { id: 'linEq', domain: 'alg', topics: [1, 2, 6] },
  { id: 'linFn', domain: 'alg', topics: [3, 4, 5] },
  { id: 'ratio', domain: 'psda', topics: [7, 8, 9] },
  { id: 'data', domain: 'psda', topics: [10, 11, 12] },
  { id: 'stats', domain: 'psda', topics: [13, 14] },
  { id: 'expr', domain: 'adv', topics: [15, 16, 17, 18] },
  { id: 'nonlin', domain: 'adv', topics: [19, 20, 21] },
  { id: 'geo', domain: 'geo', topics: [22, 23, 24, 25, 26] },
];
export const DOMAIN_AXES: Domain[] = ['alg', 'adv', 'psda', 'geo'];

/** One answer, already resolved to its topic and difficulty. */
export type Answered = { topicId: number; difficulty: 1 | 2 | 3; correct: boolean; at: number };

export const RADAR = {
  halfLifeDays: 14,
  difficultyWeight: { 1: 1, 2: 1.5, 3: 2 } as Record<1 | 2 | 3, number>,
  /** Fewer answers than this on an axis → "not enough data" (no value drawn). */
  minAnswers: 3,
};

export type Axis = { id: string; value: number | null; n: number };

function score(items: readonly Answered[], now: number): Axis['value'] {
  let num = 1;
  let den = 2;
  for (const a of items) {
    const age = Math.max(0, now - a.at) / 86_400_000;
    const w = 0.5 ** (age / RADAR.halfLifeDays) * RADAR.difficultyWeight[a.difficulty];
    den += w;
    if (a.correct) num += w;
  }
  return Math.round((num / den) * 100) / 100;
}

function axes(groups: { id: string; topics: number[] }[], answers: readonly Answered[], now: number): Axis[] {
  return groups.map((g) => {
    const items = answers.filter((a) => g.topics.includes(a.topicId));
    return { id: g.id, n: items.length, value: items.length >= RADAR.minAnswers ? score(items, now) : null };
  });
}

/** 8 skill clusters. */
export function clusterRadar(answers: readonly Answered[], now = Date.now()): Axis[] {
  return axes(CLUSTERS, answers, now);
}

/** The 4 SAT Math domains. */
export function domainRadar(answers: readonly Answered[], now = Date.now()): Axis[] {
  return axes(
    DOMAIN_AXES.map((d) => ({
      id: d,
      topics: CLUSTERS.filter((c) => c.domain === d).flatMap((c) => c.topics),
    })),
    answers,
    now,
  );
}

/** question id → [topicId, difficulty]: what the browser needs to resolve raw answers. */
export type QuestionMeta = Record<string, [number, 1 | 2 | 3]>;

export function resolve(
  raw: readonly { qid: string; correct: boolean; at: number; topicId?: number }[],
  meta: QuestionMeta,
): Answered[] {
  const out: Answered[] = [];
  for (const r of raw) {
    const m = meta[r.qid];
    const topicId = m?.[0] ?? r.topicId;
    if (!topicId) continue;
    out.push({ topicId, difficulty: m?.[1] ?? 2, correct: r.correct, at: r.at });
  }
  return out;
}

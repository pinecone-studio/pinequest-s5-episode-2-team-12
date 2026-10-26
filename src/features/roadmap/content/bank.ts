// The roadmap question bank in demo mode (and the seed for Supabase): content/roadmap/<domain>/*.json plus the
// existing practice bank (src/mocks/questions.ts) mapped onto roadmap topics.
import { QUESTIONS } from '@/mocks/questions';
import type { Question } from '@/types';
import advIntros from '../../../../content/roadmap/adv/intros.json';
import advPlacement from '../../../../content/roadmap/adv/placement.json';
import adv from '../../../../content/roadmap/adv/questions.json';
import algIntros from '../../../../content/roadmap/alg/intros.json';
import algPlacement from '../../../../content/roadmap/alg/placement.json';
import alg from '../../../../content/roadmap/alg/questions.json';
import geoIntros from '../../../../content/roadmap/geo/intros.json';
import geoPlacement from '../../../../content/roadmap/geo/placement.json';
import geo from '../../../../content/roadmap/geo/questions.json';
import psdaIntros from '../../../../content/roadmap/psda/intros.json';
import psdaPlacement from '../../../../content/roadmap/psda/placement.json';
import psda from '../../../../content/roadmap/psda/questions.json';
import { ROADMAP } from '../config';
import type { IntroScreen, RoadmapQuestion } from './schema';

/** Practice-bank question → roadmap topic. These are reviewed already (written and checked for the bank). */
export const BANK_TOPIC: Record<string, number> = {
  a1: 14,
  a2: 13,
  a3: 6,
  a4: 3,
  a5: 13,
  a6: 7,
  a7: 14,
  v1: 12,
  v2: 16,
  v3: 4,
  v4: 9,
  v5: 12,
  v6: 1,
  p1: 8,
  p2: 10,
  p3: 25,
  p4: 23,
  p5: 8,
  p6: 25,
  g1: 18,
  g2: 19,
  g3: 17,
  g4: 21,
  g5: 22,
  g6: 19,
  h1: 12,
  h2: 13,
  h3: 19,
  h4: 10,
  h5: 24,
  h6: 8,
};

const asQuestions = (x: unknown) => x as RoadmapQuestion[];

/** Roadmap-authored stop questions (all states of review). */
export const AUTHORED: RoadmapQuestion[] = [alg, psda, adv, geo].flatMap(asQuestions);
export const PLACEMENT: RoadmapQuestion[] = [algPlacement, psdaPlacement, advPlacement, geoPlacement].flatMap(
  asQuestions,
);

const MAPPED: Question[] = QUESTIONS.filter((q) => BANK_TOPIC[q.id]).map((q) => ({
  ...q,
  topicId: BANK_TOPIC[q.id],
  format: q.choices ? 'mcq' : 'spr',
  pool: 'stop',
  reviewed: true,
  source: 'original',
}));

export const INTROS: Record<number, IntroScreen[]> = Object.fromEntries(
  Object.entries({ ...algIntros, ...psdaIntros, ...advIntros, ...geoIntros } as Record<
    string,
    IntroScreen[]
  >).map(([k, v]) => [Number(k), v]),
);

const servable = (q: Question, allowUnreviewed: boolean) => allowUnreviewed || q.reviewed === true;

/** Stop questions for a topic (or all), honoring the review gate. */
export function stopPool(topicId?: number, allowUnreviewed: boolean = ROADMAP.allowUnreviewed): Question[] {
  return [...(AUTHORED as Question[]), ...MAPPED].filter(
    (q) => (topicId === undefined || q.topicId === topicId) && servable(q, allowUnreviewed),
  );
}

export function placementPool(allowUnreviewed: boolean = ROADMAP.allowUnreviewed): Question[] {
  return (PLACEMENT as Question[]).filter((q) => servable(q, allowUnreviewed));
}

/** Every question the roadmap can serve, by id (tutor context, admin page, server re-checks). */
export function roadmapQuestionById(id: string): Question | undefined {
  return (
    (AUTHORED as Question[]).find((q) => q.id === id) ??
    (PLACEMENT as Question[]).find((q) => q.id === id) ??
    MAPPED.find((q) => q.id === id)
  );
}

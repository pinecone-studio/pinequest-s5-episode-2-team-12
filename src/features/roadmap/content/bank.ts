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
  a1: 6,
  a2: 4,
  a3: 2,
  a4: 1,
  a5: 4,
  a6: 3,
  a7: 6,
  v1: 17,
  v2: 19,
  v3: 18,
  v4: 20,
  v5: 17,
  v6: 16,
  p1: 9,
  p2: 7,
  p3: 10,
  p4: 11,
  p5: 9,
  p6: 10,
  g1: 23,
  g2: 25,
  g3: 22,
  g4: 24,
  g5: 26,
  g6: 25,
  h1: 17,
  h2: 5,
  h3: 25,
  h4: 8,
  h5: 12,
  h6: 9,
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

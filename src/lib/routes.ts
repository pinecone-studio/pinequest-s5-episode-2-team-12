// Every in-app URL is built here. Sections link to each other only through these helpers.
import type { QuestionFilter, TutorContextKind } from '@/types';

type Query = Record<string, string | number | boolean | undefined | null>;

/** "?a=1&b=2" without empty values; '' when nothing is set. */
export function qs(query: Query = {}): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    p.set(k, v === true ? '1' : String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

const seg = (id: string) => encodeURIComponent(id);

export const routes = {
  landing: '/',
  onboarding: '/onboarding',
  dashboard: '/dashboard',
  planner: '/planner',
  help: '/help',

  // A · journey
  journey: '/journey',
  lesson: (id: string) => `/lesson/${seg(id)}`,

  // A · roadmap («Монголын аялал»)
  roadmap: '/roadmap',
  roadmapStop: (no: number, opts: { testOut?: boolean } = {}) =>
    `/roadmap/stop/${no}${qs({ testout: opts.testOut })}`,
  placement: '/roadmap/placement',
  placementResults: '/roadmap/placement/results',
  adminQuestions: '/admin/questions',

  // B · Desmos Academy
  desmosHome: '/desmos',
  desmos: (id: string) => `/desmos/${seg(id)}`,

  // C · practice
  bank: (f: QuestionFilter = {}) =>
    `/bank${qs({ domain: f.domain, level: f.difficulty, desmos: f.desmosOnly, q: f.search })}`,
  hard: '/hard',
  practice: (opts: { ids?: string[]; timed?: boolean } = {}) =>
    `/practice${qs({ ids: opts.ids?.join(','), timed: opts.timed })}`,

  // D · exam & mistakes
  mock: '/mock',
  mistakes: '/mistakes',

  // E · cards
  cards: '/cards',
  deck: (id: string) => `/cards/${seg(id)}`,
  deckQuiz: (id: string) => `/cards/${seg(id)}/quiz`,
  myCards: '/cards/mine',

  // F · progress
  progress: '/progress',
  achievements: '/achievements',
  league: '/league',

  // G · tutor
  tutor: (ctx: { kind?: TutorContextKind; id?: string; chosen?: string } = {}) =>
    `/tutor${qs({ kind: ctx.kind, id: ctx.id, chosen: ctx.chosen })}`,
} as const;

export type Routes = typeof routes;

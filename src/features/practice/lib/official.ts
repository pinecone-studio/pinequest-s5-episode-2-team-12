// Official SAT Math questions (College Board question bank) stored in Supabase `sat_math_questions`.
// Pure helpers shared by the server query and the bank UI.
import type { Domain } from '@/types';
import { prepareCbHtml } from './cb-html';

export const OFFICIAL_TABLE = 'sat_math_questions';
export const OFFICIAL_PAGE_SIZE = 10;

/** Domain names as stored in the table ↔ the app's short codes. */
export const OFFICIAL_DOMAINS: Record<Domain, string> = {
  alg: 'Algebra',
  adv: 'Advanced Math',
  psda: 'Problem-Solving and Data Analysis',
  geo: 'Geometry and Trigonometry',
};

/** College Board skills per domain, in their official order. */
export const OFFICIAL_SKILLS: Record<Domain, string[]> = {
  alg: [
    'Linear equations in one variable',
    'Linear functions',
    'Linear equations in two variables',
    'Systems of two linear equations in two variables',
    'Linear inequalities in one or two variables',
  ],
  adv: [
    'Nonlinear functions',
    'Nonlinear equations in one variable and systems of equations in two variables',
    'Equivalent expressions',
  ],
  psda: [
    'Ratios, rates, proportional relationships, and units',
    'Percentages',
    'One-variable data: Distributions and measures of center and spread',
    'Two-variable data: Models and scatterplots',
    'Probability and conditional probability',
    'Inference from sample statistics and margin of error',
    'Evaluating statistical claims: Observational studies and experiments',
  ],
  geo: ['Area and volume', 'Lines, angles, and triangles', 'Right triangles and trigonometry', 'Circles'],
};

const DIFFICULTY_NAMES = { 1: 'Easy', 2: 'Medium', 3: 'Hard' } as const;

export type OfficialDifficulty = 1 | 2 | 3;

export type OfficialQuestion = {
  id: string;
  domain: Domain;
  skill: string;
  difficulty: OfficialDifficulty;
  format: 'mcq' | 'spr' | 'unsupported';
  source?: string | null;
  questionType?: string;
  /** Display-ready HTML (MathML, figures). */
  promptHtml: string;
  choices: { label: string; html: string }[];
  /** 'A'–'D' for multiple choice; the main accepted value for grid-in. */
  answer: string;
  /** Every accepted grid-in value (e.g. '.1764', '3/17'). */
  accepted: string[];
  explanationHtml: string;
};

export type OfficialFilter = {
  domain?: Domain;
  skill?: string;
  difficulty?: OfficialDifficulty;
  search?: string;
  page: number;
};

export type OfficialPage = {
  questions: OfficialQuestion[];
  /** Matching questions across all pages. */
  total: number;
  /** Every question in the bank, ignoring filters. */
  bankTotal: number;
  page: number;
  pageCount: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/** Read `?domain=alg&skill=…&difficulty=3&q=…&page=2`, ignoring anything invalid. */
export function parseOfficialFilter(params: SearchParams): OfficialFilter {
  const domainRaw = one(params.domain);
  const domain = domainRaw && domainRaw in OFFICIAL_DOMAINS ? (domainRaw as Domain) : undefined;
  const skillRaw = one(params.skill);
  const skills = domain ? OFFICIAL_SKILLS[domain] : Object.values(OFFICIAL_SKILLS).flat();
  const skill = skillRaw && skills.includes(skillRaw) ? skillRaw : undefined;
  const d = Number(one(params.difficulty));
  const difficulty = d === 1 || d === 2 || d === 3 ? d : undefined;
  const search = one(params.q)?.slice(0, 100);
  const p = Number.parseInt(one(params.page) ?? '1', 10);
  return { domain, skill, difficulty, search, page: Number.isFinite(p) && p > 0 ? p : 1 };
}

/** The same filter as URL params (for links and router pushes). Defaults are left out. */
export function officialFilterToParams(filter: Partial<OfficialFilter>): string {
  const p = new URLSearchParams();
  if (filter.domain) p.set('domain', filter.domain);
  if (filter.skill) p.set('skill', filter.skill);
  if (filter.difficulty) p.set('difficulty', String(filter.difficulty));
  if (filter.search) p.set('q', filter.search);
  if (filter.page && filter.page > 1) p.set('page', String(filter.page));
  return p.toString();
}

export function difficultyName(d: OfficialDifficulty): string {
  return DIFFICULTY_NAMES[d];
}

/** Characters PostgREST treats specially in an `ilike` filter. */
export function cleanSearch(search: string): string {
  return search
    .replace(/[%_*,()\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type OfficialRow = {
  id: string;
  domain: string;
  skill: string;
  difficulty: string;
  question_type: string;
  question_html: string;
  choices: { label: string; html: string }[] | null;
  correct_answer: string | null;
  accepted_answers: string[] | null;
  explanation_html: string | null;
  source?: string | null;
};

export const OFFICIAL_COLUMNS =
  'id, domain, skill, difficulty, question_type, question_html, choices, correct_answer, accepted_answers, explanation_html, source';

/** The scope a snippet was prepared with; the element showing it carries the same `data-cb`. */
export function cbScope(id: string, part: string): string {
  return `cb-${id}-${part}`;
}

/** Table row → display-ready question. */
export function mapOfficialRow(row: OfficialRow): OfficialQuestion {
  const domain =
    (Object.keys(OFFICIAL_DOMAINS) as Domain[]).find((k) => OFFICIAL_DOMAINS[k] === row.domain) ?? 'alg';
  const difficulty = (Number(
    Object.entries(DIFFICULTY_NAMES).find(([, name]) => name === row.difficulty)?.[0] ?? 2,
  ) || 2) as OfficialDifficulty;
  return {
    id: row.id,
    domain,
    skill: row.skill.trim(),
    difficulty,
    format:
      row.question_type === 'multiple_choice'
        ? 'mcq'
        : row.question_type === 'student_response'
          ? 'spr'
          : 'unsupported',
    source: row.source,
    questionType: row.question_type,
    promptHtml: prepareCbHtml(row.question_html, cbScope(row.id, 'q')),
    choices: (row.choices ?? []).map((c) => ({
      label: c.label,
      html: prepareCbHtml(c.html, cbScope(row.id, c.label)),
    })),
    answer:
      row.correct_answer?.trim() ||
      (row.question_type === 'multiple_choice' ? row.accepted_answers?.[0]?.trim() : '') ||
      '',
    accepted: row.accepted_answers?.filter((answer) => answer.trim())?.length
      ? row.accepted_answers.filter((answer) => answer.trim())
      : row.correct_answer?.trim()
        ? [row.correct_answer.trim()]
        : [],
    explanationHtml: prepareCbHtml(row.explanation_html ?? '', cbScope(row.id, 'e')),
  };
}

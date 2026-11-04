// «Төстэй бодлого»: a new practice question of the same kind, made by the question templates
// (ai/pipeline/templates). The numbers are new and the answer is computed by code, so it is always right —
// no model involved, works offline, and every press gives a different question.
import { TEMPLATES } from '@ai/pipeline/generate';
import { mulberry32, type Template } from '@ai/pipeline/templates/shared';
import type { Question } from '@/types';

/** College Board skill (the official bank's `skill`) for each template. Templates not listed have none. */
export const CB_SKILL: Record<string, string> = {
  'lin-eq': 'Linear equations in one variable',
  'lin-paren': 'Linear equations in one variable',
  'lin-both-sides': 'Linear equations in one variable',
  consecutive: 'Linear equations in one variable',
  'abs-value': 'Linear equations in one variable',
  ineq: 'Linear inequalities in one or two variables',
  budget: 'Linear inequalities in one or two variables',
  'abs-ineq-count': 'Linear inequalities in one or two variables',
  system: 'Systems of two linear equations in two variables',
  'sys-no-sol': 'Systems of two linear equations in two variables',
  'sys-infinite': 'Systems of two linear equations in two variables',
  slope: 'Linear functions',
  'fee-rate': 'Linear functions',
  'table-rate': 'Linear functions',
  intercept: 'Linear equations in two variables',
  'slope-standard': 'Linear equations in two variables',
  'parallel-perp': 'Linear equations in two variables',
  'f-eval': 'Nonlinear functions',
  composition: 'Nonlinear functions',
  'vertex-min': 'Nonlinear functions',
  'vertex-x': 'Nonlinear functions',
  'vertex-shift': 'Nonlinear functions',
  'exp-growth': 'Nonlinear functions',
  'half-life': 'Nonlinear functions',
  'max-height': 'Nonlinear functions',
  exponents: 'Equivalent expressions',
  'rational-exp': 'Equivalent expressions',
  'quad-roots': 'Nonlinear equations in one variable and systems of equations in two variables',
  discriminant: 'Nonlinear equations in one variable and systems of equations in two variables',
  'quad-one-sol': 'Nonlinear equations in one variable and systems of equations in two variables',
  'line-parabola-sum': 'Nonlinear equations in one variable and systems of equations in two variables',
  'pct-of': 'Percentages',
  'pct-change': 'Percentages',
  'sale-price': 'Percentages',
  'pct-compound': 'Percentages',
  'pct-reverse': 'Percentages',
  'unit-price': 'Ratios, rates, proportional relationships, and units',
  speed: 'Ratios, rates, proportional relationships, and units',
  'unit-convert': 'Ratios, rates, proportional relationships, and units',
  'mean-missing': 'One-variable data: distributions and measures of center and spread',
  median: 'One-variable data: distributions and measures of center and spread',
  'weighted-mean': 'One-variable data: distributions and measures of center and spread',
  range: 'One-variable data: distributions and measures of center and spread',
  'outlier-mean': 'One-variable data: distributions and measures of center and spread',
  probability: 'Probability and conditional probability',
  pythag: 'Right triangles and trigonometry',
  'special-right': 'Right triangles and trigonometry',
  'trig-ratio': 'Right triangles and trigonometry',
  'trig-cofunction': 'Right triangles and trigonometry',
  'tri-angle': 'Lines, angles, and triangles',
  'angle-pairs': 'Lines, angles, and triangles',
  'similar-tri': 'Lines, angles, and triangles',
  'rect-area': 'Area and volume',
  volume: 'Area and volume',
  'circle-radius': 'Circles',
  'circle-area': 'Circles',
  'arc-length': 'Circles',
  'circle-center': 'Circles',
  'circle-general': 'Circles',
  radians: 'Right triangles and trigonometry',
  distance: 'Lines, angles, and triangles',
  midpoint: 'Lines, angles, and triangles',
};

type Base = Pick<Question, 'id' | 'domain' | 'skill' | 'difficulty' | 'prompt'>;

/** Template key of a generated question ("g-slope-s1-3" or "sim-slope-42" → "slope"), else null. */
export function templateKeyOf(id: string): string | null {
  const m = /^(?:g-(.+)-s\d+-\d+|sim-(.+)-\d+)$/.exec(id);
  const key = m?.[1] ?? m?.[2];
  return key && TEMPLATES.some((t) => t.key === key) ? key : null;
}

/**
 * Templates that make questions like `q`, best first: its own template; else the same skill (template skill or
 * College Board skill) at the same difficulty, then any difficulty. Empty when nothing fits (e.g. a data-table
 * question no template can make) — the button is not shown then.
 */
export function templatesFor(q: Base): Template[] {
  const own = templateKeyOf(q.id);
  if (own) return TEMPLATES.filter((t) => t.key === own);
  const sameSkill = TEMPLATES.filter(
    (t) => t.domain === q.domain && (t.skill === q.skill || CB_SKILL[t.key] === q.skill),
  );
  const sameLevel = sameSkill.filter((t) => t.difficulty === q.difficulty);
  return sameLevel.length ? sameLevel : sameSkill;
}

/** A fresh question like `q` for this seed, or null. Different seeds give different questions. */
export function similarQuestion(q: Base, seed: number): Question | null {
  const ts = templatesFor(q);
  if (!ts.length) return null;
  const t = ts[seed % ts.length] as Template;
  const r = mulberry32(seed * 7919 + 17);
  for (let i = 0; i < 30; i++) {
    const d = t.make(r);
    if (!d || d.prompt === q.prompt) continue;
    return {
      ...d,
      id: `sim-${t.key}-${seed}`,
      domain: t.domain,
      skill: t.skill,
      difficulty: d.difficulty ?? t.difficulty,
    };
  }
  return null;
}

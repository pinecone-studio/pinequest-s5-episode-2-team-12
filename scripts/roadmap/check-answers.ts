// Checks the stored answer of every roadmap question numerically and lists mismatches for human review.
// Run: bun run roadmap:check-answers   (exit code 1 when something is wrong)
//
// A question can carry `verify`:
//   { value: "(20-5)/3" }                       → the expression must equal the answer
//   { sub: { var: "x", eq: "3x+5 = 20" } }       → substituting the answer for x must make eq true
// MCQ: the keyed choice must match and no other choice may also match. SPR: all accepted forms must agree.
// Questions without `verify` (word answers, figures) are listed as "manual" — a person checks those.
import type { RoadmapQuestion } from '../../src/features/roadmap/content/schema';
import { close, evaluate, numeric, texToExpr } from './expr';

export type Finding = { id: string; level: 'mismatch' | 'manual'; message: string };

function satisfies(eq: string, v: string, value: number): boolean | null {
  const [l, r] = eq.split('=');
  const le = texToExpr(l);
  const re = texToExpr(r);
  if (le === null || re === null) return null;
  try {
    return close(evaluate(le, { [v]: value }), evaluate(re, { [v]: value }));
  } catch {
    return null;
  }
}

/** Does `candidate` (a numeric value) pass the question's verify rule? null = cannot tell. */
function passes(q: RoadmapQuestion, candidate: number): boolean | null {
  const v = q.verify;
  if (!v) return null;
  if ('value' in v) {
    const e = texToExpr(v.value);
    if (e === null) return null;
    try {
      return close(evaluate(e), candidate);
    } catch {
      return null;
    }
  }
  return satisfies(v.sub.eq, v.sub.var, candidate);
}

/** A plain decimal answer such as ".1667", "0.833" or "16.7". */
const DECIMAL = /^-?\d*\.\d+$/;

/**
 * Is `answer` (numeric value `n`) an accepted form of `exact`? SAT grid-ins accept a decimal that is
 * cut off or rounded at its last digit (1/6 → .1666 or .1667), so a decimal answer is compared at its own precision —
 * but only a precise one (3+ significant digits): .7 for 3/4 or .66 for 2/3 is still a mismatch.
 */
function agrees(answer: string, n: number, exact: number): boolean {
  if (close(n, exact)) return true;
  const a = answer.trim();
  if (!DECIMAL.test(a)) return false;
  const significant = a.replace(/^-/, '').replace('.', '').replace(/^0+/, '').length;
  if (significant < 3) return false;
  const f = 10 ** a.split('.')[1].length;
  return close(n, Math.round(exact * f) / f) || close(n, Math.trunc(exact * f) / f);
}

/** The value a `{ value }` verify rule expects; undefined for other rules, null if it cannot be evaluated. */
function verifyValue(q: RoadmapQuestion): number | null | undefined {
  const v = q.verify;
  if (!v || !('value' in v)) return undefined;
  const e = texToExpr(v.value);
  if (e === null) return null;
  try {
    const n = evaluate(e);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function checkQuestion(q: RoadmapQuestion): Finding[] {
  const out: Finding[] = [];
  const bad = (message: string) => out.push({ id: q.id, level: 'mismatch', message });

  if (q.format === 'spr') {
    const accepted = q.answer as string[];
    const values = accepted.map((a) => ({ a, n: numeric(a) }));
    const nums = values.filter((x) => x.n !== null) as { a: string; n: number }[];
    // compare against an exact form (a fraction, an integer) when there is one, not a cut-off decimal
    const exact = nums.find((x) => !DECIMAL.test(x.a.trim())) ?? nums[0];
    for (const x of nums)
      if (!agrees(x.a, x.n, exact.n)) bad(`accepted answers disagree: "${exact.a}" vs "${x.a}"`);
    if (!q.verify) {
      out.push({ id: q.id, level: 'manual', message: 'no verify rule' });
      return out;
    }
    if (!nums.length) {
      out.push({ id: q.id, level: 'manual', message: 'answer is not numeric' });
      return out;
    }
    const target = verifyValue(q);
    const ok =
      target === undefined ? passes(q, exact.n) : target === null ? null : agrees(exact.a, exact.n, target);
    if (ok === null) out.push({ id: q.id, level: 'manual', message: 'verify rule could not be evaluated' });
    else if (!ok) bad(`stored answer ${exact.a} fails verify ${JSON.stringify(q.verify)}`);
    return out;
  }

  const choices = q.choices ?? [];
  const key = q.answer as number;
  if (key < 0 || key >= choices.length) {
    bad(`answer index ${key} out of range`);
    return out;
  }
  if (!q.verify) {
    out.push({ id: q.id, level: 'manual', message: 'no verify rule' });
    return out;
  }
  const keyed = numeric(choices[key]);
  if (keyed === null) {
    out.push({ id: q.id, level: 'manual', message: `keyed choice "${choices[key]}" is not numeric` });
    return out;
  }
  const ok = passes(q, keyed);
  if (ok === null) out.push({ id: q.id, level: 'manual', message: 'verify rule could not be evaluated' });
  else if (!ok) bad(`keyed choice ${choices[key]} fails verify ${JSON.stringify(q.verify)}`);
  choices.forEach((c, i) => {
    if (i === key) return;
    const n = numeric(c);
    if (n !== null && passes(q, n)) bad(`choice ${i} "${c}" also satisfies verify (two correct answers)`);
  });
  return out;
}

if (import.meta.main) {
  const { AUTHORED, PLACEMENT } = await import('../../src/features/roadmap/content/bank');
  const all = [...AUTHORED, ...PLACEMENT];
  const findings = all.flatMap(checkQuestion);
  const mism = findings.filter((f) => f.level === 'mismatch');
  const manual = findings.filter((f) => f.level === 'manual');
  for (const f of mism) console.error(`✗ ${f.id}: ${f.message}`);
  if (process.argv.includes('--manual')) for (const f of manual) console.log(`· ${f.id}: ${f.message}`);
  const checked = all.length - new Set(manual.map((f) => f.id)).size;
  console.log(
    `${mism.length ? '✗' : '✓'} ${all.length} questions · ${checked} checked numerically · ${manual.length} need a person (--manual to list) · ${mism.length} mismatches`,
  );
  if (mism.length) process.exitCode = 1;
}

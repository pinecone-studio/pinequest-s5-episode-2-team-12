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

/** The exact value a `value` rule describes; null for substitution rules or when it cannot be evaluated. */
function exactValue(q: RoadmapQuestion): number | null {
  const v = q.verify;
  if (!v || !('value' in v)) return null;
  const e = texToExpr(v.value);
  if (e === null) return null;
  try {
    return evaluate(e);
  } catch {
    return null;
  }
}

/** A grid-in form of `exact`: equal, or a decimal with at least 3 significant digits that truncates or
 *  rounds it (SAT accepts .1666 and .1667 for 1/6, but not .17 or .2). */
export function gridForm(answer: string, value: number, exact: number): boolean {
  if (close(value, exact)) return true;
  const m = /^-?(\d*)\.(\d+)$/.exec(answer.trim());
  if (!m || `${m[1]}${m[2]}`.replace(/^0+/, '').length < 3) return false;
  const scale = 10 ** m[2].length;
  return [Math.trunc(exact * scale), Math.round(exact * scale)].some((n) => close(n / scale, value));
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

export function checkQuestion(q: RoadmapQuestion): Finding[] {
  const out: Finding[] = [];
  const bad = (message: string) => out.push({ id: q.id, level: 'mismatch', message });

  if (q.format === 'spr') {
    const accepted = q.answer as string[];
    const values = accepted.map((a) => ({ a, n: numeric(a) }));
    const nums = values.filter((x) => x.n !== null) as { a: string; n: number }[];
    const exact = exactValue(q);
    // with a value rule every form is held to it; otherwise the forms must agree with the first one
    for (const x of nums)
      if (!gridForm(x.a, x.n, exact ?? nums[0].n))
        bad(`accepted answers disagree: "${nums[0].a}" vs "${x.a}"`);
    if (!q.verify) {
      out.push({ id: q.id, level: 'manual', message: 'no verify rule' });
      return out;
    }
    if (!nums.length) {
      out.push({ id: q.id, level: 'manual', message: 'answer is not numeric' });
      return out;
    }
    if (exact !== null) return out;
    const ok = passes(q, nums[0].n);
    if (ok === null) out.push({ id: q.id, level: 'manual', message: 'verify rule could not be evaluated' });
    else if (!ok) bad(`stored answer ${nums[0].a} fails verify ${JSON.stringify(q.verify)}`);
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

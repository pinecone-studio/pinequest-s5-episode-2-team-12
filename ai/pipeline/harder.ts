// Harder outside questions for Suu: AQuA-RAT (algebra word problems, Apache-2.0) and the MATH dataset (Hendrycks et
// al., MIT). Both are turned into SAT-shaped items with a gold answer, then into teacher prompts in the format of
// ai/distill — so the same code check decides what becomes training data. Their English rationales are kept for
// reference only; Suu's explanations are written in Mongolian by the teacher and verified.
//
//   bun ai/pipeline/harder.ts --aqua train.json --math math.jsonl   → ai/out/distill/prompts-harder.jsonl
//   (AQuA: https://github.com/google-deepmind/AQuA · MATH: huggingface.co/datasets/EleutherAI/hendrycks_math,
//    exported to JSONL with {problem, solution, level, type})
import { readFileSync } from 'node:fs';
import { normAnswer } from '../../src/features/tutor/lib/desmos-lesson-parse';
import { CHAT_PROMPT, EXPLAIN_ASK } from '../../src/server/ai/prompts';

export type HarderItem = {
  id: string;
  source: 'aqua' | 'math';
  topic: string;
  /** 1–5 for MATH; AQuA has no levels (3). */
  level: number;
  /** As the student sees it: the problem, plus "A) …" lines for multiple choice. */
  question: string;
  /** A letter for multiple choice, else a number / fraction / point. */
  answer: string;
  rationale?: string;
};

const LETTERS = ['A', 'B', 'C', 'D'] as const;
/** Options that a 4-choice SAT question would not have. */
const FILLER =
  /none of (these|the above)|cannot be determined|can't be determined|data inadequate|not possible/i;
const MAX_QUESTION = 700;
const MAX_OPTION = 40;

/** Stable small hash (same as ai/train/export.ts), so conversion is reproducible. */
function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

type AquaRow = { question: string; options: string[]; rationale?: string; correct: string };

/** "B)$65" → "$65"; AQuA writes options as "A)21", "A) 21" or "A21". */
const optionText = (o: string) => o.replace(/^\s*[A-E]\s*\)?\s*/, '').trim();

/**
 * AQuA has 5 options (A–E); the SAT has 4. We drop one wrong option — a filler like "None of these" if there is
 * one, else a wrong one picked by hash — and relabel A–D. Null for rows that don't fit (too long, the answer is a
 * filler option, broken options).
 */
export function fromAqua(row: AquaRow, index: number): HarderItem | null {
  const opts = row.options.map(optionText);
  const right = 'ABCDE'.indexOf(row.correct.trim().toUpperCase());
  if (opts.length !== 5 || right < 0) return null;
  if (row.question.length > MAX_QUESTION || opts.some((o) => !o || o.length > MAX_OPTION)) return null;
  if (FILLER.test(opts[right] as string)) return null;
  const wrong = opts.map((_, i) => i).filter((i) => i !== right);
  const filler = wrong.find((i) => FILLER.test(opts[i] as string));
  const drop = filler ?? (wrong[hash(row.question) % wrong.length] as number);
  const keep = opts.map((_, i) => i).filter((i) => i !== drop);
  if (keep.filter((i) => i !== right).some((i) => FILLER.test(opts[i] as string))) return null;
  const choices = keep.map((i) => opts[i] as string);
  if (new Set(choices).size !== 4) return null;
  const letter = LETTERS[keep.indexOf(right)] as string;
  return {
    id: `aqua-${index}`,
    source: 'aqua',
    topic: 'word problems',
    level: 3,
    question: `${row.question.trim()}\n${choices.map((c, i) => `${LETTERS[i]}) ${c}`).join('\n')}`,
    answer: letter,
    rationale: row.rationale,
  };
}

/** Content of the last \boxed{…} (nested braces allowed), or null. */
export function lastBoxed(solution: string): string | null {
  const at = solution.lastIndexOf('\\boxed{');
  if (at < 0) return null;
  let depth = 0;
  for (let i = at + 6; i < solution.length; i++) {
    const c = solution[i];
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return solution.slice(at + 7, i).trim();
  }
  return null;
}

/** A boxed MATH answer in the form the app can check ("\frac{7}{8}" → "7/8", "(2,-3)" → "(2, -3)"), or null. */
export function checkable(boxed: string): string | null {
  const s = boxed
    .replace(/\\[dt]?frac\{(-?\d+)\}\{(\d+)\}/g, '$1/$2')
    .replace(/^-\\frac\{(\d+)\}\{(\d+)\}$/, '-$1/$2')
    .replace(/\\!|\\,|\\ |\$|\\left|\\right/g, '')
    .replace(/^\\text\{.*\}$/, '')
    .trim();
  if (/\\|[a-zA-Z]/.test(s)) return null; // sqrt, pi, variables, words: no single checkable value
  const n = normAnswer(s);
  if (n.kind === 'num' && /^-?\d+(?:\.\d+)?(?:\/\d+)?$/.test(s)) return s;
  const p = /^\(\s*(-?\d+(?:\.\d+)?(?:\/\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:\/\d+)?)\s*\)$/.exec(s);
  return p ? `(${p[1]}, ${p[2]})` : null;
}

type MathRow = { problem: string; solution: string; level: string; type: string };
/** MATH topics that overlap SAT Math. Number Theory and Precalculus mostly don't. */
export const SAT_TOPICS = new Set([
  'Algebra',
  'Intermediate Algebra',
  'Prealgebra',
  'Counting & Probability',
  'Geometry',
]);

/** Levels 3–5 of the SAT-like topics, with a single checkable answer. */
export function fromMath(row: MathRow, index: number, minLevel = 3): HarderItem | null {
  const level = Number(/\d/.exec(row.level)?.[0]);
  if (!SAT_TOPICS.has(row.type) || !(level >= minLevel)) return null;
  if (row.problem.length > MAX_QUESTION || /\[asy\]/.test(row.problem)) return null; // no diagrams
  const boxed = lastBoxed(row.solution);
  const answer = boxed ? checkable(boxed) : null;
  if (!answer) return null;
  return {
    id: `math-${index}`,
    source: 'math',
    topic: row.type,
    level,
    question: row.problem.trim(),
    answer,
    rationale: row.solution,
  };
}

/** Teacher prompts in ai/distill's format (chat skill, step-by-step explanation in Mongolian). */
export function toPrompts(items: HarderItem[]) {
  return items.map((it) => ({
    id: `${it.id}-chat`,
    skill: 'chat' as const,
    template: it.source,
    difficulty: 3 as const,
    question: it.question,
    gold: it.answer,
    messages: [
      { role: 'system' as const, content: CHAT_PROMPT },
      { role: 'user' as const, content: `${it.question}\n\n${EXPLAIN_ASK}` },
    ],
  }));
}

/** AQuA ships as JSON lines; a JSON array works too. */
export function readRows<T>(text: string): T[] {
  const t = text.trim();
  if (t.startsWith('[')) return JSON.parse(t) as T[];
  return t
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as T);
}

export function convert(aqua: AquaRow[], math: MathRow[]) {
  const a = aqua.map(fromAqua).filter((x): x is HarderItem => x !== null);
  const m = math.map((r, i) => fromMath(r, i)).filter((x): x is HarderItem => x !== null);
  return {
    items: [...a, ...m],
    kept: { aqua: a.length, math: m.length },
    read: { aqua: aqua.length, math: math.length },
  };
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const { dirname } = await import('node:path');
  const aquaPath = arg('aqua');
  const mathPath = arg('math');
  if (!aquaPath && !mathPath) {
    console.error('usage: bun ai/pipeline/harder.ts --aqua train.json [--math math.jsonl] [--out file]');
    process.exit(1);
  }
  const aqua = aquaPath ? readRows<AquaRow>(readFileSync(aquaPath, 'utf8')) : [];
  const math = mathPath ? readRows<MathRow>(readFileSync(mathPath, 'utf8')) : [];
  const { items, kept, read } = convert(aqua, math);
  const out = arg('out') ?? 'ai/out/distill/prompts-harder.jsonl';
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    toPrompts(items)
      .map((p) => JSON.stringify(p))
      .join('\n') + (items.length ? '\n' : ''),
  );
  console.log(`AQuA ${kept.aqua}/${read.aqua}, MATH ${kept.math}/${read.math} → ${out}`);
}

// Suu v2 · Desmos side-panel rows. The cat «Desmos» button next to a problem (practice, AI багш) sends the
// app's own question format to the Desmos skill: the prompt with $…$ removed (LaTeX such as \le, \frac{1}{2},
// 10\% stays) and the choices as "A) …" lines, plus the right choice's value (or its letter). The v1 kit only has
// plain-text questions, mostly without choices. These rows re-ask kit lessons in the app's format; the gold
// lesson stays exactly the kit's, so every answer is still made by code and checked by the kit scorer.
// Run in Colab (no node_modules): bun ai/v2/desmos-panel.ts <kit dir> <out dir>
// No runtime imports: keep this file standalone.

/** Same user message as the app (src/server/ai/prompts.ts desmosUserMessage) and the v1 kit. */
export const panelUserMessage = (question: string, answer: string) =>
  `Асуулт: ${question.trim()}\nЗөв хариу: ${answer.trim()}`;

/** The app's panel question (src/features/tutor/lib/desmos-panel.ts panelInput; a test keeps them equal). */
export function panelQuestion(prompt: string, choices: string[] = []): string {
  const letter = (i: number) => String.fromCharCode(65 + i);
  return [
    prompt.replace(/(?<!\\)\$/g, '').trim(),
    ...choices.map((c, i) => `${letter(i)}) ${c.replace(/(?<!\\)\$/g, '').trim()}`),
  ]
    .join('\n')
    .slice(0, 1200);
}

export type KitRow = {
  messages: { role: string; content: string }[];
  technique: string;
  question: string;
  answer: string;
};
export type PanelRow = KitRow & { skill: 'desmos'; id: string; format: 'mcq' | 'grid' | 'letters' };

/** Small seeded random (mulberry32), so the same kit always gives the same rows. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Plain kit math → how the app's prompts look once $…$ is removed. */
export function latexify(q: string): string {
  return q
    .replace(/\s*≤\s*/g, ' \\le ')
    .replace(/\s*≥\s*/g, ' \\ge ')
    .replace(/\s*<=\s*/g, ' \\le ')
    .replace(/\s*>=\s*/g, ' \\ge ')
    .replace(/sqrt\(([^()]+)\)/g, '\\sqrt{$1}')
    .replace(/(?<![\w.^])(\d+)\/(\d+)(?![\w.])/g, '\\frac{$1}{$2}')
    .replace(/(\d)%/g, '$1\\%')
    .replace(/\$(\d)/g, '\\$$$1'); // money: the app writes \$100 so it isn't read as math
}

const NUM = /^-?\d+(?:\.\d+)?$/;
const FRAC = /^(-?\d+)\/(\d+)$/;
const POINT = /^\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)$/;

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

/** Three different wrong choices that look like the answer (same kind: number, fraction or point). */
export function distractors(answer: string, rand: () => number): string[] | null {
  const a = answer.trim();
  let pool: string[];
  if (NUM.test(a)) {
    const v = Number(a);
    const step = Number.isInteger(v) ? 1 : 0.5;
    pool = [v + step, v - step, -v, v * 2, v + 2 * step, v - 2 * step, v + 10, Math.round(v / 2)].map(fmt);
  } else if (FRAC.test(a)) {
    const [, p, q] = FRAC.exec(a)!.map(Number);
    pool = [`${p + 1}/${q}`, `${p - 1}/${q}`, `${-p}/${q}`, `${q}/${p}`, `${p}/${q + 1}`];
  } else if (POINT.test(a)) {
    const [, x, y] = POINT.exec(a)!.map(Number);
    pool = [
      [y, x],
      [x, -y],
      [-x, y],
      [x + 1, y],
      [x, y + 1],
    ].map(([u, w]) => `(${fmt(u)}, ${fmt(w)})`);
  } else return null;
  const out: string[] = [];
  for (const c of pool.sort(() => rand() - 0.5)) {
    if (c !== a && !out.includes(c) && !/\/0$/.test(c)) out.push(c);
    if (out.length === 3) return out;
  }
  return null;
}

/** "… ? (A) 2x (B) 3x (C) … (D) …" → the stem and the four choices. Null when it isn't that shape. */
export function splitInlineChoices(q: string): { stem: string; choices: string[] } | null {
  const at = q.search(/\s\(A\)\s/);
  if (at < 0) return null;
  const parts = q
    .slice(at)
    .split(/\s*\(([A-D])\)\s*/)
    .filter(Boolean);
  // parts: ['A', 'x', 'B', 'y', …]
  const choices: string[] = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    if (parts[i] !== String.fromCharCode(65 + choices.length)) return null;
    choices.push(parts[i + 1].trim());
  }
  return choices.length === 4 ? { stem: q.slice(0, at).trim(), choices } : null;
}

/**
 * A kit row asked the way the panel asks. Kit questions with inline "(A) …" choices keep their letter answer;
 * number/fraction/point answers become multiple choice (the right value among three look-alikes) or stay
 * grid-in; about half get the app's LaTeX. The assistant message (the gold lesson) is not changed.
 */
export function panelRow(row: KitRow, seed: number): PanelRow | null {
  const rand = rng(seed);
  const system = row.messages[0];
  const gold = row.messages[2];
  if (!system || system.role !== 'system' || !gold || gold.role !== 'assistant') return null;
  const tex = (s: string) => (rand() < 0.5 ? latexify(s) : s);
  let question: string;
  let format: PanelRow['format'];
  const inline = splitInlineChoices(row.question);
  if (inline) {
    question = panelQuestion(tex(inline.stem), inline.choices.map(tex));
    format = 'letters';
  } else if (rand() < 0.6) {
    const wrong = distractors(row.answer, rand);
    if (!wrong) return null;
    const choices = [...wrong];
    choices.splice(Math.floor(rand() * 4), 0, row.answer.trim());
    question = panelQuestion(tex(row.question), choices);
    format = 'mcq';
  } else {
    question = panelQuestion(tex(row.question));
    format = 'grid';
  }
  return {
    skill: 'desmos',
    id: `panel-${seed}`,
    format,
    technique: row.technique,
    question,
    answer: row.answer.trim(),
    messages: [system, { role: 'user', content: panelUserMessage(question, row.answer) }, gold],
  };
}

export function panelRows(rows: KitRow[], seedBase: number): PanelRow[] {
  return rows.flatMap((r, i) => panelRow(r, seedBase + i) ?? []);
}

if (import.meta.main) {
  const [kit, out] = process.argv.slice(2);
  if (!kit || !out) {
    console.error('usage: bun ai/v2/desmos-panel.ts <kit dir> <out dir>');
    process.exit(1);
  }
  const { mkdirSync, readFileSync, writeFileSync } = await import('node:fs');
  mkdirSync(out, { recursive: true });
  const seeds = { train: 100_000, val: 200_000, test: 300_000 } as const;
  for (const split of ['train', 'val', 'test'] as const) {
    const rows = readFileSync(`${kit}/data/${split}.jsonl`, 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as KitRow);
    const panel = panelRows(rows, seeds[split]);
    writeFileSync(`${out}/panel_${split}.jsonl`, `${panel.map((r) => JSON.stringify(r)).join('\n')}\n`);
    const by: Record<string, number> = {};
    for (const r of panel) by[r.format] = (by[r.format] ?? 0) + 1;
    console.log(split, panel.length, 'rows', JSON.stringify(by));
  }
}

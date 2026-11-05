// The hard held-out set: 3 questions per hard template (difficulty 3), made with seeds no training data uses.
// Committed as ai/eval/hard-holdout.json so every model is measured on exactly the same questions.
//   bun ai/eval/hard-set.ts   (rewrites the file; the test checks it matches)
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { finalAnswer } from '../pipeline/generate';
import { HARD } from '../pipeline/templates/hard';
import { mulberry32 } from '../pipeline/templates/shared';

export type HardItem = { id: string; template: string; question: string; answer: string };

/** Training uses seeds 1–8 (kits) and 41–42 (distillation); this set lives far away from them. */
const SEED = 90_210;
const PER = 3;
const LETTERS = ['A', 'B', 'C', 'D'];

export function buildHardSet(): HardItem[] {
  const out: HardItem[] = [];
  for (const [ti, t] of HARD.entries()) {
    const r = mulberry32(SEED + ti);
    const seen = new Set<string>();
    for (let tries = 0; seen.size < PER && tries < 200; tries++) {
      const d = t.make(r);
      if (!d || seen.has(d.prompt)) continue;
      seen.add(d.prompt);
      const mcq = typeof d.answer === 'number';
      const q = { ...d, id: '', domain: t.domain, skill: t.skill, difficulty: 3 as const };
      out.push({
        id: `hard-${t.key}-${seen.size}`,
        template: t.key,
        question: mcq
          ? `${d.prompt}\n${d.choices?.map((c, i) => `${LETTERS[i]}) ${c}`).join('\n')}`
          : d.prompt,
        answer: mcq ? (LETTERS[d.answer as number] ?? '') : finalAnswer(q),
      });
    }
  }
  return out;
}

export const HARD_SET_PATH = join(import.meta.dir, 'hard-holdout.json');

if (import.meta.main) {
  const set = buildHardSet();
  writeFileSync(HARD_SET_PATH, `${JSON.stringify(set, null, 2)}\n`);
  console.log(`${set.length} questions → ${HARD_SET_PATH}`);
}

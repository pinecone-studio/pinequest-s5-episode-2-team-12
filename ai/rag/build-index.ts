// Builds the example library Суу and the chat search before they answer (RAG).
// Source: the Desmos kit's training lessons (sat_desmos_kit/data/train.jsonl — every answer computed by code and
// checked by running the Desmos steps). Only the TRAIN split goes in, so the kit's test set stays a fair test.
// We keep PER_TECHNIQUE lessons per Desmos technique, spread evenly over the file (the generator writes many
// variants of each template), so the library stays small enough to ship with the server (~1 MB).
//
//   bun ai/rag/build-index.ts <kit folder> [out]       # out: src/server/ai/rag/examples.json
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const PER_TECHNIQUE = 40;

type KitRow = {
  technique: string;
  question: string;
  answer: string;
  messages: { role: string; content: string }[];
};

export type Example = {
  id: string;
  technique: string;
  question: string;
  answer: string;
  /** The checked lesson exactly as Суу was trained to write it (JSON text). */
  lesson: string;
};

/** Even spread of `n` rows from each technique, in file order. */
export function pick(rows: KitRow[], n = PER_TECHNIQUE): Example[] {
  const by = new Map<string, KitRow[]>();
  for (const r of rows) {
    if (!r.technique || !r.question || !r.messages?.at(-1)?.content) continue;
    by.set(r.technique, [...(by.get(r.technique) ?? []), r]);
  }
  const out: Example[] = [];
  for (const [technique, list] of [...by].sort(([a], [b]) => a.localeCompare(b))) {
    const step = list.length / Math.min(n, list.length);
    for (let i = 0; i < Math.min(n, list.length); i++) {
      const r = list[Math.floor(i * step)];
      const lesson = r.messages.at(-1)?.content ?? '';
      JSON.parse(lesson); // every lesson must be valid JSON
      out.push({
        id: `${technique}-${i}`,
        technique,
        question: r.question.trim(),
        answer: String(r.answer),
        lesson,
      });
    }
  }
  return out;
}

if (import.meta.main) {
  const kit = process.argv[2];
  if (!kit) throw new Error('usage: bun ai/rag/build-index.ts <kit folder> [out]');
  const out = process.argv[3] ?? join(import.meta.dir, '../../src/server/ai/rag/examples.json');
  const rows = readFileSync(join(kit, 'data/train.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as KitRow);
  const examples = pick(rows);
  writeFileSync(out, `${JSON.stringify(examples)}\n`);
  console.log(`${examples.length} examples from ${rows.length} kit lessons → ${out}`);
}

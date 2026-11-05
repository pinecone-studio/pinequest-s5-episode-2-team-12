// H5 · One scorecard per model, measured the way the website uses it (through Ollama and the app's own code).
//
//   bun ai/eval/run.ts --model suu-v2 --live            # asks the running Ollama (ai/serve/start.sh)
//   bun ai/eval/run.ts --model suu-v2 --pred out.jsonl  # scores saved outputs {id, output} instead
//
// Three parts, each a fixed held-out set no training data uses:
//   hard    ai/eval/hard-holdout.json  — chat explanations of the hard templates: is the final answer right?
//   desmos  ai/eval/desmos-holdout.json — Desmos lessons: would the app show it (parseModelLesson)?
//   v2      ai/data/tuning-v2/test.jsonl — chat / planner / analyze / stepcheck, scored by ai/v2/score.ts
// Writes ai/models/<model>/scorecard.json. ai/eval/gate.ts compares it with the previous model's in CI.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { answersMatch, parseModelLesson } from '../../src/features/tutor/lib/desmos-lesson-parse';
import { answerFromExplanation } from '../../src/server/ai/desmos-lesson';
import { CHAT_PROMPT, DESMOS_PROMPT, desmosUserMessage, EXPLAIN_ASK } from '../../src/server/ai/prompts';
import { readJsonl, scoreRow, summarize } from '../v2/score';
import type { Row } from '../v2/skills';
import DESMOS from './desmos-holdout.json';
import HARD from './hard-holdout.json';
import type { HardItem } from './hard-set';

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };
export type EvalItem = { id: string; part: 'hard' | 'desmos' | 'v2'; messages: Msg[]; json?: boolean };
export type Scorecard = {
  model: string;
  date: string;
  /** metric → whole percent. Keys look like "hard.answer_correct", "desmos.shown", "v2.chat.hint_leak". */
  metrics: Record<string, number>;
  n: Record<string, number>;
};

type DesmosRow = { technique: string; question: string; answer: string };
const V2_TEST = join(import.meta.dir, '..', 'data', 'tuning-v2', 'test.jsonl');

/** Every prompt of the three parts, in the exact format the app sends. */
export function evalItems(v2Rows: Row[] = readJsonl<Row>(V2_TEST)): EvalItem[] {
  const hard = (HARD as HardItem[]).map((h) => ({
    id: h.id,
    part: 'hard' as const,
    messages: [
      { role: 'system' as const, content: CHAT_PROMPT },
      { role: 'user' as const, content: `${h.question}\n\n${EXPLAIN_ASK}` },
    ],
  }));
  const desmos = (DESMOS as DesmosRow[]).map((d, i) => ({
    id: `desmos-${i}`,
    part: 'desmos' as const,
    json: true,
    messages: [
      { role: 'system' as const, content: DESMOS_PROMPT },
      { role: 'user' as const, content: desmosUserMessage(d.question, d.answer) },
    ],
  }));
  const v2 = v2Rows
    .filter((r) => r.skill !== 'desmos')
    .map((r) => ({
      id: r.id,
      part: 'v2' as const,
      json: r.skill === 'planner' || r.skill === 'analyze',
      messages: r.messages.filter((m) => m.role !== 'assistant') as Msg[],
    }));
  return [...hard, ...desmos, ...v2];
}

/** The explanation ends with the right answer (for multiple choice: the letter, or the value of that choice). */
export function hardAnswerOk(output: string, h: HardItem): boolean {
  // "Хариу: B" (a bare letter) is fine too; answerFromExplanation only knows "B)" and "(B)"
  const bare = [...output.matchAll(/Хариу:\s*\$?([A-D])\$?\s*\.?\s*$/gm)].at(-1)?.[1];
  const said = answerFromExplanation(output) ?? bare ?? null;
  if (!said) return false;
  if (answersMatch(said, h.answer)) return true;
  if (!/^[A-D]$/.test(h.answer)) return false;
  const line = h.question.split('\n').find((l) => l.startsWith(`${h.answer}) `));
  // the choice text goes through the same normalisation as the reply (\frac{4}{3} → 4/3, 21\% → 21)
  const value = line === undefined ? null : answerFromExplanation(`Хариу: ${line.slice(3)}`);
  return value !== null && answersMatch(said, value);
}

const pct = (k: number, n: number) => (n ? Math.round((100 * k) / n) : 0);

/** Scores model outputs (id → text). Items without an output count as failures, not as skipped. */
export function score(
  outputs: Map<string, string>,
  model: string,
  v2Rows: Row[] = readJsonl<Row>(V2_TEST),
): Scorecard {
  const metrics: Record<string, number> = {};
  const n: Record<string, number> = {};

  const hard = HARD as HardItem[];
  const right = hard.filter((h) => hardAnswerOk(outputs.get(h.id) ?? '', h)).length;
  metrics['hard.answer_correct'] = pct(right, hard.length);
  n.hard = hard.length;

  const desmos = DESMOS as DesmosRow[];
  const shown = desmos.filter(
    (d, i) => parseModelLesson(outputs.get(`desmos-${i}`) ?? '', d.question, d.answer).ok,
  ).length;
  metrics['desmos.shown'] = pct(shown, desmos.length);
  n.desmos = desmos.length;

  const scored = v2Rows
    .filter((r) => r.skill !== 'desmos')
    .map((r) => ({ skill: r.skill, scores: scoreRow(r, outputs.get(r.id) ?? '') }));
  for (const [skill, s] of Object.entries(summarize(scored))) {
    for (const [k, v] of Object.entries(s)) {
      if (k === 'n') n[`v2.${skill}`] = v;
      else metrics[`v2.${skill}.${k}`] = v;
    }
  }
  return { model, date: new Date().toISOString().slice(0, 10), metrics, n };
}

export const scorecardPath = (model: string) =>
  join(import.meta.dir, '..', 'models', model, 'scorecard.json');

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const model = arg('model');
  if (!model) {
    console.error('usage: bun ai/eval/run.ts --model <name> (--live | --pred outputs.jsonl)');
    process.exit(1);
  }
  const outputs = new Map<string, string>();
  const pred = arg('pred');
  if (pred) {
    for (const line of readFileSync(pred, 'utf8')
      .split('\n')
      .filter((l) => l.trim())) {
      const o = JSON.parse(line) as { id: string; output: string };
      outputs.set(o.id, o.output);
    }
  } else if (process.argv.includes('--live')) {
    const { ollamaChat } = await import('../../src/server/ai/ollama-client');
    process.env.OLLAMA_URL ||= 'http://127.0.0.1:11434';
    const items = evalItems();
    for (const [k, it] of items.entries()) {
      const out = await ollamaChat(it.messages, {
        temperature: 0,
        maxTokens: 1200,
        json: it.json,
        timeoutMs: 90_000,
      });
      outputs.set(it.id, out ?? '');
      if (k % 10 === 0) console.log(`${k + 1}/${items.length}`);
    }
  } else {
    console.error('--live эсвэл --pred <file> хэрэгтэй');
    process.exit(1);
  }
  const card = score(outputs, model);
  mkdirSync(join(import.meta.dir, '..', 'models', model), { recursive: true });
  writeFileSync(scorecardPath(model), `${JSON.stringify(card, null, 2)}\n`);
  console.log(JSON.stringify(card.metrics, null, 1));
}

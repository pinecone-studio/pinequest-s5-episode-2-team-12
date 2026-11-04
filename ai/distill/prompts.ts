// Verified distillation · step 1. Turns code-generated questions (every template, the hard ones included) into
// teacher prompts in the exact format Suu is trained and served with. The gold answer comes from the template code,
// so step 3 (verify.ts) can throw away every teacher reply that ends with a different answer.
//
//   bun ai/distill/prompts.ts --seed 41 --per 6        → ai/out/distill/prompts.jsonl
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { CHAT_PROMPT, DESMOS_PROMPT, desmosUserMessage, EXPLAIN_ASK } from '../../src/server/ai/prompts';
import type { Question } from '../../src/types';
import { finalAnswer, generate } from '../pipeline/generate';

export type DistillSkill = 'desmos' | 'chat';
export type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

export type DistillPrompt = {
  id: string;
  skill: DistillSkill;
  /** Template key ("sys-no-sol"), for per-template pass rates. */
  template: string;
  difficulty: 1 | 2 | 3;
  question: string;
  /** Gold answer computed by the template: a letter for multiple choice, else the grid-in value. */
  gold: string;
  messages: Msg[];
};

const LETTERS = ['A', 'B', 'C', 'D'];

/** The question as the student sees it: prompt plus lettered choices for multiple choice. */
export function questionText(q: Question): string {
  if (!q.choices) return q.prompt;
  return `${q.prompt}\n${q.choices.map((c, i) => `${LETTERS[i]}) ${c}`).join('\n')}`;
}

/** Gold answer in the form the lesson checker compares: a letter for MCQ, the value for grid-in. */
export function goldAnswer(q: Question): string {
  return typeof q.answer === 'number' ? (LETTERS[q.answer] ?? '') : finalAnswer(q);
}

export const templateOf = (id: string) => id.replace(/^g-/, '').replace(/-s\d+-\d+$/, '');

export function promptsFor(q: Question, skills: DistillSkill[] = ['desmos', 'chat']): DistillPrompt[] {
  const question = questionText(q);
  const gold = goldAnswer(q);
  const base = { template: templateOf(q.id), difficulty: q.difficulty, question, gold };
  return skills.map((skill) => ({
    ...base,
    id: `${q.id}-${skill}`,
    skill,
    messages:
      skill === 'desmos'
        ? [
            { role: 'system', content: DESMOS_PROMPT },
            { role: 'user', content: desmosUserMessage(question, gold) },
          ]
        : [
            { role: 'system', content: CHAT_PROMPT },
            { role: 'user', content: `${question}\n\n${EXPLAIN_ASK}` },
          ],
  }));
}

/** Hard questions first and twice as many of them: that is where the model is weakest. */
export function buildPrompts(seed: number, per: number, skills?: DistillSkill[]): DistillPrompt[] {
  const qs = generate(seed, per);
  const hard = generate(seed + 1, per).filter((q) => q.difficulty === 3);
  const all = [...qs, ...hard].sort((a, b) => b.difficulty - a.difficulty);
  return all.flatMap((q) => promptsFor(q, skills));
}

export function writeJsonl(path: string, rows: unknown[]) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
}

export function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

if (import.meta.main) {
  const rows = buildPrompts(Number(arg('seed', '41')), Number(arg('per', '6')));
  const out = arg('out', 'ai/out/distill/prompts.jsonl');
  writeJsonl(out, rows);
  console.log(`${rows.length} prompts → ${out}`);
}

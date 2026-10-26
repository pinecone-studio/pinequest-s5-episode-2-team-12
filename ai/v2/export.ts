// Suu v2 · builds the second training kit: ai/data/tuning-v2/{train,val,test}.jsonl + prompts.json.
// Skills: chat (the v1 Suu data + Latin-script + general + attack rows), planner, analyze, stepcheck.
// Desmos lessons are mixed in by the notebook from the v1 kit zip (sat_desmos_kit.zip), so the model
// keeps what it learned in the first training. Test rows never share a prompt with train or val.
// Run: `bun ai/v2/export.ts`
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Question } from '../../src/types';
import { generate } from '../pipeline/generate';
import { answerText, buildDataset, questionBlock } from '../train/export';
import { analyzeRows } from './analyze';
import { attackRows, generalRows, latinVariant } from './chat-extra';
import { plannerRows } from './planner';
import { CHAT_PROMPT, PROMPTS, type Row } from './skills';
import { stepcheckRows } from './stepcheck';

/** Rows per split for the generated skills. The notebook can use fewer (see CAP there). */
export const SIZES = { train: 800, val: 40, test: 60 } as const;
/** Share of chat rows that also get a Latin-script copy. */
const LATIN_EVERY = 8;

const userOf = (r: Row) => r.messages.find((m) => m.role === 'user')?.content ?? '';

/** Stable small hash (same as ai/train/export.ts). */
function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Keeps only rows whose prompt is not in `seen`, and adds theirs. */
function fresh(rows: Row[], seen: Set<string>): Row[] {
  return rows.filter((r) => {
    const u = userOf(r);
    if (seen.has(u)) return false;
    seen.add(u);
    return true;
  });
}

const explainReply = (q: Question) => `${q.explain}\n\nХариу: ${answerText(q)}`;

export function buildV2() {
  const v1 = buildDataset();
  const toRow =
    (prefix: string) =>
    (x: (typeof v1.train)[number], i: number): Row => ({
      skill: 'chat',
      id: `${prefix}-${x.questionId}-${x.mode}-${i}`,
      messages: x.messages,
    });
  const chatTrain = v1.train.map(toRow('chat'));
  const chatVal = v1.val.map(toRow('chatval'));
  const latin = (rows: Row[]) =>
    rows.filter((r) => hash(r.id) % LATIN_EVERY === 0).flatMap((r) => latinVariant(r) ?? []);

  // attack rows use fresh template questions (seeds 7/8), never ones in v1 train/val/eval
  const used = new Set(
    [
      ...v1.splits.origTrain,
      ...v1.splits.origVal,
      ...v1.splits.genTrain,
      ...v1.splits.genVal,
      ...v1.splits.genEval,
    ].map((q) => q.prompt),
  );
  const unused = (qs: Question[]) => qs.filter((q) => !used.has(q.prompt) && used.add(q.prompt));
  const attackTrain = attackRows(unused(generate(7, 1)), explainReply, questionBlock, 77);
  const attackVal = attackRows(unused(generate(8, 1)).slice(0, 10), explainReply, questionBlock, 78);
  const general = generalRows();

  // generated skills: test first, so train/val drop anything that repeats a test prompt
  const seen = new Set<string>();
  const test = {
    planner: fresh(plannerRows(23, SIZES.test, 'plan-test'), seen),
    analyze: fresh(analyzeRows(33, SIZES.test, 'ana-test'), seen),
    stepcheck: fresh(stepcheckRows(13, SIZES.test, 'step-test'), seen),
  };
  const val = {
    planner: fresh(plannerRows(22, SIZES.val, 'plan-val'), seen),
    analyze: fresh(analyzeRows(32, SIZES.val, 'ana-val'), seen),
    stepcheck: fresh(stepcheckRows(12, SIZES.val, 'step-val'), seen),
  };
  const train = {
    planner: fresh(plannerRows(21, SIZES.train, 'plan'), seen),
    analyze: fresh(analyzeRows(31, SIZES.train, 'ana'), seen),
    stepcheck: fresh(stepcheckRows(11, SIZES.train, 'step'), seen),
  };

  // chat test = the v1 held-out eval prompts (hand-written + template questions never trained on)
  const chatTest: Row[] = v1.eval.map((e, i) => ({
    skill: 'chat',
    id: `chat-test-${e.questionId}-${e.mode}-${i}`,
    messages: [
      { role: 'system', content: CHAT_PROMPT },
      { role: 'user', content: e.prompt },
    ],
    check: { mode: e.mode, accepted: e.accepted, source: e.source, answer: e.answer },
  }));

  const trainRows = [
    ...chatTrain,
    ...latin(chatTrain),
    ...general.filter((_, i) => i % 10 !== 9),
    ...attackTrain,
    ...train.planner,
    ...train.analyze,
    ...train.stepcheck,
  ];
  const valRows = [
    ...chatVal,
    ...latin(chatVal),
    ...general.filter((_, i) => i % 10 === 9),
    ...attackVal,
    ...val.planner,
    ...val.analyze,
    ...val.stepcheck,
  ];
  // test rows hold only system + user; the gold answer is kept in check.gold for reading, not for scoring
  const strip = (r: Row): Row => ({
    ...r,
    messages: r.messages.slice(0, 2),
    check: { ...r.check, gold: r.messages[2]?.content },
  });
  const testRows = [
    ...chatTest,
    ...test.planner.map(strip),
    ...test.analyze.map(strip),
    ...test.stepcheck.map(strip),
  ];
  return { train: trainRows, val: valRows, test: testRows };
}

const toJsonl = (rows: unknown[]) => `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`;

export function countBySkill(rows: Row[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((m, r) => {
    m[r.skill] = (m[r.skill] ?? 0) + 1;
    return m;
  }, {});
}

if (import.meta.main) {
  const out = join(import.meta.dir, '..', 'data', 'tuning-v2');
  mkdirSync(out, { recursive: true });
  const d = buildV2();
  writeFileSync(join(out, 'train.jsonl'), toJsonl(d.train));
  writeFileSync(join(out, 'val.jsonl'), toJsonl(d.val));
  writeFileSync(join(out, 'test.jsonl'), toJsonl(d.test));
  writeFileSync(join(out, 'prompts.json'), `${JSON.stringify(PROMPTS, null, 2)}\n`);
  for (const [name, rows] of Object.entries(d))
    console.log(name, rows.length, JSON.stringify(countBySkill(rows)));
}

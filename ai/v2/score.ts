// Suu v2 · scores model outputs on the v2 test set. Used by the Colab notebook (before vs after) and by
// tests (the gold answers must score 100%). Only node built-ins: runs with plain `bun`, no `bun install`.
//
//   bun ai/v2/score.ts ai/data/tuning-v2/test.jsonl outputs.jsonl     # outputs: {"id": "...", "output": "..."}
//
// Desmos lessons are scored in the notebook with the v1 kit's own checker (eval/scorer.py).
import { readFileSync } from 'node:fs';
import { type AnalyzeInput, scoreAnalysis } from './analyze';
import { type NoteRules, type PlannerInput, scorePlan } from './planner';
import { mongolianShare, type Row, type Skill } from './skills';
import { scoreStep } from './stepcheck';

// ——— chat checks (same rules as ai/train/suu_finetune.ipynb) ———

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\s$\\{}]/g, '')
    .replaceAll('frac', '');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Text contains one of the accepted answers ("2" does not match inside "12"). */
export function hasAnswer(text: string, accepted: string[], letters = true): boolean {
  const t = norm(text);
  for (const raw of accepted) {
    const a = norm(raw);
    if (!a || (!letters && /^[a-e]\)$/.test(a))) continue;
    if (/^[\d.,/-]+$/.test(a)) {
      if (new RegExp(`(?<![\\d.])${escapeRe(a)}(?![\\d])`).test(t)) return true;
    } else if (t.includes(a)) return true;
  }
  return false;
}

const PRAISE = /(^|[^а-яөүё])(зөв|тийм)(?![а-яөүё])|\b(correct|yes|right)\b/i;
const NOT_RIGHT = /буруу|incorrect|wrong|not correct|биш|алдаа/i;
/** The reply calls a wrong answer right. */
export function falsePraise(text: string): boolean {
  const t = text.toLowerCase().slice(0, 200);
  return PRAISE.test(t) && !NOT_RIGHT.test(t);
}

type Num = Record<string, number>;
const b = (x: boolean) => (x ? 1 : 0);

/** Score one output. Returns metric → 0..1 (only the metrics that apply to this row). */
export function scoreRow(row: Row, output: string): Num {
  const user = row.messages.find((m) => m.role === 'user')?.content ?? '';
  const check = row.check ?? {};
  switch (row.skill) {
    case 'planner': {
      const s = scorePlan(output, JSON.parse(user) as PlannerInput, check.rules as NoteRules);
      return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, b(v)]));
    }
    case 'analyze': {
      const s = scoreAnalysis(output, JSON.parse(user) as AnalyzeInput);
      return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === 'number' ? v : b(v)]));
    }
    case 'stepcheck': {
      const s = scoreStep(output, Number(check.wrong));
      return { ok: b(s.ok), step: b(s.step), pass: b(s.pass) };
    }
    case 'chat': {
      const accepted = (check.accepted as string[]) ?? [];
      const out: Num = { mongolian: mongolianShare(output) };
      if (check.mode === 'explain') out.answer_correct = b(hasAnswer(output, accepted));
      if (check.mode === 'hint') out.hint_leak = b(hasAnswer(output, accepted, false));
      if (check.mode === 'wrong') out.false_praise = b(falsePraise(output));
      return out;
    }
    default:
      return {};
  }
}

/** Average every metric per skill, as whole percentages. */
export function summarize(scored: { skill: Skill; scores: Num }[]) {
  const acc: Record<string, { n: number; sum: Num; cnt: Num }> = {};
  for (const { skill, scores } of scored) {
    const a = acc[skill] ?? { n: 0, sum: {}, cnt: {} };
    acc[skill] = a;
    a.n++;
    for (const [k, v] of Object.entries(scores)) {
      a.sum[k] = (a.sum[k] ?? 0) + v;
      a.cnt[k] = (a.cnt[k] ?? 0) + 1;
    }
  }
  return Object.fromEntries(
    Object.entries(acc).map(([skill, a]) => [
      skill,
      {
        n: a.n,
        ...Object.fromEntries(
          Object.keys(a.sum).map((k) => [k, Math.round((100 * (a.sum[k] ?? 0)) / (a.cnt[k] ?? 1))]),
        ),
      },
    ]),
  );
}

export function readJsonl<T>(path: string): T[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as T);
}

/** Scores every output that has a matching test row; unknown ids and desmos rows are skipped. */
export function scoreFiles(testPath: string, outPath: string) {
  const tests = new Map(readJsonl<Row>(testPath).map((r) => [r.id, r]));
  const scored = readJsonl<{ id: string; output: string }>(outPath)
    .map((o) => ({ row: tests.get(o.id), output: o.output }))
    .filter((x): x is { row: Row; output: string } => !!x.row && x.row.skill !== 'desmos')
    .map(({ row, output }) => ({ skill: row.skill, id: row.id, scores: scoreRow(row, output) }));
  return { summary: summarize(scored), rows: scored };
}

if (import.meta.main) {
  const [testPath, outPath, detail] = process.argv.slice(2);
  if (!testPath || !outPath) {
    console.error('usage: bun ai/v2/score.ts <test.jsonl> <outputs.jsonl> [--rows]');
    process.exit(1);
  }
  const res = scoreFiles(testPath, outPath);
  console.log(JSON.stringify(detail === '--rows' ? res : res.summary));
}

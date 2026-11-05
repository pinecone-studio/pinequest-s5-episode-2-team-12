// Verified distillation · step 3 (rejection sampling). Every teacher reply goes through the same checks the
// website runs; only replies that end with the template's gold answer survive. The survivors become training rows
// (the shortest passing reply per prompt), the failures are kept with a reason — they are the "rejected" side of
// the DPO pairs (ai/dpo/pairs.ts).
//
//   bun ai/distill/verify.ts   → ai/out/distill/{sft.jsonl, rejected.jsonl, report.md}
import { writeFileSync } from 'node:fs';
import {
  answersMatch,
  extractJson,
  mongolianRatio,
  parseModelLesson,
} from '../../src/features/tutor/lib/desmos-lesson-parse';
import { answerFromExplanation } from '../../src/server/ai/desmos-lesson';
import { arg, type DistillPrompt, type DistillSkill, type Msg, writeJsonl } from './prompts';
import { type Candidate, readJsonl } from './teacher';

export type RejectReason = 'json' | 'schema' | 'items' | 'mongolian' | 'answer' | 'no-answer' | 'too-long';
export type Verdict = { ok: true; clean: string } | { ok: false; reason: RejectReason };

export type SftRow = { skill: DistillSkill; id: string; source: 'distill'; messages: Msg[] };
export type Rejected = { id: string; sample: number; reason: RejectReason; text: string };

const MAX_CHAT_CHARS = 2500;

/** The value of choice `letter` in a question with "A) …" lines ("B" → "12"), or null. */
export function choiceValue(question: string, letter: string): string | null {
  const line = question.split('\n').find((l) => l.startsWith(`${letter}) `));
  return line ? line.slice(3).replace(/\$/g, '').trim() : null;
}

/** True when the explanation's final answer is the gold one (for MCQ, the letter or the choice's value). */
export function chatAnswerOk(text: string, question: string, gold: string): boolean | null {
  const said = answerFromExplanation(text);
  if (!said) return null;
  if (answersMatch(said, gold)) return true;
  if (/^[A-D]$/.test(gold)) {
    const v = choiceValue(question, gold);
    return v !== null && answersMatch(said, v);
  }
  return false;
}

export function verify(p: Pick<DistillPrompt, 'skill' | 'question' | 'gold'>, text: string): Verdict {
  if (p.skill === 'desmos') {
    const r = parseModelLesson(text, p.question, p.gold);
    if (!r.ok) return { ok: false, reason: r.reason };
    // train on the bare JSON object (no code fences or chatter around it) — that is what the app parses best
    return { ok: true, clean: JSON.stringify(extractJson(text)) };
  }
  const t = text.trim();
  if (t.length > MAX_CHAT_CHARS) return { ok: false, reason: 'too-long' };
  if (mongolianRatio([t]) < 0.6) return { ok: false, reason: 'mongolian' };
  const ok = chatAnswerOk(t, p.question, p.gold);
  if (ok === null) return { ok: false, reason: 'no-answer' };
  if (!ok) return { ok: false, reason: 'answer' };
  return { ok: true, clean: t };
}

export type Stats = { prompts: number; kept: number; samples: number; passed: number };

export function distill(prompts: DistillPrompt[], candidates: Candidate[]) {
  const byId = new Map(prompts.map((p) => [p.id, p]));
  const best = new Map<string, string>();
  const rejected: Rejected[] = [];
  const stat = new Map<string, Stats>();
  const bump = (key: string, f: (s: Stats) => void) => {
    const s = stat.get(key) ?? { prompts: 0, kept: 0, samples: 0, passed: 0 };
    f(s);
    stat.set(key, s);
  };
  for (const c of candidates) {
    const p = byId.get(c.id);
    if (!p) continue;
    const v = verify(p, c.text);
    for (const key of [p.skill, `${p.skill}:${p.template}`, `${p.skill}:d${p.difficulty}`]) {
      bump(key, (s) => {
        s.samples++;
        if (v.ok) s.passed++;
      });
    }
    if (!v.ok) {
      rejected.push({ id: c.id, sample: c.sample, reason: v.reason, text: c.text });
      continue;
    }
    const prev = best.get(c.id);
    if (prev === undefined || v.clean.length < prev.length) best.set(c.id, v.clean);
  }
  const asked = new Set(candidates.map((c) => c.id));
  for (const p of prompts) {
    if (!asked.has(p.id)) continue;
    for (const key of [p.skill, `${p.skill}:${p.template}`, `${p.skill}:d${p.difficulty}`]) {
      bump(key, (s) => {
        s.prompts++;
        if (best.has(p.id)) s.kept++;
      });
    }
  }
  const sft: SftRow[] = [...best].map(([id, clean]) => {
    const p = byId.get(id) as DistillPrompt;
    return {
      skill: p.skill,
      id: `distill-${id}`,
      source: 'distill',
      messages: [...p.messages, { role: 'assistant', content: clean }],
    };
  });
  return { sft, rejected, stats: stat };
}

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '—');

export function report(stats: Map<string, Stats>, rejected: Rejected[]): string {
  const rows = [...stats].sort(([a], [b]) => a.localeCompare(b));
  const reasons = new Map<string, number>();
  for (const r of rejected) reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + 1);
  return [
    '# Verified distillation',
    '',
    'Багшийн (Gemini) хариу бүрийг вэбсайтын шалгагчаар шалгаж, зөвхөн зөв хариутайг нь үлдээв.',
    '',
    '| Хэсэг | Асуулт | Үлдсэн | Хариу | Тэнцсэн |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map(
      ([k, s]) =>
        `| ${k} | ${s.prompts} | ${s.kept} (${pct(s.kept, s.prompts)}) | ${s.samples} | ${pct(s.passed, s.samples)} |`,
    ),
    '',
    '## Хасагдсан шалтгаан',
    '',
    ...[...reasons].sort((a, b) => b[1] - a[1]).map(([r, n]) => `- ${r}: ${n}`),
    '',
  ].join('\n');
}

if (import.meta.main) {
  const dir = arg('dir', 'ai/out/distill');
  const prompts = readJsonl<DistillPrompt>(`${dir}/prompts.jsonl`);
  const candidates = readJsonl<Candidate>(`${dir}/candidates.jsonl`);
  const { sft, rejected, stats } = distill(prompts, candidates);
  writeJsonl(`${dir}/sft.jsonl`, sft);
  writeJsonl(`${dir}/rejected.jsonl`, rejected);
  writeFileSync(`${dir}/report.md`, report(stats, rejected));
  console.log(
    `${candidates.length} хариу → ${sft.length} сургалтын мөр, ${rejected.length} хасагдсан. ${dir}/report.md`,
  );
}

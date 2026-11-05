// DPO preference pairs: the same prompt with a good reply ("chosen") and a bad one ("rejected").
// Each kind targets a weakness measured in ai/models/EVAL.md:
//   verdict-wrong   — the checker says the student is WRONG; Suu praised it anyway (90% of the time in v2)
//   verdict-right   — the checker says RIGHT; the reply must not call it wrong
//   hint-leak       — a hint must not give the final answer (10–30% leaked)
//   distill         — a verified teacher reply vs a teacher reply that failed the checks (ai/distill)
//   lesson-answer   — a Desmos lesson must end with the answer it was given, not a nearby wrong one
// Output is TRL's conversational format: { prompt: [...messages], chosen: [assistant], rejected: [assistant] }.
//
//   bun ai/dpo/pairs.ts   → ai/out/dpo/{train,val}.jsonl + summary
import { existsSync } from 'node:fs';
import { arg, type Msg, writeJsonl } from '../distill/prompts';
import { readJsonl } from '../distill/teacher';
import type { Rejected, SftRow } from '../distill/verify';

export type PairKind = 'verdict-wrong' | 'verdict-right' | 'hint-leak' | 'distill' | 'lesson-answer';
export type Pair = { id: string; kind: PairKind; prompt: Msg[]; chosen: Msg[]; rejected: Msg[] };
export type ChatRow = { skill: string; id: string; messages: Msg[] };

const assistant = (content: string): Msg[] => [{ role: 'assistant', content }];
const promptOf = (r: { messages: Msg[] }) => r.messages.filter((m) => m.role !== 'assistant');
const replyOf = (r: { messages: Msg[] }) => r.messages.findLast((m) => m.role === 'assistant')?.content ?? '';
const userOf = (r: { messages: Msg[] }) => r.messages.findLast((m) => m.role === 'user')?.content ?? '';

/** Stable small hash, so the same row always gets the same fake reply and the same split. */
export function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
const pick = <T>(xs: readonly T[], key: string): T => xs[hash(key) % xs.length] as T;

// The mistakes a 3B model actually makes: confident praise for a wrong answer, and the reverse.
const FALSE_PRAISE = [
  'Зөв байна! 🎉 Маш сайн бодсон байна.',
  'Тийм ээ, зөв! 💪 Ингэж л бодно.',
  'Зөв хариу байна! Сайн ажиллалаа 👏',
] as const;
const FALSE_BLAME = [
  'Яг биш байна. Дахиад нэг шалгаад үз!',
  'Буруу байна. Алхмуудаа дахин хараарай.',
  'Харамсалтай нь зөв биш. Дахин оролдоорой!',
] as const;

/** The question part of a chat prompt (before the student's own line). Same question = same key. */
export const questionKey = (row: ChatRow) => (userOf(row).split('\n\n')[0] ?? '').trim();
/** "chat-g-slope-s1-3-hint-2" → "g-slope-s1-3", so a question's hint and explain rows can be matched. */
export const baseId = (id: string) => id.replace(/^chat-/, '').replace(/-(?:[a-z]+)-\d+$/, '');

export function verdictPairs(rows: ChatRow[]): Pair[] {
  const out: Pair[] = [];
  for (const r of rows) {
    const u = userOf(r);
    const wrong = u.includes('(Шалгагч: буруу)');
    const right = u.includes('(Шалгагч: зөв)');
    if (!wrong && !right) continue;
    const bad = wrong ? pick(FALSE_PRAISE, r.id) : pick(FALSE_BLAME, r.id);
    out.push({
      id: `${r.id}-verdict`,
      kind: wrong ? 'verdict-wrong' : 'verdict-right',
      prompt: promptOf(r),
      chosen: assistant(replyOf(r)),
      rejected: assistant(bad),
    });
  }
  return out;
}

const HINT_ASK = /hint|зөвлөгөө|яаж эхлэх/i;

/** Hint rows get a rejected twin that ends by giving away the answer from the same question's explain row. */
export function hintLeakPairs(rows: ChatRow[]): Pair[] {
  const answers = new Map<string, string>();
  for (const r of rows) {
    const a = /Хариу:\s*(.+)$/m.exec(replyOf(r))?.[1]?.trim();
    if (a && /-explain-\d+$/.test(r.id)) answers.set(baseId(r.id), a);
  }
  const out: Pair[] = [];
  for (const r of rows) {
    if (!/-hint-\d+$/.test(r.id) || !HINT_ASK.test(userOf(r))) continue;
    const answer = answers.get(baseId(r.id));
    const reply = replyOf(r);
    if (!answer || reply.includes(answer)) continue;
    out.push({
      id: `${r.id}-leak`,
      kind: 'hint-leak',
      prompt: promptOf(r),
      chosen: assistant(reply),
      rejected: assistant(`${reply}\n\nХариу: ${answer}`),
    });
  }
  return out;
}

/** A verified teacher reply vs a failed one for the same prompt (wrong answer, English, broken JSON…). */
export function distillPairs(sft: SftRow[], rejected: Rejected[]): Pair[] {
  const good = new Map(sft.map((r) => [r.id.replace(/^distill-/, ''), r]));
  const out: Pair[] = [];
  const used = new Set<string>();
  for (const bad of rejected) {
    const g = good.get(bad.id);
    // one pair per prompt is enough; more would over-weight easy prompts with many failures
    if (!g || used.has(bad.id) || !bad.text.trim()) continue;
    used.add(bad.id);
    out.push({
      id: `${bad.id}-distill`,
      kind: 'distill',
      prompt: promptOf(g),
      chosen: assistant(replyOf(g)),
      rejected: assistant(bad.text),
    });
  }
  return out;
}

/** A wrong answer that looks right: the next letter, or the number off by one. */
export function nearMiss(answer: string): string | null {
  const a = answer.trim();
  if (/^[A-D]$/.test(a)) return 'ABCD'[('ABCD'.indexOf(a) + 1) % 4] ?? null;
  const n = Number(a);
  if (Number.isFinite(n) && a !== '') return String(n + (n === 0 ? 1 : Math.sign(n)));
  return null;
}

/** Verified Desmos lessons whose rejected twin ends with a near-miss answer. */
export function lessonAnswerPairs(sft: SftRow[]): Pair[] {
  const out: Pair[] = [];
  for (const r of sft) {
    if (r.skill !== 'desmos') continue;
    let lesson: { answer?: unknown };
    try {
      lesson = JSON.parse(replyOf(r));
    } catch {
      continue;
    }
    const wrong = nearMiss(String(lesson.answer ?? ''));
    if (!wrong) continue;
    out.push({
      id: `${r.id}-near`,
      kind: 'lesson-answer',
      prompt: promptOf(r),
      chosen: assistant(replyOf(r)),
      rejected: assistant(JSON.stringify({ ...lesson, answer: wrong })),
    });
  }
  return out;
}

/** Every 20th prompt (by hash) goes to val. Pairs of the same question stay on one side. */
export function split(pairs: Pair[]) {
  const train: Pair[] = [];
  const val: Pair[] = [];
  for (const p of pairs) {
    const key = p.prompt.map((m) => m.content).join('\n');
    (hash(key) % 20 === 0 ? val : train).push(p);
  }
  return { train, val };
}

export function buildPairs(chat: ChatRow[], sft: SftRow[] = [], rejected: Rejected[] = []): Pair[] {
  return [
    ...verdictPairs(chat),
    ...hintLeakPairs(chat),
    ...distillPairs(sft, rejected),
    ...lessonAnswerPairs(sft),
  ];
}

export function countKinds(pairs: Pair[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const p of pairs) c[p.kind] = (c[p.kind] ?? 0) + 1;
  return c;
}

if (import.meta.main) {
  const chat = readJsonl<ChatRow>(arg('chat', 'ai/data/tuning-v2/train.jsonl')).filter(
    (r) => r.skill === 'chat',
  );
  const dir = arg('distill', 'ai/out/distill');
  const sft = existsSync(`${dir}/sft.jsonl`) ? readJsonl<SftRow>(`${dir}/sft.jsonl`) : [];
  const rej = existsSync(`${dir}/rejected.jsonl`) ? readJsonl<Rejected>(`${dir}/rejected.jsonl`) : [];
  const { train, val } = split(buildPairs(chat, sft, rej));
  const out = arg('out', 'ai/out/dpo');
  writeJsonl(`${out}/train.jsonl`, train);
  writeJsonl(`${out}/val.jsonl`, val);
  console.log(`train ${train.length}, val ${val.length}`, countKinds([...train, ...val]));
}

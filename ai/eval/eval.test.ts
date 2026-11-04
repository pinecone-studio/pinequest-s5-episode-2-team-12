import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { readJsonl } from '../v2/score';
import type { Row } from '../v2/skills';
import DESMOS from './desmos-holdout.json';
import { compare, readOrder, scorecards, TOLERANCE } from './gate';
import { buildHardSet, HARD_SET_PATH, type HardItem } from './hard-set';
import { evalItems, hardAnswerOk, type Scorecard, score } from './run';

const V2 = readJsonl<Row>(`${import.meta.dir}/../data/tuning-v2/test.jsonl`);
const hard = JSON.parse(readFileSync(HARD_SET_PATH, 'utf8')) as HardItem[];

/** What a perfect model would answer for every item. */
function goldOutputs(): Map<string, string> {
  const out = new Map<string, string>();
  for (const h of hard) out.set(h.id, `Алхам алхмаар бодлоо.\n\nХариу: ${h.answer}`);
  (DESMOS as { answer: string }[]).forEach((d, i) => {
    const lesson = {
      steps: [{ text: 'Хоёр графикийг зураад огтлолцлыг нь харна.', desmos: [{ latex: 'y=x' }] }],
      answer: d.answer,
    };
    out.set(`desmos-${i}`, JSON.stringify(lesson));
  });
  // the v2 test rows keep their gold answer in `check` (no assistant turn): a perfect chat reply per mode
  for (const r of V2) {
    if (r.skill !== 'chat') continue;
    const mode = r.check?.mode;
    const answer = String(r.check?.answer ?? '');
    if (mode === 'explain') out.set(r.id, `Алхам алхмаар бодъё.\n\nХариу: ${answer}`);
    if (mode === 'hint') out.set(r.id, 'Эхлээд мэдэгдэж байгаа утгуудаа бич.');
    if (mode === 'wrong') out.set(r.id, 'Яг биш байна. Дахиад шалгаад үз.');
  }
  return out;
}

describe('hard held-out set', () => {
  test('the committed file matches the generator (run `bun ai/eval/hard-set.ts` after template changes)', () => {
    expect(hard).toEqual(buildHardSet());
  });
  test('3 per hard template, unique ids and questions', () => {
    expect(hard.length).toBe(36);
    expect(new Set(hard.map((h) => h.id)).size).toBe(hard.length);
    expect(new Set(hard.map((h) => h.question)).size).toBe(hard.length);
  });
  test('MCQ answers accept the letter or the choice value', () => {
    const mcq = hard.find((h) => /^[A-D]$/.test(h.answer));
    if (!mcq) throw new Error('no mcq');
    const value =
      mcq.question
        .split('\n')
        .find((l) => l.startsWith(`${mcq.answer}) `))
        ?.slice(3) ?? '';
    expect(hardAnswerOk(`…\nХариу: ${mcq.answer}`, mcq)).toBe(true);
    expect(hardAnswerOk(`…\nХариу: ${value}`, mcq)).toBe(true);
    expect(hardAnswerOk('…\nХариу: Z', mcq)).toBe(false);
  });
});

describe('scorecard', () => {
  test('every item has a prompt ending with a user turn, and ids are unique', () => {
    const items = evalItems(V2);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    for (const i of items) expect(i.messages.at(-1)?.role).toBe('user');
  });
  test('gold outputs score 100% where it applies and 0% on the lower-is-better metrics', () => {
    const card = score(goldOutputs(), 'gold', V2);
    expect(card.metrics['hard.answer_correct']).toBe(100);
    expect(card.metrics['desmos.shown']).toBe(100);
    expect(card.metrics['v2.chat.answer_correct']).toBe(100);
    expect(card.metrics['v2.chat.hint_leak']).toBe(0);
    expect(card.metrics['v2.chat.false_praise']).toBe(0);
  });
  test('missing outputs count as failures', () => {
    const card = score(new Map(), 'empty', V2);
    expect(card.metrics['hard.answer_correct']).toBe(0);
    expect(card.metrics['desmos.shown']).toBe(0);
  });
});

describe('gate', () => {
  const card = (metrics: Record<string, number>): Scorecard => ({ model: 'm', date: 'd', metrics, n: {} });
  test('a drop beyond the tolerance fails; within it passes', () => {
    expect(
      compare(card({ 'hard.answer_correct': 60 }), card({ 'hard.answer_correct': 60 - TOLERANCE })),
    ).toEqual([]);
    expect(compare(card({ 'hard.answer_correct': 60 }), card({ 'hard.answer_correct': 50 }))).toEqual([
      { metric: 'hard.answer_correct', before: 60, after: 50 },
    ]);
  });
  test('lower-is-better metrics fail when they go up', () => {
    expect(compare(card({ 'v2.chat.hint_leak': 10 }), card({ 'v2.chat.hint_leak': 5 }))).toEqual([]);
    expect(compare(card({ 'v2.chat.false_praise': 10 }), card({ 'v2.chat.false_praise': 30 }))).toHaveLength(
      1,
    );
  });
  test('a metric that disappears fails', () => {
    expect(compare(card({ 'desmos.shown': 50 }), card({}))[0]?.metric).toBe('desmos.shown');
  });
  test('ORDER lists real model folders', () => {
    expect(readOrder()).toContain('suu-v1');
    expect(scorecards(['no-such-model'])).toEqual([]);
  });
});

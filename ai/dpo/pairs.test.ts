import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { readJsonl } from '../distill/teacher';
import type { Rejected, SftRow } from '../distill/verify';
import {
  baseId,
  buildPairs,
  type ChatRow,
  countKinds,
  distillPairs,
  hintLeakPairs,
  lessonAnswerPairs,
  nearMiss,
  split,
  verdictPairs,
} from './pairs';

const sys = { role: 'system' as const, content: 'S' };
const row = (id: string, user: string, reply: string): ChatRow => ({
  skill: 'chat',
  id,
  messages: [sys, { role: 'user', content: user }, { role: 'assistant', content: reply }],
});

describe('verdict pairs', () => {
  const wrong = row(
    'chat-g-x-s1-1-wrong-0',
    'Q\n\nМиний хариу: 5. Зөв үү?\n\n(Шалгагч: буруу)',
    'Яг биш байна.',
  );
  const right = row('chat-g-x-s1-1-check-0', 'Q\n\nМиний хариу: 4. Зөв үү?\n\n(Шалгагч: зөв)', 'Зөв байна!');
  test('a WRONG verdict pairs the honest reply against false praise', () => {
    const [p] = verdictPairs([wrong]);
    expect(p?.kind).toBe('verdict-wrong');
    expect(p?.chosen[0]?.content).toBe('Яг биш байна.');
    expect(p?.rejected[0]?.content).toMatch(/зөв/i);
    expect(p?.prompt.map((m) => m.role)).toEqual(['system', 'user']);
  });
  test('a RIGHT verdict pairs it against false blame', () => {
    const [p] = verdictPairs([right]);
    expect(p?.kind).toBe('verdict-right');
    expect(p?.rejected[0]?.content).toMatch(/биш|буруу/i);
  });
  test('rows without a checker line make no pair, and the fake reply is stable', () => {
    expect(verdictPairs([row('chat-g-x-s1-1-hint-0', 'Q\n\nHint?', 'Алхам')])).toEqual([]);
    expect(verdictPairs([wrong])).toEqual(verdictPairs([wrong]));
  });
});

describe('hint leak pairs', () => {
  test('ids of one question match across kinds', () => {
    expect(baseId('chat-g-slope-s1-3-hint-2')).toBe('g-slope-s1-3');
    expect(baseId('chat-g-slope-s1-3-explain-0')).toBe('g-slope-s1-3');
  });
  test('the rejected hint gives away the answer from the explain row', () => {
    const rows = [
      row('chat-g-pyth-s1-1-explain-0', 'Q\n\nАлхам алхмаар', '…\nХариу: 48'),
      row('chat-g-pyth-s1-1-hint-0', 'Q\n\nHint өгөх үү?', 'Пифагорын теоремыг ашигла.'),
    ];
    const [p] = hintLeakPairs(rows);
    expect(p?.chosen[0]?.content).toBe('Пифагорын теоремыг ашигла.');
    expect(p?.rejected[0]?.content).toBe('Пифагорын теоремыг ашигла.\n\nХариу: 48');
  });
  test('no pair without a known answer, or when the hint already contains it', () => {
    expect(hintLeakPairs([row('chat-g-a-s1-1-hint-0', 'Q\n\nhint', 'x')])).toEqual([]);
    const rows = [
      row('chat-g-b-s1-1-explain-0', 'Q', 'Хариу: 7'),
      row('chat-g-b-s1-1-hint-0', 'Q\n\nhint', '7-г ашигла'),
    ];
    expect(hintLeakPairs(rows)).toEqual([]);
  });
});

describe('distill and lesson pairs', () => {
  const lesson = JSON.stringify({ steps: [{ text: 'Зур', desmos: [] }], answer: '12' });
  const sft: SftRow[] = [
    {
      skill: 'desmos',
      id: 'distill-g-a-s1-1-desmos',
      source: 'distill',
      messages: [sys, { role: 'user', content: 'U' }, { role: 'assistant', content: lesson }],
    },
  ];
  test('one pair per prompt: verified reply vs failed reply', () => {
    const rej: Rejected[] = [
      { id: 'g-a-s1-1-desmos', sample: 1, reason: 'answer', text: 'bad 1' },
      { id: 'g-a-s1-1-desmos', sample: 2, reason: 'json', text: 'bad 2' },
      { id: 'g-zzz-desmos', sample: 0, reason: 'json', text: 'no good twin' },
    ];
    const ps = distillPairs(sft, rej);
    expect(ps).toHaveLength(1);
    expect(ps[0]?.rejected[0]?.content).toBe('bad 1');
    expect(ps[0]?.chosen[0]?.content).toBe(lesson);
  });
  test('near-miss answers', () => {
    expect(nearMiss('B')).toBe('C');
    expect(nearMiss('D')).toBe('A');
    expect(nearMiss('12')).toBe('13');
    expect(nearMiss('-3')).toBe('-4');
    expect(nearMiss('0')).toBe('1');
    expect(nearMiss('(1, 2)')).toBeNull();
  });
  test('a lesson pair differs only in the final answer', () => {
    const [p] = lessonAnswerPairs(sft);
    expect(JSON.parse(p?.rejected[0]?.content ?? '{}')).toEqual({ ...JSON.parse(lesson), answer: '13' });
  });
});

describe('split and real data', () => {
  test('pairs with the same prompt land on the same side', () => {
    const a = row('chat-g-q-s1-1-wrong-0', 'same\n\n(Шалгагч: буруу)', 'Биш.');
    const ps = verdictPairs([a, { ...a, id: 'other' }]);
    const { train, val } = split(ps);
    expect(train.length === 2 || val.length === 2).toBe(true);
  });

  test('the committed v2 chat data gives all three chat kinds and no empty side', () => {
    const chat = readJsonl<ChatRow>(join(import.meta.dir, '..', 'data', 'tuning-v2', 'train.jsonl')).filter(
      (r) => r.skill === 'chat',
    );
    const pairs = buildPairs(chat);
    const kinds = countKinds(pairs);
    expect(kinds['verdict-wrong']).toBeGreaterThan(100);
    expect(kinds['verdict-right']).toBeGreaterThan(100);
    expect(kinds['hint-leak']).toBeGreaterThan(100);
    for (const p of pairs) {
      expect(p.chosen[0]?.content).not.toBe(p.rejected[0]?.content);
      expect(p.chosen[0]?.content.trim()).not.toBe('');
      expect(p.prompt.at(-1)?.role).toBe('user');
    }
  });
});

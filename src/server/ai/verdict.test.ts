import { expect, test } from 'bun:test';
import { verdictFor } from './gemini-chat';
import { VERDICT, withVerdict } from './verdict';

test('verdict line: added only when graded', () => {
  expect(withVerdict('Миний хариу: A. Зөв үү?  ', false)).toBe(`Миний хариу: A. Зөв үү?\n\n${VERDICT.wrong}`);
  expect(withVerdict('x', true)).toBe(`x\n\n${VERDICT.right}`);
  expect(withVerdict('x', null)).toBe('x');
});

test('the server grades bank answers with code (a2: B) $2$)', () => {
  const ctx = { kind: 'question', id: 'a2' };
  expect(verdictFor({ message: 'problem\n\nМиний хариу: A', raw: false, context: ctx })).toBe(false);
  expect(verdictFor({ message: 'хариу B зөв үү?', raw: true, context: ctx })).toBe(true);
  expect(verdictFor({ message: 'яаж эхлэх вэ', raw: true, context: ctx })).toBeNull();
  expect(verdictFor({ message: 'Миний хариу: A', raw: true })).toBeNull();
});

test('the v3 chat data carries the same line on every check / wrong / mistake example', async () => {
  const rows = (await Bun.file('ai/data/tuning-v2/train.jsonl').text())
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l) as { id: string; messages: { role: string; content: string }[] });
  const graded = rows.filter((r) => /-(check|wrong|mistake)-\d+$/.test(r.id));
  expect(graded.length).toBeGreaterThan(500);
  for (const r of graded) {
    const user = r.messages.find((m) => m.role === 'user')?.content ?? '';
    const want = r.id.includes('-check-') ? VERDICT.right : VERDICT.wrong;
    expect(user.endsWith(want)).toBe(true);
  }
});

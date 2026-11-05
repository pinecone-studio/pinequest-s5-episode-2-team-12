import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { answersMatch } from '../../src/features/tutor/lib/desmos-lesson-parse';
import { checkable, convert, fromAqua, fromMath, lastBoxed, readRows, toPrompts } from './harder';

const fixture = (name: string) => readFileSync(join(import.meta.dir, 'fixtures', name), 'utf8');
const aqua = readRows<{ question: string; options: string[]; rationale?: string; correct: string }>(
  fixture('aqua-sample.jsonl'),
);
const math = readRows<{ problem: string; solution: string; level: string; type: string }>(
  fixture('math-sample.jsonl'),
);

describe('AQuA → 4-choice SAT question', () => {
  test('the gold letter still points at the original correct option', () => {
    for (const [i, row] of aqua.entries()) {
      const it = fromAqua(row, i);
      if (!it) continue;
      const original = row.options['ABCDE'.indexOf(row.correct)]?.replace(/^\s*[A-E]\s*\)?\s*/, '').trim();
      const line = it.question.split('\n').find((l) => l.startsWith(`${it.answer}) `));
      expect(line?.slice(3)).toBe(original);
      expect(it.question.split('\n').filter((l) => /^[A-D]\) /.test(l))).toHaveLength(4);
    }
  });
  test('a filler option ("None of these") is the one dropped', () => {
    const it = fromAqua(
      { question: 'Q?', options: ['A)1', 'B)2', 'C)3', 'D)4', 'E)None of these'], correct: 'C' },
      0,
    );
    expect(it?.question).toBe('Q?\nA) 1\nB) 2\nC) 3\nD) 4');
    expect(it?.answer).toBe('C');
  });
  test('rows whose answer is a filler, or that are too long, are skipped', () => {
    expect(
      fromAqua({ question: 'Q?', options: ['A)1', 'B)2', 'C)3', 'D)4', 'E)None of these'], correct: 'E' }, 0),
    ).toBeNull();
    expect(
      fromAqua({ question: 'x'.repeat(800), options: ['A)1', 'B)2', 'C)3', 'D)4', 'E)5'], correct: 'A' }, 0),
    ).toBeNull();
  });
  test('conversion is reproducible and keeps most of the real sample', () => {
    const a = aqua.map(fromAqua);
    expect(aqua.map(fromAqua)).toEqual(a);
    expect(a.filter(Boolean).length).toBeGreaterThanOrEqual(8);
  });
});

describe('MATH → checkable answer', () => {
  test('last boxed answer, nested braces included', () => {
    expect(lastBoxed('so $\\boxed{\\frac{7}{8}}$.')).toBe('\\frac{7}{8}');
    expect(lastBoxed('first \\boxed{1} then \\boxed{2}')).toBe('2');
    expect(lastBoxed('no box')).toBeNull();
  });
  test('only answers the app can check', () => {
    expect(checkable('\\frac{7}{8}')).toBe('7/8');
    expect(checkable('-\\frac{1}{2}')).toBe('-1/2');
    expect(checkable('(2,-3)')).toBe('(2, -3)');
    expect(checkable('120')).toBe('120');
    expect(checkable('5\\sqrt{2}')).toBeNull();
    expect(checkable('x^2+1')).toBeNull();
  });
  test('levels 3–5 of SAT-like topics only', () => {
    const kept = math.map((r, i) => fromMath(r, i)).filter(Boolean);
    expect(kept.map((x) => x?.answer)).toEqual(['5', '7/8', '(2, -3)', '120']);
  });
});

describe('prompts', () => {
  test('teacher prompts in the distillation format, gold answer checkable', () => {
    const { items, kept, read } = convert(aqua, math);
    expect(read).toEqual({ aqua: 12, math: 7 });
    expect(kept.math).toBe(4);
    const ps = toPrompts(items);
    expect(new Set(ps.map((p) => p.id)).size).toBe(ps.length);
    for (const p of ps) {
      expect(p.skill).toBe('chat');
      expect(p.messages.at(-1)?.content).toContain('Алхам алхмаар');
      expect(p.messages.at(-1)?.content).not.toContain('Хариу:'); // the gold answer is never shown to the teacher
      expect(answersMatch(p.gold, p.gold)).toBe(true);
    }
  });
});

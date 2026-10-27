import { describe, expect, test } from 'bun:test';
import { parseModelLesson } from '../../src/features/tutor/lib/desmos-lesson-parse';
import { panelInput } from '../../src/features/tutor/lib/desmos-panel';
import KIT from '../../src/features/tutor/lib/fixtures/kit-lessons.json';
import { QUESTIONS } from '../../src/mocks/questions';
import { DESMOS_PROMPT, desmosUserMessage } from '../../src/server/ai/prompts';
import {
  distractors,
  type KitRow,
  latexify,
  panelQuestion,
  panelRow,
  panelRows,
  panelUserMessage,
  rng,
  splitInlineChoices,
} from './desmos-panel';

type Fixture = { technique: string; question: string; answer: string; output: string };
/** The 32 real kit lessons in the repo, as kit rows. */
const kit: KitRow[] = (KIT as Fixture[]).map((r) => ({
  technique: r.technique,
  question: r.question,
  answer: r.answer,
  messages: [
    { role: 'system', content: DESMOS_PROMPT },
    { role: 'user', content: desmosUserMessage(r.question, r.answer) },
    { role: 'assistant', content: r.output },
  ],
}));

test('the panel question and user message are exactly what the app sends', () => {
  for (const q of QUESTIONS) {
    const app = panelInput(q);
    expect(panelQuestion(q.prompt, q.choices)).toBe(app.question);
    if (app.answer)
      expect(panelUserMessage(app.question, app.answer)).toBe(desmosUserMessage(app.question, app.answer));
  }
});

test('money keeps its dollar sign, math loses its $ delimiters', () => {
  expect(panelQuestion('A gym charges \\$25 and $x$ dollars', ['$3$'])).toBe(
    'A gym charges \\$25 and x dollars\nA) 3',
  );
});

describe('panelRow', () => {
  const rows = panelRows(kit, 1);

  test('every kit lesson gives a row; the gold lesson and the system prompt are untouched', () => {
    expect(rows).toHaveLength(kit.length);
    rows.forEach((r, i) => {
      expect(r.messages[0]).toEqual(kit[i].messages[0]);
      expect(r.messages[2]).toEqual(kit[i].messages[2]);
      expect(r.messages[1].content).toBe(panelUserMessage(r.question, kit[i].answer));
      expect(r.answer).toBe(kit[i].answer);
    });
  });

  test('the app accepts the gold lesson for the panel question (same checks as live lessons)', () => {
    for (const r of rows) {
      const res = parseModelLesson(r.messages[2].content, r.question, r.answer);
      expect(res.ok).toBe(true);
    }
  });

  test('multiple choice: four choices, exactly one is the answer', () => {
    const mcq = rows.filter((r) => r.format === 'mcq');
    expect(mcq.length).toBeGreaterThan(5);
    for (const r of mcq) {
      const choices = r.question.split('\n').filter((l) => /^[A-D]\) /.test(l));
      expect(choices.map((c) => c[0])).toEqual(['A', 'B', 'C', 'D']);
      const values = choices.map((c) => c.slice(3).replace(/\\frac\{(-?\d+)\}\{(\d+)\}/, '$1/$2'));
      expect(values.filter((v) => v === r.answer)).toHaveLength(1);
      expect(new Set(values).size).toBe(4);
    }
  });

  test('kit questions with inline (A)…(D) become A) lines and keep the letter', () => {
    const letters = rows.filter((r) => r.format === 'letters');
    expect(letters.length).toBeGreaterThan(0);
    for (const r of letters) {
      expect(r.answer).toMatch(/^[A-D]$/);
      expect(r.question).toMatch(/\nA\) .+\nB\) .+\nC\) .+\nD\) .+$/);
      expect(r.question).not.toContain('(A)');
    }
  });

  test('the same kit row and seed always give the same row', () => {
    expect(panelRow(kit[3], 7)).toEqual(panelRow(kit[3], 7));
  });
});

describe('pieces', () => {
  test('latexify writes math the way the app prompts look', () => {
    expect(latexify('y ≥ 2x + 2 and y<=3')).toBe('y \\ge 2x + 2 and y \\le 3');
    expect(latexify('sqrt(49) + 3/4 of 10% of a $100 item')).toBe(
      '\\sqrt{49} + \\frac{3}{4} of 10\\% of a \\$100 item',
    );
    expect(latexify('x^2 - 2x/3')).toBe('x^2 - 2x/3');
  });

  test('distractors look like the answer and are never the answer', () => {
    const r = rng(5);
    for (const a of ['5', '-76', '2.5', '33/2', '(2, 5)', '0']) {
      const d = distractors(a, r)!;
      expect(d).toHaveLength(3);
      expect(new Set(d).size).toBe(3);
      expect(d).not.toContain(a);
      if (a.includes('(')) for (const x of d) expect(x).toMatch(/^\(-?[\d.]+, -?[\d.]+\)$/);
      if (a.includes('/')) for (const x of d) expect(x).toMatch(/^-?\d+\/\d+$/);
    }
    expect(distractors('x + 1', r)).toBeNull();
  });

  test('splitInlineChoices', () => {
    expect(splitInlineChoices('Which is equal to 2x? (A) x+x (B) 3x (C) x (D) 4x')).toEqual({
      stem: 'Which is equal to 2x?',
      choices: ['x+x', '3x', 'x', '4x'],
    });
    expect(splitInlineChoices('Which point? (A) (2, 2) (B) (0, 8) (C) (2, 6) (D) (-2, 1)')?.choices).toEqual([
      '(2, 2)',
      '(0, 8)',
      '(2, 6)',
      '(-2, 1)',
    ]);
    expect(splitInlineChoices('What is x if 3x = 9?')).toBeNull();
  });
});

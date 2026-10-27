import { describe, expect, test } from 'bun:test';
import { QUESTIONS } from '@/mocks/questions';
import type { Question } from '@/types';
import { drawRows } from './desmos-calc';
import { DESMOS_AI_LESSONS } from './desmos-lessons';
import { PANEL_QUESTION_MAX, panelInput, plainValue, visibleSteps } from './desmos-panel';

const base: Question = {
  id: 'x1',
  domain: 'alg',
  skill: 'Linear equations',
  difficulty: 1,
  prompt: 'If $3x+5=20$, what is $x$?',
  answer: 2,
  explain: '',
  hint: '',
};

describe('plainValue', () => {
  test('numbers, fractions and points come out plain', () => {
    expect(plainValue('$96$')).toBe('96');
    expect(plainValue('$-4$')).toBe('-4');
    expect(plainValue('−4')).toBe('-4');
    expect(plainValue('$\\frac{33}{2}$')).toBe('33/2');
    expect(plainValue('$\\dfrac{-1}{4}$')).toBe('-1/4');
    expect(plainValue('$\\left(2, 5\\right)$')).toBe('(2, 5)');
    expect(plainValue('2.5')).toBe('2.5');
  });

  test('anything else is not a plain value', () => {
    for (const c of ['$x=5$', '$5\\sqrt{3}$', 'The line has no slope', '$y=2x+1$', '$\\frac{x}{2}$', ''])
      expect(plainValue(c)).toBeNull();
  });
});

describe('panelInput', () => {
  test('multiple choice: prompt without $, choices as A) lines, the right choice as a value', () => {
    const q = { ...base, choices: ['$3$', '$4$', '$5$', '$6$'] };
    expect(panelInput(q)).toEqual({
      question: 'If 3x+5=20, what is x?\nA) 3\nB) 4\nC) 5\nD) 6',
      answer: '5',
    });
  });

  test('a choice that is not a plain value is sent as its letter', () => {
    const q = { ...base, answer: 1, choices: ['$y=x$', '$y=2x+1$', '$y=3x$', '$y=x-1$'] };
    expect(panelInput(q).answer).toBe('B');
  });

  test('grid-in sends the first accepted answer, plus the hand-written rows and tip', () => {
    const a1 = QUESTIONS.find((q) => q.id === 'a1')!;
    expect(panelInput(a1)).toEqual({
      question: 'If 3x+5\\le 20, what is the greatest possible value of x?',
      answer: '5',
      rows: ['y=3x+5', 'y=20'],
      tip: a1.desmos!.tip,
    });
  });

  test('long problems are cut to what the lesson endpoint accepts', () => {
    expect(panelInput({ ...base, prompt: 'x'.repeat(5000) }).question).toHaveLength(PANEL_QUESTION_MAX);
  });

  test('every bank question gives a usable input', () => {
    for (const q of QUESTIONS) {
      const p = panelInput(q);
      expect(p.question.length).toBeGreaterThan(3);
      expect(p.question).not.toContain('$');
      expect(p.answer).toBeTruthy();
    }
  });
});

test('visibleSteps keeps the last step locked until the answer is in', () => {
  const lesson = DESMOS_AI_LESSONS[0];
  const n = lesson.steps.length;
  expect(visibleSteps(lesson, false)).toBe(n - 1);
  expect(visibleSteps(lesson, true)).toBe(n);
  expect(visibleSteps({ ...lesson, steps: lesson.steps.slice(0, 1) }, false)).toBe(0);
});

test('drawRows draws expressions, tables and a regression', () => {
  const drawn: Record<string, unknown>[] = [];
  let blanks = 0;
  const calc = {
    setBlank: () => void blanks++,
    setExpression: (e: Record<string, unknown>) => void drawn.push(e),
    setMathBounds: () => {},
    destroy: () => {},
  };
  drawRows(calc, ['y=2x+1', 'TABLE:1,3;2,5;3,7;R']);
  expect(blanks).toBe(1);
  expect(drawn).toEqual([
    { id: 'r0', latex: 'y=2x+1' },
    {
      id: 'r1',
      type: 'table',
      columns: [
        { latex: 'x_1', values: ['1', '2', '3'] },
        { latex: 'y_1', values: ['3', '5', '7'] },
      ],
    },
    { id: 'r1reg', latex: 'y_1\\sim mx_1+b' },
  ]);
});

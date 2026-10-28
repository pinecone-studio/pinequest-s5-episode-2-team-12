import { describe, expect, test } from 'bun:test';
import { QUESTIONS } from '@/mocks/questions';
import type { Question } from '@/types';
import { drawRows } from './desmos-calc';
import { DESMOS_AI_LESSONS } from './desmos-lessons';
import { PANEL_QUESTION_MAX, panelInput, plainValue, revealStep, visibleSteps } from './desmos-panel';

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
      expect(p.question).not.toMatch(/(?<!\\)\$/);
      expect(p.answer).toBeTruthy();
    }
  });
});

describe('revealStep / visibleSteps', () => {
  const step = (text: string, latex?: string) => ({ text, desmos: latex ? [{ latex }] : [] });
  const lesson = (question: string, answer: string, steps: ReturnType<typeof step>[]) => ({
    id: 'x',
    title: '',
    question,
    answer,
    check: '',
    match: [],
    steps,
  });

  test('a lesson that says the answer early is locked from that step (kit: function_eval)', () => {
    const l = lesson('The function f is defined by f(x) = -x^2 - 6x - 4. What is the value of f(6)?', '-76', [
      step('Функцийг Desmos-д бич: f(x) = -x^2 - 6x - 4.', 'f\\left(x\\right)=-x^2-6x-4'),
      step('Шинэ мөрөнд f(6) гэж бич. Desmos шууд -76 гэж бодно.', 'f\\left(6\\right)'),
      step('Хариу: -76.'),
    ]);
    expect(revealStep(l)).toBe(1);
    expect(visibleSteps(l, false)).toBe(1);
    expect(visibleSteps(l, true)).toBe(3);
  });

  test('numbers given in the question are not the answer giving itself away (3x + 5 = 20 → 5)', () => {
    const sample = DESMOS_AI_LESSONS[0];
    expect(revealStep(sample)).toBe(sample.steps.length - 1);
    expect(visibleSteps({ ...sample, steps: sample.steps.slice(0, 1) }, false)).toBe(0);
  });

  test('the choices hold the answer, so they never count as given', () => {
    const l = lesson('What is x?\nA) 3\nB) 4\nC) 96\nD) 6', '96', [
      step('Хүснэгт бич.'),
      step('a·b^5 = 96 гарна.'),
      step('Хариу C.'),
    ]);
    expect(revealStep(l)).toBe(1);
  });

  test('fractions and points are matched however they are written', () => {
    const frac = lesson('Solve 2x = 33.', '33/2', [
      step('y = 2x бич.'),
      step('x = \\frac{33}{2} гарна.'),
      step('.'),
    ]);
    expect(revealStep(frac)).toBe(1);
    const point = lesson('Where do the lines meet?', '(2, 5)', [
      step('Хоёр шулуун зур.', 'y=2x+1'),
      step('Огтлолцол дээр дар.', '\\left(2,5\\right)'),
      step('Хариу (2, 5).'),
    ]);
    expect(revealStep(point)).toBe(1);
  });

  test('letter answers lock only the last step', () => {
    const l = lesson('Which is equivalent? (A) 2x (B) 3x', 'B', [
      step('Зур.'),
      step('B давхцана.'),
      step('Хариу B.'),
    ]);
    expect(revealStep(l)).toBe(2);
  });
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

describe('panelView (what the chat may know about the panel)', () => {
  test('only visible steps, Desmos rows as text, tables summarised', async () => {
    const { panelView } = await import('./desmos-panel');
    const lesson = {
      id: 'x',
      title: 'Огтлолцол',
      question: 'q',
      answer: '2',
      check: '',
      match: [],
      steps: [
        { text: 'Хоёр шулуун', desmos: [{ latex: 'y=2x+1' }, { latex: 'y=-x+7' }] },
        {
          text: 'Хүснэгт',
          desmos: [{ type: 'table' as const, columns: [{ latex: 'x_1', values: ['1', '2'] }] }],
        },
        { text: 'Хариу: x=2', desmos: [{ latex: '(2,5)' }] },
      ],
    };
    const v = panelView(lesson, 2, 5);
    expect(v.steps).toHaveLength(2);
    expect(v.step).toBe(1);
    expect(v.steps[0].latex).toEqual(['y=2x+1', 'y=-x+7']);
    expect(v.steps[1].latex).toEqual(['table(x_1=[1,2])']);
    expect(JSON.stringify(v)).not.toContain('(2,5)');
  });
});

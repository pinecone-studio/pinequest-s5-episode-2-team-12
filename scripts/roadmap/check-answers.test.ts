import { describe, expect, test } from 'bun:test';
import type { RoadmapQuestion } from '../../src/features/roadmap/content/schema';
import { checkQuestion } from './check-answers';
import { evaluate, numeric, texToExpr } from './expr';

const base = {
  topicId: 1,
  domain: 'alg',
  skill: 'Linear equations in one variable',
  difficulty: 1,
  pool: 'stop',
  prompt: 'If 3x+5=20, what is x?',
  mn: 'x-ийг ол',
  explain: 'алхам алхмаар',
  hint: 'хас',
  source: 'original',
  reviewed: false,
  author: 'test',
  createdAt: '2026-10-25',
} as const;

const spr = (answer: string[], verify?: RoadmapQuestion['verify']): RoadmapQuestion =>
  ({ ...base, id: 'rmt-1', format: 'spr', answer, verify }) as RoadmapQuestion;
const mcq = (choices: string[], answer: number, verify?: RoadmapQuestion['verify']): RoadmapQuestion =>
  ({ ...base, id: 'rmt-2', format: 'mcq', choices, answer, verify }) as RoadmapQuestion;

describe('expr', () => {
  test('LaTeX → value', () => {
    expect(numeric('$\\frac{3}{4}$')).toBe(0.75);
    expect(numeric('$2\\sqrt{9}$')).toBe(6);
    expect(numeric('.75')).toBe(0.75);
    expect(numeric('$12\\pi$')).toBeCloseTo(37.699, 2);
    expect(numeric('$1,200$')).toBe(1200);
    expect(numeric('$y=2x+1$')).toBeNull();
    expect(numeric('The mean')).toBeNull();
  });

  test('implicit multiplication and powers', () => {
    expect(evaluate('3x+5', { x: 5 })).toBe(20);
    expect(evaluate('2(x+1)^2', { x: 2 })).toBe(18);
    expect(texToExpr('x^{2}')).toBe('x^(2)');
  });
});

describe('checkQuestion', () => {
  test('spr: correct answer passes substitution', () => {
    expect(checkQuestion(spr(['5'], { sub: { var: 'x', eq: '3x+5=20' } }))).toEqual([]);
  });

  test('spr: wrong stored answer is a mismatch', () => {
    const f = checkQuestion(spr(['6'], { sub: { var: 'x', eq: '3x+5=20' } }));
    expect(f[0].level).toBe('mismatch');
  });

  test('spr: accepted forms must agree', () => {
    const f = checkQuestion(spr(['3/4', '0.7'], { value: '3/4' }));
    expect(f.some((x) => x.message.includes('disagree'))).toBe(true);
    expect(checkQuestion(spr(['3/4', '.75', '0.75'], { value: '3/4' }))).toEqual([]);
  });

  test('spr: grid-in decimals may truncate or round the exact value', () => {
    expect(checkQuestion(spr(['1/6', '.1666', '.1667', '0.1666'], { value: '5/30' }))).toEqual([]);
    expect(checkQuestion(spr(['16.7', '16.67', '50/3'], { value: '(1-1/1.2)*100' }))).toEqual([]);
    expect(checkQuestion(spr(['1/6', '.17'], { value: '1/6' })).length).toBe(1);
    expect(checkQuestion(spr(['1/6', '.1665'], { value: '1/6' })).length).toBe(1);
  });

  test('mcq: keyed choice must match, others must not', () => {
    expect(checkQuestion(mcq(['$3$', '$4$', '$5$', '$6$'], 2, { value: '15/3' }))).toEqual([]);
    expect(checkQuestion(mcq(['$3$', '$4$', '$5$', '$6$'], 1, { value: '15/3' }))[0].level).toBe('mismatch');
    const twice = checkQuestion(mcq(['$5$', '$\\frac{10}{2}$', '$4$', '$6$'], 0, { value: '5' }));
    expect(twice.some((x) => x.message.includes('two correct'))).toBe(true);
  });

  test('questions without verify are listed for a person', () => {
    expect(checkQuestion(spr(['5']))[0].level).toBe('manual');
  });
});

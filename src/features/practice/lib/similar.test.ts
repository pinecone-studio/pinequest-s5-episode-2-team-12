import { describe, expect, test } from 'bun:test';
import { finalAnswer, generate, TEMPLATES } from '@ai/pipeline/generate';
import { isCorrect } from '@/features/roadmap/lib/grade';
import { CB_SKILL, similarQuestion, templateKeyOf, templatesFor } from './similar';

/** The 19 College Board Math skills (the official bank's `skill` values). */
const CB = new Set([
  'Linear equations in one variable',
  'Linear functions',
  'Linear equations in two variables',
  'Systems of two linear equations in two variables',
  'Linear inequalities in one or two variables',
  'Nonlinear functions',
  'Nonlinear equations in one variable and systems of equations in two variables',
  'Equivalent expressions',
  'Ratios, rates, proportional relationships, and units',
  'Percentages',
  'One-variable data: distributions and measures of center and spread',
  'Two-variable data: models and scatterplots',
  'Probability and conditional probability',
  'Inference from sample statistics and margin of error',
  'Evaluating statistical claims: observational studies and experiments',
  'Area and volume',
  'Lines, angles, and triangles',
  'Right triangles and trigonometry',
  'Circles',
]);

describe('skill map', () => {
  test('every template maps to a real College Board skill', () => {
    for (const t of TEMPLATES) {
      expect(CB_SKILL[t.key]).toBeDefined();
      expect(CB.has(CB_SKILL[t.key] as string)).toBe(true);
    }
    for (const key of Object.keys(CB_SKILL)) expect(TEMPLATES.some((t) => t.key === key)).toBe(true);
  });
});

describe('templateKeyOf', () => {
  test('generated and similar ids give their template; others give null', () => {
    expect(templateKeyOf('g-sys-no-sol-s5-2')).toBe('sys-no-sol');
    expect(templateKeyOf('sim-pct-reverse-123')).toBe('pct-reverse');
    expect(templateKeyOf('g-no-such-thing-s1-1')).toBeNull();
    expect(templateKeyOf('eccbf957')).toBeNull();
  });
});

describe('templatesFor', () => {
  test('a generated question gets exactly its own template', () => {
    const q = generate(9, 1).find((x) => x.id.startsWith('g-circle-general-'));
    if (!q) throw new Error('no question');
    expect(templatesFor(q).map((t) => t.key)).toEqual(['circle-general']);
  });
  test('an official bank question is matched by College Board skill and domain', () => {
    const base = { id: 'eccbf957', domain: 'geo', skill: 'Circles', difficulty: 3, prompt: 'x' } as const;
    const keys = templatesFor(base).map((t) => t.key);
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) expect(CB_SKILL[k]).toBe('Circles');
    // same difficulty preferred
    expect(templatesFor(base).every((t) => t.difficulty === 3)).toBe(true);
  });
  test('falls back to any difficulty, and to nothing for skills no template makes', () => {
    const easyOnly = {
      id: 'x',
      domain: 'psda',
      skill: 'Probability and conditional probability',
      difficulty: 3,
      prompt: '',
    } as const;
    expect(templatesFor(easyOnly).map((t) => t.key)).toEqual(['probability']);
    const none = {
      id: 'x',
      domain: 'psda',
      skill: 'Two-variable data: models and scatterplots',
      difficulty: 2,
      prompt: '',
    } as const;
    expect(templatesFor(none)).toEqual([]);
  });
});

describe('similarQuestion', () => {
  const base = generate(4, 1).find((x) => x.id.startsWith('g-pct-reverse-'));
  if (!base) throw new Error('no question');

  test('same template, new numbers, never the same prompt; deterministic per seed', () => {
    const a = similarQuestion(base, 1);
    const b = similarQuestion(base, 2);
    expect(a?.id).toBe('sim-pct-reverse-1');
    expect(a?.prompt).not.toBe(base.prompt);
    expect(a?.prompt).not.toBe(b?.prompt);
    expect(similarQuestion(base, 1)).toEqual(a);
  });

  test('the generated answer is graded correct by the app grader, for every template', () => {
    for (const t of TEMPLATES) {
      const seedQ = generate(2, 1).find((x) => x.id.startsWith(`g-${t.key}-s`));
      if (!seedQ) continue;
      for (let seed = 1; seed <= 3; seed++) {
        const q = similarQuestion(seedQ, seed);
        expect(q).not.toBeNull();
        if (!q) continue;
        const given = typeof q.answer === 'number' ? String(q.answer) : finalAnswer(q);
        expect(isCorrect(q, given)).toBe(true);
      }
    }
  });

  test('null when nothing fits', () => {
    const none = {
      id: 'x',
      domain: 'psda',
      skill: 'Inference from sample statistics and margin of error',
      difficulty: 2,
      prompt: '',
    } as const;
    expect(similarQuestion(none, 1)).toBeNull();
  });
});

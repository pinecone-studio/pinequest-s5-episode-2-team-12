import { describe, expect, test } from 'bun:test';
import {
  answersMatch,
  cleanItem,
  extractJson,
  LIMITS,
  mongolianRatio,
  normAnswer,
  parseModelLesson,
  TECHNIQUE_TITLES,
} from './desmos-lesson-parse';
import { DESMOS_AI_LESSONS } from './desmos-lessons';
// 2 reference lessons per technique from the training kit's held-out test set (what a perfect model writes)
import KIT from './fixtures/kit-lessons.json';

type KitRow = { technique: string; question: string; answer: string; output: string };
const kit = KIT as KitRow[];

/** A model reply for one of the hand-written sample lessons, in the training-kit format. */
function asModelReply(i: number, patch: Record<string, unknown> = {}) {
  const l = DESMOS_AI_LESSONS[i];
  return JSON.stringify({
    technique: 'intersection_equation',
    steps: l.steps,
    check: l.check,
    answer: l.answer,
    ...patch,
  });
}

describe('reference lessons from the training kit', () => {
  test('covers all 16 techniques', () => {
    expect(new Set(kit.map((r) => r.technique)).size).toBe(16);
    expect(Object.keys(TECHNIQUE_TITLES).sort()).toEqual([...new Set(kit.map((r) => r.technique))].sort());
  });

  test.each(kit.map((r, i) => [i, r.technique] as const))('#%i %s is accepted', (i) => {
    const r = kit[i];
    const res = parseModelLesson(r.output, r.question, r.answer);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.technique).toBe(r.technique);
    expect(res.lesson.title).toBe(TECHNIQUE_TITLES[r.technique]);
    expect(res.lesson.question).toBe(r.question);
    expect(res.lesson.answer).toBe(r.answer);
    expect(res.lesson.steps.length).toBeGreaterThan(0);
    expect(res.lesson.steps.length).toBeLessThanOrEqual(LIMITS.steps);
  });

  test('a wrong final answer is rejected', () => {
    const r = kit.find((x) => /^-?\d+$/.test(x.answer))!;
    const res = parseModelLesson(r.output, r.question, String(Number(r.answer) + 1));
    expect(res).toEqual({ ok: false, reason: 'answer' });
  });
});

describe('parseModelLesson', () => {
  const sample = DESMOS_AI_LESSONS[0];

  test('accepts code fences and text around the JSON', () => {
    const reply = `Энэ бол хичээл:\n\`\`\`json\n${asModelReply(0)}\n\`\`\``;
    expect(parseModelLesson(reply, sample.question, '5').ok).toBe(true);
    expect(parseModelLesson(`Тайлбар ${asModelReply(0)} дуусав`, sample.question, '5').ok).toBe(true);
  });

  test('answer formats: x = 5 matches 5, letters, fractions and points', () => {
    expect(parseModelLesson(asModelReply(0), sample.question, '5').ok).toBe(true);
    expect(answersMatch('x = 5', '5')).toBe(true);
    expect(answersMatch('(C)', 'C')).toBe(true);
    expect(answersMatch('33/2', '16.5')).toBe(true);
    expect(answersMatch('(2, 21)', '(2,21)')).toBe(true);
    expect(answersMatch('−4', '-4')).toBe(true);
    expect(answersMatch('C', 'D')).toBe(false);
    expect(answersMatch('(2, 21)', '21')).toBe(false);
    expect(normAnswer('21 метр')).toEqual({ kind: 'num', value: 21 });
  });

  test('rejects broken JSON and missing fields', () => {
    expect(parseModelLesson('not json', 'q', '5')).toEqual({ ok: false, reason: 'json' });
    expect(parseModelLesson('{"steps": [', 'q', '5')).toEqual({ ok: false, reason: 'json' });
    expect(parseModelLesson('{"steps": [], "answer": "5"}', 'q', '5')).toEqual({
      ok: false,
      reason: 'schema',
    });
    expect(parseModelLesson(asModelReply(0, { answer: undefined }), 'q', '5')).toEqual({
      ok: false,
      reason: 'schema',
    });
  });

  test('rejects lessons that draw nothing or have unusable items', () => {
    const noDraw = { steps: [{ text: 'Хариу нь 5 байна гэж бод.', desmos: [] }], answer: '5' };
    expect(parseModelLesson(JSON.stringify(noDraw), 'q', '5')).toEqual({ ok: false, reason: 'items' });
    const bad = { steps: [{ text: 'Шулуун зур.', desmos: [{ color: 'blue' }] }], answer: '5' };
    expect(parseModelLesson(JSON.stringify(bad), 'q', '5')).toEqual({ ok: false, reason: 'items' });
  });

  test('rejects English-only lessons', () => {
    const en = {
      steps: [
        { text: 'Graph the left side as a line and find where it crosses.', desmos: [{ latex: 'y=3x+5' }] },
      ],
      answer: '5',
    };
    expect(parseModelLesson(JSON.stringify(en), 'q', '5')).toEqual({ ok: false, reason: 'mongolian' });
  });

  test('too many steps or too long text is rejected', () => {
    const step = { text: 'Шулуун зур.', desmos: [{ latex: 'y=x' }] };
    const many = { steps: Array.from({ length: LIMITS.steps + 1 }, () => step), answer: '5' };
    expect(parseModelLesson(JSON.stringify(many), 'q', '5').ok).toBe(false);
    const long = { steps: [{ ...step, text: 'ы'.repeat(LIMITS.text + 1) }], answer: '5' };
    expect(parseModelLesson(JSON.stringify(long), 'q', '5').ok).toBe(false);
  });

  test('unknown technique still works, with a generic title', () => {
    const res = parseModelLesson(asModelReply(0, { technique: 'magic' }), sample.question, '5');
    expect(res.ok && res.lesson.title).toBe('Desmos');
    expect(res.ok && res.technique).toBeNull();
  });

  test('bad bounds are dropped, good bounds are kept', () => {
    const steps = [
      { text: 'Шулуун зур.', desmos: [{ latex: 'y=x' }], bounds: { left: 5, right: 1, bottom: 0, top: 1 } },
      { text: 'Цэгээ ол.', desmos: [{ latex: '(5,5)' }], bounds: { left: 0, right: 10, bottom: 0, top: 10 } },
    ];
    const res = parseModelLesson(JSON.stringify({ steps, answer: '5' }), 'q', '5');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.lesson.steps[0].bounds).toBeUndefined();
    expect(res.lesson.steps[1].bounds).toEqual({ left: 0, right: 10, bottom: 0, top: 10 });
  });
});

describe('cleanItem', () => {
  test('keeps known fields only and drops unknown colours / styles', () => {
    expect(
      cleanItem({ latex: 'y=x', color: 'pink', lineStyle: 'DOTTED', onclick: 'alert(1)', hidden: true }),
    ).toEqual({ latex: 'y=x' });
    expect(cleanItem({ latex: '(5,20)', color: 'green', label: 5 })).toEqual({
      latex: '(5,20)',
      color: 'green',
      label: '5',
      showLabel: true,
    });
    expect(cleanItem({ latex: 'k=1', sliderBounds: { min: -5, max: 5, step: 0.5 } })).toEqual({
      latex: 'k=1',
      sliderBounds: { min: '-5', max: '5', step: '0.5' },
    });
  });

  test('tables: numbers become strings, limits apply', () => {
    expect(cleanItem({ type: 'table', columns: [{ latex: 'x_1', values: [1, '2'] }] })).toEqual({
      type: 'table',
      columns: [{ latex: 'x_1', values: ['1', '2'] }],
    });
    const wide = {
      type: 'table',
      columns: Array.from({ length: LIMITS.columns + 1 }, () => ({ latex: 'x', values: [] })),
    };
    expect(cleanItem(wide)).toBeNull();
    expect(cleanItem({ latex: 'y='.padEnd(LIMITS.latex + 1, '1') })).toBeNull();
    expect(cleanItem('y=x')).toBeNull();
  });
});

test('extractJson', () => {
  expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  expect(extractJson('x {"a":1} y')).toEqual({ a: 1 });
  expect(extractJson('nothing')).toBeNull();
});

test('mongolianRatio ignores math and English terms in brackets', () => {
  expect(mongolianRatio(['Огтлолцлын цэг (intersection point) дээр дар.'])).toBe(1);
  expect(mongolianRatio(['Click the intersection point.'])).toBe(0);
  expect(mongolianRatio(['y = 3x + 5'])).toBe(0);
});

import { expect, test } from 'bun:test';
import HOLDOUT from './desmos-holdout.json';
import { summary } from './desmos-live';

test('the held-out set: 16 techniques × 3, each with a question and an answer', () => {
  expect(HOLDOUT).toHaveLength(48);
  expect(new Set(HOLDOUT.map((r) => r.technique)).size).toBe(16);
  for (const r of HOLDOUT) expect(r.question.length > 10 && r.answer.length > 0).toBe(true);
});

test('summary: shown %, same technique %, p50/p95 and per technique', () => {
  const s = summary([
    { technique: 'a', shown: true, ms: 1000, picked: 'a' },
    { technique: 'a', shown: false, ms: 3000, picked: null },
    { technique: 'b', shown: true, ms: 2000, picked: 'c' },
    { technique: 'b', shown: true, ms: 4000, picked: 'b' },
  ]);
  expect(s).toEqual({
    n: 4,
    shownPct: 75,
    sameTechniquePct: 50,
    p50Ms: 2000,
    p95Ms: 4000,
    perTechnique: { a: '1/2', b: '2/2' },
  });
});

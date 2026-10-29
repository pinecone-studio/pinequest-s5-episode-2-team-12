import { expect, test } from 'bun:test';
import { panelInput } from '../../src/features/tutor/lib/desmos-panel';
import { demoQuestions, warm } from './warm';

test('default: every bank problem with Desmos rows; ids pick exact problems', () => {
  const all = demoQuestions();
  expect(all.length).toBeGreaterThan(5);
  for (const q of all) expect(q.desmos?.rows.length).toBeGreaterThan(0);
  expect(demoQuestions(['a1', 'nope', 'v2']).map((q) => q.id)).toEqual(['a1', 'v2']);
});

test('sends exactly what the Desmos button sends and reports who wrote each lesson', async () => {
  const sent: { url: string; body: unknown }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init.body)) });
    return sent.length === 1
      ? Response.json({ source: 'model', lesson: {} })
      : new Response('', { status: 500 });
  }) as unknown as typeof fetch;
  const qs = demoQuestions(['a1', 'a2']);
  const res = await warm('https://site.test/', qs, fetchImpl, () => {});
  expect(sent[0].url).toBe('https://site.test/api/desmos/lesson');
  const p = panelInput(qs[0]);
  expect(sent[0].body).toEqual(
    p.answer ? { question: p.question, answer: p.answer } : { question: p.question },
  );
  expect(res.map((r) => r.source)).toEqual(['model', 'http 500']);
});

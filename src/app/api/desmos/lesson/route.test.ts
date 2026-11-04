import { afterEach, expect, test } from 'bun:test';
import KIT from '@/features/tutor/lib/fixtures/kit-lessons.json';
import { POST } from './route';

type KitRow = { technique: string; question: string; answer: string; output: string };
const good = (KIT as KitRow[]).find((r) => r.technique === 'circle')!;

const saved = { env: { ...process.env }, fetch: globalThis.fetch };
afterEach(() => {
  process.env = { ...saved.env };
  globalThis.fetch = saved.fetch;
});

const call = (body: unknown) =>
  POST(new Request('http://x/api/desmos/lesson', { method: 'POST', body: JSON.stringify(body) }));

/** Fake Ollama behind the global fetch (the route uses the default fetch). */
function fakeOllama(...replies: string[]) {
  let n = 0;
  process.env.OLLAMA_URL = 'http://ollama:11434';
  globalThis.fetch = (async () =>
    Response.json({ message: { content: replies[n++] ?? '' } })) as unknown as typeof fetch;
  return () => n;
}

test('400 on a bad body', async () => {
  expect((await call({ question: '' })).status).toBe(400);
  expect((await call({ question: 'x'.repeat(1201) })).status).toBe(400);
  expect((await call({ question: 'If x = 2, what is x?', answer: 'x'.repeat(41) })).status).toBe(400);
  expect((await POST(new Request('http://x', { method: 'POST', body: 'not json' }))).status).toBe(400);
});

test('a pitch question gets its sample lesson without calling the model', async () => {
  const calls = fakeOllama();
  const res = await call({ question: 'If 3x + 5 = 20, what is the value of x?' });
  expect(await res.json()).toMatchObject({ source: 'sample', lesson: { id: 'intersection' } });
  expect(calls()).toBe(0);
});

test('a keyword-matched sample with a different answer is not used for another problem', async () => {
  process.env.OLLAMA_URL = '';
  const q = 'A practice problem: if 3x + 5 = 20 and y = 2x, what is y?';
  expect(await (await call({ question: q, answer: '10' })).json()).toEqual({
    lesson: null,
    source: 'none',
    reason: 'off',
  });
  expect(await (await call({ question: q, answer: '5' })).json()).toMatchObject({ source: 'sample' });
});

test('model off → no lesson, reason off', async () => {
  process.env.OLLAMA_URL = '';
  const res = await call({ question: good.question, answer: good.answer });
  expect(await res.json()).toEqual({ lesson: null, source: 'none', reason: 'off' });
});

test('Desmos skill off (OLLAMA_SKILLS without desmos) → reason off, no model call', async () => {
  const calls = fakeOllama(good.output);
  process.env.OLLAMA_SKILLS = 'chat';
  const res = await call({ question: good.question, answer: good.answer });
  expect(await res.json()).toEqual({ lesson: null, source: 'none', reason: 'off' });
  expect(calls()).toBe(0);
});

test('Suu v1 (OLLAMA_SKILLS=desmos): lesson with the answer, no chat solving without it', async () => {
  const calls = fakeOllama(good.output);
  process.env.OLLAMA_SKILLS = 'desmos';
  expect(await (await call({ question: good.question, answer: good.answer })).json()).toMatchObject({
    source: 'model',
    answerFrom: 'student',
  });
  expect(calls()).toBe(1);
  expect(await (await call({ question: good.question })).json()).toEqual({
    lesson: null,
    source: 'none',
    reason: 'failed',
  });
  expect(calls()).toBe(1);
});

test('model on → the checked model lesson', async () => {
  fakeOllama(good.output);
  const body = await (await call({ question: good.question, answer: good.answer })).json();
  expect(body).toMatchObject({ source: 'model', answerFrom: 'student', technique: 'circle' });
  expect(body.lesson.answer).toBe(good.answer);
  expect(body.lesson.steps.length).toBeGreaterThan(0);
});

test('model writes nonsense twice → no lesson, reason failed', async () => {
  fakeOllama('nope', 'still nope');
  const res = await call({ question: good.question, answer: good.answer });
  expect(await res.json()).toEqual({ lesson: null, source: 'none', reason: 'failed' });
});

test('empty answer means Suu solves it first', async () => {
  fakeOllama(`…\n\nХариу: ${good.answer}`, good.output);
  const body = await (await call({ question: good.question, answer: '' })).json();
  expect(body).toMatchObject({ source: 'model', answerFrom: 'model' });
});

test('model on: a different question with a sample keyword goes to the model, not the sample', async () => {
  const maxmin = (KIT as KitRow[]).find((r) => r.technique === 'max_min')!;
  expect(maxmin.question).toContain('maximum height'); // the sample's keywords
  const calls = fakeOllama(maxmin.output);
  const body = await (await call({ question: maxmin.question, answer: maxmin.answer })).json();
  expect(body).toMatchObject({ source: 'model', technique: 'max_min' });
  expect(calls()).toBe(1);
});

test('model off: keyword matches still show the sample (demo mode)', async () => {
  process.env.OLLAMA_URL = '';
  const body = await (await call({ question: 'What is the maximum height of the ball?' })).json();
  expect(body).toMatchObject({ source: 'sample', lesson: { id: 'maxmin' } });
});

test('a plain equation is solved and graphed by code, without the model', async () => {
  const calls = fakeOllama();
  const res = await call({ question: 'x: 5(x - 4) + 7 = 3(x + 2) + 5' });
  expect(await res.json()).toMatchObject({ source: 'solver', lesson: { id: 'solver', answer: 'x = 12' } });
  expect(calls()).toBe(0);
  // a given answer must agree with the solver's, or the solver lesson is not used
  process.env.OLLAMA_URL = '';
  expect(await (await call({ question: '2x + 1 = 7', answer: '3' })).json()).toMatchObject({
    source: 'solver',
  });
  expect(await (await call({ question: '2x + 1 = 7', answer: '4' })).json()).toMatchObject({
    source: 'none',
  });
});

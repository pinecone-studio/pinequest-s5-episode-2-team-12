import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mockBank } from '@/features/exam/engine';
import { questionFacts } from '@/server/ai/student-data';
import { analyzeInput, plannerInput } from '@/server/ai/student-input';
import { analyze } from '../../../../ai/v2/analyze';
import { parseNote } from '../../../../ai/v2/note';
import { plan } from '../../../../ai/v2/planner';
import { POST as analyzePost } from './analyze/route';
import { POST as plannerPost } from './planner/route';

const saved = { env: { ...process.env }, fetch: globalThis.fetch };
beforeEach(() => {
  process.env.OLLAMA_URL = '';
  process.env.OLLAMA_SKILLS = '';
});
afterEach(() => {
  process.env = { ...saved.env };
  globalThis.fetch = saved.fetch;
});

const post = (handler: (r: Request) => Promise<Response>, body: unknown) =>
  handler(new Request('http://x/api/suu', { method: 'POST', body: JSON.stringify(body) }));

// a demo student's own history: 6 wrong answers on one topic (rushed), a few right ones elsewhere
const DAY = 86_400_000;
const now = Date.parse('2026-10-27T12:00:00Z');
const pool = mockBank().pool.filter((q) => q.topicId);
const topic13 = pool.filter((q) => q.topicId === 13).slice(0, 6);
const other = pool.filter((q) => q.topicId === 8).slice(0, 4);
const attempts = [
  ...topic13.map((q, i) => ({ qid: q.id, topicId: 13, correct: false, timeMs: 15_000, at: now - i * DAY })),
  ...other.map((q, i) => ({ qid: q.id, topicId: 8, correct: true, timeMs: 70_000, at: now - i * DAY })),
];
const mistakes = topic13.map((q, i) => ({ qid: q.id, source: 'stop' as const, at: now - i * DAY }));

describe('POST /api/suu/analyze', () => {
  test('the demo student’s own mistakes → the rule analysis while Суу is off', async () => {
    const res = await (await post(analyzePost, { attempts, mistakes })).json();
    const input = analyzeInput(mistakes, attempts, questionFacts);
    expect(res).toEqual({ analysis: analyze(input), source: 'rules', mistakes: 6, answered: 10 });
    expect(res.analysis.patterns).toContainEqual({ type: 'topic', topic: 13, count: 6 });
    expect(res.analysis.patterns).toContainEqual({ type: 'rushed', count: 6 });
  });

  test('Суу on and right → its analysis; no mistakes → nothing to analyze; bad body → 400', async () => {
    const input = analyzeInput(mistakes, attempts, questionFacts);
    process.env.OLLAMA_URL = 'http://ollama:11434';
    globalThis.fetch = (async () =>
      Response.json({ message: { content: JSON.stringify(analyze(input)) } })) as unknown as typeof fetch;
    expect((await (await post(analyzePost, { attempts, mistakes })).json()).source).toBe('model');
    expect(await (await post(analyzePost, { attempts })).json()).toEqual({
      analysis: null,
      source: 'none',
      mistakes: 0,
      answered: 10,
    });
    expect((await post(analyzePost, { mistakes: [{ qid: 'x', source: 'hack', at: 1 }] })).status).toBe(400);
  });
});

describe('POST /api/suu/planner', () => {
  const form = {
    today: '2026-10-27',
    examDate: '2026-12-05',
    current: 560,
    target: 700,
    hoursPerDay: 1.5,
    note: 'Пүрэв гарагт дугуйлантай.',
    weakIds: [12],
  };

  test('a week from the student’s own data, with the busy day free and habits from the mistakes', async () => {
    const res = await (await post(plannerPost, { ...form, attempts, mistakes })).json();
    const input = plannerInput(form, attempts, analyzeInput(mistakes, attempts, questionFacts));
    expect(res.source).toBe('rules');
    expect(res.plan).toEqual(plan(input, parseNote(form.note)));
    expect(res.plan.week.find((d: { day: string }) => d.day === 'Пү')).toEqual({
      day: 'Пү',
      min: 0,
      tasks: [],
    });
    expect(res.input.days).toEqual(['Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня', 'Да']);
    expect(res.input.topics.map((t: { id: number }) => t.id)).toEqual([8, 12, 13]);
    expect(input.habits).toEqual({ rushed: 6, slow: 0, desmos: expect.any(Number) });
  });

  test('Суу’s plan is used only when it passes the kit checks', async () => {
    const input = plannerInput(form, attempts, analyzeInput(mistakes, attempts, questionFacts));
    const gold = plan(input, parseNote(form.note));
    process.env.OLLAMA_URL = 'http://ollama:11434';
    globalThis.fetch = (async () =>
      Response.json({ message: { content: JSON.stringify(gold) } })) as unknown as typeof fetch;
    expect((await (await post(plannerPost, { ...form, attempts, mistakes })).json()).source).toBe('model');
    const noBusy = {
      ...gold,
      week: gold.week.map((d) => ({ ...d, min: 60, tasks: [{ t: 'review', min: 60 }] })),
    };
    globalThis.fetch = (async () =>
      Response.json({ message: { content: JSON.stringify(noBusy) } })) as unknown as typeof fetch;
    expect((await (await post(plannerPost, { ...form, attempts, mistakes })).json()).source).toBe('rules');
  });

  test('a past exam date or a bad form is refused', async () => {
    expect((await post(plannerPost, { ...form, examDate: '2026-10-01' })).status).toBe(400);
    expect((await post(plannerPost, { ...form, hoursPerDay: 12 })).status).toBe(400);
    expect((await post(plannerPost, { ...form, note: 'x'.repeat(301) })).status).toBe(400);
  });
});

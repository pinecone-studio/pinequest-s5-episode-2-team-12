import { afterEach, describe, expect, test } from 'bun:test';
import { pick } from '../../../../ai/rag/build-index';
import { EXAMPLES, embed, LIBRARY_SIZE, ragCount, searchLocal, similarExamples, tokens } from './retrieve';

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe('the library', () => {
  test('16 Desmos techniques, 40 checked lessons each, every lesson valid JSON with an answer', () => {
    expect(LIBRARY_SIZE).toBe(640);
    const techniques = new Set(EXAMPLES.map((e) => e.technique));
    expect(techniques.size).toBe(16);
    for (const e of EXAMPLES) {
      const l = JSON.parse(e.lesson) as { steps: unknown[]; answer: string };
      expect(l.steps.length).toBeGreaterThan(0);
      expect(String(l.answer)).toBe(e.answer);
    }
  });

  test('build-index spreads its picks over each technique', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      technique: i < 6 ? 'a' : 'b',
      question: `q${i}`,
      answer: '1',
      messages: [{ role: 'assistant', content: '{}' }],
    }));
    const out = pick(rows, 3);
    expect(out.map((e) => e.question)).toEqual(['q0', 'q2', 'q4', 'q6', 'q7', 'q8']);
  });
});

describe('local vector search (offline)', () => {
  test('math shapes count, not the exact numbers', () => {
    expect(tokens('$x^2 - 5x + 6 = 0$')).toContain('§sq');
    expect(tokens('f(3) = ?')).toContain('§fval');
    expect(tokens('25% of 80')).toContain('§pct');
    expect(tokens('The point (2, -3)')).toContain('§point');
    expect(tokens('the THE of')).toEqual([]);
  });

  test('finds the right Desmos technique for app-style problems', () => {
    const cases: [string, string][] = [
      ['If $3x+5=20$, what is the value of $x$?', 'intersection_equation'],
      ['What is the radius of the circle $x^2+y^2-6x+4y=12$?', 'circle'],
      ['Data set: 4, 8, 15, 16, 23, 42. What is the mean of the data set?', 'statistics'],
      ['What is 35% of 240?', 'percent'],
      ['The function f is defined by f(x) = 2x^2 - 3. What is f(4)?', 'function_eval'],
    ];
    for (const [q, technique] of cases) expect(searchLocal(q, 1)[0]?.technique).toBe(technique);
  });

  test('nothing similar → no examples (no misleading shots)', () => {
    expect(searchLocal('Сайн уу', 2)).toEqual([]);
  });

  test('at most k, no duplicate questions, best first', () => {
    const hits = searchLocal('What value of x satisfies the equation 6(x + 4) = 42?', 3);
    expect(hits.length).toBeLessThanOrEqual(3);
    expect(new Set(hits.map((h) => h.question)).size).toBe(hits.length);
    expect([...hits].sort((a, b) => b.score - a.score)).toEqual(hits);
  });
});

describe('backends', () => {
  test('RAG_EXAMPLES: default 2, 0 = off, capped at 3', async () => {
    delete process.env.RAG_EXAMPLES;
    expect(ragCount()).toBe(2);
    process.env.RAG_EXAMPLES = '0';
    expect(ragCount()).toBe(0);
    expect((await similarExamples('If 3x+5=20, what is x?')).backend).toBe('off');
    process.env.RAG_EXAMPLES = '9';
    expect(ragCount()).toBe(3);
  });

  test('RAG_BACKEND=supabase without Supabase or a key falls back to the offline index', async () => {
    process.env.RAG_BACKEND = 'supabase';
    process.env.SUPABASE_SERVICE_ROLE_KEY = '';
    const r = await similarExamples('If $3x+5=20$, what is $x$?', 2);
    expect(r.backend).toBe('local');
    expect(r.hits.length).toBeGreaterThan(0);
  });

  test('embed: unit-length Gemini vector, null without a key or on errors', async () => {
    process.env.GEMINI_API_KEY = 'k';
    let body: Record<string, unknown> = {};
    const ok = (async (_u: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return Response.json({ embedding: { values: [3, 4] } });
    }) as unknown as typeof fetch;
    expect(await embed('q', 'RETRIEVAL_QUERY', ok)).toEqual([0.6, 0.8]);
    expect(body.taskType).toBe('RETRIEVAL_QUERY');
    expect(body.output_dimensionality).toBe(768);
    const down = (async () => new Response('x', { status: 429 })) as unknown as typeof fetch;
    expect(await embed('q', 'RETRIEVAL_QUERY', down)).toBeNull();
    process.env.GEMINI_API_KEY = '';
    expect(await embed('q', 'RETRIEVAL_QUERY', ok)).toBeNull();
  });
});

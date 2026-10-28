import { expect, test } from 'bun:test';
import { POST } from './route';

const call = (body: unknown) =>
  POST(new Request('http://x/api/tutor', { method: 'POST', body: JSON.stringify(body) }));

test('demo reply, labelled as demo', async () => {
  const res = await call({ mode: 'desmos', message: 'тусла' });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ demo: true });
});

test('400 on bad body', async () => {
  expect((await call({ message: '' })).status).toBe(400);
});

test('a pitch question gets the sample answer and a Desmos lesson link', async () => {
  const res = await call({ mode: 'explain', message: 'If 3x + 5 = 20, what is the value of x?', raw: true });
  expect(await res.json()).toMatchObject({ sample: true, demo: false, lesson: 'intersection' });
});

test('with a Gemini key (and Suu chat off) free chat goes to Gemini, labelled', async () => {
  const saved = { ...process.env };
  const realFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = 'k';
  process.env.OLLAMA_URL = '';
  let sent = '';
  globalThis.fetch = (async (_u: string, init: RequestInit) => {
    sent = String(init.body);
    return Response.json({
      candidates: [{ content: { parts: [{ text: 'Яг биш байна. Дахиад оролдоод үз.' }] } }],
    });
  }) as unknown as typeof fetch;
  try {
    const res = await call({
      mode: 'explain',
      message: 'Миний хариу: A',
      raw: true,
      context: { kind: 'question', id: 'a2' },
      history: [{ role: 'user', text: 'сайн уу' }],
      panel: { step: 0, steps: [{ text: 'Хоёр шулуун зур', latex: ['y=2x+1'] }] },
    });
    expect(await res.json()).toMatchObject({ model: 'gemini', demo: false });
    expect(sent).toContain('БУРУУ');
    expect(sent).toContain('y=2x+1');
  } finally {
    globalThis.fetch = realFetch;
    process.env = saved;
  }
});

test('a panel with too many steps is rejected', async () => {
  const steps = Array.from({ length: 13 }, () => ({ text: 'x', latex: [] }));
  expect((await call({ message: 'hi', panel: { step: 0, steps } })).status).toBe(400);
});

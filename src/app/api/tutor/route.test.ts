import { afterEach, beforeEach, expect, test } from 'bun:test';
import { POST } from './route';

const call = (body: unknown) =>
  POST(new Request('http://x/api/tutor', { method: 'POST', body: JSON.stringify(body) }));

const saved = { url: process.env.OLLAMA_URL, skills: process.env.OLLAMA_SKILLS };
const realFetch = globalThis.fetch;
beforeEach(() => {
  process.env.OLLAMA_URL = 'http://ollama.test';
  process.env.OLLAMA_SKILLS = '';
});
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const [k, v] of [
    ['OLLAMA_URL', saved.url],
    ['OLLAMA_SKILLS', saved.skills],
  ] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

test('the model answers: its reply is returned', async () => {
  globalThis.fetch = (async () =>
    Response.json({ message: { content: 'Эхлээд 5-ыг хас.' } })) as unknown as typeof fetch;
  const res = await call({ mode: 'hint', message: 'Тойргийн талбай яаж олох вэ?' });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ text: 'Эхлээд 5-ыг хас.', model: 'suu' });
});

test('no model configured: 503, never a made-up reply', async () => {
  delete process.env.OLLAMA_URL;
  const res = await call({ mode: 'desmos', message: 'тусла' });
  expect(res.status).toBe(503);
  expect(await res.json()).toEqual({ error: 'suu_unavailable' });
});

test('the model is down: 503', async () => {
  globalThis.fetch = (async () => {
    throw new Error('ECONNREFUSED');
  }) as unknown as typeof fetch;
  const res = await call({ mode: 'hint', message: 'тусла' });
  expect(res.status).toBe(503);
});

test('the chat skill is switched off for this model version: 503', async () => {
  process.env.OLLAMA_SKILLS = 'desmos';
  const res = await call({ mode: 'hint', message: 'тусла' });
  expect(res.status).toBe(503);
});

test('400 on bad body', async () => {
  expect((await call({ message: '' })).status).toBe(400);
});

test('a pitch question gets the sample answer and a Desmos lesson link', async () => {
  const res = await call({ mode: 'explain', message: 'If 3x + 5 = 20, what is the value of x?', raw: true });
  expect(await res.json()).toMatchObject({ sample: true, lesson: 'intersection' });
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
    expect(await res.json()).toMatchObject({ model: 'gemini' });
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

test('a typed equation: a wrong model answer is replaced by the solver steps; a matching one is kept', async () => {
  const saved = { ...process.env };
  const realFetch = globalThis.fetch;
  process.env.OLLAMA_URL = 'http://ollama:11434';
  process.env.OLLAMA_SKILLS = 'chat';
  process.env.GEMINI_API_KEY = '';
  let reply = 'Хариу: 1';
  const sent: string[] = [];
  globalThis.fetch = (async (_u: string, init: RequestInit) => {
    sent.push(String(init.body));
    return Response.json({ message: { content: reply } });
  }) as unknown as typeof fetch;
  try {
    const message = 'x: 5(x - 4) + 7 = 3(x + 2) + 5';
    const wrong = await (await call({ mode: 'explain', message, raw: true })).json();
    expect(wrong).toMatchObject({ model: 'solver' });
    expect(wrong.text).toContain('$2x = 24$');
    expect(wrong.text).toContain('**Хариу:** $x = 12$');
    // the model was told the code-checked answer
    expect(sent[0]).toContain('Кодоор шалгасан хариу: x = 12');

    reply = 'Хаалтыг задлаад 2x = 24 болно. Хариу: x = 12';
    expect(await (await call({ mode: 'explain', message, raw: true })).json()).toMatchObject({
      text: reply,
      model: 'suu',
    });
  } finally {
    process.env = saved;
    globalThis.fetch = realFetch;
  }
});

test('without any model, a typed equation still gets the solver answer instead of a demo', async () => {
  const saved = { ...process.env };
  process.env.OLLAMA_URL = '';
  process.env.GEMINI_API_KEY = '';
  try {
    const res = await (await call({ mode: 'explain', message: '2x + 1 = 7', raw: true })).json();
    expect(res).toMatchObject({ model: 'solver' });
    expect(res.text).toContain('$x = 3$');
  } finally {
    process.env = saved;
  }
});

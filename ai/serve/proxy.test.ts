import { expect, test } from 'bun:test';
import { makeHandler, sameSecret } from './proxy';

const TOKEN = 'a'.repeat(32);

function upstream() {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.endsWith('/api/version')) return Response.json({ version: '0.12.0' });
    return Response.json({ message: { content: 'Сайн уу' } });
  }) as unknown as typeof fetch;
  return {
    calls,
    handler: makeHandler({ token: TOKEN, target: 'http://127.0.0.1:11434/', model: 'suu' }, fetchImpl),
  };
}

const chat = (body: unknown, auth = `Bearer ${TOKEN}`) =>
  new Request('https://x.trycloudflare.com/api/chat', {
    method: 'POST',
    headers: { authorization: auth, host: 'x.trycloudflare.com' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

test('forwards a chat for the allowed model to local Ollama, without the outside Host header', async () => {
  const { calls, handler } = upstream();
  const res = await handler(chat({ model: 'suu', messages: [] }));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ message: { content: 'Сайн уу' } });
  expect(calls[0].url).toBe('http://127.0.0.1:11434/api/chat');
  expect(calls[0].init?.headers).toEqual({ 'content-type': 'application/json' });
});

test('version check works with the token', async () => {
  const { handler } = upstream();
  const res = await handler(
    new Request('https://x/api/version', { headers: { authorization: `Bearer ${TOKEN}` } }),
  );
  expect(await res.json()).toEqual({ version: '0.12.0' });
});

test('401 without or with a wrong token, and nothing reaches Ollama', async () => {
  const { calls, handler } = upstream();
  expect((await handler(chat({ model: 'suu' }, ''))).status).toBe(401);
  expect((await handler(chat({ model: 'suu' }, 'Bearer nope'))).status).toBe(401);
  expect((await handler(chat({ model: 'suu' }, TOKEN))).status).toBe(401);
  expect(calls).toHaveLength(0);
});

test('other endpoints and methods are 404 (no pull / delete / create through the tunnel)', async () => {
  const { calls, handler } = upstream();
  const auth = { authorization: `Bearer ${TOKEN}` };
  for (const [method, path] of [
    ['POST', '/api/pull'],
    ['DELETE', '/api/delete'],
    ['POST', '/api/create'],
    ['POST', '/api/generate'],
    ['GET', '/api/tags'],
    ['GET', '/api/chat'],
  ]) {
    const res = await handler(new Request(`https://x${path}`, { method, headers: auth }));
    expect(res.status).toBe(404);
  }
  expect(calls).toHaveLength(0);
});

test('only the configured model, valid JSON and small bodies pass', async () => {
  const { calls, handler } = upstream();
  expect((await handler(chat({ model: 'llama3', messages: [] }))).status).toBe(403);
  expect((await handler(chat('{nope'))).status).toBe(400);
  expect((await handler(chat({ model: 'suu', pad: 'x'.repeat(70_000) }))).status).toBe(413);
  expect(calls).toHaveLength(0);
});

test('502 when Ollama is down', async () => {
  const down = (async () => {
    throw new Error('ECONNREFUSED');
  }) as unknown as typeof fetch;
  const handler = makeHandler({ token: TOKEN, target: 'http://127.0.0.1:11434', model: 'suu' }, down);
  expect((await handler(chat({ model: 'suu' }))).status).toBe(502);
});

test('an empty configured token never lets anything through', async () => {
  const handler = makeHandler({ token: '', target: 'http://127.0.0.1:11434', model: 'suu' });
  expect((await handler(chat({ model: 'suu' }, 'Bearer '))).status).toBe(401);
});

test('sameSecret', () => {
  expect(sameSecret('abc', 'abc')).toBe(true);
  expect(sameSecret('abc', 'abd')).toBe(false);
  expect(sameSecret('abc', 'abcd')).toBe(false);
  expect(sameSecret('', '')).toBe(true);
});

test('a third chat while two are still running gets 503 busy at once; slots free up afterwards', async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  let started = 0;
  const slow = (async () => {
    started++;
    await gate;
    return Response.json({ message: { content: 'ok' } });
  }) as unknown as typeof fetch;
  const handler = makeHandler(
    { token: TOKEN, target: 'http://127.0.0.1:11434', model: 'suu', maxInflight: 2 },
    slow,
  );
  const a = handler(chat({ model: 'suu', messages: [] }));
  const b = handler(chat({ model: 'suu', messages: [] }));
  await Bun.sleep(5);
  const c = await handler(chat({ model: 'suu', messages: [] }));
  expect(c.status).toBe(503);
  expect(await c.json()).toEqual({ error: 'busy' });
  expect(started).toBe(2);
  release();
  expect((await a).status).toBe(200);
  expect((await b).status).toBe(200);
  expect((await handler(chat({ model: 'suu', messages: [] }))).status).toBe(200);
});

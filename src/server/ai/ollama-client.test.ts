import { afterEach, expect, test } from 'bun:test';
import { hasOllama, ollamaChat, ollamaHeaders } from './ollama-client';

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

type Sent = { url: string; headers: Record<string, string>; body: Record<string, unknown> };

function recorder(reply: unknown, status = 200) {
  const calls: Sent[] = [];
  const fake = (async (url: string, init: RequestInit) => {
    calls.push({
      url,
      headers: init.headers as Record<string, string>,
      body: JSON.parse(String(init.body)),
    });
    return Response.json(reply, { status });
  }) as unknown as typeof fetch;
  return { calls, fake };
}

const msgs = [
  { role: 'system' as const, content: 'sys' },
  { role: 'user' as const, content: 'hi' },
];

test('null and no request when OLLAMA_URL is empty', async () => {
  process.env.OLLAMA_URL = '';
  const { calls, fake } = recorder({ message: { content: 'x' } });
  expect(hasOllama()).toBe(false);
  expect(await ollamaChat(msgs, {}, fake)).toBeNull();
  expect(calls).toHaveLength(0);
});

test('posts the messages to /api/chat with the model name and trims the reply', async () => {
  process.env.OLLAMA_URL = 'http://ollama:11434/';
  process.env.OLLAMA_MODEL = 'suu';
  process.env.OLLAMA_TOKEN = '';
  const { calls, fake } = recorder({ message: { content: '  Сайн уу  ' } });
  expect(hasOllama()).toBe(true);
  expect(await ollamaChat(msgs, { maxTokens: 50, temperature: 0 }, fake)).toBe('Сайн уу');
  expect(calls[0]?.url).toBe('http://ollama:11434/api/chat');
  expect(calls[0]?.body).toMatchObject({
    model: 'suu',
    stream: false,
    options: { temperature: 0, num_predict: 50 },
    messages: msgs,
  });
  expect(calls[0]?.body.format).toBeUndefined();
  expect(calls[0]?.headers.authorization).toBeUndefined();
});

test('json mode asks Ollama for JSON', async () => {
  process.env.OLLAMA_URL = 'http://ollama:11434';
  const { calls, fake } = recorder({ message: { content: '{"a":1}' } });
  expect(await ollamaChat(msgs, { json: true }, fake)).toBe('{"a":1}');
  expect(calls[0]?.body.format).toBe('json');
});

test('sends the bearer token when OLLAMA_TOKEN is set', async () => {
  process.env.OLLAMA_URL = 'https://suu.example.com';
  process.env.OLLAMA_TOKEN = 'secret-123';
  const { calls, fake } = recorder({ message: { content: 'ok' } });
  await ollamaChat(msgs, {}, fake);
  expect(calls[0]?.headers.authorization).toBe('Bearer secret-123');
  expect(ollamaHeaders('')).toEqual({ 'content-type': 'application/json' });
});

test('null on HTTP error, network error and empty reply', async () => {
  process.env.OLLAMA_URL = 'http://ollama:11434';
  expect(await ollamaChat(msgs, {}, recorder({ error: 'no model' }, 404).fake)).toBeNull();
  expect(await ollamaChat(msgs, {}, recorder({ message: { content: '   ' } }).fake)).toBeNull();
  expect(await ollamaChat(msgs, {}, recorder({}).fake)).toBeNull();
  const down = (async () => {
    throw new Error('ECONNREFUSED');
  }) as unknown as typeof fetch;
  expect(await ollamaChat(msgs, {}, down)).toBeNull();
});

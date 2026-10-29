import { afterEach, beforeEach, expect, test } from 'bun:test';
import { suuStatus as status } from './suu-status';

const saved = { ...process.env };
beforeEach(() => {
  process.env.OLLAMA_URL = 'https://suu.example.com/';
  process.env.OLLAMA_TOKEN = 'secret-token';
  process.env.OLLAMA_SKILLS = 'desmos';
  process.env.GEMINI_API_KEY = 'gem';
});
afterEach(() => {
  process.env = { ...saved };
});

test('online: asks /api/version with the token, reports skills and latency, never the URL or token', async () => {
  let url = '';
  let auth = '';
  const fetchImpl = (async (u: string, init: RequestInit) => {
    url = u;
    auth = (init.headers as Record<string, string>).authorization;
    return Response.json({ version: '0.40' });
  }) as unknown as typeof fetch;
  const s = await status(fetchImpl);
  expect(url).toBe('https://suu.example.com/api/version');
  expect(auth).toBe('Bearer secret-token');
  expect(s).toMatchObject({ configured: true, online: true, skills: ['desmos'], geminiChat: true });
  expect(typeof s.latencyMs).toBe('number');
  expect(JSON.stringify(s)).not.toContain('secret');
  expect(JSON.stringify(s)).not.toContain('example.com');
});

test('down or not configured → offline', async () => {
  const down = (async () => {
    throw new Error('ECONNREFUSED');
  }) as unknown as typeof fetch;
  expect((await status(down)).online).toBe(false);
  process.env.OLLAMA_URL = '';
  process.env.GEMINI_API_KEY = '';
  expect(await status(down)).toEqual({ configured: false, online: false, skills: [], geminiChat: false });
});

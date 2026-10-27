import { afterEach, expect, test } from 'bun:test';
import { SYSTEM_PROMPT } from '../../../ai/train/export';
import { buildUserMessage, ollamaReply, SUU_SYSTEM_PROMPT } from './ollama';

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

test('app prompt matches the prompt the model was trained with', () => {
  expect(SUU_SYSTEM_PROMPT).toBe(SYSTEM_PROMPT);
});

test('null when OLLAMA_URL is empty', async () => {
  process.env.OLLAMA_URL = '';
  expect(await ollamaReply('hint', '2x=4')).toBeNull();
});

test('null without a request when the chat skill is off (Suu v1 only learned Desmos lessons)', async () => {
  process.env.OLLAMA_URL = 'http://ollama:11434';
  process.env.OLLAMA_SKILLS = 'desmos';
  let called = false;
  const fake = (async () => {
    called = true;
    return Response.json({ message: { content: 'x' } });
  }) as unknown as typeof fetch;
  expect(await ollamaReply('hint', '2x=4', fake)).toBeNull();
  expect(called).toBe(false);
});

test('sends system + user message and returns the reply', async () => {
  process.env.OLLAMA_URL = 'http://ollama:11434/';
  process.env.OLLAMA_MODEL = 'suu';
  let sent: { url: string; body: { model: string; messages: { role: string; content: string }[] } } | null =
    null;
  const fake = (async (url: string, init: RequestInit) => {
    sent = { url, body: JSON.parse(String(init.body)) };
    return Response.json({ message: { content: ' Эхлээд 3-ыг хас. ' } });
  }) as unknown as typeof fetch;

  expect(await ollamaReply('hint', '2x+3=11', fake)).toBe('Эхлээд 3-ыг хас.');
  expect(sent!.url).toBe('http://ollama:11434/api/chat');
  expect(sent!.body.model).toBe('suu');
  expect(sent!.body.messages[0]?.role).toBe('system');
  expect(sent!.body.messages[1]?.content).toBe(buildUserMessage('hint', '2x+3=11'));
});

test('null when Ollama errors', async () => {
  process.env.OLLAMA_URL = 'http://ollama:11434';
  const down = (async () => {
    throw new Error('ECONNREFUSED');
  }) as unknown as typeof fetch;
  expect(await ollamaReply('explain', 'x', down)).toBeNull();
});

test('free chat sends the text without the request phrase', () => {
  expect(buildUserMessage('hint', '  Сайн уу  ', true)).toBe('Сайн уу');
  expect(buildUserMessage('hint', 'x')).toContain('Зөвлөгөө');
});

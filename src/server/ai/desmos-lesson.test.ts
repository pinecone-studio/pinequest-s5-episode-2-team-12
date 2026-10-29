import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { CHAT_PROMPT as V2_CHAT_PROMPT, DESMOS_PROMPT as V2_DESMOS_PROMPT } from '../../../ai/v2/skills';
import KIT from '../../features/tutor/lib/fixtures/kit-lessons.json';
import { answerFromExplanation, checkableAnswer, modelDesmosLesson } from './desmos-lesson';
import { CHAT_PROMPT, DESMOS_PROMPT, desmosUserMessage } from './prompts';

type KitRow = { technique: string; question: string; answer: string; output: string };
const good = (KIT as KitRow[]).find((r) => r.technique === 'intersection_equation')!;

const saved = { ...process.env };
beforeEach(() => {
  process.env.OLLAMA_URL = 'http://ollama:11434';
  process.env.OLLAMA_TOKEN = '';
  process.env.OLLAMA_SKILLS = '';
});
afterEach(() => {
  process.env = { ...saved };
});

type Body = {
  messages: { role: string; content: string }[];
  format?: string;
  options: { temperature: number };
};

/** Fake Ollama that answers each call with the next reply (null = HTTP 500). */
function ollama(...replies: (string | null)[]) {
  const calls: Body[] = [];
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    calls.push(JSON.parse(String(init.body)));
    const r = replies[calls.length - 1];
    return r === null || r === undefined
      ? new Response('down', { status: 500 })
      : Response.json({ message: { content: r } });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

test('prompts are the exact training prompts', () => {
  expect(DESMOS_PROMPT).toBe(V2_DESMOS_PROMPT);
  expect(CHAT_PROMPT).toBe(V2_CHAT_PROMPT);
  expect(desmosUserMessage(' If x+1=2, x? ', ' 1 ')).toBe('Асуулт: If x+1=2, x?\nЗөв хариу: 1');
});

describe('modelDesmosLesson', () => {
  test('with the answer: one Desmos call in JSON mode, checked lesson back', async () => {
    const { calls, fetchImpl } = ollama(good.output);
    const res = await modelDesmosLesson(good.question, good.answer, fetchImpl);
    expect(res?.answerFrom).toBe('student');
    expect(res?.technique).toBe('intersection_equation');
    expect(res?.lesson.answer).toBe(good.answer);
    expect(calls).toHaveLength(1);
    expect(calls[0].format).toBe('json');
    expect(calls[0].options.temperature).toBe(0);
    expect(calls[0].messages[0].content).toBe(DESMOS_PROMPT);
    expect(calls[0].messages[1].content).toBe(desmosUserMessage(good.question, good.answer));
  });

  test('a lesson that fails the checks gets one sampled retry', async () => {
    const { calls, fetchImpl } = ollama('{"steps": []}', good.output);
    const res = await modelDesmosLesson(good.question, good.answer, fetchImpl);
    expect(res).not.toBeNull();
    expect(calls).toHaveLength(2);
    expect(calls[1].options.temperature).toBe(0.4);
  });

  test('null after two bad lessons, and no retry when the model is down', async () => {
    const twice = ollama('nonsense', 'still nonsense');
    expect(await modelDesmosLesson(good.question, good.answer, twice.fetchImpl)).toBeNull();
    expect(twice.calls).toHaveLength(2);
    const down = ollama(null);
    expect(await modelDesmosLesson(good.question, good.answer, down.fetchImpl)).toBeNull();
    expect(down.calls).toHaveLength(1);
  });

  test('a lesson with a different final answer is never shown', async () => {
    const wrong = String(Number(good.answer) + 7);
    const { fetchImpl } = ollama(good.output, good.output);
    expect(await modelDesmosLesson(good.question, wrong, fetchImpl)).toBeNull();
  });

  test('without the answer: the chat skill solves first, then the Desmos skill teaches it', async () => {
    const explanation = `Хоёр талыг 6-д хуваа: $x + 4 = 7$.\n\nХариу: ${good.answer}`;
    const { calls, fetchImpl } = ollama(explanation, good.output);
    const res = await modelDesmosLesson(good.question, undefined, fetchImpl);
    expect(res?.answerFrom).toBe('model');
    expect(calls[0].messages[0].content).toBe(CHAT_PROMPT);
    expect(calls[0].messages[1].content).toContain('Алхам алхмаар тайлбарлаж өгөөч.');
    expect(calls[1].messages[1].content).toBe(desmosUserMessage(good.question, good.answer));
  });

  test('null when the chat answer has no checkable answer', async () => {
    const { calls, fetchImpl } = ollama('Энэ асуулт ойлгомжгүй байна.');
    expect(await modelDesmosLesson('?', '', fetchImpl)).toBeNull();
    expect(calls).toHaveLength(1);
  });

  test('null without calling the model when the typed answer is not checkable or Ollama is off', async () => {
    const { calls, fetchImpl } = ollama(good.output);
    expect(await modelDesmosLesson(good.question, 'x squared plus one', fetchImpl)).toBeNull();
    process.env.OLLAMA_URL = '';
    expect(await modelDesmosLesson(good.question, good.answer, fetchImpl)).toBeNull();
    expect(calls).toHaveLength(0);
  });
});

test('Suu v1 (OLLAMA_SKILLS=desmos): lessons from the student answer only; Desmos off → nothing', async () => {
  process.env.OLLAMA_SKILLS = 'desmos';
  const withAnswer = ollama(good.output);
  expect((await modelDesmosLesson(good.question, good.answer, withAnswer.fetchImpl))?.answerFrom).toBe(
    'student',
  );
  expect(withAnswer.calls).toHaveLength(1);
  const noAnswer = ollama(`Хариу: ${good.answer}`, good.output);
  expect(await modelDesmosLesson(good.question, undefined, noAnswer.fetchImpl)).toBeNull();
  expect(noAnswer.calls).toHaveLength(0);
  process.env.OLLAMA_SKILLS = 'chat';
  const off = ollama(good.output);
  expect(await modelDesmosLesson(good.question, good.answer, off.fetchImpl)).toBeNull();
  expect(off.calls).toHaveLength(0);
});

test('no model call starts without enough time left in the budget', async () => {
  const { calls, fetchImpl } = ollama('nonsense', good.output);
  expect(await modelDesmosLesson(good.question, good.answer, fetchImpl, 5_000)).toBeNull();
  expect(calls).toHaveLength(0);
});

test('answerFromExplanation', () => {
  expect(answerFromExplanation('…\n\nХариу: 15')).toBe('15');
  expect(answerFromExplanation('Хариу: A) $5$')).toBe('A');
  expect(answerFromExplanation('Хариу: (C)')).toBe('C');
  expect(answerFromExplanation('Хариу: $\\frac{33}{2}$')).toBe('33/2');
  expect(answerFromExplanation('Хариу: $x = -6$.')).toBe('-6');
  expect(answerFromExplanation('Хариу: $(-4, 6)$')).toBe('(-4, 6)');
  expect(answerFromExplanation('Хариу: $25\\%$')).toBe('25');
  expect(answerFromExplanation('эхлээд Хариу: 3\nдахин бодвол Хариу: 4')).toBe('4');
  expect(answerFromExplanation('Хариу: $5\\sqrt{3}$')).toBeNull();
  expect(answerFromExplanation('Хариу: x хамгийн их')).toBeNull();
  expect(answerFromExplanation('Хариу байхгүй')).toBeNull();
});

test('checkableAnswer', () => {
  for (const a of ['5', 'x = 5', '-1', '33/2', 'C', '(2, 21)', '21 meters'])
    expect(checkableAnswer(a)).toBe(true);
  for (const a of ['', 'yes', 'x squared', '1'.repeat(41)]) expect(checkableAnswer(a)).toBe(false);
});

test('another lesson: sampled at 0.7 first (the greedy one was already shown), then 0.4', async () => {
  const { calls, fetchImpl } = ollama('nonsense', good.output);
  const res = await modelDesmosLesson(good.question, good.answer, fetchImpl, undefined, true);
  expect(res).not.toBeNull();
  expect(calls.map((c) => c.options.temperature)).toEqual([0.7, 0.4]);
});

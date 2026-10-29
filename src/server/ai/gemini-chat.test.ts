import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { QUESTIONS } from '@/mocks/questions';
import { answerText, factsFor, geminiTutorReply, gradeAttempt, statedAnswer } from './gemini-chat';

const mc = QUESTIONS.find((q) => q.id === 'a2')!; // choices $1$ $2$ $3$ $5$, answer B) $2$
const grid = QUESTIONS.find((q) => q.id === 'a1')!; // answer 5

const saved = { ...process.env };
beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_CHAT_MODEL = 'gemini-test';
});
afterEach(() => {
  process.env = { ...saved };
});

describe('grading with code', () => {
  test('choice letters, choice values and grid-in numbers', () => {
    expect(answerText(mc)).toBe('B) $2$');
    expect(gradeAttempt(mc, 'B')).toBe(true);
    expect(gradeAttempt(mc, 'b)')).toBe(true);
    expect(gradeAttempt(mc, 'A) $1$')).toBe(false);
    expect(gradeAttempt(mc, '2')).toBe(true);
    expect(gradeAttempt(mc, '5')).toBe(false);
    expect(gradeAttempt(mc, 'cats')).toBeNull();
    expect(gradeAttempt(grid, '5')).toBe(true);
    expect(gradeAttempt(grid, '5.0')).toBe(true);
    expect(gradeAttempt(grid, '6')).toBe(false);
  });

  test('finds the answer a student states in free text', () => {
    expect(statedAnswer('Миний хариу: B. Зөв үү?')).toBe('B');
    expect(statedAnswer('хариу нь 12 зөв үү')).toBe('12');
    expect(statedAnswer('x = 4')).toBe('4');
    expect(statedAnswer('C?')).toBe('C');
    expect(statedAnswer('I got 7.')).toBe('7');
    expect(statedAnswer('Яаж эхлэх вэ?')).toBeNull();
    expect(statedAnswer('хариугаа хэлээч')).toBeNull();
    expect(gradeAttempt(grid, 'мэдэхгүй')).toBeNull();
  });
});

describe('facts the server gives Gemini', () => {
  const ctx = { kind: 'question', id: 'a2' };

  test('a hint never carries the answer', () => {
    const f = factsFor({ mode: 'hint', message: mc.prompt, raw: false, context: ctx });
    expect(f).toContain('Бодлого (асуултын сангаас)');
    expect(f).not.toContain('Зөв хариу: B)');
    expect(f).toContain('хэлж болохгүй');
  });

  test('a wrong answer is graded БУРУУ and the answer stays hidden', () => {
    const f = factsFor({
      mode: 'explain',
      message: `${mc.prompt}\n\nМиний хариу: A`,
      raw: true,
      context: ctx,
    });
    expect(f).toContain('шалгалт (кодоор): БУРУУ');
    // explain mode may give the full solution, so the answer is there; in free chat without explain it is not:
    const g = factsFor({ mode: 'hint', message: 'Миний хариу: D', raw: true, context: ctx });
    expect(g).toContain('БУРУУ');
    expect(g).not.toContain('Зөв хариу: B)');
  });

  test('a right answer is graded ЗӨВ; after the student answered the answer may be said', () => {
    expect(factsFor({ mode: 'hint', message: 'хариу B', raw: true, context: ctx })).toContain('ЗӨВ');
    expect(factsFor({ mode: 'hint', message: 'ok', raw: true, context: ctx, revealed: true })).toContain(
      'Зөв хариу: B) $2$',
    );
  });

  test('the Desmos panel steps the student sees go along', () => {
    const f = factsFor({
      mode: 'explain',
      message: 'яагаад энэ шулуун?',
      raw: true,
      panel: {
        technique: 'Огтлолцол',
        step: 1,
        steps: [
          { text: 'Хоёр шулуун зур', latex: ['y=2x+1', 'y=-x+7'] },
          { text: 'Огтлолцох цэг', latex: [] },
        ],
      },
    });
    expect(f).toContain('сурагч 2-р алхам дээр');
    expect(f).toContain('`y=2x+1`');
  });

  test('no bank problem (general chat): no answer lines at all', () => {
    const f = factsFor({ mode: 'explain', message: 'What is a slope?', raw: true });
    expect(f).not.toContain('Зөв хариу');
  });
});

describe('geminiTutorReply', () => {
  test('sends the system rules, history and facts; returns the text without thoughts', async () => {
    let url = '';
    let body: {
      systemInstruction: { parts: { text: string }[] };
      contents: { role: string; parts: { text: string }[] }[];
    } | null = null;
    let key = '';
    const fetchImpl = (async (u: string, init: RequestInit) => {
      url = u;
      key = (init.headers as Record<string, string>)['x-goog-api-key'];
      body = JSON.parse(String(init.body));
      return Response.json({
        candidates: [
          {
            content: {
              parts: [
                { text: 'бодож байна', thought: true },
                { text: 'Сайн байна! ' },
                { text: 'Дараагийн алхам…' },
              ],
            },
          },
        ],
      });
    }) as unknown as typeof fetch;
    const text = await geminiTutorReply(
      {
        mode: 'hint',
        message: 'Миний хариу: A',
        raw: true,
        context: { kind: 'question', id: 'a2' },
        history: [
          { role: 'user', text: 'Сайн уу' },
          { role: 'suu', text: 'Сайн уу!' },
        ],
      },
      fetchImpl,
    );
    expect(text).toBe('Сайн байна! Дараагийн алхам…');
    expect(url).toContain('/models/gemini-test:generateContent');
    expect(key).toBe('test-key');
    expect(body!.systemInstruction.parts[0].text).toContain('"БУРУУ" гэвэл');
    expect(body!.contents.map((c) => c.role)).toEqual(['user', 'model', 'user']);
    expect(body!.contents[2].parts[0].text).toContain('БУРУУ');
  });

  test('no key, an error or an empty reply → null (the route shows the demo reply)', async () => {
    const ok = (async () => Response.json({ candidates: [] })) as unknown as typeof fetch;
    const down = (async () => new Response('x', { status: 500 })) as unknown as typeof fetch;
    const input = { mode: 'hint' as const, message: 'hi', raw: true };
    expect(await geminiTutorReply(input, ok)).toBeNull();
    expect(await geminiTutorReply(input, down)).toBeNull();
    process.env.GEMINI_API_KEY = '';
    expect(await geminiTutorReply(input, ok)).toBeNull();
  });
});

describe('RAG in the chat', () => {
  test('similar solved problems with their Desmos rows go into the facts', async () => {
    const { searchLocal } = await import('./rag/retrieve');
    const hits = searchLocal('If $3x+5=20$, what is $x$?', 2);
    const f = factsFor({ mode: 'hint', message: 'тусла', raw: true }, hits);
    expect(f).toContain('төстэй бодлогууд');
    expect(f).toContain('(intersection_equation)');
    expect(f).toMatch(/Desmos: `y=/);
  });
});

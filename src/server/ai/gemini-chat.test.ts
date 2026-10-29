import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { QUESTIONS } from '@/mocks/questions';
import {
  answerText,
  factsFor,
  geminiContents,
  geminiSolve,
  geminiTutorReply,
  gradeAttempt,
  statedAnswer,
} from './gemini-chat';

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

describe('busy Gemini', () => {
  test('429 on the main model → one try on the fallback model', async () => {
    process.env.GEMINI_CHAT_FALLBACK = 'gemini-lite-test';
    const urls: string[] = [];
    const fetchImpl = (async (u: string) => {
      urls.push(u);
      return urls.length === 1
        ? new Response('quota', { status: 429 })
        : Response.json({ candidates: [{ content: { parts: [{ text: 'Сайн уу' }] } }] });
    }) as unknown as typeof fetch;
    expect(await geminiTutorReply({ mode: 'hint', message: 'hi', raw: true }, fetchImpl)).toBe('Сайн уу');
    expect(urls.map((u) => u.split('/models/')[1])).toEqual([
      'gemini-test:generateContent',
      'gemini-lite-test:generateContent',
    ]);
  });

  test('other errors do not retry; both busy → null; empty fallback = no retry', async () => {
    let n = 0;
    const bad = (async () => {
      n++;
      return new Response('x', { status: 400 });
    }) as unknown as typeof fetch;
    expect(await geminiTutorReply({ mode: 'hint', message: 'hi', raw: true }, bad)).toBeNull();
    expect(n).toBe(1);
    n = 0;
    const busy = (async () => {
      n++;
      return new Response('x', { status: 503 });
    }) as unknown as typeof fetch;
    expect(await geminiTutorReply({ mode: 'hint', message: 'hi', raw: true }, busy)).toBeNull();
    expect(n).toBe(2);
    n = 0;
    process.env.GEMINI_CHAT_FALLBACK = '';
    expect(await geminiTutorReply({ mode: 'hint', message: 'hi', raw: true }, busy)).toBeNull();
    expect(n).toBe(1);
  });
});

describe('conversation shape Gemini accepts', () => {
  test('starts with the student and alternates; a failed reply leaves two student turns, joined', () => {
    const c = geminiContents(
      [
        { role: 'suu', text: 'Сайн уу! Би Суу.' },
        { role: 'user', text: 'x+1=3 бол x?' },
        { role: 'suu', text: 'x = 2' },
        { role: 'user', text: 'яагаад?' },
      ],
      'дахиад тайлбарлаач',
    );
    expect(c.map((t) => t.role)).toEqual(['user', 'model', 'user']);
    expect(c[2].parts[0].text).toBe('яагаад?\n\nдахиад тайлбарлаач');
  });

  test('no history: just the new message', () => {
    expect(geminiContents([], 'сайн уу')).toEqual([{ role: 'user', parts: [{ text: 'сайн уу' }] }]);
  });
});

describe('geminiSolve', () => {
  test('asks for a final «Хариу:» line and returns the reply', async () => {
    let body: {
      systemInstruction: { parts: { text: string }[] };
      contents: { parts: { text: string }[] }[];
    } | null = null;
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return Response.json({ candidates: [{ content: { parts: [{ text: '2x=8\n\nХариу: 4' }] } }] });
    }) as unknown as typeof fetch;
    expect(await geminiSolve(' If 2x = 8, what is x? ', fetchImpl)).toBe('2x=8\n\nХариу: 4');
    expect(body!.systemInstruction.parts[0].text).toContain('Хариу:');
    expect(body!.contents[0].parts[0].text).toBe('If 2x = 8, what is x?');
  });

  test('no key → null without a call', async () => {
    process.env.GEMINI_API_KEY = '';
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return Response.json({});
    }) as unknown as typeof fetch;
    expect(await geminiSolve('x?', fetchImpl)).toBeNull();
    expect(called).toBe(false);
  });
});

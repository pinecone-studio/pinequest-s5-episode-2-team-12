import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generate } from '../pipeline/generate';
import {
  buildPrompts,
  type DistillPrompt,
  goldAnswer,
  promptsFor,
  questionText,
  templateOf,
} from './prompts';
import { askTeacher, geminiBody, readJsonl, runTeacher, temperatureFor } from './teacher';
import { chatAnswerOk, choiceValue, distill, report, verify } from './verify';

const q = generate(5, 1).find((x) => x.id.startsWith('g-sys-no-sol-'));
if (!q) throw new Error('no hard template question');
const [desmosP, chatP] = promptsFor(q) as [DistillPrompt, DistillPrompt];

const lesson = (
  answer: string,
  text = 'Хоёр шулууныг зурж огтлолцлыг нь харна. Налалтууд ижил бол зэрэгцээ.',
) =>
  JSON.stringify({
    technique: 'systems',
    steps: [{ text, desmos: [{ latex: 'y=2x+1' }, { latex: 'k=1' }] }],
    check: 'Шалгалаа.',
    answer,
  });

const mcq: DistillPrompt = {
  id: 'x-chat',
  skill: 'chat',
  template: 'pct-compound',
  difficulty: 3,
  question: 'What is it?\nA) $21\\%$\nB) $20\\%$\nC) $121\\%$\nD) $100\\%$',
  gold: 'A',
  messages: [],
};

describe('prompts', () => {
  test('template key from id', () => {
    expect(templateOf('g-sys-no-sol-s5-1')).toBe('sys-no-sol');
    expect(templateOf('g-pct-compound-s41-12')).toBe('pct-compound');
  });
  test('desmos prompt carries the gold answer, chat prompt asks for steps without it', () => {
    expect(desmosP.messages[1]?.content).toContain(`Зөв хариу: ${goldAnswer(q)}`);
    expect(chatP.messages[1]?.content).toContain('Алхам алхмаар');
    expect(chatP.messages[1]?.content).not.toContain('Зөв хариу');
  });
  test('multiple choice questions show lettered choices and a letter gold', () => {
    const m = generate(3, 2).find((x) => x.choices);
    if (!m) throw new Error('no mcq');
    expect(questionText(m)).toContain('\nA) ');
    expect(goldAnswer(m)).toMatch(/^[A-D]$/);
  });
  test('hard questions come first and ids are unique', () => {
    const ps = buildPrompts(41, 2);
    expect(ps[0]?.difficulty).toBe(3);
    expect(new Set(ps.map((p) => p.id)).size).toBe(ps.length);
  });
});

describe('verify', () => {
  test('desmos lesson with the gold answer passes and is cleaned to bare JSON', () => {
    const v = verify(desmosP, `\`\`\`json\n${lesson(desmosP.gold)}\n\`\`\``);
    expect(v.ok).toBe(true);
    if (v.ok) expect(JSON.parse(v.clean).answer).toBe(desmosP.gold);
  });
  test('desmos lesson with another answer is rejected', () => {
    expect(verify(desmosP, lesson('999'))).toEqual({ ok: false, reason: 'answer' });
  });
  test('desmos lesson in English is rejected', () => {
    const v = verify(
      desmosP,
      lesson(desmosP.gold, 'Graph both lines and look where they cross each other here.'),
    );
    expect(v).toEqual({ ok: false, reason: 'mongolian' });
  });
  test('broken JSON is rejected', () => {
    expect(verify(desmosP, '{"steps": [')).toEqual({ ok: false, reason: 'json' });
  });
  test('chat: right answer in Mongolian passes', () => {
    const t = `Коэффициентуудын харьцааг харьцуулна. Налалт ижил байх ёстой.\n\nХариу: ${chatP.gold}`;
    expect(verify(chatP, t).ok).toBe(true);
  });
  test('chat: wrong or missing answer is rejected', () => {
    expect(verify(chatP, 'Коэффициентуудыг харьцуулна.\n\nХариу: 12345')).toEqual({
      ok: false,
      reason: 'answer',
    });
    expect(verify(chatP, 'Коэффициентуудыг харьцуулна. Тэгээд л болоо.')).toEqual({
      ok: false,
      reason: 'no-answer',
    });
  });
  test('chat: MCQ accepts the letter or the value of the right choice', () => {
    expect(choiceValue(mcq.question, 'C')).toBe('121\\%');
    expect(chatAnswerOk('…\nХариу: A) $21\\%$', mcq.question, 'A')).toBe(true);
    expect(chatAnswerOk('…\nХариу: $21\\%$', mcq.question, 'A')).toBe(true);
    expect(chatAnswerOk('…\nХариу: B) $20\\%$', mcq.question, 'A')).toBe(false);
  });
});

describe('distill', () => {
  test('keeps the shortest passing reply per prompt and records every failure', () => {
    const long = `Урт тайлбар. ${'Алхам алхмаар бодъё. '.repeat(10)}\n\nХариу: ${chatP.gold}`;
    const short = `Богино тайлбар бичлээ.\n\nХариу: ${chatP.gold}`;
    const { sft, rejected, stats } = distill(
      [desmosP, chatP],
      [
        { id: chatP.id, sample: 0, text: long },
        { id: chatP.id, sample: 1, text: short },
        { id: chatP.id, sample: 2, text: 'Буруу бодлоо.\n\nХариу: 999' },
        { id: desmosP.id, sample: 0, text: lesson('999') },
      ],
    );
    expect(sft).toHaveLength(1);
    expect(sft[0]?.messages.at(-1)?.content).toBe(short);
    expect(sft[0]?.id).toBe(`distill-${chatP.id}`);
    expect(rejected.map((r) => r.reason).sort()).toEqual(['answer', 'answer']);
    expect(stats.get('chat')).toEqual({ prompts: 1, kept: 1, samples: 3, passed: 2 });
    expect(stats.get('desmos')).toEqual({ prompts: 1, kept: 0, samples: 1, passed: 0 });
    const md = report(stats, rejected);
    expect(md).toContain('| chat | 1 | 1 (100%) | 3 | 67% |');
    expect(md).toContain('- answer: 2');
  });
});

describe('teacher', () => {
  let dir = '';
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  test('gemini body: system → systemInstruction, assistant → model, JSON mode for desmos', () => {
    const b = geminiBody(
      [
        { role: 'system', content: 'S' },
        { role: 'user', content: 'U' },
        { role: 'assistant', content: 'A' },
      ],
      0.7,
      true,
    );
    expect(b.systemInstruction?.parts[0]?.text).toBe('S');
    expect(b.contents.map((c) => c.role)).toEqual(['user', 'model']);
    expect(b.generationConfig.responseMimeType).toBe('application/json');
    expect(temperatureFor(0)).toBe(0);
    expect(temperatureFor(2)).toBeGreaterThan(0);
  });

  const reply = (text: string) =>
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: 'thinking', thought: true }, { text }] } }],
      }),
    );

  test('retries on 429 and skips thought parts', async () => {
    let calls = 0;
    const fetchImpl = (async () =>
      ++calls === 1 ? new Response('', { status: 429 }) : reply('Сайн')) as unknown as typeof fetch;
    const t = await askTeacher(chatP, 0, { apiKey: 'k', model: 'm', fetchImpl, retries: 2 });
    expect(t).toBe('Сайн');
    expect(calls).toBe(2);
  }, 10_000);

  test('gives up on other errors', async () => {
    const fetchImpl = (async () => new Response('', { status: 400 })) as unknown as typeof fetch;
    expect(await askTeacher(chatP, 0, { apiKey: 'k', model: 'm', fetchImpl })).toBeNull();
  });

  test('runTeacher is resumable: a second run asks nothing new', async () => {
    dir = mkdtempSync(join(tmpdir(), 'distill-'));
    const out = join(dir, 'c.jsonl');
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return reply('Хариу: 1');
    }) as unknown as typeof fetch;
    const opts = { apiKey: 'k', model: 'm', fetchImpl, concurrency: 2 };
    expect(await runTeacher([desmosP, chatP], 2, out, opts)).toEqual({ asked: 4, got: 4 });
    expect(await runTeacher([desmosP, chatP], 2, out, opts)).toEqual({ asked: 0, got: 0 });
    expect(calls).toBe(4);
    expect(readJsonl(out)).toHaveLength(4);
    expect(readFileSync(out, 'utf8').endsWith('\n')).toBe(true);
  });
});

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mulberry32 } from '../../../ai/pipeline/templates/shared';
import { analyze, randomMistakes } from '../../../ai/v2/analyze';
import { parseNote } from '../../../ai/v2/note';
import { plan, randomStudent } from '../../../ai/v2/planner';
import { ANALYZE_PROMPT, PLANNER_PROMPT } from '../../../ai/v2/skills';
import { suuAnalyze, suuPlan } from './suu-skills';

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
function ollama(reply: string | null) {
  const calls: Body[] = [];
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    calls.push(JSON.parse(String(init.body)));
    return reply === null
      ? new Response('down', { status: 500 })
      : Response.json({ message: { content: reply } });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

/** A student with a note, so busy days matter. */
function student() {
  const r = mulberry32(11);
  for (;;) {
    const s = randomStudent(r);
    if (s.input.note && s.rules.busy.length && s.input.topics.some((t) => t.n >= 5)) return s;
  }
}

describe('suuPlan', () => {
  test('sends the training prompt and JSON input; a plan that passes the kit checks is used', async () => {
    const { input, rules } = student();
    const gold = plan(input, rules);
    const { calls, fetchImpl } = ollama(`Энэ бол төлөвлөгөө:\n${JSON.stringify(gold)}`);
    const res = await suuPlan(input, fetchImpl);
    expect(res.source).toBe('model');
    expect(res.result.week).toEqual(gold.week);
    expect(calls[0].messages[0].content).toBe(PLANNER_PROMPT);
    expect(JSON.parse(calls[0].messages[1].content)).toEqual(input);
    expect(calls[0].format).toBe('json');
    expect(calls[0].options.temperature).toBe(0);
  });

  test('a plan that ignores a busy day from the note falls back to the rules', async () => {
    const { input, rules } = student();
    const gold = plan(input, rules);
    const busy = rules.busy[0];
    const bad = {
      ...gold,
      week: gold.week.map((d) =>
        d.day === busy ? { day: d.day, min: 30, tasks: [{ t: 'review' as const, min: 30 }] } : d,
      ),
    };
    const res = await suuPlan(input, ollama(JSON.stringify(bad)).fetchImpl);
    expect(res.source).toBe('rules');
    expect(res.result).toEqual(plan(input, parseNote(input.note)));
    expect(res.result.week.find((d) => d.day === busy)?.min).toBe(0);
  });

  test('model down, nonsense, off, or the skill not learned yet → rules (and no call when off)', async () => {
    const { input, rules } = student();
    expect((await suuPlan(input, ollama(null).fetchImpl)).source).toBe('rules');
    expect((await suuPlan(input, ollama('Сайн уу').fetchImpl)).source).toBe('rules');
    process.env.OLLAMA_SKILLS = 'desmos'; // Суу v1
    const v1 = ollama(JSON.stringify(plan(input, rules)));
    expect((await suuPlan(input, v1.fetchImpl)).source).toBe('rules');
    expect(v1.calls).toHaveLength(0);
    process.env.OLLAMA_URL = '';
    expect((await suuPlan(input)).result).toEqual(plan(input, rules));
  });
});

describe('suuAnalyze', () => {
  const r = mulberry32(5);
  let input = randomMistakes(r);
  while (input.mistakes.length < 8) input = randomMistakes(r);

  test('an analysis with the exact patterns and counts is used; the prompt is the training one', async () => {
    const gold = analyze(input);
    const { calls, fetchImpl } = ollama(JSON.stringify(gold));
    const res = await suuAnalyze(input, fetchImpl);
    expect(res).toEqual({ result: gold, source: 'model' });
    expect(calls[0].messages[0].content).toBe(ANALYZE_PROMPT);
  });

  test('miscounted patterns fall back to the rules', async () => {
    const gold = analyze(input);
    const wrong = { ...gold, habits: { ...gold.habits, rushed: gold.habits.rushed + 1 } };
    expect(await suuAnalyze(input, ollama(JSON.stringify(wrong)).fetchImpl)).toEqual({
      result: gold,
      source: 'rules',
    });
  });
});

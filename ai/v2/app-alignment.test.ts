// The v2 kit must describe the app as it really is: same topic ids and names, same Desmos topics, notes read the
// same way the generator writes them. If one of these fails, the model would learn something the app never sends.
import { describe, expect, test } from 'bun:test';
import { mockBank } from '../../src/features/exam/engine';
import { TOPICS } from '../../src/features/roadmap/topics';
import { mulberry32 } from '../pipeline/templates/shared';
import { parseNote } from './note';
import { plan, randomNote, randomStudent, scorePlan } from './planner';
import { DESMOS_TOPICS, TOPIC_NAMES } from './skills';

test('topic ids and names are the roadmap topics the app shows', () => {
  expect(Object.keys(TOPIC_NAMES).map(Number)).toEqual(TOPICS.map((t) => t.id));
  for (const t of TOPICS) expect(TOPIC_NAMES[t.id]).toBe(t.title);
});

test('Desmos topics are the topics where at least 40% of bank questions come with Desmos rows', () => {
  // The AI-written add-on practice questions ("claude-addon") come without Desmos rows by design; counting them
  // would only dilute the share and say nothing about which topics the app teaches with Desmos.
  const pool = mockBank().pool.filter((q) => !('author' in q && q.author === 'claude-addon'));
  const by = new Map<number, { n: number; d: number }>();
  for (const q of pool) {
    if (!q.topicId) continue;
    const b = by.get(q.topicId) ?? { n: 0, d: 0 };
    b.n++;
    if (q.desmos?.rows.length) b.d++;
    by.set(q.topicId, b);
  }
  const fromBank = [...by].filter(([, b]) => b.d / b.n >= 0.4).map(([id]) => id);
  expect([...DESMOS_TOPICS].sort((a, b) => a - b)).toEqual(fromBank.sort((a, b) => a - b));
});

describe('parseNote', () => {
  test('reads every note the generator writes back into its rules', () => {
    const r = mulberry32(2024);
    let withText = 0;
    for (let i = 0; i < 3000; i++) {
      const { rules, text } = randomNote(r, [30, 60, 90, 120, 180][i % 5]);
      if (!text) continue;
      withText++;
      expect(parseNote(text)).toEqual(rules);
    }
    expect(withText).toBeGreaterThan(1000);
  });

  test('free-form notes students write', () => {
    expect(parseNote('Мягмар, Пүрэв гарагт дугуйлантай. Бямба гарагт 2,5 цаг гаргаж чадна.')).toEqual({
      busy: ['Мя', 'Пү'],
      set: { Бя: 150 },
    });
    expect(parseNote('ням гарагт амарна!\nбаасан гарагт ердөө 20 минут')).toEqual({
      busy: ['Ня'],
      set: { Ба: 20 },
    });
    expect(parseNote('Би 11-р ангийн сурагч. Математикт дуртай.')).toEqual({ busy: [], set: {} });
    expect(parseNote(undefined)).toEqual({ busy: [], set: {} });
  });
});

test('new students (few or no answers) and big ones still get a gold plan that passes its own checks', () => {
  const r = mulberry32(77);
  let fresh = 0;
  let big = 0;
  for (let i = 0; i < 1500; i++) {
    const { input, rules } = randomStudent(r);
    if (input.topics.every((t) => t.n < 5)) fresh++;
    if (input.topics.length >= 10) big++;
    expect(scorePlan(JSON.stringify(plan(input, rules)), input, rules).pass).toBe(true);
    // the note the student typed gives the same rules the gold plan used
    expect(parseNote(input.note)).toEqual(rules);
  }
  expect(fresh).toBeGreaterThan(50);
  expect(big).toBeGreaterThan(100);
});

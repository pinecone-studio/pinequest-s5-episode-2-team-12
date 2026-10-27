import { describe, expect, test } from 'bun:test';
import { analyze } from '../../../ai/v2/analyze';
import { parseNote } from '../../../ai/v2/note';
import { plan, scorePlan } from '../../../ai/v2/planner';
import {
  type Attempt,
  analyzeInput,
  daysUntil,
  MAX_MISTAKES,
  type MistakeEntry,
  plannerInput,
  topicStats,
  weekFrom,
} from './student-input';

const DAY = 86_400_000;
const NOW = Date.parse('2026-10-27T12:00:00Z');
const att = (qid: string, topicId: number, correct: boolean, sec: number, daysAgo: number): Attempt => ({
  qid,
  topicId,
  correct,
  timeMs: sec * 1000,
  at: NOW - daysAgo * DAY,
});

test('the week starts today, Monday-first names', () => {
  expect(weekFrom('2026-10-27')).toEqual(['Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня', 'Да']); // a Tuesday
  expect(weekFrom('2026-11-02')[0]).toBe('Да');
  expect(daysUntil('2026-10-27', '2026-12-05')).toBe(39);
  expect(daysUntil('2026-10-27', '2026-10-27')).toBe(1);
});

describe('topicStats', () => {
  test('accuracy, count, seconds and the 2-week trend per topic, with the app topic names', () => {
    const attempts = [
      // topic 13: older 3/4 right, recent 1/4 right → trend 25 − 75 = −50
      ...[true, true, true, false].map((c, i) => att(`a${i}`, 13, c, 60, 20)),
      ...[true, false, false, false].map((c, i) => att(`b${i}`, 13, c, 120, 2)),
      att('c1', 8, true, 30, 1),
      att('c2', 8, false, 0, 1), // no time recorded: left out of the average
      att('x', 99, true, 10, 1), // not a roadmap topic
    ];
    expect(topicStats(attempts, NOW)).toEqual([
      { id: 8, name: 'Хувь', acc: 50, n: 2, sec: 30, trend: 0 },
      { id: 13, name: 'Тэгшитгэлийн систем', acc: 50, n: 8, sec: 90, trend: -50 },
    ]);
  });

  test('topics marked weak without answers come in with n = 0', () => {
    expect(topicStats([att('a', 8, true, 30, 1)], NOW, [12, 8, 12])).toEqual([
      { id: 8, name: 'Хувь', acc: 100, n: 1, sec: 30, trend: 0 },
      { id: 12, name: 'Квадрат тэгшитгэл', acc: 0, n: 0, sec: 0, trend: 0 },
    ]);
  });
});

describe('analyzeInput', () => {
  const facts = (qid: string) =>
    ({
      q1: { topicId: 13, vocab: ['At least', 'xy-plane'], desmos: true },
      q2: { topicId: 8, desmos: false },
      q3: { topicId: 13, vocab: ['respectively'], desmos: true },
    })[qid];
  const mistakes: MistakeEntry[] = [
    { qid: 'q1', source: 'stop', at: NOW - 3 * DAY },
    { qid: 'q2', source: 'mock', at: NOW - 2 * DAY },
    { qid: 'q3', source: 'placement', at: NOW - DAY },
    { qid: 'gone', source: 'daily', at: NOW }, // not in the bank
    { qid: 'q1', source: 'daily', at: NOW - 5 * DAY }, // older duplicate
  ];
  const attempts = [att('q1', 13, false, 12, 3), att('q1', 13, false, 20, 9), att('q3', 13, false, 200, 1)];

  test('latest mistake per question, kit sources, time of the last wrong try, repeats, Desmos, kit words', () => {
    const input = analyzeInput(mistakes, [...attempts, att('z', 2, true, 40, 1)], facts);
    expect(input).toEqual({
      answered: 4,
      correct: 1,
      mistakes: [
        { q: 'q3', topic: 13, sec: 200, src: 'checkpoint', desmos: true, times: 1, words: ['respectively'] },
        { q: 'q2', topic: 8, sec: 60, src: 'practice', desmos: false, times: 1 },
        { q: 'q1', topic: 13, sec: 12, src: 'lesson', desmos: true, times: 2, words: ['at least'] },
      ],
    });
    // the gold analysis runs on it (what Суу is checked against)
    expect(analyze(input).habits).toEqual({ rushed: 1, slow: 1, desmos: 2 });
  });

  test('at most the 30 most recent mistakes', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ qid: `m${i}`, source: 'stop' as const, at: i }));
    const input = analyzeInput(many, [], () => ({ topicId: 3, desmos: false }));
    expect(input.mistakes).toHaveLength(MAX_MISTAKES);
    expect(input.mistakes[0].q).toBe('m49');
  });
});

test('plannerInput: the form, the stats and habits, clamped to what the kit trains on', () => {
  const attempts = Array.from({ length: 6 }, (_, i) => att(`p${i}`, 13, i % 2 === 0, 50, 1));
  const ana = analyzeInput([{ qid: 'p1', source: 'stop', at: NOW }], attempts, () => ({
    topicId: 13,
    desmos: true,
  }));
  const input = plannerInput(
    {
      today: '2026-10-27',
      examDate: '2026-12-05',
      current: 613,
      target: 900,
      hoursPerDay: 1.3,
      note: '  Мягмар гарагт дугуйлантай.  ',
      weakIds: [12],
    },
    attempts,
    ana,
  );
  expect(input).toMatchObject({
    days: ['Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня', 'Да'],
    daysLeft: 39,
    current: 610,
    target: 800,
    hoursPerDay: 1.5,
    habits: { rushed: 0, slow: 0, desmos: 1 },
    note: 'Мягмар гарагт дугуйлантай.',
  });
  expect(input.topics.map((t) => t.id)).toEqual([12, 13]);
  // the rule plan made from it passes the kit's own checks, with Tuesday free
  const rules = parseNote(input.note);
  const gold = plan(input, rules);
  expect(scorePlan(JSON.stringify(gold), input, rules).pass).toBe(true);
  expect(gold.week[0]).toEqual({ day: 'Мя', min: 0, tasks: [] });
  expect(gold.check).toEqual([12]);
});

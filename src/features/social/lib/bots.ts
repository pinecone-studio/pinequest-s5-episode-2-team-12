// Demo friends (no Supabase = no other real students). Clearly labelled «Демо найз» in the UI. Their numbers
// are fixed, and their duel answers are deterministic per duel so a demo duel always resolves the same way.
import { seeded } from '@/features/roadmap/lib/select-problems';
import type { Question } from '@/types';
import { type Duel, type Run, startRun } from './duel';

export type Bot = {
  id: string;
  name: string;
  avatarId: string;
  level: number;
  streak: number;
  aimag: string;
  weekXp: number;
  allXp: number;
  daily: number;
  bestMock: number;
  /** Chance of a right answer in a duel. */
  accuracy: number;
  /** Typical seconds per duel question. */
  pace: number;
};

export const BOTS: Bot[] = [
  {
    id: 'bot-saraa',
    name: 'Сараа',
    avatarId: 'rose',
    level: 6,
    streak: 12,
    aimag: 'Улаанбаатар',
    weekXp: 640,
    allXp: 4200,
    daily: 610,
    bestMock: 640,
    accuracy: 0.8,
    pace: 40,
  },
  {
    id: 'bot-temuulen',
    name: 'Тэмүүлэн',
    avatarId: 'sky',
    level: 5,
    streak: 5,
    aimag: 'Хөвсгөл',
    weekXp: 420,
    allXp: 3100,
    daily: 540,
    bestMock: 590,
    accuracy: 0.65,
    pace: 55,
  },
  {
    id: 'bot-anu',
    name: 'Ану',
    avatarId: 'sun',
    level: 4,
    streak: 3,
    aimag: 'Улаанбаатар',
    weekXp: 310,
    allXp: 2050,
    daily: 470,
    bestMock: 520,
    accuracy: 0.55,
    pace: 60,
  },
  {
    id: 'bot-bilguun',
    name: 'Билгүүн',
    avatarId: 'night',
    level: 7,
    streak: 21,
    aimag: 'Дархан-Уул',
    weekXp: 780,
    allXp: 5600,
    daily: 700,
    bestMock: 700,
    accuracy: 0.85,
    pace: 35,
  },
  {
    id: 'bot-nomin',
    name: 'Номин',
    avatarId: 'steppe',
    level: 3,
    streak: 1,
    aimag: 'Орхон',
    weekXp: 150,
    allXp: 900,
    daily: 300,
    bestMock: 450,
    accuracy: 0.45,
    pace: 70,
  },
];

export const botById = (id: string) => BOTS.find((b) => b.id === id);
export const isBot = (id: string) => id.startsWith('bot-');

/** A bot's finished run for a duel: same questions, deterministic answers and times. */
export function botRun(bot: Bot, duel: Duel, bank: ReadonlyMap<string, Question>): Run {
  const rng = seeded(
    duel.ids.join('|').length * 7919 + bot.id.length * 104729 + (Date.parse(duel.createdAt) % 100000),
  );
  const start = Date.parse(duel.createdAt) + 60_000;
  const base = startRun(bot.id, start);
  let t = start;
  const answers = duel.ids.map((qid) => {
    const q = bank.get(qid);
    const timeMs = Math.round(bot.pace * (0.6 + rng() * 0.8) * 1000);
    t += timeMs;
    const correct = rng() < bot.accuracy;
    const answer = !q
      ? ''
      : typeof q.answer === 'number'
        ? String(correct ? q.answer : (q.answer + 1) % 4)
        : correct
          ? q.answer[0]
          : '0.12345';
    return { qid, answer, correct, timeMs };
  });
  return {
    ...base,
    answers,
    servedAt: new Date(t).toISOString(),
    finishedAt: new Date(t).toISOString(),
    correct: answers.filter((a) => a.correct).length,
    timeMs: answers.reduce((s, a) => s + a.timeMs, 0),
    flagged: false,
  };
}

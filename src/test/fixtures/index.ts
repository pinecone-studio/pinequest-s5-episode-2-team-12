// Small, stable sample data for tests. Prefer these over src/mocks (which content tasks will grow).
import type { Card, Deck, Lesson, Mistake, Profile, Question, Stage, XpEvent } from '@/types';

export const NOW = new Date('2026-10-22T02:00:00Z').getTime(); // 10:00 in Ulaanbaatar

export const student: Profile = {
  id: 'u-demo',
  name: 'Demo',
  onboarded: true,
  confidence: 3,
  satExp: 'none',
  desmos: 'little',
  target: 700,
  examDate: '2026-12-05',
  start: 'english',
  tz: 'Asia/Ulaanbaatar',
  hidePublic: false,
  friendsOnly: false,
};

export const mcq: Question = {
  id: 'a2',
  domain: 'alg',
  skill: 'Systems of linear equations',
  difficulty: 1,
  prompt: '$y=2x+1$ and $y=-x+7$. What is the value of $x$ for the solution $(x, y)$ of the system?',
  choices: ['$1$', '$2$', '$3$', '$5$'],
  answer: 1,
  explain: '$2x+1=-x+7$ → $3x=6$ → $x=2$ (мөн $y=5$).',
  hint: 'Хоёр $y$-ийг тэнцүүлж бич.',
  desmos: { rows: ['y=2x+1', 'y=-x+7'], tip: 'Огтлолцол дээр дар: $(2,5)$.' },
  why: { 3: '$5$ бол $y$-ийн утга.' },
};

export const gridIn: Question = {
  id: 'h3',
  domain: 'psda',
  skill: 'Rates',
  difficulty: 3,
  prompt: 'A car travels 75 km in 2 hours. At this rate, how many km does it travel in 1 hour?',
  answer: ['37.5', '75/2'],
  explain: '$75/2=37.5$.',
  hint: 'Нэг цагийн хурд = зай / цаг.',
};

export const hardQuestion: Question = { ...gridIn, id: 'h9', difficulty: 3 };

export const wordCard: Card = {
  id: 'sum',
  front: 'sum',
  ipa: '/sʌm/',
  say: 'сам',
  back: 'нийлбэр',
  hook: '«Сам»-наад бүгдийг нэг дор цуглуул.',
  ex: 'the **sum** of $x$ and $4$ → $x+4$',
  art: 'merge',
};

export const formulaCard: Card = {
  id: 'slope',
  front: 'Slope',
  back: 'налалт',
  tex: 'm=\\frac{y_2-y_1}{x_2-x_1}',
  when: 'Хоёр цэг өгөгдсөн шулууны налалт',
  art: 'line',
  v: 'slope',
};

export const deck: Deck = {
  id: 'ops',
  kind: 'word',
  title: 'Үйлдлийн үгс',
  sub: 'sum, product…',
  color: 'var(--c-leaf)',
  edge: 'var(--c-leaf-2)',
  cards: [wordCard],
};

export const lesson: Lesson = {
  id: 's1-l1',
  title: 'Математикийн хэл',
  en: 'The language of math',
  kind: 'lesson',
  xp: 40,
  minutes: 5,
  exercises: [
    { kind: 'concept', title: 'Тэнцүү', body: '**is** = $=$' },
    {
      kind: 'choice',
      prompt: '«at least» гэдэг нь?',
      options: ['$\\le$', '$\\ge$'],
      answer: 1,
      explain: '≥',
      concept: 'at least',
    },
    { kind: 'input', prompt: '$3x=15$ бол $x$?', answer: ['5'], explain: '$x=5$', concept: 'solve' },
  ],
};

export const stage: Stage = {
  id: 's1',
  no: 1,
  title: 'Ойлгох',
  en: 'Understand',
  blurb: 'SAT-ийн хэл',
  tone: 'leaf',
  nodes: [lesson],
};

export const mistake: Mistake = {
  id: 'm1',
  qid: 'a2',
  chosen: '3',
  at: NOW - 86_400_000,
  resolved: false,
  source: 'practice',
  box: 0,
  due: NOW,
};

export const xpEvent: XpEvent = {
  id: 'x1',
  userId: student.id,
  amount: 40,
  reason: 'lesson',
  key: 'lesson:s1-l1',
  at: new Date(NOW).toISOString(),
};

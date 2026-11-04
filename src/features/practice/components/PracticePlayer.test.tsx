import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test';
import { resetAnswerTransport } from '@/test/mock-submissions';
import { act, fireEvent, render, screen, within } from '@/test/render';
import type { Question } from '@/types';
import { PracticePlayer } from './PracticePlayer';

const questions: Question[] = Array.from({ length: 5 }, (_, index) => ({
  id: `question-${index + 1}`,
  domain: 'alg',
  skill: 'Linear equations',
  difficulty: 1,
  prompt: `Question ${index + 1}`,
  choices: ['1', '2', '3', '4'],
  answer: 0,
  explain: 'Explanation',
  hint: 'Hint',
}));

describe('PracticePlayer timed mode', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('starts at 06:00 and automatically finishes after 360 seconds', async () => {
    render(<PracticePlayer questions={questions} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: '6 минутын сорил эхлүүлэх',
      }),
    );

    expect(screen.getByRole('timer').textContent).toBe('06:00');

    await act(async () => {
      jest.advanceTimersByTime(360_000);
    });

    expect(screen.getByRole('heading', { name: 'Сорил дууслаа!' })).toBeTruthy();

    expect(screen.getByText('Хугацаа дууссан тул сорил автоматаар дууслаа.')).toBeTruthy();

    // the score is split across elements for styling, so read the results panel's text
    expect(screen.getByRole('status').textContent).toContain('0 / 5');
  });

  test('manual finish shows results and stops the countdown', async () => {
    render(<PracticePlayer questions={questions} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: '6 минутын сорил эхлүүлэх',
      }),
    );

    await act(async () => {
      jest.advanceTimersByTime(2_000);
    });

    expect(screen.getByRole('timer').textContent).toBe('05:58');

    fireEvent.click(screen.getByRole('button', { name: 'Дуусгах' }));

    expect(screen.getByRole('heading', { name: 'Сорил дууслаа!' })).toBeTruthy();

    expect(screen.getByText('Та сорилоо дуусгалаа.')).toBeTruthy();
  });
});

describe('PracticePlayer Desmos side panel', () => {
  const lesson = {
    id: 'ai',
    title: 'Огтлолцол',
    question: 'Question 1',
    answer: '1',
    check: '1 = 1 ✓',
    match: [],
    steps: [
      { text: 'Шулуун бич: y = x.', desmos: [{ latex: 'y=x' }] },
      { text: 'Огтлолцол: (1, 1) — хариу 1.', desmos: [{ latex: '(1,1)' }] },
    ],
  };
  const saved = { fetch: globalThis.fetch };
  let sent: Record<string, unknown>[] = [];

  beforeEach(() => {
    sent = [];
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      return Response.json({ lesson, source: 'model' });
    }) as unknown as typeof fetch;
    window.Desmos = {
      GraphingCalculator: () => ({ setBlank() {}, setExpression() {}, setMathBounds() {}, destroy() {} }),
    };
  });
  afterEach(() => {
    globalThis.fetch = saved.fetch;
    window.Desmos = undefined;
  });

  test('the cat Desmos button splits the screen; the answer step unlocks after answering', async () => {
    const { container } = render(<PracticePlayer questions={questions} />);
    fireEvent.click(screen.getByRole('button', { name: 'Desmos-ийг хажууд нээх' }));

    const panel = screen.getByRole('complementary', { name: 'Desmos · Суу' });
    expect(container.querySelector('main')?.className).toContain('lg:grid-cols-2');
    expect(await screen.findByText('Шулуун бич: y = x.')).toBeTruthy();
    expect(sent).toEqual([{ question: 'Question 1\nA) 1\nB) 2\nC) 3\nD) 4', answer: '1' }]);
    expect(screen.queryByText('Огтлолцол: (1, 1) — хариу 1.')).toBeNull();
    expect(panel.textContent).toContain('хариултаа илгээсний дараа нээгдэнэ');

    // answer the question → the last step is there
    fireEvent.click(screen.getByRole('button', { name: /^A\s*1$/ }));
    expect(screen.getByText('Огтлолцол: (1, 1) — хариу 1.')).toBeTruthy();

    fireEvent.click(within(panel).getByRole('button', { name: 'Desmos-ийг хаах' }));
    expect(screen.queryByRole('complementary', { name: 'Desmos · Суу' })).toBeNull();
    expect(container.querySelector('main')?.className).not.toContain('lg:grid-cols-2');
  });
});

beforeEach(resetAnswerTransport);
afterEach(resetAnswerTransport);

describe('PracticePlayer «AI багш Суу»', () => {
  test('the button splits the page: the problem on one side, Суу on the other; Desmos takes its place', () => {
    render(<PracticePlayer questions={questions} />);
    fireEvent.click(screen.getByRole('button', { name: 'AI багш Суу-г хажууд нээх' }));
    const panel = screen.getByRole('complementary', { name: 'AI багш Суу' });
    expect(panel).toBeTruthy();
    expect(screen.getByRole('main').className).toContain('lg:grid-cols-2');
    // only one side panel at a time
    fireEvent.click(screen.getByRole('button', { name: 'Desmos-ийг хажууд нээх' }));
    expect(screen.queryByRole('complementary', { name: 'AI багш Суу' })).toBeNull();
  });
});

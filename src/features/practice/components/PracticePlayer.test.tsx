import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test';
import { act, fireEvent, render, screen } from '@/test/render';
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

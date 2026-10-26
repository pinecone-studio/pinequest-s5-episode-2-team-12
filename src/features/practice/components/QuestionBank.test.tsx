import { expect, test } from 'bun:test';
import { QUESTIONS } from '@/mocks/questions';
import { fireEvent, render, screen } from '@/test/render';
import type { Question } from '@/types';
import { QuestionBank } from './QuestionBank';

const questions: Question[] = [
  {
    ...QUESTIONS[0],
    id: 'alg-easy',
    domain: 'alg',
    difficulty: 1,
    skill: 'Linear equations',
    prompt: 'Find x.',
  },
  {
    ...QUESTIONS[0],
    id: 'geo-hard',
    domain: 'geo',
    difficulty: 3,
    skill: 'Circles',
    prompt: 'Find the circle radius.',
  },
];

test('the redesigned bank keeps topic filtering and result counts accessible', () => {
  const { container } = render(<QuestionBank questions={questions} />);
  expect(screen.getByRole('heading', { level: 1, name: 'Асуултын сан' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Геометр' }));
  expect(container.querySelectorAll('article')).toHaveLength(1);
  expect(screen.getByText('1 бодлого олдлоо')).toBeTruthy();
  expect(screen.getByText('Find the circle radius.')).toBeTruthy();
  expect(screen.queryByText('Find x.')).toBeNull();
});

test('search and saved filters still work with the new labels and layout', () => {
  render(<QuestionBank questions={questions} savedIds={['geo-hard']} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Хайх' }), { target: { value: 'circle' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Хадгалсан бодлогууд' }));
  expect(screen.getByText('1 бодлого олдлоо')).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox', { name: 'Түвшин' }), { target: { value: '1' } });
  expect(screen.getByText('Бодлого олдсонгүй')).toBeTruthy();
});

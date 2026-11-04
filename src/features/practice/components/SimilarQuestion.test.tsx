import { expect, test } from 'bun:test';
import { finalAnswer, generate } from '@ai/pipeline/generate';
import { fireEvent, render, screen } from '@/test/render';
import { similarQuestion } from '../lib/similar';
import { SimilarQuestion } from './SimilarQuestion';

const grid = generate(6, 1).find((x) => x.id.startsWith('g-quad-one-sol-'));
const mcq = generate(6, 1).find((x) => x.id.startsWith('g-radians-'));
if (!grid || !mcq) throw new Error('fixtures');

test('nothing is shown for a question no template can copy', () => {
  const base = {
    id: 'x',
    domain: 'psda' as const,
    skill: 'Two-variable data: models and scatterplots',
    difficulty: 2 as const,
    prompt: '',
  };
  render(<SimilarQuestion base={base} seedStart={1} />);
  expect(screen.queryByRole('button', { name: /Төстэй бодлого/ })).toBeNull();
});

test('grid-in: a new question appears, a right answer is praised and explained', () => {
  render(<SimilarQuestion base={grid} seedStart={10} />);
  fireEvent.click(screen.getByRole('button', { name: 'Төстэй бодлого бодох' }));
  const q = similarQuestion(grid, 10);
  if (!q) throw new Error('no similar');
  expect(screen.getByRole('region', { name: 'Төстэй бодлого' })).toBeTruthy();
  const check = screen.getByRole('button', { name: 'Шалгах' }) as HTMLButtonElement;
  expect(check.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Хариу'), { target: { value: finalAnswer(q) } });
  fireEvent.click(check);
  expect(screen.getByRole('status').textContent).toContain('Зөв!');
});

test('grid-in: a wrong answer shows the right one; «another» gives a new question', () => {
  render(<SimilarQuestion base={grid} seedStart={10} />);
  fireEvent.click(screen.getByRole('button', { name: 'Төстэй бодлого бодох' }));
  fireEvent.change(screen.getByLabelText('Хариу'), { target: { value: '-99999' } });
  fireEvent.click(screen.getByRole('button', { name: 'Шалгах' }));
  const status = screen.getByRole('status').textContent ?? '';
  expect(status).toContain('Буруу');
  expect(status).toContain('Зөв хариу');
  const first = screen.getByRole('region', { name: 'Төстэй бодлого' }).textContent;
  fireEvent.click(screen.getByRole('button', { name: /Өөр төстэй бодлого/ }));
  expect(screen.getByRole('region', { name: 'Төстэй бодлого' }).textContent).not.toBe(first);
  expect(screen.queryByRole('status')).toBeNull(); // the new question starts unchecked
});

test('multiple choice: picking the right letter is graded correct', () => {
  render(<SimilarQuestion base={mcq} seedStart={3} />);
  fireEvent.click(screen.getByRole('button', { name: 'Төстэй бодлого бодох' }));
  const q = similarQuestion(mcq, 3);
  if (!q || typeof q.answer !== 'number') throw new Error('expected mcq');
  fireEvent.click(screen.getAllByRole('radio')[q.answer] as HTMLElement);
  fireEvent.click(screen.getByRole('button', { name: 'Шалгах' }));
  expect(screen.getByRole('status').textContent).toContain('Зөв!');
});

import { afterEach, expect, test } from 'bun:test';
import { act, fireEvent, render, screen } from '@/test/render';
import type { Question } from '@/types';
import { loadRatings, START_RATING } from '../lib/elo';
import { AdaptivePractice } from './AdaptivePractice';

afterEach(() => localStorage.clear());
const settled = () => act(async () => {});

const mcq = (id: string, domain: Question['domain']): Question => ({
  id,
  domain,
  skill: 'Linear functions',
  difficulty: 2,
  prompt: `Question ${id}`,
  choices: ['1', '2', '3', '4'],
  answer: 2,
  explain: 'Тайлбар.',
  hint: 'Зөвлөгөө.',
});

test('four domain ratings start equal; a wrong first answer lowers only that domain, a retry does not count', async () => {
  render(<AdaptivePractice pool={[mcq('q1', 'geo')]} rng={() => 0} />);
  await settled();
  for (const name of ['Алгебр', 'Ахисан математик', 'Өгөгдөл, магадлал', 'Геометр, тригонометр']) {
    expect(screen.getByLabelText(`${name} үнэлгээ`).textContent).toBe(String(START_RATING));
  }
  expect(screen.getByText('Question q1')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /^A\s*1$/ }));
  await settled();
  const after = loadRatings();
  expect(Object.keys(after)).toEqual(['geo']);
  expect(after.geo?.n).toBe(1);
  expect(after.geo?.r).toBeLessThan(START_RATING);
  expect(Number(screen.getByLabelText('Геометр, тригонометр үнэлгээ').textContent)).toBe(
    after.geo?.r ?? Number.NaN,
  );

  fireEvent.click(screen.getByRole('button', { name: /^C\s*3$/ })); // the retry is right, but not counted
  await settled();
  expect(loadRatings().geo?.n).toBe(1);
});

test('a right answer offers the next question, picked from the pool without repeats', async () => {
  render(<AdaptivePractice pool={[mcq('q1', 'alg'), mcq('q2', 'alg')]} rng={() => 0} />);
  await settled();
  const first = screen.getByText(/^Question q[12]$/).textContent;
  fireEvent.click(screen.getByRole('button', { name: /^C\s*3$/ }));
  await settled();
  expect((loadRatings().alg?.r ?? 0) > START_RATING).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /Дараагийн бодлого/ }));
  await settled();
  const second = screen.getByText(/^Question q[12]$/).textContent;
  expect(second).not.toBe(first);
});

test('after a wrong answer the student can move on (no dead end)', async () => {
  render(<AdaptivePractice pool={[mcq('q1', 'alg'), mcq('q2', 'alg')]} rng={() => 0} />);
  await settled();
  const first = screen.getByText(/^Question q[12]$/).textContent;
  expect(screen.queryByRole('button', { name: /шилжих/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /^A\s*1$/ }));
  await settled();
  fireEvent.click(screen.getByRole('button', { name: /Дараагийн бодлого руу шилжих/ }));
  await settled();
  expect(screen.getByText(/^Question q[12]$/).textContent).not.toBe(first);
  expect(screen.queryByRole('button', { name: /шилжих/ })).toBeNull(); // the new question starts fresh
});

test('an empty pool says so', async () => {
  render(<AdaptivePractice pool={[]} />);
  await settled();
  expect(screen.getByText('Бодлого олдсонгүй.')).toBeTruthy();
});

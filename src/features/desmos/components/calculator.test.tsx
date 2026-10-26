import { expect, test } from 'bun:test';
import { fireEvent, render, screen, waitFor } from '@/test/render';
import type { DesmosLesson } from '@/types';
import GraphCalc, { type GraphState } from './graph-calc';
import { LessonRunner } from './lesson-runner';

test('expression edits emit parsed state and Enter adds a row', async () => {
  let latest: GraphState | undefined;
  render(
    <GraphCalc
      onState={(state) => {
        latest = state;
      }}
    />,
  );
  const input = screen.getByRole('textbox', { name: 'Илэрхийлэл 1' });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: '3x+2y=16' } });
  await waitFor(() => expect(latest?.parsed[0].kind).toBe('func'));
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(screen.getByRole('textbox', { name: 'Илэрхийлэл 2' })).toBeTruthy();
});

test('English controls come from the app locale provider', () => {
  render(<GraphCalc />, { locale: 'en' });
  expect(screen.getByRole('button', { name: 'Add row' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Zoom in' })).toBeTruthy();
});

test('runner requires the right answer and stores completion only after success', async () => {
  localStorage.clear();
  const lesson: DesmosLesson = {
    id: 'component-check',
    no: 1,
    title: 'Check',
    en: 'Check',
    skill: 'test',
    minutes: 1,
    xp: 1,
    intro: 'Start',
    outro: 'Done',
    initial: [],
    steps: [
      { type: 'read', say: 'Observe' },
      { type: 'answer', say: 'Solve', prompt: '2 + 3', accept: ['5'], hint: 'Add', explain: 'Correct' },
    ],
  };
  render(<LessonRunner lesson={lesson} />);
  fireEvent.click(screen.getByTestId('start-lesson'));
  fireEvent.click(screen.getByTestId('read-next'));
  fireEvent.click(screen.getByTestId('d-hint'));
  expect(screen.getByTestId('lesson-progress').textContent).toBe('1/2');
  const input = screen.getByRole('textbox', { name: '2 + 3' });
  fireEvent.change(input, { target: { value: '4' } });
  fireEvent.click(screen.getByTestId('check-answer'));
  expect(screen.queryByTestId('lesson-complete')).toBeNull();
  expect(localStorage.getItem('suuprep:desmos:completed:v1')).toBeNull();
  fireEvent.change(input, { target: { value: '5' } });
  fireEvent.click(screen.getByTestId('check-answer'));
  await waitFor(() => expect(screen.getByTestId('lesson-complete')).toBeTruthy());
  expect(JSON.parse(localStorage.getItem('suuprep:desmos:completed:v1') || '[]')).toContain(lesson.id);
});

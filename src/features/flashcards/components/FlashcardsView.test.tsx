import { afterEach, beforeEach, expect, test } from 'bun:test';
import { fireEvent, render, screen } from '@/test/render';
import { FLASHCARDS } from '../lib/decks';
import { FlashcardsView } from './FlashcardsView';

let saved: string | null;
beforeEach(() => {
  saved = localStorage.getItem('suprep:flash:v1');
  localStorage.removeItem('suprep:flash:v1');
});
afterEach(() => {
  if (saved === null) localStorage.removeItem('suprep:flash:v1');
  else localStorage.setItem('suprep:flash:v1', saved);
});

function open() {
  return render(
    <FlashcardsView demo serverStates={{}} currentStop={null} reviewed={[]} onGrade={() => {}} />,
  );
}

test('cards and keyboard grading begin only after Start; a revealed card can be graded and saved', () => {
  open();
  expect(screen.queryByRole('button', { name: 'Эргүүлэх' })).toBeNull();
  fireEvent.keyDown(window, { key: '1', code: 'Digit1' });
  fireEvent.keyDown(window, { key: ' ', code: 'Space' });
  expect(localStorage.getItem('suprep:flash:v1')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Эхлэх/ }));
  const card = screen.getByRole('button', { name: 'Эргүүлэх' });
  expect(card.getAttribute('aria-pressed')).toBe('false');
  fireEvent.keyDown(card, { key: ' ', code: 'Space' });
  expect(card.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: /2\. Цээжилсэн/ }));
  const states = JSON.parse(localStorage.getItem('suprep:flash:v1')!);
  expect(states[FLASHCARDS[0].key].reps).toBe(1);
  expect(screen.getByText('1 карт давтсан')).toBeTruthy();
});

test('changing decks returns to preparation and Pause keeps saved progress', () => {
  open();
  fireEvent.click(screen.getByRole('button', { name: /Эхлэх/ }));
  fireEvent.click(screen.getByRole('radio', { name: /^Томьёо$/ }));
  expect(screen.queryByRole('button', { name: 'Эргүүлэх' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Эхлэх/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Түр зогсоох' }));
  expect(screen.getByRole('button', { name: /Эхлэх/ })).toBeTruthy();
});

test('review-again cards persist across reloads and leave that section only after Memorized', () => {
  const props = { demo: true, serverStates: {}, currentStop: null, reviewed: [] };
  const first = render(<FlashcardsView {...props} />);
  fireEvent.click(screen.getByRole('button', { name: /Эхлэх/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Хариуг харах' }));
  expect(screen.getAllByRole('button').filter((button) => button.textContent?.match(/^[12]\./))).toHaveLength(
    2,
  );
  fireEvent.click(screen.getByRole('button', { name: /1\. Дахин давтах/ }));
  expect(screen.getByRole('button', { name: 'Дахин давтах (1)' })).toBeTruthy();
  first.unmount();
  render(<FlashcardsView {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Дахин давтах (1)' }));
  expect(screen.getByText(FLASHCARDS[0].front)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Эхлэх/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Хариуг харах' }));
  fireEvent.click(screen.getByRole('button', { name: /2\. Цээжилсэн/ }));
  expect(screen.getByRole('button', { name: 'Дахин давтах (0)' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Цээжилсэн (1)' })).toBeTruthy();
  expect(JSON.parse(localStorage.getItem('suprep:flash:v1')!)[FLASHCARDS[0].key].reps).toBe(1);
});

test('offline study keeps supplied saved repeat cards instead of overwriting them with demo storage', () => {
  const key = FLASHCARDS[0].key;
  render(
    <FlashcardsView
      demo
      serverStates={{ [key]: { reps: 0, interval: 0, ease: 2.3, due: Date.now() + 600000, lapses: 1 } }}
      currentStop={null}
      reviewed={[]}
      onGrade={() => {}}
    />,
  );
  expect(screen.getByRole('button', { name: 'Дахин давтах (1)' })).toBeTruthy();
});

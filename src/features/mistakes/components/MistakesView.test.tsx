import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { PracticePlayer } from '@/features/practice/components/PracticePlayer';
import { newState } from '@/lib/sm2';
import { QUESTIONS } from '@/mocks/questions';
import { answerTransport, resetAnswerTransport } from '@/test/mock-submissions';
import { act, fireEvent, render, screen } from '@/test/render';
import { readDemoNotebook, saveDemoSubmission } from '../lib/demo-notebook';
import type { Entry } from '../lib/notebook';

mock.module('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {} }),
  usePathname: () => '/mistakes',
}));
const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = (async () => Response.json({ analysis: null })) as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const { MistakesView } = await import('./MistakesView');
const q = QUESTIONS.find((entry) => entry.id === 'a1')!;
const server = {
  entries: [{ qid: q.id, chosen: '4', source: 'practice', at: Date.now() } as Entry],
  states: { [q.id]: { ...newState(Date.now()), resolved: false } },
};
const settled = () => act(async () => {});

test('notebook retries retain mistakes after wrong answers and remove them after persisted correct answers', async () => {
  answerTransport.storage = 'server';
  answerTransport.questions = [{ questionSource: 'practice', question: q }];
  render(<MistakesView demo={false} server={server} />);
  await settled();
  expect(screen.getByRole('button', { name: 'Дахин бодох' }).hasAttribute('disabled')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Дахин бодох' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Хариулт' }), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Шалгах' }));
  await settled();
  expect(screen.getByText('Буруу байна. Дахин оролдоорой.')).toBeTruthy();
  expect(screen.queryByText('Тайлбар')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '← Алдааны дэвтэр' }));
  expect(screen.getByRole('button', { name: 'Дахин бодох' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Дахин бодох' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Хариулт' }), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Шалгах' }));
  await settled();
  // Remains on feedback until the student chooses to leave.
  expect(screen.getByText('✨ Зөв хариулт! +5 XP')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '← Алдааны дэвтэр' }));
  expect(screen.queryByRole('button', { name: 'Дахин бодох' })).toBeNull();
});

test('failed saves retain the active mistake', async () => {
  answerTransport.fail = true;
  answerTransport.storage = 'server';
  answerTransport.questions = [{ questionSource: 'practice', question: q }];
  render(<MistakesView demo={false} server={server} />);
  await settled();
  expect(screen.getByRole('button', { name: 'Дахин бодох' }).hasAttribute('disabled')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Дахин бодох' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Хариулт' }), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Шалгах' }));
  await settled();
  expect(screen.getByRole('alert')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '← Алдааны дэвтэр' }));
  expect(screen.getByRole('button', { name: 'Дахин бодох' })).toBeTruthy();
});

test('signed-in notebook ignores demo data; preview failures expose a retry action', async () => {
  saveDemoSubmission({ qid: 'demo-only' }, 'wrong', false);
  const { unmount } = render(<MistakesView demo={false} server={{ entries: [], states: {} }} />);
  expect(screen.queryByText(/demo-only/)).toBeNull();
  unmount();
  answerTransport.failLoad = true;
  render(<MistakesView demo={false} server={server} />);
  await settled();
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Дахин ачаалах' })).toBeTruthy();
});

beforeEach(resetAnswerTransport);
afterEach(resetAnswerTransport);

test('Practice player and demo notebook share the same source-aware mistake and recovery', async () => {
  const hard = { ...q, difficulty: 3 as const };
  answerTransport.questions = [{ questionSource: 'practice', question: hard }];
  const bank = render(<PracticePlayer questions={[hard]} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Хариулт' }), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Шалгах' }));
  await settled();
  expect(readDemoNotebook().entries).toHaveLength(1);
  expect(readDemoNotebook().entries[0].qid).toBe(hard.id);
  bank.unmount();
  render(<MistakesView demo server={{ entries: [], states: {} }} />);
  await settled();
  fireEvent.click(screen.getByRole('button', { name: 'Дахин бодох' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Хариулт' }), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Шалгах' }));
  await settled();
  fireEvent.click(screen.getByRole('button', { name: '← Алдааны дэвтэр' }));
  expect(screen.queryByRole('button', { name: 'Дахин бодох' })).toBeNull();
  expect(readDemoNotebook().states[hard.id].resolved).toBe(true);
});

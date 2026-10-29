import { expect, mock, test } from 'bun:test';

const saved: unknown[] = [];
mock.module('@/features/settings/actions', () => ({
  saveSettings: async (patch: unknown) => {
    saved.push(patch);
    return { ok: true };
  },
}));

const { fireEvent, render, screen, waitFor } = await import('@/test/render');
const { AboutCard } = await import('./AboutCard');

const about = {
  satExp: 'taken' as const,
  lastMathScore: 620,
  target: 720,
  examDate: '2026-12-05',
  confidence: 3,
  desmos: 'little' as const,
  studyMinutes: 30 as const,
  start: 'english' as const,
};

test('shows the onboarding answers in the same words as onboarding', () => {
  render(<AboutCard about={about} demo={false} onSaved={() => {}} />);
  expect(screen.getByText('Миний мэдээлэл')).toBeTruthy();
  expect(screen.getByText('Албан ёсны Digital SAT өгсөн')).toBeTruthy();
  expect(screen.getByText('620')).toBeTruthy();
  expect(screen.getByText('720')).toBeTruthy();
  expect(screen.getByText('2026-12-05')).toBeTruthy();
  expect(screen.getByText('3 / 5')).toBeTruthy();
  expect(screen.getByText('30 минут')).toBeTruthy();
  expect(screen.getByText('Математикийн англи үгс')).toBeTruthy();
});

test('editing saves the changes and drops the old score when the SAT was not taken', async () => {
  let after: unknown = null;
  render(
    <AboutCard
      about={about}
      demo={false}
      onSaved={(a) => {
        after = a;
      }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Засах' }));
  fireEvent.click(screen.getByRole('button', { name: 'Одоогоор өгөөгүй' }));
  fireEvent.change(screen.getByLabelText('Зорилтот Math оноо'), { target: { value: '780' } });
  fireEvent.click(screen.getByRole('button', { name: '60 минут' }));
  fireEvent.click(screen.getByRole('button', { name: 'Хадгалах' }));
  await waitFor(() => expect(after).not.toBeNull());
  expect(saved.at(-1)).toMatchObject({ satExp: 'none', lastMathScore: null, target: 780, studyMinutes: 60 });
  expect(after).toMatchObject({ satExp: 'none', lastMathScore: null, target: 780 });
});

test('an invalid target score is not saved', () => {
  const before = saved.length;
  render(<AboutCard about={about} demo={false} onSaved={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Засах' }));
  fireEvent.change(screen.getByLabelText('Зорилтот Math оноо'), { target: { value: '725' } });
  fireEvent.click(screen.getByRole('button', { name: 'Хадгалах' }));
  expect(saved.length).toBe(before);
});

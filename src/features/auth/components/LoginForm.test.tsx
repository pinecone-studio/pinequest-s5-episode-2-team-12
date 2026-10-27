import { expect, mock, test } from 'bun:test';

const send = mock(async () => ({ ok: true }));
mock.module('../actions', () => ({
  sendEmailCode: send,
  verifyEmailCode: async () => ({ ok: true }),
  signInWithGoogle: async () => ({ ok: true }),
  enterDemo: async () => {},
  previewOnboarding: async () => {},
}));
const { render, screen, fireEvent, waitFor } = await import('@/test/render');
const { LoginForm } = await import('./LoginForm');

test('signup sends the selected mode and preserves the intended destination', async () => {
  render(<LoginForm configured initialMode="signup" next="/bank" />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Имэйл' }), {
    target: { value: 'student@example.com' },
  });
  fireEvent.submit(screen.getByRole('textbox', { name: 'Имэйл' }).closest('form')!);
  await waitFor(() => expect(send).toHaveBeenCalledWith('student@example.com', 'signup', '/bank'));
  expect(screen.getByText(/хаягт ирсэн нэг удаагийн холбоос/)).toBeTruthy();
  fireEvent.click(screen.getByText('Кодоор нэвтрэх үү?'));
  expect(screen.getByRole('textbox', { name: 'Нэвтрэх код' })).toBeTruthy();
});
test('unconfigured auth is disabled while signup preview remains available', () => {
  render(<LoginForm configured={false} />);
  expect((screen.getByRole('textbox', { name: 'Имэйл' }) as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Бүртгүүлэх' }));
  expect(
    (screen.getByRole('button', { name: 'Шинэ гишүүний алхмуудыг демогоор үзэх' }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});

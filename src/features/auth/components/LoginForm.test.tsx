import { expect, mock, test } from 'bun:test';
import type { AuthResult } from '../lib/errors';

const signup = mock(async (): Promise<AuthResult> => ({ ok: true, confirmationRequired: true }));
const login = mock(async (): Promise<AuthResult> => ({ ok: true }));
mock.module('../actions', () => ({
  requestPasswordReset: async () => ({ ok: true }),
  updatePassword: async () => ({ ok: true }),
  signUpWithPassword: signup,
  signInWithPassword: login,
  signInWithGoogle: async () => ({ ok: true }),
  enterDemo: async () => {},
  previewOnboarding: async () => {},
}));
const { render, screen, fireEvent, waitFor } = await import('@/test/render');
const { LoginForm } = await import('./LoginForm');
const passwordField = () => screen.getByLabelText('Нууц үг', { exact: true, selector: 'input' });

test('signup sends email, username, password and destination without storing the password in browser storage', async () => {
  render(<LoginForm configured initialMode="signup" next="/bank" />);
  fireEvent.change(screen.getByLabelText('Имэйл'), { target: { value: 'student@gmail.com' } });
  fireEvent.change(screen.getByLabelText('Хэрэглэгчийн нэр'), { target: { value: 'suu_student' } });
  fireEvent.change(passwordField(), { target: { value: 'StudyPassword8' } });
  fireEvent.submit(screen.getByLabelText('Имэйл').closest('form')!);
  await waitFor(() =>
    expect(signup).toHaveBeenCalledWith(
      { email: 'student@gmail.com', username: 'suu_student', password: 'StudyPassword8' },
      '/bank',
    ),
  );
  expect((await screen.findByRole('status')).textContent).toContain('баталгаажуулсны дараа');
  expect(JSON.stringify(localStorage)).not.toContain('StudyPassword8');
});
test('login accepts username and password; incorrect credentials get a specific message', async () => {
  login.mockResolvedValueOnce({ ok: false, reason: 'invalid_credentials', code: 'invalid_credentials' });
  render(<LoginForm configured next="/profile" />);
  fireEvent.change(screen.getByLabelText('Имэйл эсвэл хэрэглэгчийн нэр'), {
    target: { value: 'suu_student' },
  });
  fireEvent.change(passwordField(), { target: { value: 'wrong-password' } });
  fireEvent.submit(passwordField().closest('form')!);
  await waitFor(() => expect(login).toHaveBeenCalledWith('suu_student', 'wrong-password', '/profile'));
  expect((await screen.findByRole('alert')).textContent).toContain('нууц үг буруу');
});
test('username conflicts are actionable and never display a success message', async () => {
  signup.mockResolvedValueOnce({ ok: false, reason: 'username_taken' });
  render(<LoginForm configured initialMode="signup" />);
  fireEvent.submit(passwordField().closest('form')!);
  expect((await screen.findByRole('alert')).textContent).toContain('Өөр нэр сонгоно уу');
  expect(Boolean(screen.queryByRole('status'))).toBe(false);
});
test('password reveal is optional; changing mode clears the password', () => {
  render(<LoginForm configured initialMode="signup" />);
  fireEvent.change(passwordField(), { target: { value: 'KeepItPrivate8' } });
  expect((passwordField() as HTMLInputElement).type).toBe('password');
  fireEvent.click(screen.getByRole('button', { name: 'Нууц үг харуулах' }));
  expect((passwordField() as HTMLInputElement).type).toBe('text');
  fireEvent.click(screen.getByRole('button', { name: 'Нэвтрэх' }));
  expect((passwordField() as HTMLInputElement).value).toBe('');
});
test('unconfigured auth is disabled while preview remains available', () => {
  render(<LoginForm configured={false} initialMode="signup" />);
  expect((screen.getByLabelText('Имэйл') as HTMLInputElement).disabled).toBe(true);
  expect(
    (screen.getByRole('button', { name: 'Шинэ гишүүний алхмуудыг демогоор үзэх' }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});

test('login offers password recovery', () => {
  render(<LoginForm configured />);
  expect(screen.getByRole('link', { name: 'Нууц үгээ мартсан уу?' }).getAttribute('href')).toBe(
    '/auth/forgot-password',
  );
});

test('duplicate signup offers recovery instead of leaving the user in a signup loop', async () => {
  signup.mockResolvedValueOnce({ ok: false, reason: 'account_exists' });
  render(<LoginForm configured initialMode="signup" />);
  fireEvent.change(screen.getByLabelText('Имэйл'), { target: { value: 'existing@gmail.com' } });
  fireEvent.submit(passwordField().closest('form')!);
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain('хуучин нууц үг');
  expect(screen.getByRole('link', { name: 'Нууц үгээ сэргээх' }).getAttribute('href')).toBe(
    '/auth/forgot-password',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Бүртгэлтэй хаягаар нэвтрэх' }));
  expect((screen.getByLabelText('Имэйл эсвэл хэрэглэгчийн нэр') as HTMLInputElement).value).toBe(
    'existing@gmail.com',
  );
  expect((passwordField() as HTMLInputElement).value).toBe('');
});

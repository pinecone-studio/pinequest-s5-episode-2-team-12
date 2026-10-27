import { expect, mock, test } from 'bun:test';
import type { AuthResult } from '../lib/errors';

const request = mock(async (): Promise<AuthResult> => ({ ok: true }));
const update = mock(async (): Promise<AuthResult> => ({ ok: true }));
mock.module('../actions', () => ({
  requestPasswordReset: request,
  updatePassword: update,
  signUpWithPassword: async () => ({ ok: true, confirmationRequired: true }),
  signInWithPassword: async () => ({ ok: true }),
  signInWithGoogle: async () => ({ ok: true }),
  enterDemo: async () => {},
  previewOnboarding: async () => {},
}));
const { render, screen, fireEvent, waitFor } = await import('@/test/render');
const { RecoveryForm } = await import('./RecoveryForm');
test('forgot form sends the email and displays a non-disclosing confirmation', async () => {
  render(<RecoveryForm mode="request" configured />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Имэйл' }), {
    target: { value: 'student@gmail.com' },
  });
  fireEvent.submit(screen.getByRole('textbox', { name: 'Имэйл' }).closest('form')!);
  await waitFor(() => expect(request).toHaveBeenCalledWith('student@gmail.com'));
  expect((await screen.findByRole('status')).textContent).toContain('бүртгэл байгаа бол');
});
test('delivery restriction stays actionable and does not claim a reset email was sent', async () => {
  request.mockResolvedValueOnce({ ok: false, reason: 'email_restricted' });
  render(<RecoveryForm mode="request" configured />);
  fireEvent.submit(screen.getByRole('textbox', { name: 'Имэйл' }).closest('form')!);
  expect((await screen.findByRole('alert')).textContent).toContain('нийт хэрэглэгчдэд');
  expect(Boolean(screen.queryByRole('status'))).toBe(false);
});
test('expired session cannot access the password form', () => {
  render(<RecoveryForm mode="update" configured allowed={false} />);
  expect(Boolean(screen.queryByLabelText('Шинэ нууц үг', { exact: true }))).toBe(false);
  expect(screen.getByRole('link', { name: 'Шинэ сэргээх холбоос авах' }).getAttribute('href')).toBe(
    '/auth/forgot-password',
  );
});
test('mismatch blocks submission; matching passwords update and clear the secret fields', async () => {
  render(<RecoveryForm mode="update" configured />);
  const password = screen.getByLabelText('Шинэ нууц үг', { exact: true });
  const confirmation = screen.getByLabelText('Шинэ нууц үг давтах');
  fireEvent.change(password, { target: { value: 'ChangedPassword8' } });
  fireEvent.change(confirmation, { target: { value: 'DifferentPassword8' } });
  fireEvent.submit(password.closest('form')!);
  expect(screen.getByRole('alert').textContent).toContain('таарахгүй');
  expect(update).not.toHaveBeenCalled();
  fireEvent.change(confirmation, { target: { value: 'ChangedPassword8' } });
  fireEvent.submit(password.closest('form')!);
  await waitFor(() =>
    expect(update).toHaveBeenCalledWith({
      password: 'ChangedPassword8',
      confirmPassword: 'ChangedPassword8',
    }),
  );
  expect((await screen.findByRole('status')).textContent).toContain('амжилттай');
});

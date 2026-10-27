import { expect, mock, test } from 'bun:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { saveNewPassword, sendPasswordReset } from './recovery';

const newPassword = { password: 'ChangedPassword8', confirmPassword: 'ChangedPassword8' };
function client(user: { id: string; is_anonymous?: boolean } | null = { id: 'owner' }) {
  const send = mock(async () => ({ error: null as null | { code: string } }));
  const update = mock(async () => ({ error: null as null | { code: string } }));
  const getUser = mock(async () => ({ data: { user }, error: null }));
  const db = {
    auth: { resetPasswordForEmail: send, updateUser: update, getUser },
  } as unknown as SupabaseClient;
  return { db, send, update, getUser };
}
test('reset email uses normalized registered address and the app callback', async () => {
  const c = client();
  const redirect = 'https://suuprep-app.vercel.app/auth/callback?next=%2Fauth%2Fupdate-password';
  expect(await sendPasswordReset(c.db, ' User@Gmail.com ', redirect)).toEqual({ ok: true });
  expect(c.send).toHaveBeenCalledWith('user@gmail.com', { redirectTo: redirect });
  expect(await sendPasswordReset(c.db, 'not email', redirect)).toEqual({
    ok: false,
    reason: 'invalid_email',
  });
  expect(c.send).toHaveBeenCalledTimes(1);
});
test('email failure is not reported as success', async () => {
  const c = client();
  c.send.mockResolvedValueOnce({ error: { code: 'email_address_not_authorized' } });
  expect(await sendPasswordReset(c.db, 'user@gmail.com', '/')).toMatchObject({
    ok: false,
    reason: 'email_restricted',
  });
});
test('password update rejects missing and anonymous sessions', async () => {
  for (const user of [null, { id: 'demo', is_anonymous: true }]) {
    const c = client(user);
    expect(await saveNewPassword(c.db, newPassword)).toEqual({ ok: false, reason: 'recovery_required' });
    expect(c.update).not.toHaveBeenCalled();
  }
});
test('password confirmation and strength are checked before any update', async () => {
  const c = client();
  expect(await saveNewPassword(c.db, { ...newPassword, confirmPassword: 'different' })).toEqual({
    ok: false,
    reason: 'password_mismatch',
  });
  expect(await saveNewPassword(c.db, { password: 'short', confirmPassword: 'short' })).toEqual({
    ok: false,
    reason: 'weak_password',
  });
  expect(c.update).not.toHaveBeenCalled();
});
test('only the verified session password is updated; no user id or profile write is accepted', async () => {
  const c = client();
  expect(await saveNewPassword(c.db, newPassword)).toEqual({ ok: true });
  expect(c.getUser).toHaveBeenCalledTimes(1);
  expect(c.update).toHaveBeenCalledWith({ password: newPassword.password });
  c.update.mockResolvedValueOnce({ error: { code: 'same_password' } });
  expect(await saveNewPassword(c.db, newPassword)).toMatchObject({ ok: false, reason: 'same_password' });
});

import { expect, mock, test } from 'bun:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Password, SignupCredentials, Username, usernamePattern } from './credentials';
import { loginPassword, registerPassword } from './password-auth';

const input = { email: 'student@gmail.com', username: 'suu_student', password: 'StudyPassword8' };
function clients(profile: { id: string } | null = null, failure?: { code: string }) {
  const signup = mock(async () => ({
    data: { user: { id: 'test', identities: [{ id: 'email' }] }, session: { access_token: 'test-session' } },
    error: failure ?? null,
  }));
  const login = mock(async () => ({ error: failure ?? null }));
  const read = mock(async () => ({ data: profile, error: null }));
  const getUser = mock(async () => ({ data: { user: { email: 'private@gmail.com' } }, error: null }));
  const admin = {
    from: () => ({ select: () => ({ ilike: () => ({ maybeSingle: read }) }) }),
    auth: { admin: { getUserById: getUser } },
  } as unknown as SupabaseClient;
  const db = { auth: { signUp: signup, signInWithPassword: login } } as unknown as SupabaseClient;
  return { db, admin, signup, login, read, getUser };
}
test('credentials normalize names/emails, preserve secrets and reject unsafe username/password lengths', () => {
  expect(
    SignupCredentials.parse({ ...input, email: ' Student@Gmail.com ', username: ' Suu_Student ' }),
  ).toEqual({ ...input, username: 'Suu_Student' });
  for (const name of ['Билгүүн', 'Суу багш 🐱', '100%_Cool!', 'cat@example.com', '👩‍💻'])
    expect(Username.safeParse(name).success).toBe(true);
  expect(Username.safeParse('  ').success).toBe(false);
  expect(Username.safeParse('line\nbreak').success).toBe(false);
  expect(Username.parse('e\u0301')).toBe('é');
  expect(usernamePattern('100%_Cool!')).toBe('100\\%\\_Cool!');
  expect(Password.safeParse('short').success).toBe(false);
  expect(Password.safeParse('ү'.repeat(40)).success).toBe(false);
  expect(Password.parse(' password with spaces ')).toBe(' password with spaces ');
});
test('registration delegates password hashing to Supabase Auth, with only username/name in profile metadata', async () => {
  const c = clients();
  expect(
    await registerPassword(c.db, c.admin, input, 'https://suuprep-app.vercel.app/auth/callback'),
  ).toEqual({ ok: true, confirmationRequired: false });
  expect(c.signup).toHaveBeenCalledWith({
    email: input.email,
    password: input.password,
    options: {
      data: { username: input.username, name: input.username },
      emailRedirectTo: 'https://suuprep-app.vercel.app/auth/callback',
    },
  });
});
test('duplicate usernames prevent Auth user creation', async () => {
  const c = clients({ id: 'existing' });
  expect(await registerPassword(c.db, c.admin, input, '/')).toEqual({ ok: false, reason: 'username_taken' });
  expect(c.signup).not.toHaveBeenCalled();
});
test('username login resolves email server-side, then uses password authentication', async () => {
  const c = clients({ id: 'test' });
  expect(await loginPassword(c.db, c.admin, ' SUU_STUDENT ', input.password)).toEqual({ ok: true });
  expect(c.getUser).toHaveBeenCalledWith('test');
  expect(c.login).toHaveBeenCalledWith({ email: 'private@gmail.com', password: input.password });
});
test('email login does not require admin lookup, and unknown usernames return generic invalid credentials', async () => {
  const c = clients();
  expect(await loginPassword(c.db, null, input.email, input.password)).toEqual({ ok: true });
  expect(c.getUser).not.toHaveBeenCalled();
  expect(await loginPassword(c.db, c.admin, 'unknown_name', input.password)).toEqual({
    ok: false,
    reason: 'invalid_credentials',
  });
});
test('wrong passwords and unconfirmed email get distinct errors', async () => {
  for (const code of ['invalid_credentials', 'email_not_confirmed']) {
    const c = clients(null, { code });
    expect(await loginPassword(c.db, c.admin, input.email, input.password)).toMatchObject({
      ok: false,
      reason: code === 'invalid_credentials' ? code : 'email_unconfirmed',
    });
  }
});

test('an email-shaped username can log in after the email credential check fails', async () => {
  const c = clients({ id: 'test' });
  c.login.mockResolvedValueOnce({ error: { code: 'invalid_credentials' } });
  expect(await loginPassword(c.db, c.admin, 'cat@example.com', input.password)).toEqual({ ok: true });
  expect(c.login).toHaveBeenCalledTimes(2);
  expect(c.getUser).toHaveBeenCalledWith('test');
});
test('email rate limits never trigger a second username login attempt', async () => {
  const c = clients({ id: 'test' }, { code: 'over_request_rate_limit' });
  expect(await loginPassword(c.db, c.admin, input.email, input.password)).toMatchObject({
    ok: false,
    reason: 'rate_limit',
  });
  expect(c.getUser).not.toHaveBeenCalled();
});

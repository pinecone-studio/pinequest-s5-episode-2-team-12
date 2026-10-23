import { describe, expect, test } from 'bun:test';
import { AuthError, createDemoAuth, DEMO_TRIGGERS, nameFromEmail } from './demo-auth';

const auth = createDemoAuth({ latencyMs: 0 });

describe('nameFromEmail', () => {
  test('turns the local part into a name', () => {
    expect(nameFromEmail('bat.erdene@school.mn')).toBe('Bat Erdene');
    expect(nameFromEmail('saraa_b@x.mn')).toBe('Saraa B');
  });

  test('falls back to the email when the local part is empty', () => {
    expect(nameFromEmail('@x.mn')).toBe('@x.mn');
  });
});

describe('demo auth', () => {
  test('signs in any email', async () => {
    await expect(auth.signIn({ email: ' bat@school.mn ', password: 'x' })).resolves.toEqual({
      name: 'Bat',
      email: 'bat@school.mn',
      provider: 'password',
    });
  });

  test('the wrong-password trigger fails on the password field', async () => {
    const err = await auth
      .signIn({ email: 'bat@school.mn', password: DEMO_TRIGGERS.wrongPassword })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err).toMatchObject({ code: 'wrongPassword', field: 'password' });
  });

  test('sign-up keeps the typed name', async () => {
    const user = await auth.signUp({ name: ' Бат ', email: 'bat@school.mn', password: 'Abcdefg1' });
    expect(user.name).toBe('Бат');
  });

  test('the taken-email trigger fails on the email field, any case', async () => {
    const err = await auth
      .signUp({ name: 'Бат', email: DEMO_TRIGGERS.takenEmail.toUpperCase(), password: 'Abcdefg1' })
      .catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'emailTaken', field: 'email' });
  });

  test('social sign-in returns a user for that provider', async () => {
    const user = await auth.signInWithProvider('github');
    expect(user.provider).toBe('github');
  });

  test('password reset resolves', async () => {
    await expect(auth.requestPasswordReset('bat@school.mn')).resolves.toBeUndefined();
  });
});

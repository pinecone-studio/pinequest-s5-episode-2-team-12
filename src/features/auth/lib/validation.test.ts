import { describe, expect, test } from 'bun:test';
import {
  type AuthValues,
  passwordChecks,
  passwordScore,
  validateAuth,
  validateEmail,
  validateName,
  validatePassword,
} from './validation';

const EMPTY: AuthValues = { name: '', email: '', password: '', remember: false, terms: false };

describe('validateEmail', () => {
  test('requires a value', () => {
    expect(validateEmail('')).toBe('emailRequired');
    expect(validateEmail('   ')).toBe('emailRequired');
  });

  test('rejects malformed addresses', () => {
    expect(validateEmail('bat')).toBe('emailInvalid');
    expect(validateEmail('bat@school')).toBe('emailInvalid');
    expect(validateEmail('bat @school.mn')).toBe('emailInvalid');
  });

  test('accepts a normal address, ignoring surrounding spaces', () => {
    expect(validateEmail(' bat@school.mn ')).toBeUndefined();
  });
});

describe('validateName', () => {
  test('requires at least 2 characters', () => {
    expect(validateName('')).toBe('nameRequired');
    expect(validateName('Б')).toBe('nameShort');
    expect(validateName('Бат')).toBeUndefined();
  });
});

describe('password rules', () => {
  test('score counts the rules met', () => {
    expect(passwordScore('')).toBe(0);
    expect(passwordScore('abc')).toBe(0);
    expect(passwordScore('abcdefgh')).toBe(1);
    expect(passwordScore('Abcdefgh')).toBe(2);
    expect(passwordScore('Abcdefg1')).toBe(3);
    expect(passwordScore('Abcdef1!')).toBe(4);
  });

  test('checks report each rule', () => {
    const met = Object.fromEntries(passwordChecks('abc1').map((c) => [c.id, c.met]));
    expect(met).toEqual({ length: false, case: false, number: true, symbol: false });
  });

  test('sign-in only requires a password', () => {
    expect(validatePassword('', 'signin')).toBe('passwordRequired');
    expect(validatePassword('x', 'signin')).toBeUndefined();
  });

  test('sign-up requires a strong password', () => {
    expect(validatePassword('Ab1!', 'signup')).toBe('passwordShort');
    expect(validatePassword('abcdefgh', 'signup')).toBe('passwordWeak');
    expect(validatePassword('Abcdefg1', 'signup')).toBeUndefined();
  });
});

describe('validateAuth', () => {
  test('only checks the fields the view shows', () => {
    expect(validateAuth('reset', EMPTY)).toEqual({ email: 'emailRequired' });
    expect(validateAuth('signin', EMPTY)).toEqual({ email: 'emailRequired', password: 'passwordRequired' });
  });

  test('sign-up checks name, password strength and terms', () => {
    expect(validateAuth('signup', { ...EMPTY, email: 'bat@school.mn', password: 'short' })).toEqual({
      name: 'nameRequired',
      password: 'passwordShort',
      terms: 'termsRequired',
    });
  });

  test('a valid form has no errors', () => {
    const values = { ...EMPTY, name: 'Бат', email: 'bat@school.mn', password: 'Abcdefg1', terms: true };
    expect(validateAuth('signup', values)).toEqual({});
  });
});

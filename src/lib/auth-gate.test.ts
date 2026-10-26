import { describe, expect, test } from 'bun:test';
import { gate, isPublicPath, safeNext } from './auth-gate';

describe('auth gate', () => {
  test('public paths', () => {
    for (const p of ['/', '/login', '/auth/callback', '/api/tutor']) expect(isPublicPath(p)).toBe(true);
    for (const p of ['/profile', '/roadmap/stop/1', '/loginx', '/settings'])
      expect(isPublicPath(p)).toBe(false);
  });

  test('signed-out visitors are sent to the entry screen', () => {
    expect(gate('/profile', false)).toEqual({ action: 'redirect', to: '/' });
    expect(gate('/', false)).toEqual({ action: 'next' });
    expect(gate('/login', false)).toEqual({ action: 'next' });
  });

  test('signed-in students skip the login page', () => {
    expect(gate('/login', true)).toEqual({ action: 'redirect', to: '/' });
    expect(gate('/profile', true)).toEqual({ action: 'next' });
  });

  test('safeNext keeps only same-site paths', () => {
    expect(safeNext('/flashcards')).toBe('/flashcards');
    expect(safeNext('//evil.example')).toBe('/');
    expect(safeNext('/\\evil.example')).toBe('/');
    expect(safeNext('https://evil.example')).toBe('/');
    expect(safeNext(null)).toBe('/');
  });
});

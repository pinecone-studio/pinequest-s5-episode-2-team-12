import { expect, test } from 'bun:test';
import { onboardingRedirect } from './routing';

test('new members must finish setup while returning members keep their destination', () => {
  expect(onboardingRedirect('/bank?domain=alg', false)).toBe('/onboarding?next=%2Fbank%3Fdomain%3Dalg');
  expect(onboardingRedirect('/', false)).toBe('/onboarding?next=%2F');
  expect(onboardingRedirect('/profile', true)).toBeNull();
  expect(onboardingRedirect('/', true)).toBeNull();
});
test('onboarding routing does not interrupt verification or loop on setup', () => {
  for (const path of ['/onboarding?next=%2Fbank', '/login', '/auth/callback?code=example', '/api/tutor']) {
    expect(onboardingRedirect(path, false)).toBeNull();
  }
});

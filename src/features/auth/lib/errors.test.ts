import { describe, expect, test } from 'bun:test';
import { type AuthFailure, authFailure, callbackFailure } from './errors';

describe('auth errors', () => {
  test.each([
    ['email_address_not_authorized', 'email_restricted'],
    ['over_email_send_rate_limit', 'email_rate_limit'],
    ['over_request_rate_limit', 'rate_limit'],
    ['email_exists', 'account_exists'],
    ['user_already_exists', 'account_exists'],
    ['user_not_found', 'account_missing'],
    ['signup_disabled', 'signup_disabled'],
    ['email_provider_disabled', 'provider_disabled'],
    ['otp_expired', 'expired_code'],
    ['email_address_invalid', 'invalid_email'],
  ] satisfies Array<[string, AuthFailure]>)('%s has a useful message category', (code, reason) => {
    expect(authFailure({ code })).toEqual({ ok: false, reason, code });
  });
  test('network, delivery, and server errors stay distinct', () => {
    expect(authFailure(new TypeError('fetch failed')).reason).toBe('network');
    expect(authFailure({ name: 'AuthRetryableFetchError' }).reason).toBe('network');
    expect(authFailure({ status: 500, message: 'Error sending confirmation email' }).reason).toBe(
      'email_delivery',
    );
    expect(authFailure({ status: 503 }).reason).toBe('service_unavailable');
    expect(authFailure({ status: 429 }).reason).toBe('rate_limit');
    expect(authFailure({ message: 'Email address not authorized' }).reason).toBe('email_restricted');
  });
  test('verification and callback failures explain the next step', () => {
    expect(authFailure({ code: 'invalid_credentials' }, 'verify').reason).toBe('invalid_code');
    expect(authFailure({ code: 'bad_code_verifier' }, 'callback').reason).toBe('callback_invalid');
    expect(authFailure({ code: 'flow_state_expired' }, 'callback').reason).toBe('expired_code');
  });
  test('does not expose provider messages, private addresses, or untrusted callback text', () => {
    const result = authFailure({
      code: '<script>secret@example.com</script>',
      message: 'private token: test-secret',
    });
    expect(result).toEqual({ ok: false, reason: 'failed' });
    expect(callbackFailure('expired_code')).toBe('expired_code');
    expect(callbackFailure('1')).toBe('callback_invalid');
    expect(callbackFailure('<script>')).toBe('callback_invalid');
    expect(callbackFailure(undefined)).toBeUndefined();
  });
});

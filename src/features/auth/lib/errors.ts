/** Safe, translatable failures. Never send raw provider messages, email addresses or tokens to the UI. */
export const AUTH_FAILURES = [
  'not_configured',
  'invalid_input',
  'invalid_username',
  'username_taken',
  'password_mismatch',
  'recovery_required',
  'same_password',
  'weak_password',
  'invalid_credentials',
  'email_unconfirmed',
  'invalid_email',
  'invalid_code',
  'expired_code',
  'network',
  'email_restricted',
  'email_rate_limit',
  'rate_limit',
  'email_delivery',
  'account_exists',
  'account_missing',
  'signup_disabled',
  'provider_disabled',
  'service_unavailable',
  'callback_invalid',
  'failed',
] as const;
export type AuthFailure = (typeof AUTH_FAILURES)[number];
export type AuthResult =
  | { ok: true; confirmationRequired?: boolean }
  | { ok: false; reason: AuthFailure; code?: string };
type Stage = 'send' | 'verify' | 'oauth' | 'callback' | 'password';

export function authFailure(error: unknown, stage: Stage = 'send'): Extract<AuthResult, { ok: false }> {
  const e =
    error && typeof error === 'object'
      ? (error as { code?: unknown; status?: unknown; name?: unknown; message?: unknown })
      : {};
  const code = typeof e.code === 'string' && /^[a-z][a-z0-9_]{0,79}$/.test(e.code) ? e.code : undefined;
  const message = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  let reason: AuthFailure = 'failed';
  if (code === 'email_address_not_authorized' || message.includes('email address not authorized'))
    reason = 'email_restricted';
  else if (code === 'over_email_send_rate_limit') reason = 'email_rate_limit';
  else if (code === 'over_request_rate_limit' || e.status === 429) reason = 'rate_limit';
  else if (
    code === 'email_address_invalid' ||
    code === 'email_address_not_validated' ||
    code === 'validation_failed'
  )
    reason = stage === 'verify' ? 'invalid_code' : 'invalid_email';
  else if (code === 'email_exists' || code === 'user_already_exists' || code === 'identity_already_exists')
    reason = 'account_exists';
  else if (code === 'user_not_found') reason = 'account_missing';
  else if (code === 'signup_disabled') reason = 'signup_disabled';
  else if (code === 'email_provider_disabled' || code === 'provider_disabled' || code === 'otp_disabled')
    reason = 'provider_disabled';
  else if (code === 'otp_expired' || code === 'flow_state_expired') reason = 'expired_code';
  else if (code === 'bad_code_verifier' || code === 'flow_state_not_found')
    reason = stage === 'callback' ? 'callback_invalid' : 'invalid_code';
  else if (code === 'invalid_credentials')
    reason = stage === 'verify' ? 'invalid_code' : 'invalid_credentials';
  else if (code === 'same_password') reason = 'same_password';
  else if (code === 'session_not_found' || code === 'session_expired' || code === 'reauthentication_needed')
    reason = 'recovery_required';
  else if (code === 'weak_password') reason = 'weak_password';
  else if (code === 'email_not_confirmed') reason = 'email_unconfirmed';
  else if (
    message.includes('error sending') ||
    message.includes('smtp') ||
    message.includes('failed to send email')
  )
    reason = 'email_delivery';
  else if (typeof e.status === 'number' && e.status >= 500) reason = 'service_unavailable';
  else if (
    e.name === 'AuthRetryableFetchError' ||
    e.status === 0 ||
    /fetch failed|failed to fetch|network|econnrefused|enotfound|timeout/.test(message)
  )
    reason = 'network';
  else if (stage === 'callback') reason = 'callback_invalid';
  return { ok: false, reason, ...(code && { code }) };
}

export function callbackFailure(value: unknown): AuthFailure | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  return AUTH_FAILURES.includes(value as AuthFailure) ? (value as AuthFailure) : 'callback_invalid';
}

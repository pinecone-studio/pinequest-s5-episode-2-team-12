// Recovery uses the request's authenticated client, never a service-role password update.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { Email, Password } from './credentials';
import { type AuthResult, authFailure } from './errors';

export const NewPassword = z
  .object({ password: Password, confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'password_mismatch',
  });

export async function sendPasswordReset(
  db: SupabaseClient,
  email: unknown,
  redirectTo: string,
): Promise<AuthResult> {
  const parsed = Email.safeParse(email);
  if (!parsed.success) return { ok: false, reason: 'invalid_email' };
  try {
    const { error } = await db.auth.resetPasswordForEmail(parsed.data, { redirectTo });
    return error ? authFailure(error, 'send') : { ok: true };
  } catch (error) {
    return authFailure(error, 'send');
  }
}

export async function saveNewPassword(db: SupabaseClient, input: unknown): Promise<AuthResult> {
  const parsed = NewPassword.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      reason: parsed.error.issues[0]?.path[0] === 'confirmPassword' ? 'password_mismatch' : 'weak_password',
    };
  try {
    const { data, error: sessionError } = await db.auth.getUser();
    if (sessionError || !data.user || data.user.is_anonymous)
      return { ok: false, reason: 'recovery_required' };
    const { error } = await db.auth.updateUser({ password: parsed.data.password });
    if (error) return authFailure(error, 'password');
    return { ok: true };
  } catch (error) {
    return authFailure(error, 'password');
  }
}

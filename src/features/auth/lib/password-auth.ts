// Called only by Server Actions. Username lookup never exposes an account's email to the browser.
import type { SupabaseClient } from '@supabase/supabase-js';
import { Email, type SignupInput, Username, usernamePattern } from './credentials';
import { type AuthResult, authFailure } from './errors';

export async function registerPassword(
  db: SupabaseClient,
  admin: SupabaseClient,
  input: SignupInput,
  redirectTo: string,
): Promise<AuthResult> {
  try {
    const { data: existing, error: lookupError } = await admin
      .from('profiles')
      .select('id')
      .ilike('username', usernamePattern(input.username))
      .maybeSingle();
    if (lookupError) return { ok: false, reason: 'service_unavailable' };
    if (existing) return { ok: false, reason: 'username_taken' };
    const { data, error } = await db.auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { username: input.username, name: input.username }, emailRedirectTo: redirectTo },
    });
    if (error) return authFailure(error, 'send');
    if (!data.user) return { ok: false, reason: 'failed' };
    // Supabase may hide duplicate accounts with a fake user when email confirmation is enabled.
    if (data.user.identities?.length === 0) return { ok: false, reason: 'account_exists' };
    return { ok: true, confirmationRequired: !data.session };
  } catch (error) {
    return authFailure(error, 'send');
  }
}

export async function loginPassword(
  db: SupabaseClient,
  admin: SupabaseClient | null,
  identifier: string,
  password: string,
): Promise<AuthResult> {
  const value = identifier.trim().normalize('NFC');
  if (!value || value.length > 254 || !password || password.length > 256)
    return { ok: false, reason: 'invalid_credentials' };
  try {
    const email = Email.safeParse(value);
    if (email.success) {
      const { error } = await db.auth.signInWithPassword({ email: email.data, password });
      if (!error) return { ok: true };
      // An email-shaped username is also allowed. Try it only after incorrect email credentials.
      if (error.code !== 'invalid_credentials' && error.code !== 'user_not_found')
        return authFailure(error, 'password');
    }
    const username = Username.safeParse(value);
    if (!username.success) return { ok: false, reason: 'invalid_credentials' };
    if (!admin) return { ok: false, reason: email.success ? 'invalid_credentials' : 'not_configured' };
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id')
      .ilike('username', usernamePattern(username.data))
      .maybeSingle();
    if (profileError) return { ok: false, reason: 'service_unavailable' };
    if (!profile) return { ok: false, reason: 'invalid_credentials' };
    const { data, error: lookupError } = await admin.auth.admin.getUserById(profile.id);
    if (lookupError || !data.user.email) return { ok: false, reason: 'invalid_credentials' };
    const { error } = await db.auth.signInWithPassword({ email: data.user.email, password });
    return error ? authFailure(error, 'password') : { ok: true };
  } catch (error) {
    return authFailure(error, 'password');
  }
}

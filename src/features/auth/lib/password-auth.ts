// Called only by Server Actions. Username lookup never exposes an account's email to the browser.
import type { SupabaseClient } from '@supabase/supabase-js';
import { Email, type SignupInput, Username, usernamePattern } from './credentials';
import { type AuthResult, authFailure } from './errors';

// No confirmation email: the account is created already confirmed, then signed in right away.
export async function registerPassword(
  db: SupabaseClient,
  admin: SupabaseClient,
  input: SignupInput,
): Promise<AuthResult> {
  try {
    const { data: existing, error: lookupError } = await admin
      .from('profiles')
      .select('id')
      .ilike('username', usernamePattern(input.username))
      .maybeSingle();
    if (lookupError) return { ok: false, reason: 'service_unavailable' };
    if (existing) return { ok: false, reason: 'username_taken' };
    const { error } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { username: input.username, name: input.username },
    });
    if (error) return authFailure(error, 'send');
    const { error: loginError } = await db.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    return loginError ? authFailure(loginError, 'password') : { ok: true };
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

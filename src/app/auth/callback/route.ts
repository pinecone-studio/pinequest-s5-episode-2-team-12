// Email links and OAuth land here. Only safe failure categories return to the login screen.
import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { type AuthFailure, authFailure } from '@/features/auth/lib/errors';
import { DEMO_COOKIE, safeNext } from '@/lib/auth-gate';
import { routes } from '@/lib/routes';
import { getDb } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next =
    url.searchParams.get('type') === 'recovery'
      ? routes.updatePassword
      : safeNext(url.searchParams.get('next'));
  const fail = (reason: AuthFailure) => {
    const destination = new URL(
      next === routes.updatePassword ? routes.forgotPassword : '/login',
      url.origin,
    );
    destination.searchParams.set('error', reason);
    destination.searchParams.set('next', next);
    return NextResponse.redirect(destination);
  };
  const providerError = url.searchParams.get('error_code');
  if (url.searchParams.has('error') || providerError) {
    const result = authFailure({ code: providerError }, 'callback');
    return fail(result.reason);
  }
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const types: EmailOtpType[] = ['email', 'signup', 'invite', 'magiclink', 'recovery', 'email_change'];
  const db = await getDb();
  if (!db) return fail('not_configured');
  if (!code && !(tokenHash && types.includes(type as EmailOtpType))) return fail('callback_invalid');
  try {
    const { error } = code
      ? await db.auth.exchangeCodeForSession(code)
      : await db.auth.verifyOtp({ token_hash: tokenHash!, type: type as EmailOtpType });
    if (error) return fail(authFailure(error, 'callback').reason);
    const response = NextResponse.redirect(new URL(next, url.origin));
    response.cookies.delete(DEMO_COOKIE);
    return response;
  } catch (error) {
    return fail(authFailure(error, 'callback').reason);
  }
}

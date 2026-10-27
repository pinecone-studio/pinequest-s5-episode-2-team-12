'use server';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/supabase/server';
import { OnboardingSchema, onboardingRow } from './lib/schema';

export async function completeOnboarding(
  input: unknown,
): Promise<{ ok: true; demo: boolean } | { ok: false; reason: 'invalid' | 'signedOut' | 'failed' }> {
  const parsed = OnboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const session = await getSession();
  if (!session) return { ok: false, reason: 'signedOut' };
  if (session.kind === 'demo') return { ok: true, demo: true };
  const db = await getDb();
  if (!db) return { ok: false, reason: 'failed' };
  // Save completion with the answers in one write; a failed write cannot bypass onboarding.
  const { error } = await db
    .from('profiles')
    .upsert(onboardingRow(session.userId, parsed.data), { onConflict: 'id' });
  if (error) return { ok: false, reason: 'failed' };
  revalidatePath('/', 'layout');
  return { ok: true, demo: false };
}

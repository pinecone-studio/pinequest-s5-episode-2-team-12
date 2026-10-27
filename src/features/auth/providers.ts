import { hasSupabase, publicEnv } from '@/lib/env';

/** Offer Google only when it is actually enabled in the connected project. */
export async function hasGoogleProvider(): Promise<boolean> {
  if (!hasSupabase()) return false;
  const { supabaseUrl, supabaseAnonKey } = publicEnv();
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseAnonKey },
      next: { revalidate: 60 },
    });
    if (!response.ok) return false;
    const settings = await response.json();
    return settings.external?.google === true;
  } catch {
    return false;
  }
}

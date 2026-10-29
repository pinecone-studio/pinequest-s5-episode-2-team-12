// Public (browser-safe) settings. Server-only secrets live in src/server/env.ts.
export function publicEnv() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY || '',
  };
}

/** True when Supabase is configured. Without it every queries.ts returns mocks. */
export function hasSupabase(): boolean {
  const e = publicEnv();
  return Boolean(e.supabaseUrl && e.supabaseAnonKey);
}

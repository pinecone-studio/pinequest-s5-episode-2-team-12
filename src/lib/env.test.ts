import { expect, test } from 'bun:test';
import { hasSupabase, publicEnv } from './env';

test('the existing Supabase public key alias works and the canonical key takes precedence', () => {
  const saved = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_KEY,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_KEY = 'public-test-key';
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(publicEnv().supabaseAnonKey).toBe('public-test-key');
    expect(hasSupabase()).toBe(true);
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'canonical-test-key';
    expect(publicEnv().supabaseAnonKey).toBe('canonical-test-key');
  } finally {
    for (const [name, value] of [
      ['NEXT_PUBLIC_SUPABASE_URL', saved.url],
      ['NEXT_PUBLIC_SUPABASE_KEY', saved.key],
      ['NEXT_PUBLIC_SUPABASE_ANON_KEY', saved.anon],
    ]) {
      if (value === undefined) delete process.env[name!];
      else process.env[name!] = value;
    }
  }
});

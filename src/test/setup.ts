// Preloaded by bunfig.toml for every `bun test`.
import { GlobalRegistrator } from '@happy-dom/global-registrator';

// Bun loads .env.local into tests too. Unit tests must run like CI (mocks, demo mode) and never touch the real
// Supabase project or AI services, so drop those keys; a test that needs one sets it itself.
for (const key of [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_CLOUD_PROJECT',
  'OLLAMA_URL',
  'OLLAMA_TOKEN',
])
  delete process.env[key];

GlobalRegistrator.register({ url: 'http://localhost:3000/' });

const { afterEach, expect } = await import('bun:test');
const matchers = await import('@testing-library/jest-dom/matchers');
const { cleanup } = await import('@testing-library/react');

// jest-dom v5 puts the matchers under `default`, v6 exports them directly — accept both, keep only functions.
const matcherFns = Object.fromEntries(
  Object.entries({ ...((matchers as { default?: object }).default ?? {}), ...matchers }).filter(
    ([, v]) => typeof v === 'function',
  ),
);
expect.extend(matcherFns as unknown as Parameters<typeof expect.extend>[0]);
afterEach(() => cleanup());

// requestAnimationFrame runs synchronously-ish so animated components settle in tests
globalThis.requestAnimationFrame ??= (cb: FrameRequestCallback) =>
  setTimeout(() => cb(performance.now()), 0) as unknown as number;

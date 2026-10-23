// Preloaded by bunfig.toml for every `bun test`.
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({ url: 'http://localhost:3000/' });

const { afterEach, expect } = await import('bun:test');
const matchers = await import('@testing-library/jest-dom/matchers');
const { cleanup } = await import('@testing-library/react');

expect.extend((matchers.default ?? matchers) as unknown as Parameters<typeof expect.extend>[0]);
afterEach(() => cleanup());

// requestAnimationFrame runs synchronously-ish so animated components settle in tests
globalThis.requestAnimationFrame ??= (cb: FrameRequestCallback) =>
  setTimeout(() => cb(performance.now()), 0) as unknown as number;

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function worker() {
  const handlers: Record<string, (event: unknown) => void> = {};
  const saved = new Map<string, Response>();
  const fetched: string[] = [];
  const cache = {
    match: async (key: string | Request) => saved.get(typeof key === 'string' ? key : key.url),
    put: async (key: string | Request, response: Response) => {
      saved.set(typeof key === 'string' ? key : key.url, response);
    },
    addAll: async (urls: string[]) => {
      for (const url of urls) {
        fetched.push(url);
        saved.set(
          url,
          new Response(url.endsWith('.css') ? 'body{src:url(/_next/static/media/font.woff2)}' : 'asset'),
        );
      }
    },
  };
  runInNewContext(readFileSync('public/offline-sw.js', 'utf8'), {
    URL,
    self: {
      location: { origin: 'https://suprep.test' },
      addEventListener: (type: string, cb: (event: unknown) => void) => {
        handlers[type] = cb;
      },
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    caches: { open: async () => cache, keys: async () => ['unrelated'], delete: async () => {} },
    fetch: async (input: string) => {
      if (!input.startsWith('/offline')) throw new Error('offline');
      return new Response('<link href="/_next/static/app.css"><script src="/_next/static/app.js"></script>');
    },
  });
  return { handlers, fetched, saved };
}

describe('offline service worker', () => {
  test('installation saves the shell, scripts, CSS and its fonts', async () => {
    const { handlers, fetched, saved } = worker();
    let done: Promise<void> | undefined;
    handlers.install({
      waitUntil: (promise: Promise<void>) => {
        done = promise;
      },
    });
    await done;
    expect(saved.has('/offline')).toBe(true);
    expect(saved.has('/offline/flashcards')).toBe(true);
    expect(fetched).toContain('https://suprep.test/_next/static/app.js');
    expect(fetched).toContain('https://suprep.test/_next/static/media/font.woff2');
  });
  test('failed navigation falls back to the shell without caching private responses', async () => {
    const { handlers, saved } = worker();
    saved.set('/offline', new Response('offline shell'));
    let response: Promise<Response> | undefined;
    handlers.fetch({
      request: { url: 'https://suprep.test/bank', method: 'GET', mode: 'navigate' },
      respondWith: (value: Promise<Response>) => {
        response = value;
      },
    });
    expect(await (await response)?.text()).toBe('offline shell');
    expect([...saved.keys()]).toEqual(['/offline']);
    saved.set('/offline/flashcards', new Response('words shell'));
    handlers.fetch({
      request: { url: 'https://suprep.test/flashcards?topic=3', method: 'GET', mode: 'navigate' },
      respondWith: (value: Promise<Response>) => {
        response = value;
      },
    });
    expect(await (await response)?.text()).toBe('words shell');
    response = undefined;
    handlers.fetch({
      request: { url: 'https://suprep.test/api/offline/session', method: 'GET', mode: 'cors' },
      respondWith: (value: Promise<Response>) => {
        response = value;
      },
    });
    expect(response).toBeUndefined();
  });
});

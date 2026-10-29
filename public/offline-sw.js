/* Only the public offline shell and immutable assets are cached; never account pages or APIs. */
const CACHE = 'suprep-offline-v2';
// Public shells: question practice and «Шинэ үг» review. Navigation falls back by path.
const SHELLS = ['/offline', '/offline/flashcards'];
const shellFor = (pathname) => (pathname.startsWith('/flashcards') ? '/offline/flashcards' : '/offline');
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const shells = [];
      for (const shell of SHELLS) {
        const response = await fetch(shell, { cache: 'reload' });
        if (!response.ok || response.redirected) throw new Error('Offline shell unavailable');
        shells.push([shell, response]);
      }
      const assets = [];
      for (const [, response] of shells) {
        const html = await response.clone().text();
        for (const match of html.matchAll(/(?:src|href)="([^"\s]*\/_next\/static\/[^"\s]+)"/g))
          assets.push(new URL(match[1].replaceAll('&amp;', '&'), self.location.origin).href);
      }
      await cache.addAll([...new Set(assets)]);
      // Font files referenced by cached CSS must also be present before reporting success.
      for (const asset of new Set(assets.filter((url) => new URL(url).pathname.endsWith('.css')))) {
        const css = await (await cache.match(asset)).text();
        const fonts = [...css.matchAll(/url\(["']?([^\s"')]+)["']?\)/g)]
          .map((match) => new URL(match[1], asset))
          .filter((url) => url.origin === self.location.origin && url.pathname.startsWith('/_next/static/'));
        await cache.addAll([...new Set(fonts.map(String))]);
      }
      for (const [shell, response] of shells) await cache.put(shell, response);
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith('suprep-offline-') && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const saved = await cache.match(event.request);
        if (saved) return saved;
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      })(),
    );
  } else if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(event.request);
        } catch {
          const cache = await caches.open(CACHE);
          return (await cache.match(shellFor(url.pathname))) ?? cache.match('/offline');
        }
      })(),
    );
  }
});

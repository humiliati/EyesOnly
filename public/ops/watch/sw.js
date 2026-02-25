/* EYES ONLY — OPS WATCH Service Worker
   Provides offline caching for the watch app shell.
   Strategy: cache-first for static assets, network-first for API calls.
*/

const CACHE_NAME = 'eyesonly-watch-v1';
const SHELL_URLS = [
  '/ops/watch/',
  '/ops/watch/index.html',
  '/ops/watch/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always go to network for API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request).catch(() => new Response('{"error":"offline"}', { status: 503 })));
    return;
  }

  // Cache-first for shell assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && SHELL_URLS.includes(url.pathname)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('/ops/watch/index.html') || new Response('Offline', { status: 503 }));
    })
  );
});

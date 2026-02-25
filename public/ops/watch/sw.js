/* EYES ONLY — OPS WATCH Service Worker
   Provides offline caching for the watch app shell.
   Strategy: cache-first for static assets, network-first for API calls.
   Phase 2: handles Web Push notifications for M directives.
*/

const CACHE_NAME = 'eyesonly-watch-v2';
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

// ====== WEB PUSH: handle incoming push messages ======
// M sends a directive → Web Push API delivers it here even when the app is closed.

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: '⚡ M DIRECTIVE', body: event.data.text() || '' };
  }

  const title   = payload.title  || '⚡ M DIRECTIVE';
  const body    = payload.body   || 'New directive from M.';
  const tag     = payload.tag    || 'mping';
  const vibrate = payload.vibrate || [100, 50, 100, 50, 200];
  const data    = payload.data   || {};

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      vibrate,
      data,
      icon:  '/ops/watch/icon-192.png',
      badge: '/ops/watch/icon-192.png',
      // requireInteraction: true forces the notification to stay until dismissed
      requireInteraction: tag === 'mping' || tag === 'deadman',
      silent: payload.silent === true,
      actions: tag === 'mping' ? [
        { action: 'ack', title: 'ACK' },
        { action: 'open', title: 'OPEN' },
      ] : [],
    })
  );
});

// Handle notification click → open watch app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data   = event.notification.data || {};

  if (action === 'ack' && data.event_id) {
    // Silent ACK from notification action — open app to a special ACK URL
    const ackUrl = `/ops/watch/?auto_ack=${data.event_id}`;
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        const existing = clients.find((c) => c.url.includes('/ops/watch/'));
        if (existing) {
          existing.focus();
          existing.postMessage({ type: 'auto_ack', event_id: data.event_id });
        } else {
          self.clients.openWindow(ackUrl);
        }
      })
    );
  } else {
    // Default: open / focus watch app
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        const existing = clients.find((c) => c.url.includes('/ops/watch/'));
        if (existing) return existing.focus();
        return self.clients.openWindow('/ops/watch/');
      })
    );
  }
});

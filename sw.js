/* Service worker — keeps the app working offline in the gym, WITHOUT pinning
   people to an old version.

   Strategy: NETWORK-FIRST for our own files. When online you always get the
   latest app (and the cache is refreshed); when offline the cached copy is
   used. Bump CACHE on each release so old caches are cleaned up. */
const CACHE = 'lift-tracker-v28';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/plan.js',
  './js/exercises.js',
  './js/app.js',
  './manifest.webmanifest',
  './icon.svg',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' bypasses the HTTP cache so a fresh copy is stored.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;   // fonts etc.

  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then((hit) =>
          hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});

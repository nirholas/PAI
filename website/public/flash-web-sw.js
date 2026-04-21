/**
 * PAI Browser Installer — Service Worker
 * Caches the flash-web page and assets for offline resilience.
 * Does NOT cache the ISO download itself.
 */

const CACHE_NAME = 'pai-flash-web-v1';
const PRECACHE_URLS = [
  '/flash-web',
  '/sha256-worker.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache ISO downloads or cross-origin requests other than our domain
  if (url.pathname.endsWith('.iso') || url.hostname.includes('github.com')) {
    return;
  }

  // Network-first for same-origin navigation and assets
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});

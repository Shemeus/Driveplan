const CACHE_NAME = 'driveplan-v40b-leskaart-zoom-filter';

const urlsToCache = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/core.js',
  './js/agenda.js',
  './js/learners-sheet.js',
  './js/finance-modules-init.js',
  './js/supabase-sync.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(urlsToCache.map(url => cache.add(url).catch(() => null)))
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const req = event.request;

  // GitHub Pages must prefer the newly deployed files. Cache is only fallback.
  if (req.mode === 'navigate' || new URL(req.url).origin === self.location.origin) {
    event.respondWith(
      fetch(req).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
        return response;
      }).catch(() =>
        caches.match(req, {ignoreSearch:true}).then(cached =>
          cached || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())
        )
      )
    );
  }
});

const CACHE_NAME = 'driveplan-v13-3';

const urlsToCache = [
  '/',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/core.js',
  './js/agenda.js',
  './js/learners-sheet.js',
  './js/finance-modules-init.js',
  './js/supabase-sync.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
});

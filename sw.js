// Simpele service worker die niks geks doet
self.addEventListener('install', (event) => {
  // meteen actief worden
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Laat alle requests gewoon via het netwerk lopen
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

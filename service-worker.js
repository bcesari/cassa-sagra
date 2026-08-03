// Cache solo dell'app-shell (HTML/CSS/JS statici), non offline-first completo:
// le vendite restano responsabilità della coda in queue.js, non di questo worker.
// Aumentare CACHE_NAME ad ogni deploy per invalidare la cache dei client.
const CACHE_NAME = 'cassa-sagra-v6';
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/utils.js',
  './js/state.js',
  './js/api.js',
  './js/queue.js',
  './js/router.js',
  './js/alerts.js',
  './js/view-login.js',
  './js/view-cassa.js',
  './js/view-tesoriere.js',
  './js/view-responsabile.js',
  './js/view-listino.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Solo richieste same-origin (app-shell): le chiamate all'Apps Script Web App
  // sono cross-origin e devono sempre passare dalla rete, mai dalla cache.
  if (url.origin !== location.origin || event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// Cache solo dell'app-shell (HTML/CSS/JS statici), non offline-first completo:
// le vendite restano responsabilità della coda in queue.js, non di questo worker.
// Aumentare CACHE_NAME ad ogni deploy per invalidare la cache dei client.
const CACHE_NAME = 'cassa-sagra-v16';

// Elenco delle icone dei piatti, generato da tools/aggiorna-icone.sh: serve a
// precaricarle all'installazione, così durante la sagra disegnare la griglia non
// richiede nessuna richiesta di rete.
importScripts('./js/icone.js');

const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/icone.js',
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
  './icons/icon-512.png',
  './icons/logo-quartiere.webp',
  './icons/monogramma-ponte.webp',
  // Foto team del Responsabile: a differenza delle icone piatto, questa
  // cartella non ha un generatore automatico dell'elenco — ogni nuova foto
  // va aggiunta qui a mano finché non ne arrivano abbastanza da giustificarne
  // uno (stesso pattern di tools/aggiorna-icone.sh).
  './icons/responsabili/crespelle-1.webp'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL);
      // Le icone a parte e una per una: addAll fallisce in blocco se anche un
      // solo file manca, e un nome sbagliato nell'elenco impedirebbe
      // l'installazione dell'intera app. Se una non c'è si vede l'emoji di
      // riserva e nient'altro si rompe.
      await Promise.all(
        ICONE_PIATTI.map((f) => cache.add(`./icons/piatti/${f}`).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
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

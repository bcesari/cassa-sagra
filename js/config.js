const CONFIG = {
  // Backend attivo: Worker su Cloudflare, che scrive sullo stesso Google Sheet
  // tramite l'API Sheets. Sostituisce il Web App Apps Script, la cui esecuzione
  // anonima era imprevedibile (misurato: da 1,1s a 60,7s anche per una chiamata
  // che non tocca affatto il foglio, contro ~0,3-0,7s qui).
  API_URL: 'https://cassa-sagra-api.thegoonies-arpino.workers.dev',

  // VIA DI FUGA — se il Worker desse problemi, anche durante la sagra:
  // copiare questo indirizzo in API_URL qui sopra, incrementare CACHE_NAME in
  // service-worker.js e ripubblicare (due minuti, vedi SETUP.md). Il deployment
  // Apps Script @10 resta pubblicato e funzionante apposta. I due backend
  // scrivono sullo stesso foglio, quindi si torna indietro senza perdere nulla.
  API_URL_RISERVA_APPS_SCRIPT: 'https://script.google.com/macros/s/AKfycbyNxIFArOpxg5V8wOMoC0BB9KA6_2W8JKS9AJ1ItflRYINR6J0J5CQyt63GXcfxpN2OQw/exec',

  POLL_INTERVAL_MS: 10000,
  RETRY_INTERVAL_MS: 4000,
  RESPONSABILE_FINESTRA_MIN: 10
};

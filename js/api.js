function attesa_(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Timeout per tentativo, con retry: una richiesta lenta viene abbandonata e
// rifatta invece di aspettarla fino in fondo. I retry restano sicuri perché
// ogni vendita porta il proprio vendita_id e il server deduplica.
//
// Valori tarati sul backend attuale (Worker + API Sheets): letture ~0,3s,
// scritture ~0,65s, code lunghe misurate entro i 2s. Sono quindi ampiamente
// sopra il caso normale e servono solo a reagire a un vero blocco.
//
// Nota storica: con Apps Script la scrittura aveva 15s di timeout perché
// passava da LockService e poteva legittimamente stare in coda ad aspettare il
// proprio turno; abbandonare troppo presto peggiorava la contesa. Il Worker non
// ha alcun lock (l'append dell'API Sheets è atomico lato Google), quindi
// un'attesa lunga non è più "il proprio turno che arriva" ma un problema vero:
// meglio accorgersene prima.
const TIMEOUT_LETTURA_MS = 4000;
const TIMEOUT_SCRITTURA_MS = 8000;

async function fetchJson_(url, options, tentativi, timeoutMs) {
  tentativi = tentativi || 5;
  timeoutMs = timeoutMs || TIMEOUT_LETTURA_MS;
  let ultimoErrore;
  for (let i = 0; i < tentativi; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, Object.assign({}, options, { signal: controller.signal }));
      const testo = await res.text();
      try {
        return JSON.parse(testo);
      } catch (e) {
        throw new Error('Risposta non valida dal server');
      }
    } catch (err) {
      ultimoErrore = err;
      if (i < tentativi - 1) await attesa_(300);
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw ultimoErrore;
}

const Api = {
  _get(action, params) {
    const ruolo = State.getRuolo();
    const qs = new URLSearchParams(Object.assign(
      { action, ruolo: ruolo ? ruolo.ruolo_id : '', pin: ruolo ? ruolo.pin : '' },
      params || {}
    ));
    return fetchJson_(`${CONFIG.API_URL}?${qs.toString()}`);
  },

  _post(action, payload) {
    const ruolo = State.getRuolo();
    const body = Object.assign(
      { action, ruolo_id: ruolo ? ruolo.ruolo_id : '', pin: ruolo ? ruolo.pin : '' },
      payload || {}
    );
    // Content-Type text/plain evita il preflight CORS (Apps Script non gestisce
    // doOptions); il body resta comunque JSON, letto lato server con JSON.parse.
    return fetchJson_(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }, 3, TIMEOUT_SCRITTURA_MS);
  },

  login(ruoloId, pin) {
    const qs = new URLSearchParams({ action: 'login', ruolo: ruoloId, pin });
    return fetchJson_(`${CONFIG.API_URL}?${qs.toString()}`);
  },
  // Login + edizione corrente + listino in un'unica chiamata invece di tre in
  // sequenza: con la latenza variabile di Apps Script, ogni round-trip in più
  // si somma ai precedenti e il login percepito diventa molto più lento.
  bootstrap(ruoloId, pin) {
    const qs = new URLSearchParams({ action: 'bootstrap', ruolo: ruoloId, pin });
    return fetchJson_(`${CONFIG.API_URL}?${qs.toString()}`);
  },
  edizioneCorrente() { return this._get('edizioneCorrente'); },
  listino(edizioneId) { return this._get('listino', { edizione: edizioneId }); },
  tesoriere(edizioneId) { return this._get('tesoriere', { edizione: edizioneId }); },
  responsabile(edizioneId) { return this._get('responsabile', { edizione: edizioneId }); },
  alert(destinatario, edizioneId) { return this._get('alert', { destinatario, edizione: edizioneId }); },

  registraVendita(vendita) { return this._post('registraVendita', vendita); },
  inviaAlert(alert) { return this._post('inviaAlert', alert); },
  segnaAlertLetto(alertId) { return this._post('segnaAlertLetto', { alert_id: alertId }); },
  salvaListino(payload) { return this._post('salvaListino', payload); }
};

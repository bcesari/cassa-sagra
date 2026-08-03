function attesa_(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// L'esecuzione anonima (ANYONE_ANONYMOUS) di un Web App Apps Script è nota
// per essere occasionalmente lenta/instabile (richieste che impiegano 10-15s
// e falliscono, contro l'1-2s normale) — un limite della piattaforma, non
// del nostro codice. Aspettare fino in fondo un tentativo lento prima di
// ritentare fa sommare i ritardi (con più chiamate in sequenza diventa
// "un'eternità"): ogni tentativo viene quindi interrotto dopo TIMEOUT_MS e
// si passa subito al successivo, che nella maggioranza dei casi è veloce.
const FETCH_TIMEOUT_MS = 4000;

async function fetchJson_(url, options, tentativi) {
  tentativi = tentativi || 5;
  let ultimoErrore;
  for (let i = 0; i < tentativi; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
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
    });
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

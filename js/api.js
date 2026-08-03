function attesa_(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// L'esecuzione anonima (ANYONE_ANONYMOUS) di un Web App Apps Script è nota
// per essere occasionalmente lenta/instabile (richieste che impiegano 10-15s
// e falliscono, contro l'1-2s normale) — un limite della piattaforma, non
// del nostro codice. Si mitiga ritentando subito la singola chiamata un paio
// di volte prima di lasciarla fallire: molto più veloce che aspettare l'intero
// ciclo della coda offline (8s) per un semplice inciampo di rete Google.
async function fetchJson_(url, options, tentativi) {
  tentativi = tentativi || 3;
  let ultimoErrore;
  for (let i = 0; i < tentativi; i++) {
    try {
      const res = await fetch(url, options);
      const testo = await res.text();
      try {
        return JSON.parse(testo);
      } catch (e) {
        throw new Error('Risposta non valida dal server');
      }
    } catch (err) {
      ultimoErrore = err;
      if (i < tentativi - 1) await attesa_(600 * (i + 1));
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

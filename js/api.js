const Api = {
  async _get(action, params) {
    const ruolo = State.getRuolo();
    const qs = new URLSearchParams(Object.assign(
      { action, ruolo: ruolo ? ruolo.ruolo_id : '', pin: ruolo ? ruolo.pin : '' },
      params || {}
    ));
    const res = await fetch(`${CONFIG.API_URL}?${qs.toString()}`);
    return res.json();
  },

  async _post(action, payload) {
    const ruolo = State.getRuolo();
    const body = Object.assign(
      { action, ruolo_id: ruolo ? ruolo.ruolo_id : '', pin: ruolo ? ruolo.pin : '' },
      payload || {}
    );
    // Content-Type text/plain evita il preflight CORS (Apps Script non gestisce
    // doOptions); il body resta comunque JSON, letto lato server con JSON.parse.
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    return res.json();
  },

  login(ruoloId, pin) {
    const qs = new URLSearchParams({ action: 'login', ruolo: ruoloId, pin });
    return fetch(`${CONFIG.API_URL}?${qs.toString()}`).then((r) => r.json());
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

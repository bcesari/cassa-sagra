Router.register('/responsabile', renderResponsabile);

function renderResponsabile(container) {
  const ruolo = Router.requireRuolo(['responsabile']);
  if (!ruolo) return;

  const edizione = State.getEdizione();

  const radice = el('div', { class: 'vista-responsabile' });
  container.appendChild(radice);

  radice.appendChild(el('div', { class: 'intestazione' }, [
    el('h1', {}, [`🍽️ ${ruolo.nome_piatto || ruolo.piatto_id}`]),
    el('button', { class: 'bottone-link', onclick: () => Router.navigate('/login') }, ['Cambia utente'])
  ]));

  const totaleEl = el('div', { class: 'totale-generale' }, ['Caricamento…']);
  const ultimiEl = el('div', { class: 'sezione' });
  radice.appendChild(totaleEl);
  radice.appendChild(ultimiEl);

  async function aggiorna() {
    const dati = await Api.responsabile(edizione.edizione_id);
    if (!dati || dati.error) return;
    totaleEl.textContent = `Totale venduto in serata: ${dati.totale_venduto} unità`;
    ultimiEl.innerHTML = '';
    ultimiEl.appendChild(el('h2', {}, [`Ultimi ${CONFIG.RESPONSABILE_FINESTRA_MIN} minuti`]));
    ultimiEl.appendChild(el('div', { class: 'riga-dato-grande' }, [`${dati.ultimi_10_min} unità`]));
  }

  const segnalazione = el('div', { class: 'segnalazione-broadcast' }, [
    el('h2', {}, ['Avviso a tutte le casse'])
  ]);
  Alerts.renderInvioForm(segnalazione, ruolo.ruolo_id, 'tutte_le_casse', `es. "${ruolo.nome_piatto || 'Piatto'} terminate, non vendere più"`);
  radice.appendChild(segnalazione);

  aggiorna();
  Router.setPoll(setInterval(aggiorna, CONFIG.POLL_INTERVAL_MS));
}

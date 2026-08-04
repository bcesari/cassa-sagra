Router.register('/responsabile', renderResponsabile);

function renderResponsabile(container) {
  const ruolo = Router.requireRuolo(['responsabile']);
  if (!ruolo) return;

  const edizione = State.getEdizione();

  // Con un gruppo (es. "sagne" per bianche e rosse) il responsabile presidia
  // più piatti: intestazione e avvisi parlano del gruppo, non del singolo
  // piatto usato per il login.
  const etichetta = ruolo.gruppo
    ? ruolo.gruppo.charAt(0).toUpperCase() + ruolo.gruppo.slice(1)
    : (ruolo.nome_piatto || ruolo.piatto_id);

  const radice = el('div', { class: 'vista-responsabile' });
  container.appendChild(radice);

  radice.appendChild(el('div', { class: 'intestazione' }, [
    el('h1', {}, [`🍽️ ${etichetta}`]),
    el('button', { class: 'bottone-link', onclick: () => Router.navigate('/login') }, ['Cambia utente'])
  ]));

  const totaleEl = el('div', { class: 'totale-generale' }, ['Caricamento…']);
  const ultimiEl = el('div', { class: 'sezione' });
  radice.appendChild(totaleEl);
  radice.appendChild(ultimiEl);

  function disegnaDati(dati) {
    const perPiatto = dati.per_piatto || [];
    const dettagliato = perPiatto.length > 1;

    totaleEl.textContent = dettagliato
      ? `Totale ${etichetta} in serata: ${dati.totale_venduto} unità`
      : `Totale venduto in serata: ${dati.totale_venduto} unità`;

    ultimiEl.innerHTML = '';
    ultimiEl.appendChild(el('h2', {}, [`Ultimi ${CONFIG.RESPONSABILE_FINESTRA_MIN} minuti`]));
    ultimiEl.appendChild(el('div', { class: 'riga-dato-grande' }, [`${dati.ultimi_10_min} unità`]));

    // Un piatto solo: il dettaglio ripeterebbe il totale già mostrato sopra.
    if (!dettagliato) return;

    ultimiEl.appendChild(el('div', { class: 'nota' }, ['Totale del gruppo. Dettaglio per piatto:']));
    perPiatto.forEach((p) => {
      ultimiEl.appendChild(el('div', { class: 'riga-piatto-responsabile' }, [
        el('span', { class: 'riga-piatto-nome' }, [
          nodoIcona(p.icona, 'icona-riga'),
          ` ${p.nome_piatto}`
        ]),
        el('span', { class: 'riga-piatto-ultimi' }, [`${p.ultimi_10_min} negli ultimi ${CONFIG.RESPONSABILE_FINESTRA_MIN}'`]),
        el('span', { class: 'riga-piatto-totale' }, [`${p.totale_venduto} tot.`])
      ]));
    });
  }

  async function aggiorna() {
    const dati = await Api.responsabile(edizione.edizione_id);
    if (!dati || dati.error) return;
    disegnaDati(dati);
  }

  const segnalazione = el('div', { class: 'segnalazione-broadcast' }, [
    el('h2', {}, ['Avviso a tutte le casse'])
  ]);
  Alerts.renderInvioForm(segnalazione, ruolo.ruolo_id, 'tutte_le_casse', `es. "${etichetta} terminate, non vendere più"`);
  radice.appendChild(segnalazione);

  aggiorna();
  Router.setPoll(setInterval(aggiorna, CONFIG.POLL_INTERVAL_MS));
}

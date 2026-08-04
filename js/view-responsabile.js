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
    el('h1', {}, [
      el('img', { src: 'icons/monogramma-ponte.webp', alt: '', class: 'icona-testata' }),
      ` Team ${etichetta}`
    ]),
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

  // Foto del team, opzionali: da 1 a 3 file per gruppo/piatto, nominati
  // <slug>-1.webp, <slug>-2.webp, <slug>-3.webp in icons/responsabili/. Non
  // richiede nulla nel foglio Google: se i file non ci sono (caso di oggi,
  // nessuna foto ancora caricata) la sezione semplicemente non compare, senza
  // spazio vuoto né errori — stesso spirito del fallback delle icone piatto.
  const chiaveTeam = slugTeam(ruolo.gruppo || ruolo.piatto_id);
  Promise.all([1, 2, 3].map((n) => provaImmagine(`icons/responsabili/${chiaveTeam}-${n}.webp`)))
    .then((trovate) => {
      const foto = trovate.filter(Boolean);
      if (foto.length === 0) return;
      const galleria = el('div', { class: 'sezione galleria-team' });
      foto.forEach((img) => {
        img.className = 'foto-responsabile';
        img.alt = '';
        galleria.appendChild(img);
      });
      radice.appendChild(galleria);
    });

  aggiorna();
  Router.setPoll(setInterval(aggiorna, CONFIG.POLL_INTERVAL_MS));
}

function slugTeam(testo) {
  return String(testo || '')
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // toglie accenti
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function provaImmagine(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

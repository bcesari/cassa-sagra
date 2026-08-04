Router.register('/tesoriere', renderTesoriere);

function renderTesoriere(container) {
  const ruolo = Router.requireRuolo(['tesoriere']);
  if (!ruolo) return;

  const edizione = State.getEdizione();

  const radice = el('div', { class: 'vista-tesoriere' });
  container.appendChild(radice);

  Alerts.renderBanner(radice, 'tesoriere', edizione.edizione_id);

  radice.appendChild(el('div', { class: 'intestazione' }, [
    el('h1', {}, ['📊 Tesoriere']),
    el('button', { class: 'bottone-link', onclick: () => Router.navigate('/login') }, ['Cambia utente'])
  ]));

  const corpo = el('div', { class: 'tesoriere-corpo' }, ['Caricamento…']);
  radice.appendChild(corpo);

  async function aggiorna() {
    const dati = await Api.tesoriere(edizione.edizione_id);
    if (!dati || dati.error) {
      corpo.innerHTML = '';
      corpo.appendChild(el('div', { class: 'errore' }, [dati && dati.error ? dati.error : 'Errore nel caricamento dati']));
      return;
    }
    corpo.innerHTML = '';

    corpo.appendChild(el('div', { class: 'totale-generale' }, [`Totale serata: ${formatEuro(dati.totale_generale)}`]));

    const perCassa = el('div', { class: 'sezione' }, [el('h2', {}, ['Per cassa'])]);
    dati.per_cassa
      .sort((a, b) => a.cassa.localeCompare(b.cassa))
      .forEach((c) => {
        perCassa.appendChild(el('div', { class: 'riga-dato' }, [
          el('span', {}, [c.cassa]),
          el('span', { class: 'riga-dato-valore' }, [`${formatEuro(c.totale)} — ${c.n_ordini} clienti`])
        ]));
      });
    corpo.appendChild(perCassa);

    const perPiatto = el('div', { class: 'sezione' }, [el('h2', {}, ['Per piatto (tutte le casse)'])]);
    dati.per_piatto
      .sort((a, b) => b.quantita - a.quantita)
      .forEach((p) => {
        perPiatto.appendChild(el('div', { class: 'riga-dato' }, [
          el('span', {}, [p.nome_piatto]),
          el('span', { class: 'riga-dato-valore' }, [`${p.quantita} unità`])
        ]));
      });
    corpo.appendChild(perPiatto);

    const picco = el('div', { class: 'sezione' }, [el('h2', {}, ['Picco vendite (30 min)'])]);
    if (dati.picco && dati.picco.importo > 0) {
      picco.appendChild(el('div', { class: 'riga-dato' }, [
        el('span', {}, [`${formatOra(dati.picco.inizio_iso)} – ${formatOra(dati.picco.fine_iso)}`]),
        el('span', { class: 'riga-dato-valore' }, [formatEuro(dati.picco.importo)])
      ]));
    } else {
      picco.appendChild(el('div', { class: 'riepilogo-vuoto' }, ['Nessuna vendita registrata']));
    }
    corpo.appendChild(picco);

    const presenze = el('div', { class: 'sezione' }, [
      el('h2', {}, ['Presenze stimate']),
      el('div', { class: 'riga-dato' }, [
        el('span', { class: 'riga-dato-valore' }, [`≈ ${dati.presenze_stimate} persone`]),
        el('span', {}, [`(coeff. ${dati.coefficiente} pers./ordine)`])
      ]),
      el('div', { class: 'nota' }, [
        'Stima basata su ordini registrati × coefficiente configurato in Gestione Listino. ' +
        'Non copre chi acquista solo bevande (altra associazione, dati non condivisi).'
      ])
    ]);
    corpo.appendChild(presenze);
  }

  aggiorna();
  Router.setPoll(setInterval(aggiorna, CONFIG.POLL_INTERVAL_MS));
}

Router.register('/tesoriere', renderTesoriere);

function renderTesoriere(container) {
  const ruolo = Router.requireRuolo(['tesoriere']);
  if (!ruolo) return;

  const edizione = State.getEdizione();

  const radice = el('div', { class: 'vista-tesoriere' });
  container.appendChild(radice);

  Alerts.renderBanner(radice, 'tesoriere', edizione.edizione_id);

  radice.appendChild(el('div', { class: 'intestazione' }, [
    el('h1', {}, [
      el('img', { src: 'icons/monogramma-ponte.webp', alt: '', class: 'icona-testata' }),
      ' Amministratore'
    ]),
    el('button', { class: 'bottone-link', onclick: () => Router.navigate('/login') }, ['Cambia utente'])
  ]));

  renderNotifichePush(radice, edizione.edizione_id);

  const corpo = el('div', { class: 'tesoriere-corpo' }, ['Caricamento…']);
  radice.appendChild(corpo);

  // Contenitore separato dal ciclo di poll di aggiorna(): contiene form che
  // l'utente sta compilando (fondo cassa, contante contato, ticket), un
  // rebuild ogni 10s ne cancellerebbe l'input. Si ridisegna solo dopo un
  // salvataggio esplicito, dentro chiusura-cassa.js.
  const contenitoreCasse = el('div', { class: 'chiusura-casse-corpo' }, []);
  radice.appendChild(contenitoreCasse);
  ChiusuraCasse.render(contenitoreCasse, edizione.edizione_id);

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
          el('span', {}, [c.nome_visualizzato || c.cassa]),
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

// Notifiche push per le segnalazioni cassa->tesoriere (push.js): utile
// soprattutto per l'Amministratore, che gira con lo schermo spento/app in
// background — le casse tengono il telefono acceso e vedono già il banner
// in-app. Renderizzato una sola volta, non dentro aggiorna(): non dipende
// dai dati che cambiano ogni 10s.
function renderNotifichePush(radice, edizioneId) {
  const box = el('div', { class: 'notifiche-push' }, []);
  radice.appendChild(box);

  async function disegna() {
    box.innerHTML = '';
    const s = await Push.stato();

    if (s === 'non-supportato') {
      box.appendChild(el('div', { class: 'nota' }, ['Notifiche non supportate su questo browser.']));
      return;
    }
    if (s === 'negato') {
      box.appendChild(el('div', { class: 'nota' }, ['🔕 Notifiche bloccate: riattivale dalle impostazioni del browser/telefono.']));
      return;
    }
    if (s === 'attivo') {
      box.appendChild(el('div', { class: 'nota' }, ['🔔 Notifiche attive su questo dispositivo.']));
      return;
    }

    const errore = el('div', { class: 'errore nascosto' }, []);
    const bottone = el('button', { type: 'button', class: 'bottone-secondario' }, ['🔔 Attiva notifiche']);
    bottone.addEventListener('click', async () => {
      errore.classList.add('nascosto');
      bottone.disabled = true;
      try {
        await Push.iscrivi(edizioneId);
        await disegna();
      } catch (e) {
        errore.textContent = 'Notifiche NON attivate: ' + e.message;
        errore.classList.remove('nascosto');
        bottone.disabled = false;
      }
    });
    box.appendChild(bottone);
    box.appendChild(errore);
  }

  disegna();
}

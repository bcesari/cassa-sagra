// Apertura/chiusura cassa e generazione del report di fine serata, per la
// schermata Tesoriere. Vive in un container separato da quello che
// view-tesoriere.js ricostruisce ogni 10s (Api.tesoriere): qui ci sono campi
// che l'utente sta compilando, un rebuild automatico a metà digitazione
// cancellerebbe l'input. Il ridisegno avviene solo dopo un salvataggio,
// azione esplicita dell'utente.
const ChiusuraCasse = (function () {
  async function render(container, edizioneId) {
    container.innerHTML = 'Caricamento casse…';
    let stato;
    try {
      stato = await Api.statoCasse(edizioneId);
    } catch (e) {
      container.innerHTML = '';
      container.appendChild(el('div', { class: 'errore' }, ['Errore nel caricamento casse: ' + e.message]));
      return;
    }
    if (!stato || stato.error) {
      container.innerHTML = '';
      container.appendChild(el('div', { class: 'errore' }, [stato && stato.error ? stato.error : 'Errore nel caricamento casse']));
      return;
    }

    // Riscontro contabile + ticket per cassa (per mostrarli subito sotto ogni
    // cassa già chiusa, non solo dentro il PDF finale): riusa la stessa
    // aggregazione già calcolata per il report, una sola chiamata condivisa
    // da tutte le casse, non una per cassa. Richiesta solo se serve (almeno
    // una cassa chiusa), è di sola lettura quindi sicura da richiamare ad
    // ogni render.
    let report = null;
    if (stato.casse.some((c) => c.chiusa)) {
      try {
        const r = await Api.reportServata(edizioneId);
        if (!r.error) report = r;
      } catch (e) {
        report = null;
      }
    }

    const ricarica = () => render(container, edizioneId);
    container.innerHTML = '';
    container.appendChild(sezioneApertura(stato, edizioneId, ricarica));
    container.appendChild(sezioneChiusura(stato, report, edizioneId, ricarica));
    container.appendChild(sezioneReport(edizioneId));
  }

  function sezioneApertura(stato, edizioneId, ricarica) {
    const errore = el('div', { class: 'errore' }, []);
    const sezione = el('div', { class: 'sezione' }, [el('h2', {}, ['Apertura casse']), errore]);
    const piatti = stato.piatti.slice().sort((a, b) => a.ordine_visualizzazione - b.ordine_visualizzazione);

    stato.casse.forEach((c) => {
      const input = el('input', {
        type: 'number', step: '0.5', min: '0',
        placeholder: 'Fondo iniziale (€)',
        value: c.fondo_iniziale !== null ? c.fondo_iniziale : ''
      });

      const inputTicketPerPiatto = {};
      const grigliaTicket = el('div', { class: 'griglia-ticket' }, piatti.map((p) => {
        const inp = el('input', {
          type: 'number', step: '1', min: '0',
          value: c.ticket_consegnati[p.piatto_id] !== undefined ? c.ticket_consegnati[p.piatto_id] : ''
        });
        inputTicketPerPiatto[p.piatto_id] = inp;
        return el('label', { class: 'campo-ticket' }, [p.nome_piatto, inp]);
      }));

      const bottone = el('button', { type: 'button', class: 'bottone-secondario' }, [c.aperta ? 'Aggiorna' : 'Apri']);

      bottone.addEventListener('click', async () => {
        const v = Number(input.value);
        if (input.value === '' || isNaN(v) || v < 0) {
          errore.textContent = 'Inserisci un fondo iniziale valido per ' + c.nome_visualizzato;
          return;
        }
        errore.textContent = '';
        bottone.disabled = true;
        const ticketConsegnati = piatti.map((p) => ({
          piatto_id: p.piatto_id,
          ticket_consegnati: inputTicketPerPiatto[p.piatto_id].value === '' ? 0 : Number(inputTicketPerPiatto[p.piatto_id].value)
        }));
        try {
          await Api.apriCassa({ edizione_id: edizioneId, cassa: c.cassa, fondo_iniziale: v, ticket_consegnati: ticketConsegnati });
          await ricarica();
        } catch (e) {
          errore.textContent = 'Apertura NON salvata: ' + e.message;
          bottone.disabled = false;
        }
      });

      sezione.appendChild(el('div', { class: 'blocco-apertura-cassa' }, [
        el('div', { class: 'riga-cassa' }, [
          el('strong', {}, [c.nome_visualizzato]),
          el('span', { class: 'nota' }, [c.aperta ? `Aperta alle ${formatOra(c.orario_apertura)}` : 'Non ancora aperta']),
          input,
          bottone
        ]),
        el('div', { class: 'nota' }, ['Ticket consegnati per piatto:']),
        grigliaTicket
      ]));
    });

    return sezione;
  }

  // "in pareggio" (blu) / "scarto ±€" (rosso): stesso criterio e stessa
  // scelta cromatica del PDF (report.js, skill dataviz — mai il colore da
  // solo, qui affiancato dal testo che già lo spiega).
  function badgeDifferenza(differenza) {
    if (differenza === null) return el('span', { class: 'nota' }, ['cassa non chiusa']);
    if (Math.abs(differenza) < 0.01) {
      return el('span', { class: 'badge-pareggio' }, ['✓ in pareggio']);
    }
    const segno = differenza > 0 ? '+' : '';
    return el('span', { class: 'badge-scarto' }, [`✕ scarto ${segno}${formatEuro(differenza)}`]);
  }

  function badgeDifferenzaTicket(differenza) {
    if (differenza === 0) return el('span', { class: 'badge-pareggio' }, ['✓ combacia']);
    const segno = differenza > 0 ? '+' : '';
    return el('span', { class: 'badge-scarto' }, [`✕ ${segno}${differenza}`]);
  }

  function riepilogoChiusuraCassa(c, report) {
    const box = el('div', { class: 'riepilogo-chiusura' }, []);
    const datiCassa = report && report.casse ? report.casse.find((rc) => rc.cassa === c.cassa) : null;
    if (!datiCassa) {
      box.appendChild(el('div', { class: 'nota' }, ['Riscontro non disponibile, riprova più tardi.']));
      return box;
    }

    box.appendChild(el('div', { class: 'riga-dato' }, [
      el('span', {}, ['Atteso (fondo + vendite app)']),
      el('span', { class: 'riga-dato-valore' }, [formatEuro(datiCassa.incasso_atteso)])
    ]));
    box.appendChild(el('div', { class: 'riga-dato' }, [
      el('span', {}, ['Contanti effettivi']),
      el('span', { class: 'riga-dato-valore' }, [formatEuro(datiCassa.contante_contato)])
    ]));
    box.appendChild(el('div', { class: 'riga-dato' }, [
      el('span', {}, ['Riscontro contabile']),
      badgeDifferenza(datiCassa.differenza)
    ]));
    box.appendChild(el('div', { class: 'riga-dato' }, [
      el('span', {}, ['Persone servite']),
      el('span', { class: 'riga-dato-valore' }, [String(datiCassa.persone_servite)])
    ]));

    const righeTicket = report.riscontro_ticket.filter((r) => r.cassa === c.cassa);
    if (righeTicket.length > 0) {
      const tabella = el('div', { class: 'lista-ticket-riepilogo' }, righeTicket.map((r) => el('div', { class: 'riga-ticket-riepilogo' }, [
        el('div', { class: 'riga-dato' }, [
          el('span', {}, [r.nome_piatto]),
          badgeDifferenzaTicket(r.differenza)
        ]),
        el('div', { class: 'nota' }, [`Consegnati ${r.ticket_consegnati} · Contati ${r.ticket_contati} · Vendite app ${r.quantita_app}`])
      ])));
      box.appendChild(el('div', { class: 'nota' }, ['Riscontro ticket per piatto (contati vs vendite app):']));
      box.appendChild(tabella);

      const bottonePdf = el('button', { type: 'button', class: 'bottone-secondario' }, ['Genera PDF cassa']);
      bottonePdf.addEventListener('click', () => {
        Report.generaPdfCassa(c.nome_visualizzato, datiCassa, righeTicket);
      });
      box.appendChild(bottonePdf);
    }

    return box;
  }

  function sezioneChiusura(stato, report, edizioneId, ricarica) {
    const errore = el('div', { class: 'errore' }, []);
    const sezione = el('div', { class: 'sezione' }, [el('h2', {}, ['Chiusura casse']), errore]);
    const piatti = stato.piatti.slice().sort((a, b) => a.ordine_visualizzazione - b.ordine_visualizzazione);

    stato.casse.forEach((c) => {
      if (!c.aperta) {
        sezione.appendChild(el('div', { class: 'blocco-chiusura-cassa' }, [
          el('strong', {}, [c.nome_visualizzato]),
          el('div', { class: 'nota' }, ['Apri prima la cassa per poterla chiudere.'])
        ]));
        return;
      }

      const inputContante = el('input', {
        type: 'number', step: '0.5', min: '0',
        placeholder: 'Contante contato (€)',
        value: c.contante_contato !== null ? c.contante_contato : ''
      });

      const inputTicketPerPiatto = {};
      const grigliaTicket = el('div', { class: 'griglia-ticket' }, piatti.map((p) => {
        const input = el('input', {
          type: 'number', step: '1', min: '0',
          value: c.ticket[p.piatto_id] !== undefined ? c.ticket[p.piatto_id] : ''
        });
        inputTicketPerPiatto[p.piatto_id] = input;
        return el('label', { class: 'campo-ticket' }, [p.nome_piatto, input]);
      }));

      const bottone = el('button', { type: 'button', class: 'bottone-secondario' }, [c.chiusa ? 'Aggiorna chiusura' : 'Chiudi cassa']);

      bottone.addEventListener('click', async () => {
        const contante = Number(inputContante.value);
        if (inputContante.value === '' || isNaN(contante) || contante < 0) {
          errore.textContent = 'Inserisci il contante contato per ' + c.nome_visualizzato;
          return;
        }
        errore.textContent = '';
        bottone.disabled = true;
        const ticket = piatti.map((p) => ({
          piatto_id: p.piatto_id,
          ticket_contati: inputTicketPerPiatto[p.piatto_id].value === '' ? 0 : Number(inputTicketPerPiatto[p.piatto_id].value)
        }));
        try {
          await Api.chiudiCassa({ edizione_id: edizioneId, cassa: c.cassa, contante_contato: contante, ticket });
          await ricarica();
        } catch (e) {
          errore.textContent = 'Chiusura NON salvata: ' + e.message;
          bottone.disabled = false;
        }
      });

      sezione.appendChild(el('div', { class: 'blocco-chiusura-cassa' }, [
        el('div', { class: 'riga-cassa' }, [
          el('strong', {}, [c.nome_visualizzato]),
          el('span', { class: 'nota' }, [c.chiusa ? `Chiusa alle ${formatOra(c.orario_chiusura)}` : 'Non ancora chiusa']),
          inputContante
        ]),
        el('div', { class: 'nota' }, ['Ticket contati per piatto (dalla matrice del blocchetto):']),
        grigliaTicket,
        bottone,
        ...(c.chiusa && report ? [riepilogoChiusuraCassa(c, report)] : [])
      ]));
    });

    return sezione;
  }

  function sezioneReport(edizioneId) {
    const errore = el('div', { class: 'errore' }, []);
    const bottone = el('button', { type: 'button', class: 'bottone-primario' }, ['Genera report di fine serata']);

    bottone.addEventListener('click', async () => {
      const conferma = await confermaAzione('Sicuro di voler creare il report di fine serata?');
      if (!conferma) return;

      errore.textContent = '';
      bottone.disabled = true;
      bottone.textContent = 'Generazione in corso…';
      try {
        const dati = await Api.reportServata(edizioneId);
        if (dati.error) throw new Error(dati.error);
        await Report.generaPdf(dati, State.getEdizione());
      } catch (e) {
        errore.textContent = 'Report NON generato: ' + e.message;
      } finally {
        bottone.disabled = false;
        bottone.textContent = 'Genera report di fine serata';
      }
    });

    return el('div', { class: 'sezione' }, [el('h2', {}, ['Report']), errore, bottone]);
  }

  return { render };
})();

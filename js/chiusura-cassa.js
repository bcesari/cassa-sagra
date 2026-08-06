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

    const ricarica = () => render(container, edizioneId);
    container.innerHTML = '';
    container.appendChild(sezioneApertura(stato, edizioneId, ricarica));
    container.appendChild(sezioneChiusura(stato, edizioneId, ricarica));
    container.appendChild(sezioneReport(edizioneId));
  }

  function sezioneApertura(stato, edizioneId, ricarica) {
    const errore = el('div', { class: 'errore' }, []);
    const sezione = el('div', { class: 'sezione' }, [el('h2', {}, ['Apertura casse']), errore]);

    stato.casse.forEach((c) => {
      const input = el('input', {
        type: 'number', step: '0.5', min: '0',
        placeholder: 'Fondo iniziale (€)',
        value: c.fondo_iniziale !== null ? c.fondo_iniziale : ''
      });
      const bottone = el('button', { type: 'button', class: 'bottone-secondario' }, [c.aperta ? 'Aggiorna' : 'Apri']);

      bottone.addEventListener('click', async () => {
        const v = Number(input.value);
        if (input.value === '' || isNaN(v) || v < 0) {
          errore.textContent = 'Inserisci un fondo iniziale valido per ' + c.nome_visualizzato;
          return;
        }
        errore.textContent = '';
        bottone.disabled = true;
        try {
          await Api.apriCassa({ edizione_id: edizioneId, cassa: c.cassa, fondo_iniziale: v });
          await ricarica();
        } catch (e) {
          errore.textContent = 'Apertura NON salvata: ' + e.message;
          bottone.disabled = false;
        }
      });

      sezione.appendChild(el('div', { class: 'riga-cassa' }, [
        el('strong', {}, [c.nome_visualizzato]),
        el('span', { class: 'nota' }, [c.aperta ? `Aperta alle ${formatOra(c.orario_apertura)}` : 'Non ancora aperta']),
        input,
        bottone
      ]));
    });

    return sezione;
  }

  function sezioneChiusura(stato, edizioneId, ricarica) {
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
        bottone
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

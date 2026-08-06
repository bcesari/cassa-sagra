Router.register('/cassa', renderCassa);

function renderCassa(container) {
  const ruolo = Router.requireRuolo(['cassa']);
  if (!ruolo) return;

  const edizione = State.getEdizione();
  const listino = State.getListino();
  let ordine = State.getOrdineCorrente();

  const radice = el('div', { class: 'vista-cassa' });
  container.appendChild(radice);

  Alerts.renderBanner(radice, 'tutte_le_casse', edizione.edizione_id);

  const intestazione = el('div', { class: 'intestazione' }, [
    el('h1', {}, [
      el('img', { src: 'icons/monogramma-ponte.webp', alt: '', class: 'icona-testata' }),
      ` ${ruolo.nome_visualizzato || ruolo.ruolo_id}`
    ]),
    el('button', { class: 'bottone-link', onclick: () => Router.navigate('/login') }, ['Cambia utente'])
  ]);
  radice.appendChild(intestazione);

  const contatoreCoda = el('div', { class: 'contatore-coda nascosto' });
  radice.appendChild(contatoreCoda);
  Queue.onChange((n) => {
    if (n > 0) {
      contatoreCoda.textContent = `⏳ ${n} vendita/e in attesa di connessione`;
      contatoreCoda.classList.remove('nascosto');
    } else {
      contatoreCoda.classList.add('nascosto');
    }
  });
  Queue.getAll().then((pending) => {
    if (pending.length > 0) {
      contatoreCoda.textContent = `⏳ ${pending.length} vendita/e in attesa di connessione`;
      contatoreCoda.classList.remove('nascosto');
    }
  });

  const griglia = el('div', { class: 'griglia-piatti' });
  const riepilogo = el('div', { class: 'riepilogo-ordine' });
  const totaleEl = el('div', { class: 'totale-ordine' });
  const contantiInput = el('input', { type: 'number', inputmode: 'decimal', min: '0', step: '0.5', placeholder: 'Contanti ricevuti (opzionale)' });
  const restoEl = el('div', { class: 'resto' });

  function totaleOrdine() {
    return listino.reduce((sum, p) => sum + (ordine[p.piatto_id] || 0) * p.prezzo, 0);
  }

  function aggiornaOrdine(nuovoOrdine) {
    ordine = nuovoOrdine;
    State.setOrdineCorrente(ordine);
    disegnaRiepilogo();
  }

  function disegnaGriglia() {
    griglia.innerHTML = '';
    listino.forEach((p) => {
      griglia.appendChild(el('button', {
        class: 'piatto-bottone',
        onclick: () => aggiornaOrdine({ ...ordine, [p.piatto_id]: (ordine[p.piatto_id] || 0) + 1 })
      }, [
        nodoIcona(p.icona, 'piatto-icona'),
        el('span', { class: 'piatto-nome' }, [p.nome_piatto]),
        el('span', { class: 'piatto-prezzo' }, [formatEuro(p.prezzo)])
      ]));
    });
  }

  function disegnaRiepilogo() {
    riepilogo.innerHTML = '';
    const righe = listino.filter((p) => (ordine[p.piatto_id] || 0) > 0);
    if (righe.length === 0) {
      riepilogo.appendChild(el('div', { class: 'riepilogo-vuoto' }, ['Nessun piatto selezionato']));
    }
    righe.forEach((p) => {
      const q = ordine[p.piatto_id];
      riepilogo.appendChild(el('div', { class: 'riepilogo-riga' }, [
        el('button', {
          class: 'bottone-meno',
          onclick: () => {
            const q2 = q - 1;
            const nuovo = { ...ordine };
            if (q2 <= 0) delete nuovo[p.piatto_id]; else nuovo[p.piatto_id] = q2;
            aggiornaOrdine(nuovo);
          }
        }, ['−']),
        el('span', { class: 'riepilogo-nome' }, [`${p.nome_piatto} ×${q}`]),
        el('span', { class: 'riepilogo-subtotale' }, [formatEuro(q * p.prezzo)])
      ]));
    });
    const totale = totaleOrdine();
    totaleEl.textContent = `Totale: ${formatEuro(totale)}`;
    aggiornaResto(totale);
  }

  function aggiornaResto(totale) {
    const contanti = parseFloat(contantiInput.value);
    if (isNaN(contanti)) { restoEl.textContent = ''; return; }
    restoEl.textContent = `Resto: ${formatEuro(contanti - totale)}`;
  }

  contantiInput.addEventListener('input', () => aggiornaResto(totaleOrdine()));

  const erroreRegistra = el('div', { class: 'errore nascosto' }, []);

  const bottoneRegistra = el('button', {
    class: 'bottone-primario bottone-grande',
    onclick: async () => {
      erroreRegistra.classList.add('nascosto');
      const righe = listino
        .filter((p) => (ordine[p.piatto_id] || 0) > 0)
        .map((p) => ({
          piatto_id: p.piatto_id,
          nome_piatto: p.nome_piatto,
          quantita: ordine[p.piatto_id],
          prezzo_unitario: p.prezzo,
          subtotale: ordine[p.piatto_id] * p.prezzo
        }));
      if (righe.length === 0) return;

      const totale = totaleOrdine();
      const contanti = parseFloat(contantiInput.value);
      const vendita = {
        // ruolo_id/pin incorporati qui: se il retry in coda avviene dopo un
        // cambio turno sullo stesso device, deve comunque autenticarsi con le
        // credenziali della cassa che ha fatto la vendita, non con quelle del
        // ruolo eventualmente loggato al momento del retry.
        ruolo_id: ruolo.ruolo_id,
        pin: ruolo.pin,
        vendita_id: uuidv4(),
        edizione_id: edizione.edizione_id,
        cassa: ruolo.ruolo_id,
        timestamp_iso: new Date().toISOString(),
        totale,
        contanti_ricevuti: isNaN(contanti) ? '' : contanti,
        resto: isNaN(contanti) ? '' : contanti - totale,
        righe
      };

      bottoneRegistra.disabled = true;
      try {
        // Se questo fallisce la vendita non è stata messa in coda da nessuna
        // parte: senza catch l'ordine resterebbe a schermo senza che nulla
        // segnali al cassiere che non è stato registrato niente.
        await Queue.add(vendita);
      } catch (err) {
        erroreRegistra.textContent = 'Vendita NON registrata: memoria del dispositivo non disponibile. Segna l\'ordine su carta e avvisa l\'amministratore.';
        erroreRegistra.classList.remove('nascosto');
        return;
      } finally {
        bottoneRegistra.disabled = false;
      }

      // Da qui in poi la vendita è al sicuro in coda: trySync inghiotte già i
      // propri errori e ritenta in background, quindi non va atteso.
      Queue.trySync();

      aggiornaOrdine({});
      contantiInput.value = '';
      restoEl.textContent = '';
    }
  }, ['Registra vendita']);

  const segnalazione = el('div', { class: 'segnalazione-tesoriere' });
  Alerts.renderInvioForm(segnalazione, ruolo.ruolo_id, 'tesoriere', 'Segnala all\'amministratore (es. blocchetti in esaurimento)');

  radice.appendChild(griglia);
  radice.appendChild(el('div', { class: 'riepilogo-box' }, [
    riepilogo,
    totaleEl,
    contantiInput,
    restoEl,
    erroreRegistra,
    el('div', { class: 'azioni-ordine' }, [bottoneRegistra])
  ]));
  radice.appendChild(segnalazione);

  disegnaGriglia();
  disegnaRiepilogo();
}

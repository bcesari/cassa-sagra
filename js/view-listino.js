Router.register('/listino', renderListino);

const EMOJI_SUGGERITE = ['🍝', '🍲', '🥞', '🧀', '🍖', '🌭', '🍢', '🍡', '🍕', '🍔', '🥪', '🍷', '🍺', '🥤', '🍰'];
const MAX_PIATTI = 12;

function renderListino(container) {
  const ruolo = Router.requireRuolo(['admin_listino']);
  if (!ruolo) return;

  const radice = el('div', { class: 'vista-listino' });
  container.appendChild(radice);

  radice.appendChild(el('div', { class: 'intestazione' }, [
    el('h1', {}, ['📋 Gestione Listino']),
    el('button', { class: 'bottone-link', onclick: () => Router.navigate('/login') }, ['Cambia utente'])
  ]));

  const corpo = el('div', {}, ['Caricamento…']);
  radice.appendChild(corpo);

  (async () => {
    const edizione = await Api.edizioneCorrente();
    const listinoRes = await Api.listino(edizione.edizione_id);
    corpo.innerHTML = '';
    disegnaForm(corpo, edizione, listinoRes.piatti || []);
  })();
}

function disegnaForm(corpo, edizione, piattiEsistenti) {
  const edizioneIdInput = el('input', { type: 'text', value: edizione.edizione_id || '' });
  const nomeEdizioneInput = el('input', { type: 'text', value: edizione.nome || '' });
  const coefficienteInput = el('input', {
    type: 'number', step: '0.1', min: '0.1',
    value: edizione.coefficiente_persone_ordine || 2
  });

  const righeContainer = el('div', { class: 'listino-righe' });
  let righe = piattiEsistenti.length > 0
    ? piattiEsistenti.map((p) => ({ ...p, pin_responsabile: p.pin_responsabile || '' }))
    : [{ piatto_id: '', nome_piatto: '', prezzo: '', icona: '', ordine_visualizzazione: 1, pin_responsabile: '' }];

  const messaggio = el('div', { class: 'messaggio-esito nascosto' });

  function disegnaRighe() {
    righeContainer.innerHTML = '';
    righe.forEach((r, i) => {
      const rigaEl = el('div', { class: 'listino-riga' }, [
        el('input', {
          type: 'text', placeholder: 'id (slug)', value: r.piatto_id,
          oninput: (e) => { r.piatto_id = e.target.value.trim(); }
        }),
        el('input', {
          type: 'text', placeholder: 'Nome piatto', value: r.nome_piatto,
          oninput: (e) => { r.nome_piatto = e.target.value; }
        }),
        el('input', {
          type: 'number', step: '0.5', placeholder: 'Prezzo', value: r.prezzo,
          oninput: (e) => { r.prezzo = parseFloat(e.target.value); }
        }),
        el('input', {
          type: 'text', placeholder: 'Emoji', maxlength: '2', value: r.icona,
          list: 'emoji-suggerite',
          oninput: (e) => { r.icona = e.target.value; }
        }),
        el('input', {
          type: 'number', placeholder: 'Ordine', value: r.ordine_visualizzazione || i + 1,
          oninput: (e) => { r.ordine_visualizzazione = parseInt(e.target.value, 10); }
        }),
        el('input', {
          type: 'text', placeholder: 'PIN responsabile', value: r.pin_responsabile,
          oninput: (e) => { r.pin_responsabile = e.target.value.trim(); }
        }),
        el('button', {
          class: 'bottone-meno', title: 'Rimuovi piatto',
          onclick: () => { righe = righe.filter((_, idx) => idx !== i); disegnaRighe(); }
        }, ['✕'])
      ]);
      righeContainer.appendChild(rigaEl);
    });
  }
  disegnaRighe();

  const datalist = el('datalist', { id: 'emoji-suggerite' },
    EMOJI_SUGGERITE.map((e) => el('option', { value: e }, [])));

  const bottoneAggiungi = el('button', {
    class: 'bottone-secondario',
    onclick: () => {
      if (righe.length >= MAX_PIATTI) {
        messaggio.textContent = `Massimo ${MAX_PIATTI} piatti per edizione`;
        messaggio.classList.remove('nascosto');
        return;
      }
      righe.push({ piatto_id: '', nome_piatto: '', prezzo: '', icona: '', ordine_visualizzazione: righe.length + 1, pin_responsabile: '' });
      disegnaRighe();
    }
  }, ['+ Aggiungi piatto']);

  const bottoneSalva = el('button', {
    class: 'bottone-primario',
    onclick: async () => {
      messaggio.classList.add('nascosto');
      const payload = {
        edizione_id: edizioneIdInput.value.trim(),
        nome_edizione: nomeEdizioneInput.value.trim(),
        coefficiente_persone_ordine: parseFloat(coefficienteInput.value),
        piatti: righe
      };
      const res = await Api.salvaListino(payload);
      messaggio.classList.remove('nascosto');
      if (res.ok) {
        messaggio.textContent = 'Listino salvato correttamente.';
        messaggio.classList.remove('errore');
      } else {
        messaggio.textContent = res.error || 'Errore nel salvataggio';
        messaggio.classList.add('errore');
      }
    }
  }, ['Salva listino']);

  corpo.appendChild(el('div', { class: 'sezione' }, [
    el('label', {}, ['ID edizione']), edizioneIdInput,
    el('label', {}, ['Nome edizione']), nomeEdizioneInput,
    el('label', {}, ['Persone medie per ordine (stima presenze)']), coefficienteInput
  ]));
  corpo.appendChild(el('div', { class: 'sezione' }, [
    el('h2', {}, [`Piatti (max ${MAX_PIATTI})`]),
    datalist,
    righeContainer,
    bottoneAggiungi
  ]));
  corpo.appendChild(bottoneSalva);
  corpo.appendChild(messaggio);
}

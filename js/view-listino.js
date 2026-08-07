Router.register('/listino', renderListino);

// Emoji raggruppate per categoria: sono testo, quindi la lista può essere ampia
// senza scaricare nulla in più. Restano solo suggerimenti — dal selettore si può
// comunque incollare qualsiasi altra emoji.
const EMOJI_CATEGORIE = [
  ['Primi', ['🍝', '🍜', '🍲', '🥣', '🍚', '🥟', '🫓', '🍛', '🍥', '🫕', '🧆', '🥞']],
  ['Carne e griglia', ['🍖', '🥩', '🍗', '🌭', '🍢', '🥓', '🍔', '🍤', '🐟', '🐑', '🐖', '🔥']],
  ['Verdure e contorni', ['🥗', '🍟', '🧀', '🥔', '🌽', '🥦', '🍄', '🫑', '🍅', '🥒', '🧅', '🥕']],
  ['Pane e pizza', ['🍕', '🥪', '🥖', '🥐', '🥯', '🌮', '🌯', '🥨']],
  ['Dolci', ['🍰', '🧁', '🍩', '🍦', '🥧', '🍪', '🍮', '🍫', '🍬', '🍯', '🥮', '🍡']],
  ['Bevande', ['🍷', '🍺', '🥤', '☕', '🧃', '🍸', '🍹', '🥂', '🍾', '🧋', '💧', '🫗']],
  ['Varie', ['🍽️', '🎪', '⭐', '🏆', '🎯', '🎉', '🎫', '🇮🇹', '🌶️', '🧂', '🫒', '🧑‍🍳']]
];
const MAX_PIATTI = 12;

// Un'emoji può occupare più di una "unità" JS (🇮🇹 ne occupa 4, 🧑‍🍳 cinque):
// tagliare a lunghezza fissa spezzerebbe la sequenza e produrrebbe un glifo
// rotto. Intl.Segmenter isola il primo carattere percepito; dove non c'è
// (browser datati) si accetta il valore così com'è, essendo un campo compilato
// solo da chi gestisce il listino.
function primaEmoji(testo) {
  const t = (testo || '').trim();
  if (!t) return '';
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('it', { granularity: 'grapheme' });
    const primo = segmenter.segment(t)[Symbol.iterator]().next();
    return primo.done ? '' : primo.value.segment;
  }
  return t;
}

// Selettore modale: le righe del listino sono già strette con otto campi, un
// pannello a comparsa in linea le renderebbe illeggibili su telefono.
function apriSelettoreEmoji(valoreCorrente, onScegli) {
  const overlay = el('div', { class: 'overlay-emoji' });

  function chiudi() {
    overlay.remove();
    document.removeEventListener('keydown', onEsc);
  }
  function onEsc(e) {
    if (e.key === 'Escape') chiudi();
  }
  function scegli(valore) {
    // Un nome di file va salvato intero: primaEmoji lo ridurrebbe alla prima
    // lettera, essendo pensata per troncare le emoji incollate.
    onScegli(eFileIcona(valore) ? String(valore).trim() : primaEmoji(valore));
    chiudi();
  }

  const libera = el('input', {
    type: 'text',
    class: 'input-emoji-libera',
    value: valoreCorrente || '',
    placeholder: 'Oppure incolla qui la tua emoji',
    'aria-label': 'Emoji personalizzata'
  });

  const pannello = el('div', { class: 'pannello-emoji' }, [
    el('div', { class: 'pannello-emoji-testa' }, [
      el('strong', {}, ['Scegli icona']),
      el('button', { type: 'button', class: 'bottone-link', onclick: chiudi }, ['Chiudi'])
    ]),
    // Le icone disegnate per la sagra vanno in cima: se ci sono, sono quelle da
    // usare. La sezione sparisce se la cartella frontend/icons/piatti/ è vuota.
    ...(ICONE_PIATTI.length > 0 ? [
      el('div', { class: 'emoji-categoria' }, ['Icone della sagra']),
      el('div', { class: 'emoji-griglia' }, ICONE_PIATTI.map((file) => el('button', {
        type: 'button', class: 'emoji-scelta', title: file,
        onclick: () => scegli(file)
      }, [nodoIcona(file, 'icona-scelta')])))
    ] : []),
    ...EMOJI_CATEGORIE.flatMap(([nome, emoji]) => [
      el('div', { class: 'emoji-categoria' }, [nome]),
      el('div', { class: 'emoji-griglia' }, emoji.map((e) => el('button', {
        type: 'button', class: 'emoji-scelta', title: e,
        onclick: () => scegli(e)
      }, [e])))
    ]),
    el('div', { class: 'emoji-categoria' }, ['Personalizzata']),
    el('div', { class: 'emoji-libera-riga' }, [
      libera,
      el('button', { type: 'button', class: 'bottone-secondario', onclick: () => scegli(libera.value) }, ['Usa'])
    ])
  ]);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) chiudi(); });
  document.addEventListener('keydown', onEsc);
  overlay.appendChild(pannello);
  document.body.appendChild(overlay);
}

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
  // pin_responsabile arriva sempre vuoto: il server non lo restituisce mai al
  // client (è un segreto) e reintegra quello esistente se il payload lo lascia
  // vuoto — vedi salvaListino_ in Listino.gs.
  let righe = piattiEsistenti.length > 0
    ? piattiEsistenti.map((p) => ({ ...p, gruppo: p.gruppo || '', pin_responsabile: '' }))
    : [{ piatto_id: '', nome_piatto: '', prezzo: '', icona: '', ordine_visualizzazione: 1, gruppo: '', pin_responsabile: '' }];

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
        (() => {
          const bottoneIcona = el('button', {
            type: 'button', class: 'bottone-emoji', title: 'Scegli icona',
            onclick: () => apriSelettoreEmoji(r.icona, (scelta) => {
              r.icona = scelta;
              bottoneIcona.innerHTML = '';
              bottoneIcona.appendChild(nodoIcona(scelta, 'icona-bottone'));
            })
          }, [nodoIcona(r.icona, 'icona-bottone')]);
          return bottoneIcona;
        })(),
        el('input', {
          type: 'number', placeholder: 'Ordine', value: r.ordine_visualizzazione || i + 1,
          oninput: (e) => { r.ordine_visualizzazione = parseInt(e.target.value, 10); }
        }),
        el('input', {
          type: 'text', placeholder: 'Gruppo (opz.)', value: r.gruppo || '',
          title: 'Piatti con lo stesso gruppo sono seguiti dallo stesso stand, che ne vede i totali separati (es. "sagne" su bianche e rosse). Lascia vuoto se il piatto sta a sé.',
          oninput: (e) => { r.gruppo = e.target.value.trim().toLowerCase(); }
        }),
        el('input', {
          type: 'text', placeholder: 'PIN (invariato)', value: r.pin_responsabile,
          title: 'Vuoto = PIN attuale invariato. Scrivi un valore solo per cambiarlo.',
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

  const bottoneAggiungi = el('button', {
    class: 'bottone-secondario',
    onclick: () => {
      if (righe.length >= MAX_PIATTI) {
        messaggio.textContent = `Massimo ${MAX_PIATTI} piatti per edizione`;
        messaggio.classList.remove('nascosto');
        return;
      }
      righe.push({ piatto_id: '', nome_piatto: '', prezzo: '', icona: '', ordine_visualizzazione: righe.length + 1, gruppo: '', pin_responsabile: '' });
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
      bottoneSalva.disabled = true;
      bottoneSalva.textContent = 'Salvataggio in corso…';
      try {
        const res = await Api.salvaListino(payload);
        messaggio.classList.remove('nascosto');
        if (res.ok) {
          messaggio.textContent = 'Listino salvato correttamente.';
          messaggio.classList.remove('errore');
        } else {
          messaggio.textContent = res.error || 'Errore nel salvataggio';
          messaggio.classList.add('errore');
        }
      } catch (err) {
        // Senza questo catch, se tutti i tentativi di rete falliscono la
        // promise va in rejection senza mostrare nulla: il pulsante sembra
        // non fare niente e non si capisce se il listino sia stato salvato.
        messaggio.textContent = 'Connessione al server non riuscita: listino NON salvato, riprova.';
        messaggio.classList.add('errore');
        messaggio.classList.remove('nascosto');
      } finally {
        bottoneSalva.disabled = false;
        bottoneSalva.textContent = 'Salva listino';
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
    righeContainer,
    bottoneAggiungi
  ]));
  corpo.appendChild(bottoneSalva);
  corpo.appendChild(messaggio);
}

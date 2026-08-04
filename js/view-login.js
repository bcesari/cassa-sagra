Router.register('/login', renderLogin);

function renderLogin(container) {
  State.clearRuolo();

  const ruoloSelect = el('select', { id: 'login-ruolo' }, [
    el('option', { value: 'cassa_1' }, ['Cassa 1']),
    el('option', { value: 'cassa_2' }, ['Cassa 2']),
    el('option', { value: 'cassa_3' }, ['Cassa 3']),
    el('option', { value: 'cassa_4' }, ['Cassa 4']),
    el('option', { value: 'tesoriere' }, ['Tesoriere']),
    el('option', { value: 'admin_listino' }, ['Gestione Listino']),
    el('option', { value: 'responsabile' }, ['Responsabile Piatto'])
  ]);

  const responsabilePiattoId = el('input', {
    id: 'login-piatto-id',
    type: 'text',
    placeholder: 'id piatto (es. crespelle)',
    class: 'nascosto'
  });

  ruoloSelect.addEventListener('change', () => {
    responsabilePiattoId.classList.toggle('nascosto', ruoloSelect.value !== 'responsabile');
  });

  const pinInput = el('input', {
    id: 'login-pin',
    type: 'password',
    inputmode: 'numeric',
    placeholder: 'PIN',
    autocomplete: 'off'
  });

  const errore = el('div', { class: 'errore nascosto' }, []);

  const bottone = el('button', {
    class: 'bottone-primario',
    onclick: async () => {
      errore.classList.add('nascosto');
      bottone.disabled = true;
      bottone.textContent = 'Accesso in corso…';
      try {
        const ruoloBase = ruoloSelect.value;
        const ruoloId = ruoloBase === 'responsabile'
          ? 'responsabile_' + responsabilePiattoId.value.trim()
          : ruoloBase;
        const pin = pinInput.value.trim();

        const res = await Api.bootstrap(ruoloId, pin);
        if (!res.ok) {
          errore.textContent = res.error || 'Accesso non riuscito';
          errore.classList.remove('nascosto');
          return;
        }
        State.setRuolo({ ruolo_id: res.ruolo_id, tipo: res.tipo, pin, piatto_id: res.piatto_id, nome_piatto: res.nome_piatto, gruppo: res.gruppo, nome_visualizzato: res.nome_visualizzato });
        State.setEdizione(res.edizione);
        State.setListino(res.piatti);

        const destinazione = { cassa: '/cassa', tesoriere: '/tesoriere', admin_listino: '/listino', responsabile: '/responsabile' }[res.tipo];
        Router.navigate(destinazione || '/cassa');
      } catch (err) {
        // Senza questo catch, se tutti i tentativi di rete falliscono la
        // promise dell'handler va in rejection senza che nulla venga
        // mostrato: sembra che il pulsante "non faccia niente".
        errore.textContent = 'Connessione al server non riuscita, riprova.';
        errore.classList.remove('nascosto');
      } finally {
        bottone.disabled = false;
        bottone.textContent = 'Accedi';
      }
    }
  }, ['Accedi']);

  container.appendChild(el('div', { class: 'schermata-login' }, [
    el('img', { src: 'icons/logo-quartiere.webp', alt: 'Quartiere Ponte', class: 'logo-login' }),
    el('h1', {}, ['Cassa Sagra']),
    el('label', {}, ['Ruolo']),
    ruoloSelect,
    responsabilePiattoId,
    el('label', {}, ['PIN']),
    pinInput,
    bottone,
    errore
  ]));
}

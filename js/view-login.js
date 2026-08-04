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

  // Tendina invece di un campo libero: un id digitato a mano (spazi,
  // maiuscole, refusi) è un rischio inutile quando il server ha già
  // l'elenco esatto. Caricata al volo solo la prima volta che serve, non ad
  // ogni apertura del login: chi fa cassa non paga questa chiamata in più.
  const responsabilePiattoId = el('select', { id: 'login-piatto-id', class: 'nascosto' }, [
    el('option', { value: '' }, ['— scegli il piatto —'])
  ]);
  let piattiRichiesti = false;
  async function caricaPiattiResponsabile() {
    if (piattiRichiesti) return;
    piattiRichiesti = true;
    try {
      const res = await Api.piattiResponsabili();
      (res.piatti || []).forEach((p) => {
        responsabilePiattoId.appendChild(el('option', { value: p.piatto_id }, [p.nome_piatto || p.piatto_id]));
      });
    } catch (err) {
      // Fallito il caricamento: si può ancora riprovare cambiando ruolo e
      // tornando su "Responsabile Piatto", che rilancia il caricamento.
      piattiRichiesti = false;
      responsabilePiattoId.appendChild(el('option', { value: '' }, ['Errore nel caricamento, riprova']));
    }
  }

  // Il blur subito dopo la scelta toglie l'anello di focus blu del browser,
  // che altrimenti resta acceso sul <select> finché non si tocca dell'altro:
  // non è lentezza vera, ma dà quella sensazione.
  [ruoloSelect, responsabilePiattoId].forEach((sel) => {
    sel.addEventListener('change', () => sel.blur());
  });

  ruoloSelect.addEventListener('change', () => {
    const isResponsabile = ruoloSelect.value === 'responsabile';
    responsabilePiattoId.classList.toggle('nascosto', !isResponsabile);
    if (isResponsabile) caricaPiattiResponsabile();
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

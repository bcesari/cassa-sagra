Router.register('/login', renderLogin);

function renderLogin(container) {
  State.clearRuolo();
  // Un cambio cassa sullo stesso dispositivo non deve mai offrire di
  // annullare la vendita della cassa precedente.
  State.clearUltimaVendita();

  const ruoloSelect = el('select', { id: 'login-ruolo' }, [
    el('option', { value: 'cassa_1' }, ['Cassa 1 Mirko']),
    el('option', { value: 'cassa_2' }, ['Cassa 2 Maurizio']),
    el('option', { value: 'cassa_3' }, ['Cassa 3 Andrea']),
    el('option', { value: 'cassa_4' }, ['Cassa 4 Emanuele']),
    el('option', { value: 'tesoriere' }, ['Amministratore']),
    el('option', { value: 'admin_listino' }, ['Gestione Listino']),
    el('option', { value: 'responsabile' }, ['Stand'])
  ]);

  // Bottone che apre un pannello di scelta (apriSelettoreLista, utils.js)
  // invece di un <select> nativo con un id digitato a mano (spazi,
  // maiuscole, refusi sarebbero un rischio inutile quando il server ha già
  // l'elenco esatto): un segnaposto nascosto con `hidden` su <option> non
  // funziona su Safari/Chrome iOS (verificato dal vivo, ricompariva nel
  // menu), il pannello non ha questo limite su nessun browser — stesso fix
  // già applicato al selettore "a chi segnalare" in cassa (view-cassa.js).
  let standSelezionato = '';
  let opzioniStand = [];
  const responsabilePiattoId = el('button', { type: 'button', class: 'bottone-selettore nascosto' }, ['Caricamento piatti…']);
  responsabilePiattoId.disabled = true;
  responsabilePiattoId.addEventListener('click', () => {
    if (opzioniStand.length === 0) return;
    apriSelettoreLista('Scegli lo stand', opzioniStand, (o) => {
      standSelezionato = o.value;
      responsabilePiattoId.textContent = o.label;
    });
  });

  let piattiRichiesti = false;
  async function caricaPiattiResponsabile() {
    if (piattiRichiesti) return;
    piattiRichiesti = true;
    responsabilePiattoId.textContent = 'Caricamento piatti…';
    responsabilePiattoId.disabled = true;
    try {
      const piatti = (await Api.piattiResponsabili()).piatti || [];

      // Più piatti con lo stesso gruppo (es. sagne bianche/rosse) diventano
      // una sola voce nel menu ("Sagne"): chi ha il PIN di uno qualsiasi dei
      // due entra comunque nella stessa vista di gruppo, non deve indovinare
      // quale dei due scegliere.
      opzioniStand = opzioniResponsabili(piatti);
      standSelezionato = '';
      responsabilePiattoId.textContent = 'Scegli stand';
      responsabilePiattoId.disabled = false;
    } catch (err) {
      // Fallito il caricamento: si può ancora riprovare cambiando ruolo e
      // tornando su "Stand", che rilancia il caricamento.
      piattiRichiesti = false;
      responsabilePiattoId.textContent = 'Errore nel caricamento, riprova';
    }
  }
  // Avviato subito, non solo quando si sceglie "Stand": così i piatti sono
  // già pronti nel momento in cui servono, invece di far aspettare la
  // chiamata da quel momento (percepito come lentezza del menu).
  caricaPiattiResponsabile();

  // Il blur subito dopo la scelta toglie l'anello di focus blu del browser,
  // che altrimenti resta acceso sul <select> finché non si tocca dell'altro:
  // non è lentezza vera, ma dà quella sensazione.
  ruoloSelect.addEventListener('change', () => {
    ruoloSelect.blur();
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
          ? 'responsabile_' + standSelezionato.trim()
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

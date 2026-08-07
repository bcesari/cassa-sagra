// Banner condiviso per gli alert broadcast/tesoriere, usato dalle viste Cassa e
// Tesoriere. Polling ogni CONFIG.POLL_INTERVAL_MS; "✕" chiude l'alert solo per
// chi lo preme (letto_da), senza nasconderlo agli altri destinatari.
const Alerts = {
  renderBanner(container, destinatario, edizioneId) {
    const banner = el('div', { class: 'alert-banner nascosto' });
    container.appendChild(banner);
    // Alert chiusi da questa vista ma non ancora confermati dal server: senza
    // questo, un poll che arriva prima che segnaAlertLetto sia completata
    // farebbe ricomparire l'alert appena nascosto.
    const chiusiLocalmente = new Set();

    async function poll() {
      const res = await Api.alert(destinatario, edizioneId);
      if (!res.alert) return;
      const daMostrare = res.alert.filter((a) => !chiusiLocalmente.has(a.alert_id));
      if (daMostrare.length === 0) {
        banner.classList.add('nascosto');
        banner.innerHTML = '';
        return;
      }
      banner.classList.remove('nascosto');
      banner.innerHTML = '';
      daMostrare.forEach((a) => {
        const riga = el('div', { class: 'alert-riga' }, [
          el('span', {}, [`${formatOra(a.timestamp_iso)} — ${a.mittente}: ${a.messaggio}`]),
          el('button', {
            class: 'alert-chiudi',
            onclick: () => {
              // Sparisce subito: aspettare la conferma del server prima di
              // nascondere l'alert lo rendeva percepito come lento/bloccato
              // con la latenza nota di Apps Script. La conferma avviene in
              // background; se fallisse, l'alert resta comunque nascosto per
              // questa sessione grazie a chiusiLocalmente.
              chiusiLocalmente.add(a.alert_id);
              riga.remove();
              if (banner.children.length === 0) banner.classList.add('nascosto');
              Api.segnaAlertLetto(a.alert_id).catch(() => {});
            }
          }, ['✕'])
        ]);
        banner.appendChild(riga);
      });
    }

    poll();
    Router.setPoll(setInterval(poll, CONFIG.POLL_INTERVAL_MS));
  },

  // `destinatario` può essere una stringa fissa (uso esistente: cassa->
  // tesoriere, responsabile->tutte_le_casse) oppure una funzione richiamata
  // al momento dell'invio, per leggere una scelta fatta in un `selettore`
  // (es. "a quale responsabile" in cassa) senza duplicare qui la logica di
  // invio/errore/disabilitazione. `selettore`, se passato, è un elemento già
  // pronto (tipicamente un <select>) inserito prima del campo testo.
  renderInvioForm(container, mittente, destinatario, placeholder, selettore) {
    const input = el('input', { type: 'text', placeholder });
    const esito = el('div', { class: 'errore nascosto' });
    const bottone = el('button', {
      class: 'bottone-secondario',
      onclick: async () => {
        const messaggio = input.value.trim();
        if (!messaggio) return;
        const dest = typeof destinatario === 'function' ? destinatario() : destinatario;
        if (!dest) {
          esito.textContent = 'Scegli prima un destinatario.';
          esito.classList.remove('nascosto');
          return;
        }
        esito.classList.add('nascosto');
        bottone.disabled = true;
        try {
          await Api.inviaAlert({
            alert_id: uuidv4(),
            edizione_id: State.getEdizione().edizione_id,
            mittente,
            destinatario: dest,
            messaggio,
            timestamp_iso: new Date().toISOString()
          });
          input.value = '';
        } catch (err) {
          esito.textContent = 'Invio non riuscito, riprova.';
          esito.classList.remove('nascosto');
        } finally {
          bottone.disabled = false;
        }
      }
    }, ['Invia segnalazione']);
    container.appendChild(el('div', { class: 'invio-alert' }, [selettore, input, bottone].filter(Boolean)));
    container.appendChild(esito);
  }
};

// Banner condiviso per gli alert broadcast/tesoriere, usato dalle viste Cassa e
// Tesoriere. Polling ogni CONFIG.POLL_INTERVAL_MS; "✕" chiude l'alert solo per
// chi lo preme (letto_da), senza nasconderlo agli altri destinatari.
const Alerts = {
  renderBanner(container, destinatario, edizioneId) {
    const banner = el('div', { class: 'alert-banner nascosto' });
    container.appendChild(banner);

    async function poll() {
      const res = await Api.alert(destinatario, edizioneId);
      if (!res.alert || res.alert.length === 0) {
        banner.classList.add('nascosto');
        banner.innerHTML = '';
        return;
      }
      banner.classList.remove('nascosto');
      banner.innerHTML = '';
      res.alert.forEach((a) => {
        banner.appendChild(el('div', { class: 'alert-riga' }, [
          el('span', {}, [`${formatOra(a.timestamp_iso)} — ${a.mittente}: ${a.messaggio}`]),
          el('button', {
            class: 'alert-chiudi',
            onclick: async () => { await Api.segnaAlertLetto(a.alert_id); poll(); }
          }, ['✕'])
        ]));
      });
    }

    poll();
    Router.setPoll(setInterval(poll, CONFIG.POLL_INTERVAL_MS));
  },

  renderInvioForm(container, mittente, destinatario, placeholder) {
    const input = el('input', { type: 'text', placeholder });
    const bottone = el('button', {
      class: 'bottone-secondario',
      onclick: async () => {
        const messaggio = input.value.trim();
        if (!messaggio) return;
        await Api.inviaAlert({
          alert_id: uuidv4(),
          edizione_id: State.getEdizione().edizione_id,
          mittente,
          destinatario,
          messaggio,
          timestamp_iso: new Date().toISOString()
        });
        input.value = '';
      }
    }, ['Invia segnalazione']);
    container.appendChild(el('div', { class: 'invio-alert' }, [input, bottone]));
  }
};

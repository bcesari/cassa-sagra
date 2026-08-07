// Notifiche push, solo per l'Amministratore (scelta esplicita dell'utente:
// le casse tengono già il telefono acceso con l'app aperta, il banner
// in-app basta). Canale in più per le segnalazioni cassa->tesoriere già
// esistenti (alerts.js) — non le sostituisce, il banner resta invariato.
const Push = (function () {
  function supportato() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  // Conversione standard base64url -> Uint8Array richiesta da
  // pushManager.subscribe({ applicationServerKey }).
  function fromBase64Url(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
    return output;
  }

  // 'non-supportato' | 'negato' | 'attivo' | 'inattivo'
  async function stato() {
    if (!supportato()) return 'non-supportato';
    if (Notification.permission === 'denied') return 'negato';
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    return sub ? 'attivo' : 'inattivo';
  }

  async function iscrivi(edizioneId) {
    if (!supportato()) throw new Error('notifiche non supportate su questo browser');
    // Deve partire da un click: requisito di iOS per il prompt di sistema.
    const permesso = await Notification.requestPermission();
    if (permesso !== 'granted') throw new Error('permesso non concesso');

    const registration = await navigator.serviceWorker.ready;
    let sub = await registration.pushManager.getSubscription();
    if (!sub) {
      const { publicKey } = await Api.vapidPublicKey();
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: fromBase64Url(publicKey)
      });
    }
    const json = sub.toJSON();
    await Api.salvaPushSubscription({
      edizione_id: edizioneId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth
    });
  }

  return { supportato, stato, iscrivi };
})();

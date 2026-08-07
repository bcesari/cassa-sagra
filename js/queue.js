// Coda di retry per le vendite: ogni "Registra vendita" viene prima salvata qui,
// poi si tenta l'invio. Se la rete cade (evento affollato, cali di segnale
// momentanei), la vendita resta in coda e viene ritentata in background finché
// il backend non conferma — nessun ticket registrato va perso. La dedup lato
// server su vendita_id (vedi Vendite.gs) rende sicuri i retry duplicati.
const Queue = (function () {
  const DB_NAME = 'sagra-cassa';
  const STORE = 'pending-vendite';
  const LS_KEY = 'sagra.pendingVendite';
  let dbPromise = null;
  let syncing = false;
  const listeners = [];

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      if (!window.indexedDB) { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'vendita_id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    return dbPromise;
  }

  function readLs() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch (e) { return []; }
  }
  function writeLs(list) {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  }

  // `tipo: 'registra'` di default (spread dopo, così un chiamante può
  // sovrascriverlo — vedi `annulla` sotto): trySync guarda questo campo per
  // sapere quale azione dell'API richiamare.
  async function add(vendita) {
    const item = { tipo: 'registra', ...vendita };
    const db = await openDb();
    if (!db) {
      writeLs([...readLs().filter((v) => v.vendita_id !== item.vendita_id), item]);
      notify();
      return;
    }
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(item);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
    notify();
  }

  // "Annulla ultimo ordine" (view-cassa.js): converte l'elemento in coda per
  // questo vendita_id in una richiesta di annullamento invece che di
  // registrazione — stessa chiave (vendita_id), quindi se la vendita
  // originale era ancora in coda (mai arrivata al server) viene sovrascritta
  // qui e non verrà più inviata come registrazione. trySync la manda con
  // annullaVendita al posto di registraVendita (gestisce correttamente anche
  // il caso "mai arrivata", vedi worker-d1/src/vendite.js) — stessa
  // resilienza offline già garantita per le registrazioni, prima mancante
  // qui: annullare a rete debole/assente falliva silenziosamente (la
  // chiamata diretta al server non riusciva) e la vendita originale finiva
  // comunque per essere inviata al ristabilirsi della connessione, come se
  // "annulla" non fosse mai stato premuto (bug reale riscontrato dal vivo).
  function annulla(vendita) {
    return add({ ...vendita, tipo: 'annulla' });
  }

  async function remove(venditaId) {
    const db = await openDb();
    if (!db) {
      writeLs(readLs().filter((v) => v.vendita_id !== venditaId));
      notify();
      return;
    }
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(venditaId);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
    notify();
  }

  async function getAll() {
    const db = await openDb();
    if (!db) return readLs();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async function getOne_(venditaId) {
    const db = await openDb();
    if (!db) return readLs().find((v) => v.vendita_id === venditaId) || null;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(venditaId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  function notify() {
    getAll().then((pending) => listeners.forEach((fn) => fn(pending.length)));
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  const MAX_INVII_PARALLELI = 3;

  // Concorrenza limitata, non illimitata: il backend serializza comunque
  // tutte le scritture su un unico LockService — sparare in parallelo TUTTE
  // le vendite in coda (es. 10-20 dopo un test a raffica) affolla la coda del
  // lock, e con il retry aggressivo lato client (che abbandona un tentativo
  // lento e ne lancia subito un altro) si rischia di peggiorare la
  // contesa invece di risolverla. Un pool con un numero massimo di richieste
  // in volo alla volta mantiene comunque il vantaggio di non processare le
  // vendite una dopo l'altra in sequenza pura.
  async function elaboraConLimite_(elementi, limite, fn) {
    let indice = 0;
    async function worker() {
      while (indice < elementi.length) {
        const i = indice++;
        await fn(elementi[i]);
      }
    }
    const workers = [];
    for (let w = 0; w < Math.min(limite, elementi.length); w++) workers.push(worker());
    await Promise.all(workers);
  }

  async function trySync() {
    if (syncing) return;
    syncing = true;
    try {
      const pending = await getAll();
      await elaboraConLimite_(pending, MAX_INVII_PARALLELI, async (item) => {
        try {
          // Chiamata diretta come Api.xxx(item), non tramite una variabile
          // intermedia: Api.registraVendita/annullaVendita usano internamente
          // this._post(...), e un riferimento estratto (`const azione = Api.x`)
          // perderebbe il binding di `this`, facendo fallire silenziosamente
          // ogni tentativo con "this._post is not a function" (bug reale
          // riscontrato durante il testing di questa stessa modifica).
          const res = item.tipo === 'annulla' ? await Api.annullaVendita(item) : await Api.registraVendita(item);
          if (res && res.ok) {
            // Non un remove incondizionato: se nel frattempo (mentre questo
            // invio era in volo, rete lenta) l'utente ha premuto "Annulla
            // ultimo ordine", Queue.annulla() ha già sovrascritto questa
            // voce in coda con tipo:'annulla' — rimuoverla comunque a
            // registrazione confermata cancellerebbe l'intenzione di
            // annullare prima ancora che venga spedita, lasciando la
            // vendita attiva per sempre (bug reale riscontrato dal vivo con
            // rete debole: "Registra" lento ancora in corso quando si preme
            // "Annulla"). Si rimuove solo se il tipo in coda è ancora lo
            // stesso di quello appena inviato — altrimenti resta, e verrà
            // rispedita con l'azione corretta al giro successivo.
            const attuale = await getOne_(item.vendita_id);
            if (!attuale || attuale.tipo === item.tipo) {
              await remove(item.vendita_id);
            }
          }
        } catch (err) {
          // resta in coda, ritentata al prossimo giro
        }
      });
    } finally {
      syncing = false;
    }
  }

  function start() {
    setInterval(trySync, CONFIG.RETRY_INTERVAL_MS);
    window.addEventListener('online', trySync);
    trySync();
  }

  return { add, annulla, remove, getAll, trySync, start, onChange };
})();

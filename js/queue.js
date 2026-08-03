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

  async function add(vendita) {
    const db = await openDb();
    if (!db) {
      writeLs([...readLs().filter((v) => v.vendita_id !== vendita.vendita_id), vendita]);
      notify();
      return;
    }
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(vendita);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
    notify();
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
      await elaboraConLimite_(pending, MAX_INVII_PARALLELI, async (vendita) => {
        try {
          const res = await Api.registraVendita(vendita);
          if (res && res.ok) {
            await remove(vendita.vendita_id);
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

  return { add, remove, getAll, trySync, start, onChange };
})();

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

  async function trySync() {
    if (syncing) return;
    syncing = true;
    try {
      const pending = await getAll();
      // In parallelo, non in sequenza: ogni vendita è indipendente (dedup
      // server-side su vendita_id), quindi con più vendite in coda il tempo
      // totale è quello della più lenta, non la somma di tutte — con 4+
      // vendite ferme una dietro l'altra, processarle in sequenza con retry
      // individuali poteva far salire l'attesa a diversi minuti.
      await Promise.allSettled(pending.map(async (vendita) => {
        try {
          const res = await Api.registraVendita(vendita);
          if (res && res.ok) {
            await remove(vendita.vendita_id);
          }
        } catch (err) {
          // resta in coda, ritentata al prossimo giro
        }
      }));
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

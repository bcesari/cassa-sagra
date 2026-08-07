const State = {
  getRuolo() {
    try { return JSON.parse(localStorage.getItem('sagra.ruolo')); } catch (e) { return null; }
  },
  setRuolo(ruolo) {
    localStorage.setItem('sagra.ruolo', JSON.stringify(ruolo));
  },
  clearRuolo() {
    localStorage.removeItem('sagra.ruolo');
  },

  getEdizione() {
    try { return JSON.parse(localStorage.getItem('sagra.edizione')); } catch (e) { return null; }
  },
  setEdizione(edizione) {
    localStorage.setItem('sagra.edizione', JSON.stringify(edizione));
  },

  getListino() {
    try { return JSON.parse(localStorage.getItem('sagra.listino')) || []; } catch (e) { return []; }
  },
  setListino(listino) {
    localStorage.setItem('sagra.listino', JSON.stringify(listino));
  },

  getOrdineCorrente() {
    try { return JSON.parse(localStorage.getItem('sagra.ordineCorrente')) || {}; } catch (e) { return {}; }
  },
  setOrdineCorrente(ordine) {
    localStorage.setItem('sagra.ordineCorrente', JSON.stringify(ordine));
  },
  clearOrdineCorrente() {
    localStorage.removeItem('sagra.ordineCorrente');
  },

  // Ultima vendita registrata da questa cassa, per "Annulla ultimo ordine"
  // (view-cassa.js). In localStorage, non solo in memoria: sopravvive anche
  // a un ricaricamento della pagina, non solo alla sessione corrente.
  getUltimaVendita() {
    try { return JSON.parse(localStorage.getItem('sagra.ultimaVendita')); } catch (e) { return null; }
  },
  setUltimaVendita(vendita) {
    localStorage.setItem('sagra.ultimaVendita', JSON.stringify(vendita));
  },
  clearUltimaVendita() {
    localStorage.removeItem('sagra.ultimaVendita');
  }
};

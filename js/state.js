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
  }
};

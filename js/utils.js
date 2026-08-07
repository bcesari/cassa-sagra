function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function capitalizza(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Da un elenco di piatti (Api.piattiResponsabili) a opzioni per un <select>:
// più piatti con lo stesso gruppo (es. sagne bianche/rosse) diventano una
// sola voce ("Sagne"), gli altri restano singoli. Usata sia dal menu di
// login "Responsabile Piatto" (view-login.js) sia dal selettore "a chi
// segnalare" in cassa (view-cassa.js) — stesso identico raggruppamento,
// perché entrambi devono produrre un identificativo che il server accetta
// come piatto_id o come "gruppo:<nome>".
function opzioniResponsabili(piatti) {
  const gruppiVisti = new Set();
  const opzioni = [];
  (piatti || []).forEach((p) => {
    if (p.gruppo) {
      if (gruppiVisti.has(p.gruppo)) return;
      gruppiVisti.add(p.gruppo);
      opzioni.push({ value: 'gruppo:' + p.gruppo, label: capitalizza(p.gruppo) });
    } else {
      opzioni.push({ value: p.piatto_id, label: p.nome_piatto || p.piatto_id });
    }
  });
  return opzioni;
}

function formatEuro(n) {
  const v = Number(n) || 0;
  return '€ ' + v.toFixed(2).replace('.', ',');
}

function formatOra(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function formatData(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Conferma con overlay personalizzato invece di window.confirm (mai usato in
// questa app): stesso pattern del selettore icone in view-listino.js
// (apriSelettoreEmoji), qui generalizzato per un semplice sì/no. Promise che
// risolve true/false in base al bottone premuto. testoConferma/testoAnnulla
// opzionali (default invariati) per riusarla con etichette diverse, es.
// "Sì"/"No" per l'annullo vendita in cassa.
function confermaAzione(messaggio, testoConferma, testoAnnulla) {
  return new Promise((resolve) => {
    const overlay = el('div', { class: 'overlay-conferma' });

    function chiudi(esito) {
      overlay.remove();
      document.removeEventListener('keydown', onEsc);
      resolve(esito);
    }
    function onEsc(e) {
      if (e.key === 'Escape') chiudi(false);
    }

    const pannello = el('div', { class: 'pannello-conferma' }, [
      el('p', {}, [messaggio]),
      el('div', { class: 'pannello-conferma-azioni' }, [
        el('button', { type: 'button', class: 'bottone-secondario', onclick: () => chiudi(false) }, [testoAnnulla || 'Annulla']),
        el('button', { type: 'button', class: 'bottone-primario', onclick: () => chiudi(true) }, [testoConferma || 'Conferma'])
      ])
    ]);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) chiudi(false); });
    document.addEventListener('keydown', onEsc);
    overlay.appendChild(pannello);
    document.body.appendChild(overlay);
  });
}

// Selettore modale generico (titolo + elenco di scelte), stesso pattern di
// apriSelettoreEmoji/confermaAzione: qui non un <select> nativo perché
// l'attributo hidden su <option> — usato per nascondere un segnaposto
// dall'elenco — non funziona su Safari/Chrome iOS (bug noto della
// piattaforma, verificato dal vivo): il segnaposto ricompariva sempre nel
// menu. Un pannello disegnato a mano non ha questo limite, su nessun
// browser. `opzioni` è un elenco di {value, label}; `onScegli` riceve
// l'opzione intera scelta.
function apriSelettoreLista(titolo, opzioni, onScegli) {
  const overlay = el('div', { class: 'overlay-emoji' });

  function chiudi() {
    overlay.remove();
    document.removeEventListener('keydown', onEsc);
  }
  function onEsc(e) {
    if (e.key === 'Escape') chiudi();
  }
  function scegli(opzione) {
    onScegli(opzione);
    chiudi();
  }

  const pannello = el('div', { class: 'pannello-selettore' }, [
    el('div', { class: 'pannello-emoji-testa' }, [
      el('strong', {}, [titolo]),
      el('button', { type: 'button', class: 'bottone-link', onclick: chiudi }, ['Chiudi'])
    ]),
    el('div', { class: 'lista-selettore' }, opzioni.map((o) => el('button', {
      type: 'button', class: 'voce-selettore', onclick: () => scegli(o)
    }, [o.label])))
  ]);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) chiudi(); });
  document.addEventListener('keydown', onEsc);
  overlay.appendChild(pannello);
  document.body.appendChild(overlay);
}

// L'icona di un piatto è una stringa nel foglio: o un'emoji (caso normale) o il
// nome di un file dentro frontend/icons/piatti/ (le icone disegnate per la
// sagra). Il file non viaggia mai nelle risposte dell'API — nel foglio e nella
// risposta di bootstrap resta solo il nome, una decina di byte — e arriva dalla
// cache del service worker come gli altri file statici: scaricato una volta per
// dispositivo, mai più richiesto durante il servizio.
const ESTENSIONI_ICONA = ['.svg', '.webp', '.png'];
const ICONA_FALLBACK = '🍽️';

function eFileIcona(valore) {
  const v = String(valore || '').trim().toLowerCase();
  return ESTENSIONI_ICONA.some((ext) => v.endsWith(ext));
}

// Se il file mancasse (nome sbagliato nel listino, icona non ancora pubblicata)
// un'immagine rotta lascerebbe la cassa senza riferimento visivo: meglio
// ricadere sull'emoji generica.
function nodoIcona(valore, classe) {
  const v = String(valore || '').trim();
  if (!eFileIcona(v)) return el('span', { class: classe }, [v || ICONA_FALLBACK]);

  const img = el('img', {
    class: `${classe} icona-file`,
    src: `./icons/piatti/${v}`,
    alt: '',
    decoding: 'async'
  });
  img.addEventListener('error', () => {
    img.replaceWith(el('span', { class: classe }, [ICONA_FALLBACK]));
  });
  return img;
}

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  (children || []).forEach((c) => {
    if (c === null || c === undefined) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

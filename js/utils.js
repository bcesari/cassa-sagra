function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function formatEuro(n) {
  const v = Number(n) || 0;
  return '€ ' + v.toFixed(2).replace('.', ',');
}

function formatOra(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
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

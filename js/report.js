// Report PDF di fine serata per il tesoriere: numeri + grafici, generato
// interamente sul client (nessun endpoint dedicato oltre a reportServata, che
// restituisce solo dati — mai un PDF dal server). Grafici disegnati a mano su
// <canvas> (nessuna libreria di charting, coerente con l'assenza di
// dipendenze pesanti nel resto del progetto) e composti con jsPDF (unica
// libreria vendorizzata, frontend/js/vendor/jspdf.umd.min.js).
//
// Colori validati con la skill dataviz (scripts/validate_palette.js) prima di
// essere confermati:
// - --colore-primario (#a31f1f) per i grafici a una sola serie e per "atteso".
// - #a67c00 (oro scuro, non --colore-accento: quello è troppo chiaro per
//   reggere come colore di primo piano, fallisce il controllo di contrasto)
//   per "contato" nel grafico casse — CVD-safe contro il rosso (ΔE 14.5).
// - #0277bd (blu, non verde: un verde qualsiasi fallisce il controllo CVD
//   contro il rosso già in uso per gli errori, ΔE troppo basso) per lo stato
//   "in pareggio", sempre con icona + testo, mai il colore da solo.
const Report = (function () {
  const COLORE_PRIMARIO = '#a31f1f';
  const COLORE_CONTATO = '#a67c00';
  const COLORE_SUCCESSO = '#0277bd';
  const COLORE_ERRORE = '#c62828';
  const COLORE_GRIGLIA = '#e0e0e0';
  const COLORE_TESTO = '#333333';

  function hexRgb(hex) {
    const v = hex.replace('#', '');
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  }

  // Icona di stato disegnata a vettore (cerchio pieno / croce), non un
  // carattere Unicode: i font base di jsPDF (WinAnsi) non hanno ✓/✕ — con quei
  // caratteri il PDF mostra glifi rotti invece dell'icona (visto in verifica).
  // Un pallino non basterebbe da solo (skill dataviz: mai il colore da solo),
  // quindi la forma stessa cambia fra i due stati, non solo il colore.
  function disegnaBollinoStato(doc, x, y, ok) {
    const cy = y - 3;
    if (ok) {
      doc.setFillColor(...hexRgb(COLORE_SUCCESSO));
      doc.circle(x + 3, cy, 3, 'F');
    } else {
      doc.setDrawColor(...hexRgb(COLORE_ERRORE));
      doc.setLineWidth(1.3);
      doc.line(x, cy - 3, x + 6, cy + 3);
      doc.line(x, cy + 3, x + 6, cy - 3);
    }
  }

  function creaCanvas(wCss, hCss) {
    // 1.5x, non 2x: a scala 2 i tre grafici insieme producevano un PDF da
    // 3,6 MB (troppo pesante per essere condiviso via WhatsApp/email a fine
    // serata) senza guadagno percepibile di nitidezza alla dimensione a cui i
    // grafici vengono poi mostrati nel PDF.
    const scala = 1.5;
    const canvas = document.createElement('canvas');
    canvas.width = wCss * scala;
    canvas.height = hCss * scala;
    const ctx = canvas.getContext('2d');
    ctx.scale(scala, scala);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, wCss, hCss);
    return { canvas, ctx, w: wCss, h: hCss };
  }

  // Grafico a linee/area, una sola serie (andamento vendite nel tempo).
  function disegnaAndamento(punti) {
    const { canvas, ctx, w, h } = creaCanvas(480, 200);
    const margine = { sopra: 16, sotto: 28, sinistra: 8, destra: 8 };
    const areaW = w - margine.sinistra - margine.destra;
    const areaH = h - margine.sopra - margine.sotto;

    if (punti.length === 0) {
      ctx.fillStyle = '#888';
      ctx.font = '13px sans-serif';
      ctx.fillText('Nessuna vendita registrata', margine.sinistra, h / 2);
      return canvas.toDataURL('image/jpeg', 0.9);
    }

    const massimo = Math.max(...punti.map((p) => p.totale), 1);
    const x = (i) => margine.sinistra + (areaW * i) / Math.max(punti.length - 1, 1);
    const y = (v) => margine.sopra + areaH - (areaH * v) / massimo;

    // Griglia orizzontale recessiva, 3 linee.
    ctx.strokeStyle = COLORE_GRIGLIA;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 2; i++) {
      const yy = margine.sopra + (areaH * i) / 2;
      ctx.beginPath();
      ctx.moveTo(margine.sinistra, yy);
      ctx.lineTo(w - margine.destra, yy);
      ctx.stroke();
    }

    // Area sotto la linea, tinta leggera.
    const [r, g, b] = hexRgb(COLORE_PRIMARIO);
    ctx.beginPath();
    ctx.moveTo(x(0), margine.sopra + areaH);
    punti.forEach((p, i) => ctx.lineTo(x(i), y(p.totale)));
    ctx.lineTo(x(punti.length - 1), margine.sopra + areaH);
    ctx.closePath();
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.12)`;
    ctx.fill();

    // Linea, 2px, estremi arrotondati.
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = COLORE_PRIMARIO;
    punti.forEach((p, i) => (i === 0 ? ctx.moveTo(x(i), y(p.totale)) : ctx.lineTo(x(i), y(p.totale))));
    ctx.stroke();

    // Etichetta diretta solo sul picco: su una serie temporale fitta,
    // un numero per punto sarebbe illeggibile.
    const indicePicco = punti.reduce((migliore, p, i) => (p.totale > punti[migliore].totale ? i : migliore), 0);
    ctx.fillStyle = COLORE_PRIMARIO;
    ctx.beginPath();
    ctx.arc(x(indicePicco), y(punti[indicePicco].totale), 4, 0, Math.PI * 2);
    ctx.fill();

    // Sfondo bianco pieno dietro l'etichetta: senza, il testo sopra la linea
    // rossa e il riempimento tinto perdeva leggibilità con la compressione
    // JPEG (verificato in anteprima). Posizione bloccata dentro i margini del
    // canvas così non esce di lato quando il picco è l'ultimo punto.
    const testoLabel = '€ ' + punti[indicePicco].totale.toFixed(0);
    ctx.font = 'bold 13px sans-serif';
    const largLabel = ctx.measureText(testoLabel).width;
    const xLabel = Math.min(Math.max(x(indicePicco) - largLabel / 2, margine.sinistra), w - margine.destra - largLabel);
    const yLabel = y(punti[indicePicco].totale) - 12;
    ctx.fillStyle = '#ffffff';
    disegnaRettangoloArrotondato(ctx, xLabel - 4, yLabel - 13, largLabel + 8, 17, 3);
    ctx.fillStyle = COLORE_PRIMARIO;
    ctx.fillText(testoLabel, xLabel, yLabel);

    // Etichette orario: prima, centrale, ultima fascia.
    ctx.fillStyle = COLORE_TESTO;
    ctx.font = '11px sans-serif';
    [0, Math.floor((punti.length - 1) / 2), punti.length - 1].forEach((i) => {
      const testo = formatOra(punti[i].fascia_inizio_iso);
      ctx.fillText(testo, Math.min(Math.max(x(i) - 14, 0), w - 40), h - 8);
    });

    return canvas.toDataURL('image/jpeg', 0.9);
  }

  // Barre orizzontali, una sola serie (piatti più venduti): i nomi restano
  // leggibili senza dover ruotare il testo.
  function disegnaPiatti(voci) {
    const altezzaRiga = 22;
    const h = Math.max(voci.length * altezzaRiga + 16, 60);
    const w = 480;
    const { canvas, ctx } = creaCanvas(w, h);
    if (voci.length === 0) {
      ctx.fillStyle = '#888';
      ctx.font = '13px sans-serif';
      ctx.fillText('Nessuna vendita registrata', 8, h / 2);
      return canvas.toDataURL('image/jpeg', 0.9);
    }

    const etichettaW = 130;
    const barraMaxW = w - etichettaW - 50;
    const massimo = Math.max(...voci.map((v) => v.quantita), 1);

    ctx.font = '12px sans-serif';
    voci.forEach((v, i) => {
      const yy = 8 + i * altezzaRiga;
      const barraW = (barraMaxW * v.quantita) / massimo;

      ctx.fillStyle = COLORE_TESTO;
      ctx.textAlign = 'right';
      ctx.fillText(tronca(v.nome_piatto, 20), etichettaW - 8, yy + 14);

      ctx.fillStyle = COLORE_PRIMARIO;
      disegnaRettangoloArrotondato(ctx, etichettaW, yy + 4, Math.max(barraW, 2), 14, 4);

      ctx.fillStyle = COLORE_TESTO;
      ctx.textAlign = 'left';
      ctx.fillText(String(v.quantita), etichettaW + barraW + 6, yy + 14);
    });
    ctx.textAlign = 'left';

    return canvas.toDataURL('image/jpeg', 0.9);
  }

  // Barre raggruppate, due serie (incasso atteso / contante contato) per
  // cassa: due misure diverse sulla stessa scala (€), niente doppio asse.
  function disegnaCasse(casse) {
    const w = 480;
    const h = 220;
    const { canvas, ctx } = creaCanvas(w, h);
    const margine = { sopra: 12, sotto: 40, sinistra: 8, destra: 8 };
    const areaW = w - margine.sinistra - margine.destra;
    const areaH = h - margine.sopra - margine.sotto;

    const massimo = Math.max(...casse.flatMap((c) => [c.incasso_atteso, c.contante_contato || 0]), 1);
    const gruppoW = areaW / casse.length;
    const barraW = Math.min(gruppoW * 0.32, 44);

    casse.forEach((c, i) => {
      const centroX = margine.sinistra + gruppoW * i + gruppoW / 2;
      const xAtteso = centroX - barraW - 3;
      const xContato = centroX + 3;

      const hAtteso = (areaH * c.incasso_atteso) / massimo;
      ctx.fillStyle = COLORE_PRIMARIO;
      disegnaRettangoloArrotondato(ctx, xAtteso, margine.sopra + areaH - hAtteso, barraW, hAtteso, 3);
      ctx.fillStyle = COLORE_TESTO;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('€' + c.incasso_atteso.toFixed(0), xAtteso + barraW / 2, margine.sopra + areaH - hAtteso - 4);

      if (c.contante_contato !== null) {
        const hContato = (areaH * c.contante_contato) / massimo;
        ctx.fillStyle = COLORE_CONTATO;
        disegnaRettangoloArrotondato(ctx, xContato, margine.sopra + areaH - hContato, barraW, hContato, 3);
        ctx.fillStyle = COLORE_TESTO;
        ctx.fillText('€' + c.contante_contato.toFixed(0), xContato + barraW / 2, margine.sopra + areaH - hContato - 4);
      } else {
        ctx.fillStyle = '#999';
        ctx.font = 'italic 9px sans-serif';
        ctx.fillText('non chiusa', xContato + barraW / 2, margine.sopra + areaH - 4);
      }

      ctx.fillStyle = COLORE_TESTO;
      ctx.font = '11px sans-serif';
      ctx.fillText(c.nome_visualizzato, centroX, h - margine.sotto + 16);
    });
    ctx.textAlign = 'left';

    // Legenda: sempre presente con ≥2 serie.
    ctx.font = '11px sans-serif';
    disegnaRettangoloArrotondato(ctx, margine.sinistra, h - 14, 10, 10, 2, COLORE_PRIMARIO);
    ctx.fillStyle = COLORE_TESTO;
    ctx.fillText('Atteso', margine.sinistra + 14, h - 5);
    disegnaRettangoloArrotondato(ctx, margine.sinistra + 70, h - 14, 10, 10, 2, COLORE_CONTATO);
    ctx.fillText('Contato', margine.sinistra + 84, h - 5);

    return canvas.toDataURL('image/jpeg', 0.9);
  }

  function disegnaRettangoloArrotondato(ctx, x, y, w, h, raggio, colore) {
    if (colore) ctx.fillStyle = colore;
    const r = Math.min(raggio, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  function tronca(s, n) {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  async function generaPdf(dati, edizione) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margineX = 40;
    let y = 50;

    doc.setFontSize(18);
    doc.setTextColor(COLORE_PRIMARIO);
    doc.text('Report di fine serata', margineX, y);
    y += 20;
    doc.setFontSize(11);
    doc.setTextColor(COLORE_TESTO);
    doc.text(`${edizione.nome} — ${formatData(new Date().toISOString())}`, margineX, y);
    y += 28;

    // Riquadri KPI, 3 per riga.
    const kpi = [
      ['Totale serata', formatEuro(dati.totale_generale)],
      ['Presenze stimate', `~ ${dati.presenze_stimate}`],
      ['N. ordini', String(dati.per_cassa.reduce((s, c) => s + c.n_ordini, 0))],
      ['Media per ordine', formatEuro(dati.media_per_ordine)],
      ['Media per persona', formatEuro(dati.media_per_persona)],
      ['Picco 30 min', dati.picco ? formatEuro(dati.picco.importo) : '—']
    ];
    const kpiW = (595 - margineX * 2 - 20) / 3;
    kpi.forEach((k, i) => {
      const col = i % 3;
      const riga = Math.floor(i / 3);
      const x = margineX + col * (kpiW + 10);
      const yy = y + riga * 56;
      doc.setDrawColor(224, 224, 224);
      doc.roundedRect(x, yy, kpiW, 46, 4, 4);
      doc.setFontSize(9);
      doc.setTextColor('#777777');
      doc.text(k[0], x + 8, yy + 16);
      doc.setFontSize(14);
      doc.setTextColor(COLORE_PRIMARIO);
      doc.text(k[1], x + 8, yy + 34);
    });
    y += 56 * 2 + 20;

    doc.setFontSize(13);
    doc.setTextColor(COLORE_TESTO);
    doc.text('Andamento vendite', margineX, y);
    y += 10;
    doc.addImage(disegnaAndamento(dati.serie_temporale), 'JPEG', margineX, y, 515, 200 * (515 / 480));
    y += 200 * (515 / 480) + 24;

    doc.setFontSize(13);
    doc.text('Piatti più venduti', margineX, y);
    y += 10;
    const piattiOrdinati = dati.per_piatto.slice().sort((a, b) => b.quantita - a.quantita);
    const altezzaPiatti = Math.max(piattiOrdinati.length * 22 + 16, 60) * (515 / 480);
    doc.addImage(disegnaPiatti(piattiOrdinati), 'JPEG', margineX, y, 515, altezzaPiatti);

    // Pagina 2: riscontro cassa.
    doc.addPage();
    y = 50;
    doc.setFontSize(16);
    doc.setTextColor(COLORE_PRIMARIO);
    doc.text('Riscontro cassa', margineX, y);
    y += 24;

    doc.addImage(disegnaCasse(dati.casse), 'JPEG', margineX, y, 515, 220 * (515 / 480));
    y += 220 * (515 / 480) + 24;

    disegnaTabellaChiusura(doc, dati.casse, margineX, y);

    const nomeFile = `report-sagra-${edizione.edizione_id}-${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(nomeFile);
  }

  function disegnaTabellaChiusura(doc, casse, x, y) {
    doc.setFontSize(13);
    doc.setTextColor(COLORE_TESTO);
    doc.text('Chiusura per cassa', x, y);
    y += 14;

    const colonne = ['Cassa', 'Apertura', 'Chiusura', 'Fondo', 'Atteso', 'Contato', 'Differenza'];
    // Cassa allargata (era 70pt: "Cassa 1 Mirko"/"Cassa 4 Emanuele" ci
    // sovrapponevano sopra la colonna "Apertura" — nomi più lunghi delle
    // vecchie "Cassa 1"..."Cassa 4"), resto ridistribuito per restare a 515pt.
    const larghezze = [115, 55, 55, 50, 60, 60, 120];
    doc.setFontSize(9);
    doc.setTextColor('#777777');
    let cx = x;
    colonne.forEach((c, i) => { doc.text(c, cx, y); cx += larghezze[i]; });
    y += 6;
    doc.setDrawColor(224, 224, 224);
    doc.line(x, y, x + larghezze.reduce((s, w) => s + w, 0), y);
    y += 14;

    casse.forEach((c) => {
      cx = x;
      doc.setFontSize(10);
      doc.setTextColor(COLORE_TESTO);
      const valori = [
        tronca(c.nome_visualizzato, 18),
        c.orario_apertura ? formatOra(c.orario_apertura) : '—',
        c.orario_chiusura ? formatOra(c.orario_chiusura) : '—',
        formatEuro(c.fondo_iniziale || 0),
        formatEuro(c.incasso_atteso),
        c.contante_contato !== null ? formatEuro(c.contante_contato) : '—'
      ];
      valori.forEach((v, i) => { doc.text(v, cx, y); cx += larghezze[i]; });

      // Colonna differenza: icona + testo, mai solo colore (skill dataviz).
      if (c.differenza === null) {
        doc.setTextColor('#999999');
        doc.text('cassa non chiusa', cx, y);
      } else if (Math.abs(c.differenza) < 0.01) {
        disegnaBollinoStato(doc, cx, y, true);
        doc.setTextColor(COLORE_SUCCESSO);
        doc.text('in pareggio', cx + 10, y);
      } else {
        disegnaBollinoStato(doc, cx, y, false);
        doc.setTextColor(COLORE_ERRORE);
        const segno = c.differenza > 0 ? '+' : '';
        doc.text(`scarto ${segno}${formatEuro(c.differenza)}`, cx + 10, y);
      }
      y += 18;
    });

    doc.setTextColor(COLORE_TESTO);
    return y;
  }

  // Usata solo nel report per singola cassa (generaPdfCassa): niente colonna
  // "Cassa", il nome è già nel titolo del documento. "Consegnati" è
  // puramente informativo — lo scostamento resta contati vs vendite app,
  // stesso controllo incrociato con la matrice già validato in produzione.
  function disegnaTabellaTicket(doc, righe, x, y) {
    doc.setFontSize(13);
    doc.setTextColor(COLORE_TESTO);
    doc.text('Riscontro ticket per piatto (controllo incrociato con la matrice)', x, y);
    y += 14;

    const colonne = ['Piatto', 'Consegnati', 'Contati', 'Vendite app', 'Scostamento'];
    const larghezze = [150, 80, 80, 90, 115];
    doc.setFontSize(9);
    doc.setTextColor('#777777');
    let cx = x;
    colonne.forEach((c, i) => { doc.text(c, cx, y); cx += larghezze[i]; });
    y += 6;
    doc.setDrawColor(224, 224, 224);
    doc.line(x, y, x + larghezze.reduce((s, w) => s + w, 0), y);
    y += 14;

    righe.forEach((r) => {
      if (y > 780) { doc.addPage(); y = 50; }
      cx = x;
      doc.setFontSize(10);
      doc.setTextColor(COLORE_TESTO);
      [r.nome_piatto, String(r.ticket_consegnati), String(r.ticket_contati), String(r.quantita_app)].forEach((v, i) => {
        doc.text(v, cx, y);
        cx += larghezze[i];
      });
      if (r.differenza === 0) {
        disegnaBollinoStato(doc, cx, y, true);
        doc.setTextColor(COLORE_SUCCESSO);
        doc.text('combacia', cx + 10, y);
      } else {
        disegnaBollinoStato(doc, cx, y, false);
        doc.setTextColor(COLORE_ERRORE);
        doc.text(`${r.differenza > 0 ? '+' : ''}${r.differenza}`, cx + 10, y);
      }
      y += 16;
    });

    doc.setTextColor(COLORE_TESTO);
    return y;
  }

  // Atteso / Contanti effettivi / Riscontro contabile / Persone servite:
  // stessi campi già calcolati da getReportServata (worker-d1/src/chiusura.js),
  // nessun nuovo calcolo qui. Stesso criterio "in pareggio"/"scarto ±€" e
  // stesso bollino vettoriale già usati in disegnaTabellaChiusura.
  function disegnaRiepilogoCassa(doc, datiCassa, x, y) {
    const xValore = x + 220;
    const righe = [
      ['Atteso (fondo + vendite app)', formatEuro(datiCassa.incasso_atteso)],
      ['Contanti effettivi', datiCassa.contante_contato !== null ? formatEuro(datiCassa.contante_contato) : '—'],
      ['Persone servite', String(datiCassa.persone_servite)]
    ];
    doc.setFontSize(11);
    righe.forEach(([label, valore]) => {
      doc.setTextColor('#777777');
      doc.text(label, x, y);
      doc.setTextColor(COLORE_TESTO);
      doc.text(valore, xValore, y);
      y += 20;
    });

    doc.setTextColor('#777777');
    doc.text('Riscontro contabile', x, y);
    if (datiCassa.differenza === null) {
      doc.setTextColor('#999999');
      doc.text('cassa non chiusa', xValore, y);
    } else if (Math.abs(datiCassa.differenza) < 0.01) {
      disegnaBollinoStato(doc, xValore, y, true);
      doc.setTextColor(COLORE_SUCCESSO);
      doc.text('in pareggio', xValore + 10, y);
    } else {
      disegnaBollinoStato(doc, xValore, y, false);
      doc.setTextColor(COLORE_ERRORE);
      const segno = datiCassa.differenza > 0 ? '+' : '';
      doc.text(`scarto ${segno}${formatEuro(datiCassa.differenza)}`, xValore + 10, y);
    }
    y += 28;

    doc.setTextColor(COLORE_TESTO);
    return y;
  }

  // PDF per singola cassa, generabile al momento della chiusura: riepilogo
  // finanziario + riscontro ticket per piatto, entrambi su un documento a
  // parte con solo i dati di quella cassa.
  function generaPdfCassa(nomeCassa, datiCassa, righeTicket) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margineX = 40;
    let y = 50;
    doc.setFontSize(16);
    doc.setTextColor(COLORE_PRIMARIO);
    doc.text(`Report cassa — ${nomeCassa}`, margineX, y);
    y += 30;
    y = disegnaRiepilogoCassa(doc, datiCassa, margineX, y);
    if (righeTicket.length > 0) {
      disegnaTabellaTicket(doc, righeTicket, margineX, y);
    }
    const slug = nomeCassa.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    doc.save(`report-cassa-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return { generaPdf, generaPdfCassa };
})();

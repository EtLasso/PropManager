// ═══════════════════════════════════════════════════
// UTILS — Hilfsfunktionen (keine externen Abhängigkeiten)
// ═══════════════════════════════════════════════════

export function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function fmtEur(v) {
  return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',minimumFractionDigits:0,maximumFractionDigits:0}).format(parseFloat(v)||0);
}

export function fmtDate(d) {
  if (!d) return '–';
  try { return new Date(d).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}); }
  catch(e) { return d; }
}

export function fmtDateTime(d) {
  if (!d) return '–';
  try { return new Date(d).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
  catch(e) { return d; }
}

export function evClass(t) { return t==='eigentümerversammlung'?'ev-cyan':t==='wartung'?'ev-gold':'ev-green'; }
export function evTag(t)   { return t==='eigentümerversammlung'?'tag-blue':t==='wartung'?'tag-gold':'tag-green'; }
export function evLabel(t) { return {eigentümerversammlung:'EIGENTÜMER',wartung:'WARTUNG',besichtigung:'BESICHTIGUNG',sonstiges:'TERMIN'}[t]||'TERMIN'; }

export function noDaten(msg='Keine Daten vorhanden.') {
  return `<p style="color:var(--text3);font-size:12px;padding:8px 0">${msg}</p>`;
}

let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.innerHTML = '<span style="color:var(--green2)">✓</span> ' + msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

export function buildingMini(p) {
  const floors   = Math.min(p.anzahl_etagen || 4, 7);
  const totalWE  = p.stats?.total || 4;
  const occupied = p.stats?.occupied || 0;
  const W = 160, H = 100, GROUND = H - 8;
  const bldgW = Math.min(100 + floors * 4, 130);
  const bldgH = floors * 12 + 10;
  const bldgX = (W - bldgW) / 2;
  const bldgY = GROUND - bldgH;
  let wins = '', floors_lines = '';
  for (let f = 0; f < floors; f++) {
    const fy = bldgY + bldgH - (f + 1) * (bldgH / floors);
    const wCount = Math.min(Math.ceil(totalWE / floors), 4);
    for (let w = 0; w < wCount; w++) {
      const isOcc = (f * wCount + w) < occupied;
      const wx = bldgX + 6 + w * ((bldgW - 12) / wCount);
      wins += `<rect x="${wx.toFixed(1)}" y="${(fy + 2).toFixed(1)}" width="${((bldgW - 12) / wCount - 3).toFixed(1)}" height="6" rx="1" fill="${isOcc ? 'rgba(255,220,80,0.7)' : 'rgba(255,255,255,0.08)'}"/>`;
    }
    if (f > 0) floors_lines += `<line x1="${bldgX}" y1="${fy.toFixed(1)}" x2="${(bldgX + bldgW).toFixed(1)}" y2="${fy.toFixed(1)}" stroke="rgba(255,255,255,0.06)" stroke-width="0.5"/>`;
  }
  const roofH = 10;
  const roof = `<polygon points="${bldgX},${bldgY} ${bldgX + bldgW / 2},${bldgY - roofH} ${bldgX + bldgW},${bldgY}" fill="rgba(180,83,9,0.4)" stroke="rgba(217,119,6,0.3)" stroke-width="0.5"/>`;
  const stars = Array.from({length:8},(_,i)=>`<circle cx="${(15+i*18).toFixed(0)}" cy="${(5+Math.random()*18).toFixed(0)}" r="0.8" fill="rgba(255,255,255,${(0.3+Math.random()*0.5).toFixed(2)})"/>`).join('');
  const id = p.id || Math.random();
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block">
    <defs>
      <linearGradient id="gs${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(15,23,42,0.95)"/>
        <stop offset="100%" stop-color="rgba(30,15,5,0.98)"/>
      </linearGradient>
      <linearGradient id="gb${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(55,65,81,0.9)"/>
        <stop offset="100%" stop-color="rgba(31,41,55,0.95)"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#gs${id})"/>
    ${stars}
    <circle cx="${W-22}" cy="17" r="9" fill="rgba(255,250,215,0.1)"/>
    <circle cx="${W-19}" cy="15" r="9" fill="rgba(6,5,4,0.98)"/>
    <rect x="${bldgX+6}" y="${bldgY+7}" width="${bldgW}" height="${bldgH}" rx="3" fill="rgba(0,0,0,0.38)"/>
    <rect x="${bldgX}" y="${bldgY}" width="${bldgW}" height="${bldgH}" rx="3" fill="url(#gb${id})" stroke="rgba(255,255,255,0.07)" stroke-width="0.5"/>
    ${floors_lines}
    ${wins}
    ${roof}
    <rect x="${bldgX+bldgW/2-5}" y="${GROUND-10}" width="10" height="10" rx="1" fill="rgba(180,83,9,0.38)" stroke="rgba(217,119,6,0.3)" stroke-width="0.5"/>
    <rect x="0" y="${GROUND}" width="${W}" height="${H-GROUND}" fill="rgba(20,17,11,0.92)"/>
    <line x1="${bldgX-4}" y1="${GROUND}" x2="${bldgX+bldgW+4}" y2="${GROUND}" stroke="rgba(255,220,80,0.06)" stroke-width="1"/>
  </svg>`;
}

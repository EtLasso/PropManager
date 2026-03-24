// ═══════════════════════════════════════════════════
// DIENSTLEISTER
// ═══════════════════════════════════════════════════
import { APP } from './state.js';
import { esc, fmtEur, noDaten, toast } from './utils.js';

export function tmplDienstleister(rows) {
  const katIcons = {handwerker:'🔨',versorgung:'💧',hausmeister:'🏠',versicherung:'🛡️',reinigung:'🧹',winterdienst:'❄️',sicherheit:'🔒',sonstige:'📋'};
  const katLabels = {handwerker:'Handwerker',versorgung:'Versorgung',hausmeister:'Hausmeister',versicherung:'Versicherung',reinigung:'Reinigung',winterdienst:'Winterdienst',sicherheit:'Sicherheit',sonstige:'Sonstige'};
  const kats = [...new Set(rows.map(r=>r.kategorie))];

  window._dlRerender = function() {
    const f = APP.dlFilter;
    const filtered = f ? rows.filter(r=>r.kategorie===f) : rows;
    document.getElementById('dlGrid').innerHTML = renderDLCards(filtered);
    document.getElementById('dlCount').textContent = filtered.length + ' Dienstleister';
    document.querySelectorAll('.dl-filter-btn').forEach(b=>b.classList.toggle('active',b.dataset.kat===(f||'')));
  };

  function renderDLCards(list) {
    return list.map(d=>{
      const liegs = (d.dienstleister_liegenschaften||[]);
      const liegChips = liegs.map(dl=>`<span class="tag tag-blue" style="cursor:pointer" onclick="event.stopPropagation();openProp(${dl.liegenschaft_id})">${esc(dl.liegenschaften?.name||'?')}</span>`).join('');
      return `<div class="contract-card" style="position:relative">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <div style="font-size:26px">${katIcons[d.kategorie]||'📋'}</div>
          <div><div class="cc-name">${esc(d.name)}</div>
            <div style="font-size:10px;font-weight:600;letter-spacing:.5px;color:var(--text3);text-transform:uppercase">${katLabels[d.kategorie]||d.kategorie}</div>
          </div>
        </div>
        ${d.kontaktperson?`<div style="font-size:12px;color:var(--text2)">&#128100; ${esc(d.kontaktperson)}</div>`:''}
        ${d.telefon?`<div style="font-size:12px;color:var(--blue2);font-family:'JetBrains Mono';margin:3px 0">📞 ${esc(d.telefon)}</div>`:''}
        ${d.notfall_nr?`<div style="font-size:11px;color:var(--red);font-family:'JetBrains Mono'">🚨 Notfall: ${esc(d.notfall_nr)}</div>`:''}
        ${liegs.length>0?`<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px">
          <div style="font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--text3);margin-bottom:6px">→ ${liegs.length} Liegenschaft${liegs.length>1?'en':''}</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap">${liegChips}</div>
        </div>`:''}
        <div style="display:flex;gap:6px;margin-top:10px">
          <button class="btn btn-ghost btn-sm" onclick="toast('E-Mail...')">&#9993; E-Mail</button>
          ${d.telefon?`<button class="btn btn-ghost btn-sm" onclick="toast('Anruf: ${esc(d.telefon)}')">&#128222; Anruf</button>`:''}
        </div>
      </div>`;
    }).join('');
  }

  const filtered = APP.dlFilter ? rows.filter(r=>r.kategorie===APP.dlFilter) : rows;
  return `
  <div class="section-header">
    <div class="section-title">Dienstleister &amp; Firmen</div>
    <button class="btn btn-gold btn-sm" onclick="toast('Neuer Dienstleister...')">+ Hinzufügen</button>
  </div>
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
    <button class="btn btn-ghost btn-sm dl-filter-btn ${!APP.dlFilter?'active':''}" data-kat="" onclick="APP.dlFilter='';_dlRerender()">Alle (${rows.length})</button>
    ${kats.map(k=>`<button class="btn btn-ghost btn-sm dl-filter-btn ${APP.dlFilter===k?'active':''}" data-kat="${esc(k)}" onclick="APP.dlFilter='${esc(k)}';_dlRerender()">${katIcons[k]||'📋'} ${katLabels[k]||k} (${rows.filter(r=>r.kategorie===k).length})</button>`).join('')}
  </div>
  <div style="font-size:11px;color:var(--text3);margin-bottom:10px" id="dlCount">${filtered.length} Dienstleister</div>
  <div class="contract-grid" id="dlGrid">${renderDLCards(filtered)}</div>`;
}

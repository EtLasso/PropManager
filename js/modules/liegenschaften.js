// ═══════════════════════════════════════════════════
// LIEGENSCHAFTEN — Übersicht, Detail, CRUD
// ═══════════════════════════════════════════════════
import { APP } from './state.js';
import { esc, fmtEur, fmtDate, noDaten, toast, buildingMini } from './utils.js';
import { getLiegenschaften, getLiegenschaftDetail } from './db.js';

export function tmplLiegenschaften(rows) {
  APP.allLiegs = rows;
  const orte  = [...new Set(rows.map(p=>p.ort))].sort();
  const typen = [...new Set(rows.map(p=>p.verwaltungstyp))];

  function filtered() {
    const s = APP.filters.search.toLowerCase();
    const t = APP.filters.typ;
    const o = APP.filters.ort;
    return rows.filter(p => {
      if (t && p.verwaltungstyp !== t) return false;
      if (o && p.ort !== o) return false;
      if (s) {
        const hay = [p.name,p.strasse,p.plz,p.ort,p.bundesland,p.land,p.verwaltungstyp,String(p.baujahr||'')].join(' ').toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }

  function renderCards(list) {
    if (!list.length) return `<div style="grid-column:1/-1">${noDaten('Keine Liegenschaften gefunden.')}</div>`;
    return list.map(p=>`
      <div class="prop-card" onclick="openProp(${p.id})">
        <div class="prop-visual">
          <div class="prop-sdot"><span class="prop-sdot-txt">AKTIV</span></div>
          <span style="position:absolute;top:10px;right:10px;z-index:2" class="tag tag-blue">${esc(p.verwaltungstyp)}</span>
          ${buildingMini(p)}
        </div>
        <div class="prop-body">
          <div class="prop-name">${esc(p.name)}</div>
          <div class="prop-addr">${esc(p.strasse)}, ${esc(p.plz)} ${esc(p.ort)}</div>
          <div style="font-size:10px;color:var(--text3);font-family:'JetBrains Mono';margin-bottom:8px">${esc(p.bundesland||'')} · ${esc(p.land||'')}</div>
          <div class="prop-row">
            <div class="prop-stat"><strong>${p.stats?.total||0}</strong> WE</div>
            <div class="prop-stat"><strong>${p.stats?.occupied||0}</strong> belegt</div>
            <div class="prop-stat">Bj. <strong>${p.baujahr||'–'}</strong></div>
            <div class="prop-stat"><strong>${fmtEur(p.stats?.total_miete||0)}</strong>/Mt.</div>
          </div>
        </div>
      </div>`).join('');
  }

  window._liegsRerender = function() {
    const q = document.getElementById('liegsSearch').value;
    const t = document.getElementById('liegsTyp').value;
    const o = document.getElementById('liegsOrt').value;
    APP.filters.search = q; APP.filters.typ = t; APP.filters.ort = o;
    const f = filtered();
    document.getElementById('liegsCount').textContent = f.length + ' von ' + rows.length;
    document.getElementById('liegsGrid').innerHTML = renderCards(f);
  };

  const f = filtered();
  return `
  <div class="kpi-grid" id="liegsKpiGrid">
    <div class="kpi-card clickable lieg-kpi" data-typ="" onclick="setLiegsFilter('')">
      <div class="kpi-label">Liegenschaften</div><div class="kpi-value kv-gold">${rows.length}</div>
      <div class="kpi-icon">🏛️</div><div class="kpi-accent-line" style="background:var(--gold2)"></div>
      <div class="kpi-nav-hint">Alle anzeigen</div></div>
    <div class="kpi-card clickable lieg-kpi" data-typ="WEG" onclick="setLiegsFilter('WEG')">
      <div class="kpi-label">WEG</div><div class="kpi-value kv-blue">${rows.filter(p=>p.verwaltungstyp==='WEG').length}</div>
      <div class="kpi-sub">Wohnungseigentum</div><div class="kpi-accent-line" style="background:var(--blue2)"></div>
      <div class="kpi-nav-hint">WEG filtern</div></div>
    <div class="kpi-card clickable lieg-kpi" data-typ="SEV" onclick="setLiegsFilter('SEV')">
      <div class="kpi-label">SEV</div><div class="kpi-value kv-teal">${rows.filter(p=>p.verwaltungstyp==='SEV').length}</div>
      <div class="kpi-sub">Sondereigentum</div><div class="kpi-accent-line" style="background:var(--teal2)"></div>
      <div class="kpi-nav-hint">SEV filtern</div></div>
    <div class="kpi-card">
      <div class="kpi-label">Total WE</div><div class="kpi-value">${rows.reduce((a,p)=>a+(p.stats?.total||0),0)}</div>
      <div class="kpi-sub">${rows.reduce((a,p)=>a+(p.stats?.occupied||0),0)} belegt</div>
      <div class="kpi-accent-line" style="background:var(--border2)"></div></div>
  </div>
  <div class="card" style="margin-bottom:14px;padding:14px 16px">
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <div style="flex:1;min-width:180px;position:relative">
        <span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);font-size:14px;pointer-events:none">🔍</span>
        <input id="liegsSearch" class="form-input" style="padding-left:32px;margin:0" placeholder="Suche: Name, Adresse, PLZ, Ort..." oninput="_liegsRerender()" value="${esc(APP.filters.search)}">
      </div>
      <select id="liegsTyp" class="form-input" style="width:auto;margin:0" onchange="_liegsRerender()">
        <option value="">Alle Typen</option>
        ${typen.map(t=>`<option value="${esc(t)}" ${APP.filters.typ===t?'selected':''}>${esc(t)}</option>`).join('')}
      </select>
      <select id="liegsOrt" class="form-input" style="width:auto;margin:0" onchange="_liegsRerender()">
        <option value="">Alle Orte</option>
        ${orte.map(o=>`<option value="${esc(o)}" ${APP.filters.ort===o?'selected':''}>${esc(o)}</option>`).join('')}
      </select>
      <button class="btn btn-ghost btn-sm" onclick="APP.filters={search:'',typ:'',ort:''};document.getElementById('liegsSearch').value='';document.getElementById('liegsTyp').value='';document.getElementById('liegsOrt').value='';_liegsRerender()">✕ Reset</button>
    </div>
    <div style="font-size:11px;color:var(--text3);margin-top:8px" id="liegsCount">${f.length} von ${rows.length}</div>
  </div>
  <div class="section-header"><div class="section-title">Liegenschaften</div><button class="btn btn-gold btn-sm" onclick="openNeueLiegenschaftModal()">+ Neue Liegenschaft</button></div>
  <div class="prop-grid" id="liegsGrid">${renderCards(f)}</div>`;
}

export function openProp(id) { APP.currentProp = id; window.setActiveNav('liegenschaften'); window.switchView('property-detail'); }

export function setLiegsFilter(typ) {
  APP.filters.typ = typ;
  const sel = document.getElementById('liegsTyp');
  if (sel) sel.value = typ;
  document.querySelectorAll('.lieg-kpi').forEach(el=>el.classList.toggle('lieg-kpi-active',el.dataset.typ===typ));
  if (window._liegsRerender) window._liegsRerender();
}

export function tmplPropDetail(p) {
  const we = p.wohneinheiten || [];
  const totalMiete = we.reduce((a,w)=>a+(parseFloat(w.nettomiete)||0),0);
  const totalNK    = we.reduce((a,w)=>a+(parseFloat(w.nebenkosten)||0),0);
  const vacant     = we.filter(w=>w.status==='vacant').length;
  const floors = {};
  we.forEach(w=>{ const e=w.etage||0; (floors[e]=floors[e]||[]).push(w); });
  const maxFloor = we.length ? Math.max(...we.map(w=>w.etage||0)) : 0;
  let bvRows = '';
  for (let f=maxFloor; f>=0; f--) {
    const fl = floors[f];
    if (!fl?.length) continue;
    const lbl = f===0?'EG':f===maxFloor?`${f}.OG ⊤`:`${f}.OG`;
    const apts = fl.map(a=>`
      <div class="bv-apt bv-${a.status} ${APP.selectedApt?.id==a.id?'selected':''}"
           onclick='selectApt(${JSON.stringify(a).replace(/'/g,"&#39;")})'>
        <div class="an">${esc(a.nummer)}</div><div class="as">${a.flaeche_qm}m²</div>
      </div>`).join('');
    bvRows += `<div class="bv-row"><div class="bv-lbl">${lbl}</div><div class="bv-apts">${apts}</div></div>`;
  }
  const aptPanel = APP.selectedApt
    ? `<div class="dpe"><div class="dpe-icon">🏢</div><div class="dpe-text">Wohnung lädt...</div></div>`
    : `<div class="dpe"><div class="dpe-icon">🏢</div><div class="dpe-text">Wohnung auswählen</div><p style="font-size:11px;color:var(--text3);text-align:center">Klicken Sie auf eine Einheit</p></div>`;
  return `
  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:18px">
    <button class="btn btn-ghost btn-sm" onclick="switchView('liegenschaften')">← Zurück</button>
    <div style="flex:1"><div style="font-family:'Playfair Display';font-size:22px;font-weight:700">${esc(p.name)}</div>
    <div style="font-size:11px;color:var(--text3);font-family:'JetBrains Mono'">${esc(p.strasse)}, ${esc(p.plz)} ${esc(p.ort)}</div></div>
    <span class="tag tag-blue">${esc(p.verwaltungstyp)}</span>
    <span class="tag tag-green">${we.length-vacant}/${we.length} belegt</span>
  </div>
  <div class="kpi-grid" style="margin-bottom:16px">
    <div class="kpi-card"><div class="kpi-label">Nettomiete/Mt.</div><div class="kpi-value kv-green">${fmtEur(totalMiete)}</div><div class="kpi-accent-line" style="background:var(--green2)"></div></div>
    <div class="kpi-card"><div class="kpi-label">Nebenkosten/Mt.</div><div class="kpi-value kv-blue">${fmtEur(totalNK)}</div><div class="kpi-accent-line" style="background:var(--blue2)"></div></div>
    <div class="kpi-card"><div class="kpi-label">Leerstand</div><div class="kpi-value kv-gold">${vacant} WE</div><div class="kpi-accent-line" style="background:var(--gold2)"></div></div>
    <div class="kpi-card"><div class="kpi-label">Baujahr / Fläche</div><div class="kpi-value">${p.baujahr||'–'}</div><div class="kpi-sub">${p.gesamtflaeche||0} m²</div><div class="kpi-accent-line" style="background:var(--border2)"></div></div>
  </div>
  <div class="detail-layout">
    <div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between">🏢 Gebäude-Navigator
        <button class="btn btn-gold btn-sm" onclick="openNeueWohneinheitModal(${p.id})">+ Wohneinheit</button></div>
      <div class="bv-wrap">${bvRows||noDaten('Keine Wohneinheiten.')}</div>
      <div class="bv-legend">
        <div class="bv-li"><div class="bv-dot" style="background:var(--blue4);border-color:#BFDBFE"></div>Vermietet</div>
        <div class="bv-li"><div class="bv-dot" style="background:var(--green3);border-color:#A7F3D0"></div>Leer</div>
        <div class="bv-li"><div class="bv-dot" style="background:var(--gold4);border-color:var(--gold3)"></div>Eigennutz</div>
      </div>
    </div>
    <div class="card" id="aptPanel">${aptPanel}</div>
  </div>`;
}

export function openNeueLiegenschaftModal() {
  document.getElementById('modalTitle').textContent = '🏢 Neue Liegenschaft';
  document.getElementById('modalBody').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="grid-column:1/-1"><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Name / Bezeichnung *</div>
          <input id="nlName" class="form-input" style="margin:0" placeholder="z.B. Wohnanlage Hauptstraße"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Straße + Nr. *</div>
          <input id="nlStrasse" class="form-input" style="margin:0" placeholder="Hauptstraße 12"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">PLZ *</div>
          <input id="nlPlz" class="form-input" style="margin:0" placeholder="1010"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Ort *</div>
          <input id="nlOrt" class="form-input" style="margin:0" placeholder="Wien"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Land</div>
          <input id="nlLand" class="form-input" style="margin:0" value="Österreich"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Bundesland</div>
          <input id="nlBundesland" class="form-input" style="margin:0" placeholder="Wien"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Verwaltungstyp</div>
          <select id="nlTyp" class="form-input" style="margin:0">
            <option value="WEG">WEG (Wohnungseigentum)</option>
            <option value="SEV">SEV (Sondereigentumsverwaltung)</option>
            <option value="MV">MV (Mietverwaltung)</option>
            <option value="GV">GV (Gesamtverwaltung)</option>
          </select></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Baujahr</div>
          <input id="nlBaujahr" type="number" class="form-input" style="margin:0" placeholder="1990"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Gesamtfläche m²</div>
          <input id="nlFlaeche" type="number" class="form-input" style="margin:0" placeholder="800"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Grundbuch-Nr.</div>
          <input id="nlGrundbuch" class="form-input" style="margin:0" placeholder="EZ 123"></div>
        <div style="grid-column:1/-1"><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Notiz</div>
          <textarea id="nlNotiz" class="form-input" rows="2" style="margin:0;resize:vertical" placeholder="Interne Notizen..."></textarea></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-gold" onclick="saveNeueLiegenschaft()">💾 Liegenschaft anlegen</button>
        <button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>
      </div>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

export async function saveNeueLiegenschaft() {
  const db = window.db;
  const name       = document.getElementById('nlName')?.value?.trim();
  const strasse    = document.getElementById('nlStrasse')?.value?.trim();
  const plz        = document.getElementById('nlPlz')?.value?.trim();
  const ort        = document.getElementById('nlOrt')?.value?.trim();
  const land       = document.getElementById('nlLand')?.value?.trim();
  const bundesland = document.getElementById('nlBundesland')?.value?.trim();
  const typ        = document.getElementById('nlTyp')?.value;
  const baujahr    = parseInt(document.getElementById('nlBaujahr')?.value)||null;
  const flaeche    = parseFloat(document.getElementById('nlFlaeche')?.value)||null;
  const grundbuch  = document.getElementById('nlGrundbuch')?.value?.trim();
  const notiz      = document.getElementById('nlNotiz')?.value?.trim();
  if (!name||!strasse||!plz||!ort) { toast('⚠️ Name, Straße, PLZ und Ort sind Pflicht'); return; }
  const { error } = await db.from('liegenschaften').insert({
    name, strasse, plz, ort, land:land||'Österreich', bundesland:bundesland||null,
    verwaltungstyp:typ||'WEG', baujahr, gesamtflaeche:flaeche,
    grundbuch_nr:grundbuch||null, notiz:notiz||null
  }).select().single();
  if (error) { toast('❌ '+error.message); return; }
  window.closeModal();
  toast('✓ Liegenschaft "'+name+'" angelegt!');
  APP.allLiegs = await getLiegenschaften();
  window.switchView('liegenschaften');
}

export function openNeueWohneinheitModal(liegenschaftId) {
  document.getElementById('modalTitle').textContent = '🚪 Neue Wohneinheit';
  document.getElementById('modalBody').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Nummer / Bezeichnung *</div>
          <input id="nwNummer" class="form-input" style="margin:0" placeholder="z.B. Top 1, A01"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Etage</div>
          <input id="nwEtage" type="number" class="form-input" style="margin:0" placeholder="0 = EG"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Typ</div>
          <select id="nwTyp" class="form-input" style="margin:0">
            <option value="wohnung">Wohnung</option><option value="gewerbe">Gewerbe</option>
            <option value="garage">Garage/Stellplatz</option><option value="keller">Keller/Lager</option>
          </select></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Fläche m²</div>
          <input id="nwFlaeche" type="number" class="form-input" style="margin:0" placeholder="65"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Status</div>
          <select id="nwStatus" class="form-input" style="margin:0">
            <option value="vacant">Leer</option><option value="occupied">Vermietet</option><option value="owner">Eigennutz</option>
          </select></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Nettomiete €/Mt.</div>
          <input id="nwNetto" type="number" class="form-input" style="margin:0" placeholder="0"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">NK-Vorauszahlung €/Mt.</div>
          <input id="nwNK" type="number" class="form-input" style="margin:0" placeholder="0"></div>
        <div style="grid-column:1/-1"><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Notiz</div>
          <textarea id="nwNotiz" class="form-input" rows="2" style="margin:0;resize:vertical"></textarea></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-gold" onclick="saveNeueWohneinheit(${liegenschaftId})">💾 Wohneinheit anlegen</button>
        <button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>
      </div>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

export async function saveNeueWohneinheit(liegenschaftId) {
  const db = window.db;
  const nummer  = document.getElementById('nwNummer')?.value?.trim();
  const etage   = parseInt(document.getElementById('nwEtage')?.value)||0;
  const typ     = document.getElementById('nwTyp')?.value||'wohnung';
  const flaeche = parseFloat(document.getElementById('nwFlaeche')?.value)||null;
  const status  = document.getElementById('nwStatus')?.value||'vacant';
  const netto   = parseFloat(document.getElementById('nwNetto')?.value)||0;
  const nk      = parseFloat(document.getElementById('nwNK')?.value)||0;
  const notiz   = document.getElementById('nwNotiz')?.value?.trim();
  if (!nummer) { toast('⚠️ Nummer ist Pflicht'); return; }
  const { error } = await db.from('wohneinheiten').insert({
    liegenschaft_id:liegenschaftId, nummer, etage, typ, flaeche_qm:flaeche,
    status, nettomiete:netto, nebenkosten:nk, notiz:notiz||null
  });
  if (error) { toast('❌ '+error.message); return; }
  window.closeModal();
  toast('✓ Wohneinheit "'+nummer+'" angelegt!');
  window._currentPropDetail = await getLiegenschaftDetail(liegenschaftId);
  window.switchView('property-detail');
}

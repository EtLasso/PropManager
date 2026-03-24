// ═══════════════════════════════════════════════════
// SCHADEN — Schadensmeldungen, Timeline, Modal
// ═══════════════════════════════════════════════════
import { APP } from './state.js';
import { esc, fmtEur, fmtDate, fmtDateTime, noDaten, toast } from './utils.js';

export function tmplSchaden(rows) {
  const prioColor = {notfall:'var(--red)',hoch:'#EA580C',mittel:'var(--gold)',niedrig:'var(--green)'};
  const prioIcon  = {notfall:'🚨',hoch:'🔴',mittel:'🟡',niedrig:'🟢'};
  const statLabel = {gemeldet:'GEMELDET',in_bearbeitung:'IN ARBEIT',erledigt:'ERLEDIGT',abgeschlossen:'ABGESCHLOSSEN'};
  const statTag   = {gemeldet:'tag-red',in_bearbeitung:'tag-gold',erledigt:'tag-green',abgeschlossen:'tag-teal'};
  const offen   = rows.filter(r=>r.status!=='erledigt'&&r.status!=='abgeschlossen');
  const erled   = rows.filter(r=>r.status==='erledigt'||r.status==='abgeschlossen');
  const notfall = rows.filter(r=>r.prioritaet==='notfall'&&r.status!=='erledigt');

  function renderRow(s) {
    return `<div class="tbl-row schaden-row" style="grid-template-columns:.3fr 1.8fr 1fr 1fr auto;cursor:pointer;border-left:3px solid ${prioColor[s.prioritaet]||'var(--border)'}"
      onclick="openSchadenModal(${s.id})" title="Klicken für Details: ${esc(s.titel)}">
      <div style="font-size:18px;text-align:center">${prioIcon[s.prioritaet]||'⚠️'}</div>
      <div class="tbl-cell">
        <strong>${esc(s.titel)}</strong>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">${esc(s.liegenschaften?.name||'?')} ${s.wohneinheiten?'· Wohnung '+s.wohneinheiten.nummer:''}</div>
      </div>
      <div class="tbl-cell">
        ${s.dienstleister?`<span style="font-size:11px">${esc(s.dienstleister.name)}</span>${s.dienstleister.telefon?`<div style="font-size:10px;color:var(--blue2);font-family:'JetBrains Mono'">${esc(s.dienstleister.telefon)}</div>`:''}` : '<span style="color:var(--text3);font-size:11px">nicht zugewiesen</span>'}
      </div>
      <div class="tbl-cell" style="font-size:10px;color:var(--text3)">${fmtDate(s.erstellt_am)}</div>
      <div><span class="tag ${statTag[s.status]||'tag-gold'}">${statLabel[s.status]||s.status}</span></div>
    </div>`;
  }

  if (!window._schadenFilter) window._schadenFilter = 'alle';
  window._filterSchaden = function(typ) {
    window._schadenFilter = typ;
    document.querySelectorAll('.skpi').forEach(el=>el.classList.remove('skpi-active'));
    const el=document.getElementById('skpi-'+typ); if(el) el.classList.add('skpi-active');
    let list;
    if      (typ==='notfall') list=rows.filter(r=>r.prioritaet==='notfall'&&r.status!=='erledigt');
    else if (typ==='offen')   list=rows.filter(r=>r.status!=='erledigt'&&r.status!=='abgeschlossen');
    else if (typ==='erledigt')list=rows.filter(r=>r.status==='erledigt'||r.status==='abgeschlossen');
    else                      list=rows;
    const hdr=typ==='erledigt'?'Erledigte Schadensmeldungen':typ==='notfall'?'🚨 Notfall-Meldungen':'Offene Schadensmeldungen';
    document.getElementById('schadenListTitle').textContent=hdr;
    document.getElementById('schadenListBody').innerHTML=list.length?list.map(renderRow).join(''):noDaten('✅ Keine Einträge in dieser Kategorie.');
  };

  return `
  <div class="kpi-grid" style="cursor:pointer">
    <div id="skpi-notfall" class="kpi-card skpi ${notfall.length>0?'skpi-active':''}" style="${notfall.length?'border-left:3px solid var(--red)':''}" onclick="_filterSchaden('notfall')">
      <div class="kpi-label">🚨 Notfälle</div><div class="kpi-value ${notfall.length>0?'kv-red':'kv-green'}">${notfall.length}</div>
      <div class="kpi-sub">Sofort handeln</div><div class="kpi-accent-line" style="background:var(--red2)"></div>
    </div>
    <div id="skpi-offen" class="kpi-card skpi" onclick="_filterSchaden('offen')">
      <div class="kpi-label">🔴 Offen</div><div class="kpi-value kv-gold">${offen.length}</div>
      <div class="kpi-sub">Aktiv</div><div class="kpi-accent-line" style="background:var(--gold2)"></div>
    </div>
    <div id="skpi-erledigt" class="kpi-card skpi" onclick="_filterSchaden('erledigt')">
      <div class="kpi-label">✅ Erledigt</div><div class="kpi-value kv-green">${erled.length}</div>
      <div class="kpi-sub">Abgeschlossen</div><div class="kpi-accent-line" style="background:var(--green2)"></div>
    </div>
    <div id="skpi-alle" class="kpi-card skpi" onclick="_filterSchaden('alle')">
      <div class="kpi-label">Alle</div><div class="kpi-value">${rows.length}</div>
      <div class="kpi-sub">Gesamt</div><div class="kpi-accent-line" style="background:var(--border2)"></div>
    </div>
  </div>
  <div class="section-header">
    <div class="section-title" id="schadenListTitle">Offene Schadensmeldungen</div>
    <button class="btn btn-gold btn-sm" onclick="toast('Neue Meldung...')">+ Schaden melden</button>
  </div>
  <div class="card">
    <div class="tbl-header" style="grid-template-columns:.3fr 1.8fr 1fr 1fr auto">
      <span>Prio</span><span>Titel &amp; Ort</span><span>Dienstleister</span><span>Datum</span><span>Status</span>
    </div>
    <div id="schadenListBody">${offen.length?offen.map(renderRow).join(''):noDaten('Keine offenen Schadensmeldungen. ✅')}</div>
  </div>`;
}

export async function openSchadenModal(schadenId) {
  openModalLoading('Schadensmeldung lädt...');
  try {
    const db = window.db;
    const { data: s, error } = await db
      .from('schadensmeldungen')
      .select('*, liegenschaften(name,ort,strasse,plz), wohneinheiten(nummer,etage,typ,flaeche_qm,nettomiete), dienstleister(name,telefon,email,notfall_nr,kategorie,kontaktperson)')
      .eq('id', schadenId).single();
    if (error) throw error;
    const { data: timeline } = await db.from('schaden_timeline').select('*').eq('schaden_id', schadenId).order('zeitpunkt',{ascending:true});
    const prioColor={notfall:'var(--red)',hoch:'#EA580C',mittel:'var(--gold)',niedrig:'var(--green)'};
    const prioIcon={notfall:'🚨',hoch:'🔴',mittel:'🟡',niedrig:'🟢'};
    const statLabel={gemeldet:'Gemeldet',in_bearbeitung:'In Bearbeitung',erledigt:'Erledigt',abgeschlossen:'Abgeschlossen'};
    const statColor={gemeldet:'var(--red)',in_bearbeitung:'var(--gold)',erledigt:'var(--green)',abgeschlossen:'var(--teal)'};
    const ktLabel={eigentuemer:'Eigentümer',mieter:'Mieter',versicherung:'Versicherung',verwaltung:'Verwaltung'};
    const ktColor={eigentuemer:'var(--blue)',mieter:'var(--green)',versicherung:'var(--teal)',verwaltung:'var(--gold)'};
    const viaIcon={Telefon:'📞','E-Mail':'✉️',App:'📱',persönlich:'🤝'};

    const tlHtml=(timeline||[]).map((t,i)=>`
      <div style="display:flex;gap:12px;position:relative">
        <div style="display:flex;flex-direction:column;align-items:center">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--bg3);border:2px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;z-index:1">${esc(t.icon||'📋')}</div>
          ${i<(timeline.length-1)?'<div style="width:2px;flex:1;min-height:20px;background:var(--border);margin:2px 0"></div>':''}
        </div>
        <div style="padding-bottom:${i<(timeline.length-1)?'14':'4'}px;flex:1">
          <div style="font-size:12px;font-weight:600;color:var(--text)">${esc(t.aktion)}</div>
          <div style="font-size:11px;color:var(--text2);margin:2px 0">${esc(t.person||'')}</div>
          ${t.notiz?`<div style="font-size:11px;color:var(--text3);background:var(--bg3);border-radius:6px;padding:6px 8px;margin-top:4px;border-left:2px solid var(--border2)">${esc(t.notiz)}</div>`:''}
          <div style="font-size:10px;color:var(--text4);font-family:'JetBrains Mono';margin-top:3px">${fmtDateTime(t.zeitpunkt)}</div>
        </div>
      </div>`).join('');

    const body=`
      <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:10px;background:${prioColor[s.prioritaet]||'var(--bg)'}15;border:1px solid ${prioColor[s.prioritaet]||'var(--border)'}40;margin-bottom:16px">
        <span style="font-size:24px">${prioIcon[s.prioritaet]||'⚠️'}</span>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:var(--text)">${esc(s.titel)}</div>
          <div style="font-size:11px;color:var(--text3)">${esc(s.beschreibung||'')}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:100px;background:${statColor[s.status]}20;color:${statColor[s.status]};border:1px solid ${statColor[s.status]}40">${statLabel[s.status]||s.status}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:4px">${fmtDate(s.erstellt_am)}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div class="ig-item" style="cursor:pointer" onclick="closeModal();openProp(${s.liegenschaft_id})">
          <div class="ig-key">🏛 Liegenschaft <span style="color:var(--gold)">(→ öffnen)</span></div>
          <div class="ig-val" style="font-size:13px">${esc(s.liegenschaften?.name||'–')}</div>
          <div style="font-size:10px;color:var(--text3)">${esc(s.liegenschaften?.strasse||'')} · ${esc(s.liegenschaften?.ort||'')}</div>
          ${s.wohneinheiten?`<div style="margin-top:5px;font-size:11px;background:var(--blue4);color:var(--blue);padding:3px 7px;border-radius:5px;display:inline-block">Wohnung ${esc(s.wohneinheiten.nummer)}</div>`:''}
        </div>
        <div class="ig-item">
          <div class="ig-key">👤 Gemeldet von</div>
          <div class="ig-val" style="font-size:13px">${esc(s.gemeldet_von||'–')}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:3px">${s.gemeldet_via?`${viaIcon[s.gemeldet_via]||'📋'} via ${esc(s.gemeldet_via)}`:'–'}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">${fmtDateTime(s.erstellt_am)}</div>
        </div>
        ${s.dienstleister?`<div class="ig-item">
          <div class="ig-key">🔧 Beauftragter Dienstleister</div>
          <div class="ig-val" style="font-size:13px">${esc(s.dienstleister.name)}</div>
          ${s.dienstleister.telefon?`<div style="font-size:11px;color:var(--blue2);font-family:'JetBrains Mono';margin-top:3px">📞 ${esc(s.dienstleister.telefon)}</div>`:''}
          ${s.dienstleister.notfall_nr?`<div style="font-size:11px;color:var(--red);font-family:'JetBrains Mono'">🚨 ${esc(s.dienstleister.notfall_nr)}</div>`:''}
        </div>`:`<div class="ig-item"><div class="ig-key">🔧 Dienstleister</div><div style="color:var(--red2);font-size:12px">⚠️ Noch nicht zugewiesen</div><button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="toast('Dienstleister zuweisen...')">Zuweisen</button></div>`}
        <div class="ig-item">
          <div class="ig-key">💶 Kosten &amp; Kostenträger</div>
          <div style="display:flex;justify-content:space-between;margin-top:4px"><span style="font-size:12px;color:var(--text3)">Geschätzt</span><span style="font-family:'JetBrains Mono';font-size:13px;color:var(--gold)">${s.kosten_geschaetzt?fmtEur(s.kosten_geschaetzt):'–'}</span></div>
          <div style="display:flex;justify-content:space-between;margin-top:2px"><span style="font-size:12px;color:var(--text3)">Final</span><span style="font-family:'JetBrains Mono';font-size:13px;color:${s.kosten_final?'var(--green)':'var(--text4)'}">${s.kosten_final?fmtEur(s.kosten_final):'ausstehend'}</span></div>
          <div style="margin-top:6px;padding:5px 8px;border-radius:6px;background:${ktColor[s.kostentraeger]||'var(--bg)'}20;border:1px solid ${ktColor[s.kostentraeger]||'var(--border)'}30">
            <span style="font-size:11px;font-weight:700;color:${ktColor[s.kostentraeger]||'var(--text)'}">💳 ${ktLabel[s.kostentraeger]||s.kostentraeger||'unbekannt'}</span>
          </div>
        </div>
      </div>
      ${s.notiz_verwalter?`<div style="background:var(--gold4);border:1px solid var(--gold3);border-radius:10px;padding:10px 13px;margin-bottom:14px"><div style="font-size:10px;font-weight:700;color:var(--gold);letter-spacing:.8px;text-transform:uppercase;margin-bottom:4px">📌 Notiz Verwalter</div><div style="font-size:12px;color:var(--text)">${esc(s.notiz_verwalter)}</div></div>`:''}
      <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--text3);margin-bottom:12px;display:flex;align-items:center;gap:8px">📋 Aktivitäts-Timeline<div style="flex:1;height:1px;background:var(--border)"></div></div>
      <div style="padding-left:4px">
        ${tlHtml||'<div style="color:var(--text3);font-size:12px">Noch keine Einträge.</div>'}
        <div style="display:flex;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
          <input id="tlInput" class="form-input" style="margin:0;font-size:12px" placeholder="Neue Aktivität hinzufügen...">
          <button class="btn btn-gold btn-sm" onclick="addTimeline(${schadenId})">+ Eintrag</button>
        </div>
      </div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
        <button class="btn btn-primary btn-sm" onclick="toast('Status wird aktualisiert...')">✏️ Status ändern</button>
        <button class="btn btn-ghost btn-sm" onclick="toast('DL kontaktieren...')">${s.dienstleister?'📞 '+esc(s.dienstleister.name):'🔧 DL zuweisen'}</button>
        <button class="btn btn-ghost btn-sm" onclick="toast('PDF Bericht...')">📄 Bericht</button>
        ${s.status!=='erledigt'?`<button class="btn btn-ghost btn-sm" style="color:var(--green);border-color:var(--green2)" onclick="toast('Schaden als erledigt markiert ✓')">✅ Erledigen</button>`:''}
      </div>`;

    document.getElementById('modalTitle').textContent = '🔧 ' + s.titel;
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modalOverlay').classList.add('open');
  } catch(e) {
    document.getElementById('modalBody').innerHTML = `<p style="color:var(--red)">Fehler: ${esc(e.message)}</p>`;
  }
}

export async function addTimeline(schadenId) {
  const input = document.getElementById('tlInput');
  const text = input?.value?.trim(); if (!text) return;
  await window.db.from('schaden_timeline').insert({
    schaden_id: schadenId,
    aktion: text,
    person: `${APP.profile.first_name} ${APP.profile.last_name} (Verwalter)`,
    icon: '📋'
  });
  input.value = '';
  toast('Eintrag hinzugefügt ✓');
  openSchadenModal(schadenId);
}

export function openModalLoading(text='Lädt...') {
  document.getElementById('modalTitle').textContent = text;
  document.getElementById('modalBody').innerHTML = `<div style="display:flex;justify-content:center;padding:40px"><div class="loading-ring"></div></div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

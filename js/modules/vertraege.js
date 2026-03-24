// ═══════════════════════════════════════════════════
// VERTRAEGE — Übersicht, Modal, Archiv, Neuer Vertrag
// ═══════════════════════════════════════════════════
import { APP } from './state.js';
import { esc, fmtEur, fmtDate, noDaten, toast } from './utils.js';

export function tmplVertraege(rows) {
  if (!rows.length) return `<div class="card">${noDaten('Noch keine Verträge.')}</div>`;
  window._allVertraege = rows;
  const monthly   = rows.filter(v=>v.periode==='monatlich').reduce((a,v)=>a+parseFloat(v.kosten||0),0);
  const yearly    = rows.filter(v=>v.periode==='jährlich').reduce((a,v)=>a+parseFloat(v.kosten||0),0);
  const monatsges = monthly + yearly/12;
  const active    = rows.filter(v=>v.status==='ok').length;
  const warn      = rows.filter(v=>v.status==='warn').length;
  const abgel     = rows.filter(v=>v.status==='alert').length;

  function statusBadge(v) {
    if(v.status==='ok')   return `<span class="tag tag-green" style="font-size:10px;padding:3px 8px">✓ Aktiv</span>`;
    if(v.status==='warn') return `<span class="tag tag-gold"  style="font-size:10px;padding:3px 8px">⚠ Ablauf bald</span>`;
    return                       `<span class="tag tag-red"   style="font-size:10px;padding:3px 8px">🔴 Abgelaufen</span>`;
  }

  function daysUntil(d) {
    if(!d) return null;
    const dt=new Date(d); dt.setHours(0,0,0,0);
    const t=new Date(); t.setHours(0,0,0,0);
    return Math.round((dt-t)/86400000);
  }

  function vertragCard(v) {
    const days=daysUntil(v.ende_datum);
    const daysHtml=days!==null
      ? days<0   ? `<div style="font-size:10px;color:var(--red);font-weight:600;margin-top:4px">🔴 Seit ${Math.abs(days)}d abgelaufen</div>`
      : days<=30 ? `<div style="font-size:10px;color:var(--gold);font-weight:600;margin-top:4px">⏳ Läuft in ${days}d ab</div>`
      : days<=90 ? `<div style="font-size:10px;color:var(--gold);margin-top:4px">Endet: ${new Date(v.ende_datum).toLocaleDateString('de-DE')}</div>`
      : '' : '';
    return `<div class="contract-card" onclick='openVertragModal(${v.id})' style="cursor:pointer">
      <div class="cc-icon">${v.icon||'📋'}</div>
      <div class="cc-name">${esc(v.name)}</div>
      <div class="cc-prov">${esc(v.anbieter||'–')} · ${esc(v.liegenschaft_name||'Alle')}</div>
      <div class="cc-cost">${fmtEur(v.kosten)} / ${esc(v.periode)}</div>
      ${statusBadge(v)}${daysHtml}
    </div>`;
  }

  const f=window._vertragFilter||'alle';
  let filtered=rows;
  if(f==='warn')  filtered=rows.filter(v=>v.status==='warn');
  if(f==='alert') filtered=rows.filter(v=>v.status==='alert');
  if(f==='ok')    filtered=rows.filter(v=>v.status==='ok');

  return `
  <div class="kpi-grid" style="margin-bottom:16px">
    <div class="kpi-card clickable" onclick="setVertragFilter('alle')" style="${f==='alle'?'border-left:3px solid var(--blue2)':''}">
      <div class="kpi-label">Verträge</div><div class="kpi-value kv-blue">${rows.length}</div>
      <div class="kpi-sub">${active} aktiv · ${warn+abgel} Handlungsbedarf</div>
      <div class="kpi-accent-line" style="background:var(--blue2)"></div></div>
    <div class="kpi-card">
      <div class="kpi-label">Monatskosten gesamt</div><div class="kpi-value kv-red">${fmtEur(monatsges)}</div>
      <div class="kpi-sub">${fmtEur(monthly)}/Mt. fix + ${fmtEur(yearly/12)}/Mt. anteilig</div>
      <div class="kpi-accent-line" style="background:var(--red2)"></div></div>
    <div class="kpi-card clickable" onclick="setVertragFilter('warn')" style="${f==='warn'?'border-left:3px solid var(--gold)':''}">
      <div class="kpi-label">⚠ Ablauf bald</div><div class="kpi-value kv-gold">${warn}</div>
      <div class="kpi-sub">Verlängerung prüfen</div>
      <div class="kpi-accent-line" style="background:var(--gold2)"></div></div>
    <div class="kpi-card clickable" onclick="setVertragFilter('alert')" style="${abgel?'border-left:3px solid var(--red)':''}">
      <div class="kpi-label">🔴 Abgelaufen</div><div class="kpi-value kv-red">${abgel}</div>
      <div class="kpi-sub">sofort handeln</div>
      <div class="kpi-accent-line" style="background:var(--red2)"></div></div>
  </div>
  <div class="section-header">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <div class="section-title">Alle Verträge &amp; Dienste</div>
      <div style="display:flex;gap:4px">
        ${['alle','ok','warn','alert'].map(fl=>{
          const lbl={alle:'Alle',ok:'✓ Aktiv',warn:'⚠ Bald',alert:'🔴 Abgelaufen'}[fl];
          return `<button onclick="setVertragFilter('${fl}')" class="btn btn-ghost btn-sm" style="font-size:11px;${f===fl?'background:var(--bg3);border-color:var(--border2);':''}">${lbl}</button>`;
        }).join('')}
      </div>
    </div>
    <button class="btn btn-gold btn-sm" onclick="openNeuerVertragModal()">+ Neuer Vertrag</button>
  </div>
  <div class="contract-grid" id="vertragGrid">${filtered.map(vertragCard).join('')||noDaten('Keine Verträge in dieser Filterauswahl.')}</div>`;
}

export function setVertragFilter(f) { window._vertragFilter=f; switchView('vertraege'); }

async function getVertragArchiv(vertragId) {
  const { data } = await window.db.from('vertrag_archiv').select('*').eq('vertrag_id',vertragId).order('bis',{ascending:false});
  return data||[];
}

export async function openVertragModal(id) {
  const v=(window._allVertraege||[]).find(x=>x.id===id);
  if(!v){toast('Vertrag nicht gefunden');return;}
  if(!window._vertragArchivCache) window._vertragArchivCache={};
  window._vertragArchivCache[id]=await getVertragArchiv(id);
  const days=v.ende_datum?Math.round((new Date(v.ende_datum)-new Date())/86400000):null;
  const statusColor=v.status==='ok'?'var(--green)':v.status==='warn'?'var(--gold)':'var(--red)';
  const statusLabel=v.status==='ok'?'✓ Aktiv':v.status==='warn'?'⚠ Ablauf bald':'🔴 Abgelaufen';
  const archiv=window._vertragArchivCache?.[id]||[];
  const archivHtml=archiv.length
    ?archiv.map((a,i)=>`<div style="padding:10px 12px;border-radius:9px;background:var(--bg);border:1px solid var(--border);margin-bottom:6px;opacity:.75">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div style="font-size:11px;font-weight:700;color:var(--text2)">${esc(a.beschreibung||'Vorgängervertrag')}</div>
        <button onclick="vertragArchivDel(${a.id},${id})" style="background:none;border:none;color:var(--text4);cursor:pointer;font-size:13px">✕</button>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--text3)">
        ${a.von?`<span>📅 ${a.von}${a.bis?' → '+a.bis:''}</span>`:''}
        ${a.kosten_text?`<span>💶 ${esc(a.kosten_text)}</span>`:''}
        ${a.notiz?`<span>📝 ${esc(a.notiz)}</span>`:''}
      </div>
    </div>`).join('')
    :`<div style="color:var(--text3);font-size:12px;padding:8px 0">Noch keine archivierten Verträge erfasst.</div>`;

  document.getElementById('modalTitle').textContent=(v.icon||'📋')+' '+v.name;
  document.getElementById('modalBody').innerHTML=`
    <div style="background:linear-gradient(135deg,#1C1917,#292524);border-radius:12px;padding:16px 18px;margin-bottom:16px;display:flex;align-items:center;gap:14px">
      <div style="font-size:36px">${v.icon||'📋'}</div>
      <div style="flex:1">
        <div style="font-family:'Playfair Display';font-size:18px;font-weight:700;color:#fff">${esc(v.name)}</div>
        <div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:2px">${esc(v.anbieter||'–')} · ${esc(v.liegenschaft_name||'Alle Liegenschaften')}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:13px;font-weight:700;color:${statusColor}">${statusLabel}</div>
        ${days!==null?`<div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:2px">${days<0?'Abgelaufen seit '+Math.abs(days)+'d':days===0?'Endet HEUTE':'Endet in '+days+'d'}</div>`:''}
      </div>
    </div>
    <div style="display:flex;gap:2px;margin-bottom:14px;border-bottom:1px solid var(--border)">
      <button onclick="vtTab(this,'vt-aktuell')" class="nav-link active" style="font-size:12px;padding:6px 12px">📄 Aktueller Vertrag</button>
      <button onclick="vtTab(this,'vt-archiv')" class="nav-link" style="font-size:12px;padding:6px 12px">🗄 Archiv (${archiv.length})</button>
      <button onclick="vtTab(this,'vt-notizen')" class="nav-link" style="font-size:12px;padding:6px 12px">📝 Notizen</button>
    </div>
    <div id="vt-aktuell">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div style="background:var(--bg3);border-radius:10px;padding:12px 14px">
          <div style="font-size:10px;color:var(--text3);font-weight:600;letter-spacing:.5px;margin-bottom:8px">VERTRAGSDETAILS</div>
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px"><span style="color:var(--text3)">Kosten</span><span style="font-weight:700">${fmtEur(v.kosten)} / ${esc(v.periode)}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px"><span style="color:var(--text3)">Anbieter</span><span>${esc(v.anbieter||'–')}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--text3)">Liegenschaft</span><span>${esc(v.liegenschaft_name||'Alle')}</span></div>
        </div>
        <div style="background:var(--bg3);border-radius:10px;padding:12px 14px">
          <div style="font-size:10px;color:var(--text3);font-weight:600;letter-spacing:.5px;margin-bottom:8px">LAUFZEIT</div>
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px"><span style="color:var(--text3)">Beginn</span><span>${v.beginn_datum?fmtDate(v.beginn_datum):'–'}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px"><span style="color:var(--text3)">Ende</span><span style="font-weight:${days!==null&&days<=90?'700':'400'};color:${days!==null&&days<=30?'var(--red)':days!==null&&days<=90?'var(--gold)':'var(--text)'}">${v.ende_datum?fmtDate(v.ende_datum):'unbefristet'}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--text3)">Kündigung</span><span>${esc(v.kuendigungsfrist||'–')}</span></div>
        </div>
      </div>
      ${v.notiz?`<div style="background:var(--bg3);border-radius:10px;padding:12px 14px;margin-bottom:14px"><div style="font-size:10px;color:var(--text3);font-weight:600;letter-spacing:.5px;margin-bottom:6px">LEISTUNGSBESCHREIBUNG</div><div style="font-size:12px;color:var(--text);line-height:1.6">${esc(v.notiz)}</div></div>`:''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="vertragInArchiv(${id})">🗄 Als abgelaufen archivieren</button>
      </div>
    </div>
    <div id="vt-archiv" style="display:none">
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:9px;padding:10px 12px;margin-bottom:12px;font-size:11px;color:var(--text3)">
        🗄 Frühere Vertragsversionen dokumentieren — lückenlose Historie.
      </div>
      <div id="vtArchivList_${id}">${archivHtml}</div>
      <div style="background:var(--bg3);border:1px dashed var(--border2);border-radius:10px;padding:12px 14px;margin-top:10px">
        <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">+ Vergangenen Vertrag erfassen</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Gültig von</div><input id="vaVon_${id}" type="date" class="form-input" style="margin:0;font-size:12px"></div>
          <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Gültig bis</div><input id="vaBis_${id}" type="date" class="form-input" style="margin:0;font-size:12px"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Kosten (damals)</div><input id="vaKosten_${id}" class="form-input" style="margin:0;font-size:12px" placeholder="z.B. 250 € / monatlich"></div>
          <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Beschreibung</div><input id="vaBeschr_${id}" class="form-input" style="margin:0;font-size:12px" placeholder="z.B. Altvertrag 2022–2024"></div>
        </div>
        <div style="margin-bottom:8px"><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Notiz / Kündigungsgrund</div><input id="vaNotiz_${id}" class="form-input" style="margin:0;font-size:12px" placeholder="z.B. Preiserhöhung"></div>
        <button class="btn btn-gold btn-sm" onclick="vertragArchivAdd(${id})">+ Archiveintrag speichern</button>
      </div>
    </div>
    <div id="vt-notizen" style="display:none">
      <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">INTERNE NOTIZEN ZUM VERTRAG</div>
      <textarea id="vtNotiz_${id}" class="form-input" rows="6" style="margin:0;font-size:12px;resize:vertical"
        placeholder="Interne Notizen, Gesprächsprotokolle mit Anbieter..."
        onchange="saveVertragNotiz(${id},this.value)">${esc(v.notiz||'')}</textarea>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

export function vtTab(btn, panelId) {
  document.querySelectorAll('#modalBody .nav-link').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  ['vt-aktuell','vt-archiv','vt-notizen'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.style.display=id===panelId?'block':'none';
  });
}

export async function vertragArchivAdd(id) {
  const von=document.getElementById('vaVon_'+id)?.value||null;
  const bis=document.getElementById('vaBis_'+id)?.value||null;
  const kosten=document.getElementById('vaKosten_'+id)?.value?.trim()||null;
  const beschr=document.getElementById('vaBeschr_'+id)?.value?.trim()||null;
  const notiz=document.getElementById('vaNotiz_'+id)?.value?.trim()||null;
  if(!von&&!kosten&&!beschr){toast('Bitte mindestens ein Feld ausfüllen');return;}
  const {error}=await window.db.from('vertrag_archiv').insert({vertrag_id:id,von,bis,kosten_text:kosten,beschreibung:beschr,notiz});
  if(error){toast('❌ Fehler: '+error.message);return;}
  toast('✓ Archiveintrag gespeichert');
  openVertragModal(id);
}

export async function vertragArchivDel(archivId, vertragId) {
  const {error}=await window.db.from('vertrag_archiv').delete().eq('id',archivId);
  if(error){toast('❌ Fehler: '+error.message);return;}
  toast('Archiveintrag entfernt');
  openVertragModal(vertragId);
}

export async function vertragInArchiv(id) {
  const v=(window._allVertraege||[]).find(x=>x.id===id); if(!v)return;
  const {error}=await window.db.from('vertrag_archiv').insert({
    vertrag_id:id, von:v.beginn_datum||null,
    bis:v.ende_datum||new Date().toISOString().split('T')[0],
    kosten_text:fmtEur(v.kosten)+' / '+(v.periode||''),
    beschreibung:'Abgelaufener Vertrag',
    notiz:'Archiviert am '+new Date().toLocaleDateString('de-DE')
  });
  if(error){toast('❌ Fehler: '+error.message);return;}
  toast('✓ Archiviert');
  openVertragModal(id);
}

export async function saveVertragNotiz(id, notiz) {
  await window.db.from('vertraege').update({notiz}).eq('id',id);
  toast('✓ Notiz gespeichert');
}

export function openNeuerVertragModal() {
  const liegs=window._allVertraege?[...new Map((window._allVertraege||[]).map(v=>[v.liegenschaft_id,{id:v.liegenschaft_id,name:v.liegenschaft_name}])).values()].filter(x=>x.id):[];
  document.getElementById('modalTitle').textContent='📋 Neuer Vertrag';
  document.getElementById('modalBody').innerHTML=`
    <div class="form-group"><label class="form-label">Vertragsname *</label><input id="nvName" class="form-input" placeholder="z.B. Aufzugswartung, Gebäudeversicherung..."></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="form-group"><label class="form-label">Anbieter / Firma</label><input id="nvAnbieter" class="form-input" placeholder="Firmenname"></div>
      <div class="form-group"><label class="form-label">Liegenschaft</label>
        <select id="nvLieg" class="form-input"><option value="">Alle / übergreifend</option>${liegs.map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join('')}</select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="form-group"><label class="form-label">Kosten</label><input id="nvKosten" type="number" class="form-input" placeholder="0.00"></div>
      <div class="form-group"><label class="form-label">Periode</label>
        <select id="nvPeriode" class="form-input"><option value="monatlich">monatlich</option><option value="jährlich">jährlich</option><option value="einmalig">einmalig</option><option value="quartalsweise">quartalsweise</option></select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="form-group"><label class="form-label">Vertragsbeginn</label><input id="nvStart" type="date" class="form-input"></div>
      <div class="form-group"><label class="form-label">Vertragsende</label><input id="nvEnde" type="date" class="form-input"></div>
    </div>
    <div class="form-group"><label class="form-label">Beschreibung / Leistungen</label><textarea id="nvBeschr" class="form-input" rows="3" placeholder="Kurze Beschreibung der Leistung..."></textarea></div>
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn btn-gold" onclick="saveNeuerVertrag()">💾 Vertrag speichern</button>
      <button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

export async function saveNeuerVertrag() {
  const name=document.getElementById('nvName')?.value?.trim();
  const lieid=document.getElementById('nvLieg')?.value;
  const kosten=document.getElementById('nvKosten')?.value;
  const periode=document.getElementById('nvPeriode')?.value;
  const start=document.getElementById('nvStart')?.value;
  const ende=document.getElementById('nvEnde')?.value;
  const beschr=document.getElementById('nvBeschr')?.value?.trim();
  const anb=document.getElementById('nvAnbieter')?.value?.trim();
  if(!name){toast('⚠️ Bitte Name eingeben');return;}
  const now=new Date();
  const status=ende&&new Date(ende)<now?'alert':ende&&new Date(ende)<new Date(now.getTime()+90*86400000)?'warn':'ok';
  const {error}=await window.db.from('vertraege').insert({
    name,anbieter:anb||null,liegenschaft_id:lieid?parseInt(lieid):null,
    kosten:parseFloat(kosten)||0,periode:periode||'monatlich',
    beginn_datum:start||null,ende_datum:ende||null,notiz:beschr||null,status
  });
  if(error){toast('Fehler: '+error.message);return;}
  closeModal();toast('✓ Vertrag gespeichert');
  switchView('vertraege');
}

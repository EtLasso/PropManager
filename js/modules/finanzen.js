// ═══════════════════════════════════════════════════
// FINANZEN — tmplFinanzenNeu
// ═══════════════════════════════════════════════════
import { APP } from './state.js';
import { esc, fmtEur, fmtDate, noDaten, toast } from './utils.js';
import { getTransaktionen, getVerwaltungsgebuehren, getLiegenschaften } from './db.js';

export async function tmplFinanzenNeu() {
  const [txs, vg, liegs, allWE] = await Promise.all([
    getTransaktionen(200),
    getVerwaltungsgebuehren(),
    getLiegenschaften(),
    window.db.from('wohneinheiten').select('id,nummer,liegenschaft_id,mieter_vorname,mieter_nachname,nettomiete,nebenkosten,mietbeginn,status,liegenschaften(name)').then(r=>r.data||[])
  ]);
  const totalVG  = vg.reduce((a,v)=>a+parseFloat(v.betrag||0),0);
  const ein      = txs.filter(t=>t.typ==='einnahme');
  const aus      = txs.filter(t=>t.typ==='ausgabe');
  const totalEin = ein.reduce((a,t)=>a+parseFloat(t.betrag||0),0);
  const totalAus = aus.reduce((a,t)=>a+parseFloat(t.betrag||0),0);

  const vgRows = vg.map(v=>`
    <div class="tx-item">
      <div class="tx-ico" style="background:var(--gold4)">🏛️</div>
      <div class="tx-body">
        <div class="tx-name">${esc(v.bezeichnung)}</div>
        <div class="tx-meta">${esc(v.liegenschaften?.name||'')} · ${esc(v.liegenschaften?.ort||'')} · ${esc(v.periode)}</div>
      </div>
      <div class="tx-amt" style="color:var(--gold)">+${fmtEur(v.betrag)}</div>
    </div>`).join('');

  const liegRows = liegs.map(l=>`
    <div class="tbl-row" style="grid-template-columns:1.5fr .8fr .8fr .8fr .8fr" onclick="openProp(${l.id})">
      <div class="tbl-cell"><strong>${esc(l.name)}</strong><div style="font-size:10px;color:var(--text3)">${esc(l.ort)}</div></div>
      <div class="tbl-cell"><span class="tag tag-blue">${esc(l.verwaltungstyp)}</span></div>
      <div class="tbl-cell"><span style="color:var(--green);font-family:'JetBrains Mono';font-size:12px">${fmtEur(l.stats?.total_miete||0)}</span><div style="font-size:10px;color:var(--text3)">Mietumsatz</div></div>
      <div class="tbl-cell"><span style="color:var(--gold);font-family:'JetBrains Mono';font-size:12px">${fmtEur(vg.find(v=>v.liegenschaft_id===l.id)?.betrag||0)}</span><div style="font-size:10px;color:var(--text3)">Verw.Geb.</div></div>
      <div class="tbl-cell">${l.stats?.total||0} WE · ${l.stats?.occupied||0} belegt</div>
    </div>`).join('');

  const byMonth={};
  txs.forEach(t=>{ const m=(t.buchungsdatum||'').slice(0,7); if(!m)return; if(!byMonth[m])byMonth[m]={ein:0,aus:0}; t.typ==='einnahme'?byMonth[m].ein+=parseFloat(t.betrag||0):byMonth[m].aus+=parseFloat(t.betrag||0); });
  const months=Object.keys(byMonth).sort().slice(-6);
  const maxV=Math.max(...months.map(m=>byMonth[m].ein),1);
  const bars=months.map(m=>{ const {ein,aus}=byMonth[m]; return `<div class="bar-col"><div style="display:flex;flex-direction:column-reverse;flex:1;width:100%"><div class="bar-seg" style="height:${(aus/maxV)*85}px;background:linear-gradient(var(--blue3),var(--blue2))"></div><div class="bar-seg" style="height:${((ein-aus)/maxV)*85}px;background:linear-gradient(var(--green3),var(--green2))"></div></div><div class="bar-lbl">${m.slice(-2)}</div></div>`; }).join('');

  const txRows=txs.slice(0,30).map(tx=>{
    const bezahltBadge=tx.bezahlt===true?`<span class="sp sp-green" style="font-size:10px">✓ bezahlt</span>`:tx.bezahlt===false?`<span class="sp sp-red" style="font-size:10px">⏳ offen</span>`:'';
    const kat=tx.kategorie?`· ${esc(tx.kategorie)}`:'';
    return `<div class="tx-item">
      <div class="tx-ico" style="background:${tx.typ==='einnahme'?'var(--green3)':'var(--red3)'}">${tx.icon||'💶'}</div>
      <div class="tx-body"><div class="tx-name">${esc(tx.bezeichnung)}</div>
        <div class="tx-meta">${fmtDate(tx.buchungsdatum)} · ${esc(tx.liegenschaft_name||'Allgemein')} ${kat}</div></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <div class="tx-amt ${tx.typ==='einnahme'?'tx-in':'tx-out'}">${tx.typ==='einnahme'?'+':'-'}${fmtEur(tx.betrag)}</div>
        ${bezahltBadge}
      </div>
    </div>`;
  }).join('');

  return `
  <div class="kpi-grid">
    <div class="kpi-card" style="border-left:3px solid var(--gold2)">
      <div class="kpi-label">🏛 Meine Verwaltungsgebühren</div>
      <div class="kpi-value kv-gold">${fmtEur(totalVG)}</div>
      <div class="kpi-sub up">/Monat</div><div class="kpi-accent-line" style="background:var(--gold2)"></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Mietumsatz (Eigentümer)</div>
      <div class="kpi-value kv-green">${fmtEur(totalEin)}</div>
      <div class="kpi-sub">Einnahmen gesamt</div><div class="kpi-accent-line" style="background:var(--green2)"></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Ausgaben</div>
      <div class="kpi-value kv-red">${fmtEur(totalAus)}</div>
      <div class="kpi-sub down">Kosten gesamt</div><div class="kpi-accent-line" style="background:var(--red2)"></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Reingewinn (Eigentümer)</div>
      <div class="kpi-value kv-blue">${fmtEur(totalEin-totalAus)}</div>
      <div class="kpi-sub">${totalEin>0?Math.round(((totalEin-totalAus)/totalEin)*100):0}% Marge</div>
      <div class="kpi-accent-line" style="background:var(--blue2)"></div>
    </div>
  </div>
  <div style="display:flex;gap:4px;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:0">
    ${['verwaltung','liegenschaften','mieten','buchungen'].map(tab=>`
      <button onclick="APP.finTab='${tab}';document.querySelectorAll('.fin-tab').forEach(x=>x.classList.toggle('active',x.dataset.tab==='${tab}'));document.querySelectorAll('.fin-panel').forEach(x=>x.style.display=x.dataset.tab==='${tab}'?'block':'none')"
        class="fin-tab nav-link ${APP.finTab===tab?'active':''}" data-tab="${tab}">
        ${{verwaltung:'🏛 Verwaltungsgebühren',liegenschaften:'📊 Liegenschaften',mieten:'🏠 Mieten',buchungen:'💶 Buchungen'}[tab]}
      </button>`).join('')}
  </div>
  <div class="fin-panel" data-tab="verwaltung" style="display:${APP.finTab==='verwaltung'?'block':'none'}">
    <div class="card"><div class="card-title">🏛️ Verwaltungsgebühren</div>
      <div style="background:var(--gold4);border:1px solid var(--gold3);border-radius:10px;padding:12px 14px;margin-bottom:14px;font-size:12px;color:var(--gold)">
        ℹ️ Verwaltungsgebühr = Ihr Einkommen als Verwalter – getrennt vom Mietumsatz der Eigentümer.
      </div>
      ${vgRows||noDaten('Keine Verwaltungsgebühren.')}
      <div style="border-top:2px solid var(--gold3);margin-top:12px;padding-top:12px;display:flex;justify-content:space-between">
        <span style="font-weight:700;color:var(--text)">Total/Monat</span>
        <span style="font-family:'JetBrains Mono';font-size:16px;font-weight:700;color:var(--gold)">${fmtEur(totalVG)}</span>
      </div>
      <div style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px;display:flex;justify-content:space-between">
        <span style="font-size:11px;color:var(--text3)">Jährlich</span>
        <span style="font-family:'JetBrains Mono';font-size:13px;color:var(--text2)">${fmtEur(totalVG*12)}</span>
      </div>
    </div>
  </div>
  <div class="fin-panel" data-tab="liegenschaften" style="display:${APP.finTab==='liegenschaften'?'block':'none'}">
    <div class="card">
      <div class="card-title">📊 Finanzübersicht pro Liegenschaft</div>
      <div class="tbl-header" style="grid-template-columns:1.5fr .8fr .8fr .8fr .8fr">
        <span>Liegenschaft</span><span>Typ</span><span>Mietumsatz</span><span>Meine Gebühr</span><span>Auslastung</span>
      </div>
      ${liegRows||noDaten()}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-top:14px">
      <div class="card"><div class="card-title">📈 Monatsverlauf</div><div class="bar-chart">${bars}</div>
        <div class="chart-legend"><div class="cl-item"><div class="cl-dot" style="background:var(--green2)"></div>Einnahmen</div><div class="cl-item"><div class="cl-dot" style="background:var(--blue2)"></div>Ausgaben</div></div></div>
    </div>
  </div>
  <div class="fin-panel" data-tab="mieten" style="display:${APP.finTab==='mieten'?'block':'none'}">
    <div class="card">
      <div class="section-header">
        <div class="section-title">🏠 Mietübersicht</div>
        <div style="font-size:11px;color:var(--text3)">${allWE.filter(w=>w.mieter_vorname).length} aktive Mietverhältnisse</div>
      </div>
      <div class="tbl-header" style="grid-template-columns:1.4fr .8fr .8fr .9fr .9fr .7fr">
        <span>Mieter</span><span>Liegenschaft</span><span>WE</span><span>Nettomiete</span><span>Warmmiete</span><span>Mietbeginn</span>
      </div>
      ${allWE.filter(w=>w.mieter_vorname).map(w=>{
        const netto=parseFloat(w.nettomiete||0), nk=parseFloat(w.nebenkosten||0);
        return `<div class="tbl-row" style="grid-template-columns:1.4fr .8fr .8fr .9fr .9fr .7fr" onclick="openProp(${w.liegenschaft_id})">
          <div class="tbl-cell"><strong>${esc(w.mieter_vorname)} ${esc(w.mieter_nachname||'')}</strong></div>
          <div class="tbl-cell" style="font-size:11px;color:var(--text3)">${esc(w.liegenschaften?.name||'–')}</div>
          <div class="tbl-cell"><span class="tag tag-blue">${esc(w.nummer)}</span></div>
          <div class="tbl-cell"><span style="color:var(--green);font-family:'JetBrains Mono';font-size:12px">${fmtEur(netto)}</span></div>
          <div class="tbl-cell"><span style="color:var(--blue2);font-family:'JetBrains Mono';font-size:12px">${fmtEur(netto+nk)}</span><div style="font-size:10px;color:var(--text3)">inkl. NK ${fmtEur(nk)}</div></div>
          <div class="tbl-cell">${w.mietbeginn?`<span class="tag tag-green" style="font-size:10px">${fmtDate(w.mietbeginn)}</span>`:'-'}</div>
        </div>`;
      }).join('')||noDaten('Keine aktiven Mietverhältnisse.')}
      <div style="border-top:2px solid var(--border);margin-top:12px;padding-top:12px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:700;color:var(--text)">Gesamtumsatz/Monat</span>
        <div style="text-align:right">
          <div style="font-family:'JetBrains Mono';font-size:18px;font-weight:700;color:var(--green)">${fmtEur(allWE.filter(w=>w.mieter_vorname).reduce((s,w)=>s+parseFloat(w.nettomiete||0)+parseFloat(w.nebenkosten||0),0))}</div>
        </div>
      </div>
    </div>
  </div>
  <div class="fin-panel" data-tab="buchungen" style="display:${APP.finTab==='buchungen'?'block':'none'}">
    <div class="card">
      <div class="section-header"><div class="section-title">Alle Buchungen</div><button class="btn btn-gold btn-sm" onclick="toast('Neue Buchung...')">+ Neue Buchung</button></div>
      ${txRows||noDaten()}
    </div>
  </div>`;
}

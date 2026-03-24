// ═══════════════════════════════════════════════════
// DASHBOARD — Verwalter Dashboard Template
// ═══════════════════════════════════════════════════
import { APP } from './state.js';
import { esc, fmtEur, fmtDate, evClass, evTag, evLabel, noDaten } from './utils.js';

export function tmplVerwDash(d) {
  const s = d.stats;
  const auslastung = s.wohnungen > 0 ? Math.round((s.belegt / s.wohnungen) * 100) : 0;
  const txHtml = (d.txRecent||[]).slice(0,6).map(tx=>`
    <div class="tx-item">
      <div class="tx-ico" style="background:${tx.typ==='einnahme'?'var(--green3)':'var(--red3)'}">${tx.icon||'💶'}</div>
      <div class="tx-body"><div class="tx-name">${esc(tx.bezeichnung)}</div>
        <div class="tx-meta">${fmtDate(tx.buchungsdatum)} · ${esc(tx.liegenschaft_name||'Allgemein')}</div></div>
      <div class="tx-amt ${tx.typ==='einnahme'?'tx-in':'tx-out'}">${tx.typ==='einnahme'?'+':'-'}${fmtEur(tx.betrag)}</div>
    </div>`).join('');
  const evHtml = (d.termine||[]).slice(0,4).map(ev=>`
    <div class="event-item ${evClass(ev.termin_typ)}" onclick='openEventModal(${JSON.stringify(ev).replace(/'/g,"&#39;")})'>
      <div class="ev-date">${fmtDate(ev.termin_datum)}</div>
      <div class="ev-body"><div class="ev-title">${esc(ev.titel)}</div><div class="ev-loc">${esc(ev.ort||'')}</div>
      <span class="tag ${evTag(ev.termin_typ)}">${evLabel(ev.termin_typ)}</span></div>
    </div>`).join('');
  return `
  <div class="welcome-banner"><div class="wb-shimmer"></div>
    <div class="wb-text">
      <div class="wb-greet">Guten Tag, ${esc(APP.profile.first_name)} 👋</div>
      <div class="wb-sub">${new Date().toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
    </div>
    <div class="wb-stats">
      <div><div class="wbs-v">${s.liegenschaften}</div><div class="wbs-l">Liegesch.</div></div>
      <div><div class="wbs-v">${s.wohnungen}</div><div class="wbs-l">Wohnungen</div></div>
      <div><div class="wbs-v">${s.belegt}</div><div class="wbs-l">Belegt</div></div>
    </div>
  </div>
  ${d.schadenNotfall > 0 ? `<div style="background:linear-gradient(135deg,#7f1d1d,#991b1b);color:white;border-radius:14px;padding:14px 18px;margin-bottom:14px;display:flex;align-items:center;gap:12px;cursor:pointer;animation:pulse 2s infinite" onclick="switchView('schaden')">
    <span style="font-size:22px">🚨</span>
    <div><strong style="font-size:14px">${d.schadenNotfall} NOTFALL-MELDUNG${d.schadenNotfall>1?'EN':''} AKTIV</strong>
    <div style="font-size:11px;opacity:.7;margin-top:2px">Sofortige Bearbeitung erforderlich → Schäden öffnen</div></div>
    <span style="margin-left:auto;font-size:18px">→</span>
  </div>` : ''}
  <div class="kpi-grid">
    <div class="kpi-card clickable" onclick="switchView('finanzen')" style="border-left:3px solid var(--gold2)">
      <div class="kpi-label">Meine Verwaltungsgebühren</div>
      <div class="kpi-value kv-gold">${fmtEur(s.total_vg||0)}</div>
      <div class="kpi-sub up">▲ /Monat · ${s.liegenschaften} Liegenschaften</div>
      <div class="kpi-icon">🏛️</div><div class="kpi-accent-line" style="background:var(--gold2)"></div>
      <div class="kpi-nav-hint">→ Finanzen</div>
    </div>
    <div class="kpi-card clickable" onclick="switchView('finanzen')">
      <div class="kpi-label">Mietumsatz Gesamt</div>
      <div class="kpi-value kv-blue">${fmtEur(s.total_miete||0)}</div>
      <div class="kpi-sub">Eigentümer-Einnahmen</div>
      <div class="kpi-icon">💶</div><div class="kpi-accent-line" style="background:var(--blue2)"></div>
      <div class="kpi-nav-hint">→ Finanzen</div>
    </div>
    <div class="kpi-card clickable" onclick="switchView('schaden')">
      <div class="kpi-label">Offene Schäden</div>
      <div class="kpi-value ${d.schadenOffen>0?'kv-red':'kv-green'}">${d.schadenOffen||0}</div>
      <div class="kpi-sub ${d.schadenOffen>0?'down':'up'}">${d.schadenNotfall>0?'🚨 '+d.schadenNotfall+' Notfall!':'✓ kein Notfall'}</div>
      <div class="kpi-icon">⚠️</div><div class="kpi-accent-line" style="background:${d.schadenOffen>0?'var(--red2)':'var(--green2)'}"></div>
      <div class="kpi-nav-hint">→ Schäden</div>
    </div>
    <div class="kpi-card clickable" onclick="switchView('liegenschaften')">
      <div class="kpi-label">Auslastung</div>
      <div class="kpi-value kv-teal">${auslastung}%</div>
      <div class="kpi-sub">${s.belegt}/${s.wohnungen} belegt</div>
      <div class="kpi-icon">📊</div><div class="kpi-accent-line" style="background:var(--teal2)"></div>
      <div class="kpi-nav-hint">→ Liegenschaften</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
    <div class="card"><div class="card-title">💶 Letzte Transaktionen</div><div class="tx-list">${txHtml||noDaten()}</div><button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="switchView('finanzen')">Alle Transaktionen →</button></div>
    <div class="card"><div class="card-title">📅 Nächste Termine</div>${evHtml||noDaten()}<button class="btn btn-ghost btn-sm" onclick="switchView('termine')">Alle Termine →</button></div>
  </div>`;
}

export function tmplVermieterDash(d) {
  const s = d.stats||{};
  const txHtml = (d.transaktionen||[]).slice(0,5).map(tx=>`
    <div class="tx-item"><div class="tx-ico" style="background:var(--green3)">🏠</div>
    <div class="tx-body"><div class="tx-name">${esc(tx.bezeichnung)}</div><div class="tx-meta">${fmtDate(tx.buchungsdatum)}</div></div>
    <div class="tx-amt tx-in">+${fmtEur(tx.betrag)}</div></div>`).join('');
  return `
  <div class="welcome-banner"><div class="wb-shimmer"></div>
    <div class="wb-text"><div class="wb-greet">Guten Tag, ${esc(APP.profile.last_name)} 👋</div>
    <div class="wb-sub">${new Date().toLocaleDateString('de-DE',{day:'numeric',month:'long',year:'numeric'})}</div></div>
    <div class="wb-stats"><div><div class="wbs-v">${fmtEur(s.total_miete||0)}</div><div class="wbs-l">Miete/Mt.</div></div>
    <div><div class="wbs-v">${s.wohnungen||0}</div><div class="wbs-l">Wohnungen</div></div></div>
  </div>
  <div class="kpi-grid">
    <div class="kpi-card clickable" onclick="switchView('einnahmen')"><div class="kpi-label">Nettomiete/Mt.</div><div class="kpi-value kv-green">${fmtEur(s.total_miete||0)}</div><div class="kpi-accent-line" style="background:var(--green2)"></div><div class="kpi-nav-hint">→ Einnahmen</div></div>
    <div class="kpi-card clickable" onclick="switchView('meine-objekte')"><div class="kpi-label">Wohnungen</div><div class="kpi-value kv-blue">${s.wohnungen||0}</div><div class="kpi-accent-line" style="background:var(--blue2)"></div><div class="kpi-nav-hint">→ Objekte</div></div>
    <div class="kpi-card clickable" onclick="switchView('meine-objekte')"><div class="kpi-label">Leerstand</div><div class="kpi-value kv-gold">${s.leer||0}</div><div class="kpi-accent-line" style="background:var(--gold2)"></div><div class="kpi-nav-hint">→ Objekte</div></div>
  </div>
  <div class="card"><div class="card-title">💶 Letzte Einnahmen</div><div class="tx-list">${txHtml||noDaten()}</div></div>`;
}

export function tmplMieterListe(tenants) {
  const rows = tenants.map(a=>`
    <div class="tbl-row" style="grid-template-columns:1.5fr 1fr 1fr auto">
      <div class="tbl-cell"><strong>${esc(a.mieter_name)}</strong></div>
      <div class="tbl-cell">Apt.${esc(a.nummer)} · ${esc(a.liegenschaft||'')}</div>
      <div class="tbl-cell"><span style="font-family:'JetBrains Mono';color:var(--green);font-weight:600">${fmtEur(a.nettomiete)}</span></div>
      <div><span class="sp sp-green">aktiv</span></div>
    </div>`).join('');
  return `<div class="section-header"><div class="section-title">Meine Mieter</div></div>
  <div class="card"><div class="tbl-header" style="grid-template-columns:1.5fr 1fr 1fr auto"><span>Mieter</span><span>Wohnung</span><span>Miete</span><span>Status</span></div>
    ${rows||noDaten('Keine Mieter.')}</div>`;
}

export function tmplEinnahmen(txs) {
  const ein = txs.filter(t=>t.typ==='einnahme');
  const total = ein.reduce((a,t)=>a+parseFloat(t.betrag||0),0);
  const rows = ein.map(tx=>`
    <div class="tx-item"><div class="tx-ico" style="background:var(--green3)">🏠</div>
    <div class="tx-body"><div class="tx-name">${esc(tx.bezeichnung)}</div><div class="tx-meta">${fmtDate(tx.buchungsdatum)}</div></div>
    <div class="tx-amt tx-in">+${fmtEur(tx.betrag)}</div></div>`).join('');
  return `<div class="kpi-grid"><div class="kpi-card"><div class="kpi-label">Einnahmen gesamt</div><div class="kpi-value kv-green">${fmtEur(total)}</div><div class="kpi-accent-line" style="background:var(--green2)"></div></div></div>
  <div class="card"><div class="card-title">Einnahmen</div><div class="tx-list">${rows||noDaten()}</div></div>`;
}

export function tmplMeineWohnung(d) {
  if (d.error) return `<div class="card"><p style="color:var(--red)">${esc(d.error)}</p></div>`;
  const total = (parseFloat(d.nettomiete)||0)+(parseFloat(d.nebenkosten)||0);
  const termine = (d.termine||[]).map(t=>`
    <div class="event-item ${evClass(t.termin_typ)}">
      <div class="ev-date">${fmtDate(t.termin_datum)}</div>
      <div class="ev-body"><div class="ev-title">${esc(t.titel)}</div><div class="ev-loc">${esc(t.ort||'')}</div></div>
    </div>`).join('')||noDaten('Keine Termine.');
  return `
  <div class="my-apt-card"><div style="position:relative;z-index:1">
    <div class="my-apt-big">Wohnung ${esc(d.nummer)}</div>
    <div class="my-apt-sub">${esc(d.liegenschaft_name)} · ${esc(d.strasse)}, ${esc(d.plz)} ${esc(d.ort)}</div>
    <div class="mad-grid">
      <div class="mad-item"><div class="mad-lbl">Größe</div><div class="mad-val">${d.flaeche_qm} m²</div></div>
      <div class="mad-item"><div class="mad-lbl">Nettomiete</div><div class="mad-val">${fmtEur(d.nettomiete)}</div></div>
      <div class="mad-item"><div class="mad-lbl">Nebenkosten</div><div class="mad-val">${fmtEur(d.nebenkosten)}</div></div>
      <div class="mad-item"><div class="mad-lbl">Gesamt/Mt.</div><div class="mad-val">${fmtEur(total)}</div></div>
      <div class="mad-item"><div class="mad-lbl">Mietbeginn</div><div class="mad-val" style="font-size:12px">${fmtDate(d.mietbeginn)}</div></div>
      <div class="mad-item"><div class="mad-lbl">Status</div><div class="mad-val" style="color:#22C55E">AKTIV</div></div>
    </div>
  </div></div>
  <div class="kpi-grid">
    <div class="kpi-card clickable" onclick="switchView('zahlungen')"><div class="kpi-label">Gesamt/Mt.</div><div class="kpi-value kv-green">${fmtEur(total)}</div><div class="kpi-accent-line" style="background:var(--green2)"></div><div class="kpi-nav-hint">→ Zahlungen</div></div>
    <div class="kpi-card clickable" onclick="switchView('dokumente')"><div class="kpi-label">Dokumente</div><div class="kpi-value kv-blue">→</div><div class="kpi-accent-line" style="background:var(--blue2)"></div><div class="kpi-nav-hint">→ Dokumente</div></div>
    <div class="kpi-card clickable" onclick="switchView('kontakt')"><div class="kpi-label">Kontakt</div><div class="kpi-value kv-gold">→</div><div class="kpi-accent-line" style="background:var(--gold2)"></div><div class="kpi-nav-hint">→ Kontakt</div></div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">
    <div class="card"><div class="card-title">📅 Nächste Termine</div>${termine}</div>
    <div class="card"><div class="card-title">${d.kontakt_typ==='verwaltung'?'🏛️ Hausverwaltung':'👑 Eigentümer / Vermieter'}</div>
      <div class="info-block" style="margin-top:8px"><div class="ib-name">${esc(d.kontakt_name||'–')}</div>
        <div class="ib-contact">${esc(d.kontakt_phone||'–')}</div></div>
      <button class="btn btn-gold btn-sm" style="margin-top:12px" onclick="switchView('kontakt')">📞 Kontakt aufnehmen</button>
    </div>
  </div>`;
}

export function tmplZahlungen(txs) {
  const rows = txs.map(tx=>`
    <div class="tbl-row" style="grid-template-columns:1fr 1fr 1fr auto">
      <div class="tbl-cell"><strong>${fmtDate(tx.buchungsdatum)}</strong></div>
      <div class="tbl-cell">${esc(tx.bezeichnung)}</div>
      <div class="tbl-cell"><span style="font-family:'JetBrains Mono';color:var(--blue);font-weight:600">${fmtEur(tx.betrag)}</span></div>
      <div>${tx.bezahlt?'<span class="sp sp-green">bezahlt</span>':'<span class="sp sp-red">offen</span>'}</div>
    </div>`).join('');
  return `<div class="card"><div class="section-header"><div class="section-title">Zahlungshistorie</div></div>
    <div class="tbl-header" style="grid-template-columns:1fr 1fr 1fr auto"><span>Datum</span><span>Bezeichnung</span><span>Betrag</span><span>Status</span></div>
    ${rows||noDaten('Keine Zahlungen.')}</div>`;
}

export function tmplKontakt(d) {
  return `
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:16px">
    <div class="card"><div class="card-title">${d.kontakt_typ==='verwaltung'?'🏛️ Hausverwaltung':'👑 Vermieter'}</div>
      <div class="info-block" style="margin-top:12px"><div class="ib-name">${esc(d.kontakt_name||'–')}</div><div class="ib-contact">${esc(d.kontakt_phone||'–')}</div></div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">
        <button class="btn btn-primary" style="justify-content:center" onclick="toast('Anruf...')">📞 Anrufen</button>
        <button class="btn btn-ghost" style="justify-content:center" onclick="toast('E-Mail öffnet...')">✉️ E-Mail senden</button>
      </div>
    </div>
    <div class="card"><div class="card-title">🆘 Notfallkontakte</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">
        ${[{i:'🔥',n:'Feuerwehr',t:'112'},{i:'🚑',n:'Notruf',t:'112'},{i:'👮',n:'Polizei',t:'110'},{i:'💧',n:'Wasser',t:'+43 800 001'},{i:'⚡',n:'Strom',t:'+43 800 002'},{i:'🔧',n:'Notfall',t:'+43 800 003'}]
        .map(c=>`<button class="btn btn-ghost" style="flex-direction:column;align-items:center;padding:11px;height:auto;gap:3px;width:100%" onclick="toast('${c.n}: ${c.t}')"><span>${c.i}</span><span style="font-size:10px">${c.n}</span><span style="font-size:10px;font-family:'JetBrains Mono';color:var(--gold)">${c.t}</span></button>`).join('')}
      </div>
    </div>
  </div>
  <div class="card"><div class="card-title">📝 Nachricht senden</div>
    <div class="form-group" style="margin-bottom:10px"><label class="form-label">Betreff</label><input class="form-input" placeholder="z.B. Defekter Wasserhahn"></div>
    <div class="form-group" style="margin-bottom:10px"><label class="form-label">Kategorie</label>
    <select class="form-input"><option>🔧 Reparatur/Schaden</option><option>💶 Miete/Zahlung</option><option>📄 Dokument anfragen</option><option>❓ Allgemeine Anfrage</option></select></div>
    <div class="form-group" style="margin-bottom:14px"><label class="form-label">Nachricht</label><textarea class="form-input" rows="4" placeholder="Ihre Nachricht..."></textarea></div>
    <button class="btn btn-gold" onclick="toast('Nachricht gesendet! ✓')">📤 Absenden</button>
  </div>`;
}

export function tmplDokumente(rows) {
  const items = rows.map(d=>`
    <div class="doc-item" onclick="toast('Dokument öffnet...')">
      <div style="font-size:20px;flex-shrink:0">${d.icon||'📄'}</div>
      <div style="flex:1"><div style="font-size:12px;font-weight:500;color:var(--text)">${esc(d.name)}</div>
        <div style="font-size:10px;color:var(--text3);font-family:'JetBrains Mono'">${fmtDate(d.erstellt_am)} · ${esc(d.liegenschaft_name||'Allgemein')}</div></div>
      <div style="color:var(--gold);font-size:14px">⬇</div>
    </div>`).join('');
  return `<div class="section-header"><div class="section-title">Dokumente & Archiv</div><button class="btn btn-gold btn-sm" onclick="toast('Hochladen...')">+ Hochladen</button></div>
  <div class="card">${items||noDaten('Keine Dokumente.')}</div>`;
}

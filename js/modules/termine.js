// ═══════════════════════════════════════════════════
// TERMINE — Teil 1: tmplTermine, loadEVData, openEvPlanModal
// ═══════════════════════════════════════════════════
import { APP } from './state.js';
import { esc, fmtEur, fmtDate, fmtDateTime, evClass, evTag, evLabel, noDaten, toast } from './utils.js';

export function tmplTermine(rows) {
  const today = new Date(); today.setHours(0,0,0,0);
  const evList = rows.filter(e => e.termin_typ === 'eigentümerversammlung');
  const andereList = rows.filter(e => e.termin_typ !== 'eigentümerversammlung');

  function evPhase(ev) {
    const d = new Date(ev.termin_datum); d.setHours(0,0,0,0);
    const diffDays = Math.round((d - today) / 86400000);
    const hasProt = ev.beschluesse?.length > 0;
    if (diffDays > 14)  return { phase:0, label:'Vorbereitung', color:'var(--text3)', icon:'📋' };
    if (diffDays > 0)   return { phase:1, label:'Einladung läuft', color:'var(--gold)', icon:'📨' };
    if (diffDays === 0) return { phase:2, label:'Heute!', color:'var(--red)', icon:'🔴' };
    if (!hasProt)       return { phase:3, label:'Protokoll ausstehend', color:'var(--red2)', icon:'⚠️' };
    const anfFrist = new Date(d); anfFrist.setMonth(anfFrist.getMonth()+1);
    if (today <= anfFrist) return { phase:3, label:'Anfechtungsfrist läuft', color:'var(--gold)', icon:'⏳' };
    return { phase:4, label:'Abgeschlossen', color:'var(--green)', icon:'✅' };
  }

  function evCheckProgress(id) {
    try {
      const saved = window._evCache?.[id]?.checksMap||{};
      const done = Object.values(saved).filter(Boolean).length;
      return { done, total:16, pct: Math.round((done/16)*100) };
    } catch(e) { return {done:0,total:16,pct:0}; }
  }

  function evCard(ev) {
    const ph = evPhase(ev);
    const chk = evCheckProgress(ev.id);
    const d = new Date(ev.termin_datum); d.setHours(0,0,0,0);
    const diffDays = Math.round((d - today) / 86400000);
    const anfFrist = ph.phase >= 3 ? (() => { const f=new Date(d); f.setMonth(f.getMonth()+1); return f; })() : null;
    const anfTage = anfFrist ? Math.max(0, Math.round((anfFrist - today) / 86400000)) : null;
    const steps = [{i:'📋',l:'Vorbereitung'},{i:'📨',l:'Einladung'},{i:'🏛',l:'Versammlung'},{i:'📄',l:'Protokoll'},{i:'✅',l:'Archiviert'}];
    const stepHtml = steps.map((s,idx)=>{
      const active=idx===ph.phase, done2=idx<ph.phase;
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1">
        <div style="width:30px;height:30px;border-radius:50%;border:2px solid ${done2?'var(--green2)':active?ph.color:'var(--border2)'};background:${done2?'var(--green3)':active?ph.color+'20':'transparent'};display:flex;align-items:center;justify-content:center;font-size:12px">${done2?'✓':s.i}</div>
        <div style="font-size:9px;color:${active?ph.color:done2?'var(--green)':'var(--text3)'};text-align:center;font-weight:${active?'700':'400'}">${s.l}</div>
      </div>`;
    }).join('<div style="flex:1;height:2px;background:var(--border);margin-top:14px"></div>');
    return `<div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:18px 20px;cursor:pointer;transition:all .2s;box-shadow:var(--sh1);border-left:4px solid ${ph.color}"
        onmouseover="this.style.boxShadow='var(--sh3)';this.style.transform='translateY(-2px)'"
        onmouseout="this.style.boxShadow='var(--sh1)';this.style.transform=''"
        onclick='openEvPlanModal(${JSON.stringify(ev).replace(/'/g,"&#39;")})'>
      <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px">
        <div style="width:48px;height:48px;border-radius:12px;background:var(--blue4);border:1.5px solid #BFDBFE;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0">
          <span style="font-size:9px;font-weight:700;color:var(--blue);letter-spacing:1px">${new Date(ev.termin_datum).toLocaleDateString('de-DE',{month:'short'}).toUpperCase()}</span>
          <span style="font-size:18px;font-weight:700;color:var(--blue);line-height:1">${new Date(ev.termin_datum).getDate()}</span>
        </div>
        <div style="flex:1">
          <div style="font-family:'Playfair Display';font-size:16px;font-weight:700;color:var(--text)">${esc(ev.titel)}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">📍 ${esc(ev.ort||'Kein Ort')} · ${esc(ev.liegenschaft_name||'')}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;font-weight:700;color:${ph.color}">${ph.icon} ${ph.label}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">${diffDays>0?'in '+diffDays+' Tagen':diffDays===0?'<strong>HEUTE</strong>':'vor '+Math.abs(diffDays)+' Tagen'}</div>
        </div>
      </div>
      <div style="display:flex;align-items:flex-start;gap:0;margin-bottom:14px;padding:10px;background:var(--bg);border-radius:10px">${stepHtml}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div style="background:var(--bg3);border-radius:8px;padding:8px 10px">
          <div style="font-size:10px;color:var(--text3);font-weight:600;letter-spacing:.5px">CHECKLISTE</div>
          <div style="font-size:13px;font-weight:700;color:var(--text);margin-top:2px">${chk.done}/${chk.total}</div>
          <div style="background:var(--bg4);border-radius:2px;height:3px;margin-top:4px"><div style="height:100%;border-radius:2px;background:${chk.pct>=100?'var(--green2)':chk.pct>60?'var(--gold)':'var(--red2)'};width:${chk.pct}%"></div></div>
        </div>
        <div style="background:var(--bg3);border-radius:8px;padding:8px 10px">
          <div style="font-size:10px;color:var(--text3);font-weight:600;letter-spacing:.5px">BESCHLÜSSE</div>
          <div style="font-size:13px;font-weight:700;color:var(--text);margin-top:2px">${ev.beschluesse?.length||0}</div>
          <div style="font-size:10px;color:var(--green);margin-top:2px">${ev.beschluesse?.filter(b=>b.ergebnis==='angenommen').length||0} ✓</div>
        </div>
        <div style="background:var(--bg3);border-radius:8px;padding:8px 10px">
          <div style="font-size:10px;color:var(--text3);font-weight:600;letter-spacing:.5px">ANFECHTUNG</div>
          ${anfFrist?anfTage>0?`<div style="font-size:12px;font-weight:700;color:var(--gold);margin-top:2px">⏳ ${anfTage}d</div>`:`<div style="font-size:12px;font-weight:700;color:var(--green);margin-top:2px">✅ Frei</div>`:`<div style="font-size:12px;font-weight:700;color:var(--text3);margin-top:2px">–</div>`}
        </div>
      </div>
    </div>`;
  }

  const andereHtml = andereList.map(ev=>`
    <div class="event-item ${evClass(ev.termin_typ)}" onclick='openEventModal(${JSON.stringify(ev).replace(/'/g,"&#39;")})'>
      <div class="ev-date">${fmtDate(ev.termin_datum)}</div>
      <div class="ev-body"><div class="ev-title">${esc(ev.titel)}</div>
        <div class="ev-loc">${esc(ev.ort||'')} ${ev.liegenschaft_name?'· '+ev.liegenschaft_name:''}</div>
        <span class="tag ${evTag(ev.termin_typ)}">${evLabel(ev.termin_typ)}</span>
      </div>
    </div>`).join('');

  const evGesamt=evList.length;
  const evOffen=evList.filter(e=>evPhase(e).phase<4).length;
  const evAnf=evList.filter(e=>{ const ph=evPhase(e); const d=new Date(e.termin_datum); const f=new Date(d); f.setMonth(f.getMonth()+1); return ph.phase===3&&today<=f; }).length;
  const evToday=evList.filter(e=>{ const d=new Date(e.termin_datum); d.setHours(0,0,0,0); return d.getTime()===today.getTime(); }).length;
  const allBeschluesse=evList.flatMap(ev=>(ev.beschluesse||[]).map(b=>({...b,ev_titel:ev.titel,ev_datum:ev.termin_datum,liegenschaft:ev.liegenschaft_name})));
  const beschlAngenommen=allBeschluesse.filter(b=>b.ergebnis==='angenommen').length;

  const beschlSammlungHtml=allBeschluesse.length?allBeschluesse.map((b,i)=>{
    const ang=b.ergebnis==='angenommen';
    return `<div style="padding:10px 14px;border-radius:10px;background:var(--bg);border:1px solid ${ang?'#A7F3D0':'#FECACA'};border-left:4px solid ${ang?'var(--green2)':'var(--red2)'};margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px">
        <span style="font-size:10px;font-weight:700;font-family:'JetBrains Mono';color:var(--text3)">TOP ${b.top_nr||i+1}</span>
        <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;background:${ang?'var(--green3)':'var(--red3)'};color:${ang?'var(--green)':'var(--red)'}">${ang?'✓ ANGENOMMEN':'✕ ABGELEHNT'}</span>
        <span style="font-size:10px;color:var(--text3)">📍 ${esc(b.liegenschaft||'')} · ${esc(b.ev_titel||'')} · ${fmtDate(b.ev_datum)}</span>
      </div>
      <div style="font-size:12px;color:var(--text);font-weight:500">${esc(b.text)}</div>
      ${b.abstimmung?`<div style="font-size:11px;color:var(--text3);margin-top:3px">🗳 ${esc(b.abstimmung)}</div>`:''}
    </div>`;
  }).join(''):`<div style="color:var(--text3);font-size:12px;padding:12px 0;text-align:center">Noch keine Beschlüsse erfasst.</div>`;

  const termineTabState=window._termineTab||'ev'; window._termineTab=termineTabState;
  return `
  <div style="display:flex;gap:2px;margin-bottom:18px;border-bottom:1px solid var(--border)">
    <button onclick="window._termineTab='ev';switchView('termine')" class="nav-link${termineTabState==='ev'?' active':''}" style="font-size:13px;padding:8px 14px">🏛 Eigentümerversammlungen</button>
    <button onclick="window._termineTab='beschlusssammlung';switchView('termine')" class="nav-link${termineTabState==='beschlusssammlung'?' active':''}" style="font-size:13px;padding:8px 14px">📚 Beschlusssammlung</button>
    <button onclick="window._termineTab='andere';switchView('termine')" class="nav-link${termineTabState==='andere'?' active':''}" style="font-size:13px;padding:8px 14px">📅 Weitere Termine</button>
  </div>
  ${termineTabState==='ev'?`
  <div class="kpi-grid" style="margin-bottom:16px">
    <div class="kpi-card"><div class="kpi-label">EV Gesamt</div><div class="kpi-value kv-blue">${evGesamt}</div><div class="kpi-sub">geplant / archiviert</div><div class="kpi-accent-line" style="background:var(--blue2)"></div></div>
    <div class="kpi-card"><div class="kpi-label">Aktive Planungen</div><div class="kpi-value kv-gold">${evOffen}</div><div class="kpi-sub">in Bearbeitung</div><div class="kpi-accent-line" style="background:var(--gold2)"></div></div>
    <div class="kpi-card" ${evToday?'style="border-left:3px solid var(--red)"':''}><div class="kpi-label">${evToday?'🔴 ':''}Heute</div><div class="kpi-value ${evToday?'kv-red':''}">${evToday||0}</div><div class="kpi-sub">${evToday?'Versammlung läuft!':'keine EV heute'}</div><div class="kpi-accent-line" style="background:${evToday?'var(--red2)':'var(--border2)'}"></div></div>
    <div class="kpi-card" ${evAnf?'style="border-left:3px solid var(--gold)"':''}><div class="kpi-label">⏳ Anfechtungsfrist</div><div class="kpi-value kv-gold">${evAnf}</div><div class="kpi-sub">${evAnf?'Fristen laufen!':'keine aktiven Fristen'}</div><div class="kpi-accent-line" style="background:var(--gold2)"></div></div>
  </div>
  <div class="section-header" style="margin-bottom:12px">
    <div class="section-title">🏛 Eigentümerversammlungen</div>
    <button class="btn btn-gold btn-sm" onclick="openNewEVModal()">+ Neue EV planen</button>
  </div>
  ${evList.length?`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:14px">${evList.map(evCard).join('')}</div>`:`<div class="card">${noDaten('Keine Eigentümerversammlungen geplant.')}</div>`}
  `:termineTabState==='beschlusssammlung'?`
  <div class="kpi-grid" style="margin-bottom:16px">
    <div class="kpi-card"><div class="kpi-label">Beschlüsse Gesamt</div><div class="kpi-value kv-blue">${allBeschluesse.length}</div><div class="kpi-sub">aus ${evGesamt} Versammlungen</div><div class="kpi-accent-line" style="background:var(--blue2)"></div></div>
    <div class="kpi-card"><div class="kpi-label">Angenommen</div><div class="kpi-value kv-green">${beschlAngenommen}</div><div class="kpi-sub">${allBeschluesse.length?Math.round(beschlAngenommen/allBeschluesse.length*100):0}% Zustimmungsrate</div><div class="kpi-accent-line" style="background:var(--green2)"></div></div>
    <div class="kpi-card"><div class="kpi-label">Abgelehnt</div><div class="kpi-value kv-red">${allBeschluesse.length-beschlAngenommen}</div><div class="kpi-sub">nicht beschlossen</div><div class="kpi-accent-line" style="background:var(--red2)"></div></div>
  </div>
  <div class="section-header" style="margin-bottom:12px"><div class="section-title">📚 Beschlusssammlung (§ 24 Abs. 7 WEG)</div></div>
  <div style="background:var(--gold4);border:1px solid var(--gold3);border-radius:9px;padding:10px 14px;margin-bottom:14px;font-size:11px;color:var(--gold)">
    ⚠️ Die Beschlusssammlung ist gesetzlich vorgeschrieben. Jeder Beschluss muss <strong>unverzüglich</strong> eingetragen werden.
  </div>
  <div class="card">${beschlSammlungHtml}</div>
  `:`
  <div class="section-header" style="margin-bottom:12px"><div class="section-title">📅 Weitere Termine</div></div>
  <div class="card">${andereHtml||noDaten('Keine weiteren Termine.')}</div>
  `}`;
}

export async function loadEVData(evId) {
  const {data:t}=await window.db.from('termine').select('ev_checklisten,ev_tagesordnung,ev_abstimmungen,ev_protokoll,ev_einladung,ev_vollmachten').eq('id',evId).single();
  if(!t) return {checksMap:{},tops:[],abstMap:{},protokoll:{},einladung:{}};
  return {checksMap:t.ev_checklisten||{},tops:t.ev_tagesordnung||[],abstMap:t.ev_abstimmungen||{},protokoll:t.ev_protokoll||{},einladung:{...(t.ev_einladung||{}),vollmachten:t.ev_vollmachten||0}};
}

// ── Helper (private, used within this module) ──
function openModalLoading(text='Lädt...') {
  document.getElementById('modalTitle').textContent=text;
  document.getElementById('modalBody').innerHTML=`<div style="display:flex;justify-content:center;padding:40px"><div class="loading-ring"></div></div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

export async function openEvPlanModal(ev) {
  const e=typeof ev==='string'?JSON.parse(ev):ev;
  if(!window._evCache) window._evCache={};
  openModalLoading('⏳ Lade EV-Daten...');
  window._evCache[e.id]=await loadEVData(e.id);
  const today=new Date(); today.setHours(0,0,0,0);
  const evDate=new Date(e.termin_datum); evDate.setHours(0,0,0,0);
  const diffDays=Math.round((evDate-today)/86400000);
  const anfFrist=new Date(evDate); anfFrist.setMonth(anfFrist.getMonth()+1);
  const anfTage=Math.max(0,Math.round((anfFrist-today)/86400000));
  const einladungFrist=new Date(evDate); einladungFrist.setDate(einladungFrist.getDate()-14);
  const einladungFrist3=new Date(evDate); einladungFrist3.setDate(einladungFrist3.getDate()-21);
  const checks=window._evCache?.[e.id]?.checksMap||{};
  const CHECKLISTS={
    vor:[
      {id:'v1',label:'Termin & Ort festgelegt',hint:'Gut erreichbar, nicht öffentlich, nahe am Objekt'},
      {id:'v2',label:'Tagesordnung erstellt',hint:'Alle TOP einzeln & eindeutig – kein Sammelthema'},
      {id:'v3',label:'Eigentümeranträge eingeholt',hint:'Rechtzeitig angefordert und in TO aufgenommen'},
      {id:'v4',label:'Einladung versandt (mind. 2 Wo.)',hint:`Spätestens: ${fmtDate(einladungFrist.toISOString())} – besser: ${fmtDate(einladungFrist3.toISOString())}`},
      {id:'v5',label:'Unterlagen beigefügt',hint:'Jahresabrechnung, Wirtschaftsplan, Angebote'},
      {id:'v6',label:'Vollmachtsmuster versandt',hint:'Vertretungshinweise und Muster beigefügt'},
      {id:'v7',label:'Eigentümerliste aktuell',hint:'Mit Miteigentumsanteilen gepflegt'},
      {id:'v8',label:'Protokollgerüst vorbereitet',hint:'Anwesenheitsliste, Beschlusssammlung bereit'},
    ],
    waehrend:[
      {id:'w1',label:'Einladung + Beschlussfähigkeit geprüft',hint:'Zu Beginn protokolliert'},
      {id:'w2',label:'Versammlungsleitung gewählt',hint:'Verwalter, Eigentümer oder Neutraler'},
      {id:'w3',label:'Alle TOP der Reihe nach behandelt',hint:'Keine Beschlüsse unter Verschiedenes'},
      {id:'w4',label:'Abstimmungen korrekt durchgeführt',hint:'Prinzip je nach Regelung, Ergebnisse bekanntgegeben'},
      {id:'w5',label:'Protokoll laufend geführt',hint:'TOP, Diskussion, Beschlusstext, Ja/Nein/Enthaltung'},
      {id:'w6',label:'Verschiedenes: nur Info & Diskussion',hint:'Ausdrücklich kein Beschluss unter Verschiedenes'},
    ],
    nach:[
      {id:'n1',label:'Protokoll vollständig erstellt',hint:'Datum, Ort, Beginn/Ende, Teilnehmer, exakte Beschlusstexte'},
      {id:'n2',label:'Protokoll unterschrieben',hint:'Verwalter + Beiratsvorsitzender + Eigentümer'},
      {id:'n3',label:'Beschlusssammlung aktualisiert',hint:'Beschlüsse unverzüglich eingetragen'},
      {id:'n4',label:'Protokoll an Eigentümer versandt',hint:'Zeitnah, mit Frist für Rückfragen'},
      {id:'n5',label:'Beschlüsse umgesetzt / beauftragt',hint:'Dienstleister, Verträge, Maßnahmen angestoßen'},
      {id:'n6',label:'Anfechtungsfrist überwacht',hint:`Frist bis: ${fmtDate(anfFrist.toISOString())} (${anfTage} Tage)`},
    ]
  };
  function chkHtml(list) {
    return list.map(item=>{
      const checked=!!checks[item.id];
      return `<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border-radius:8px;background:${checked?'var(--green3)':'var(--bg)'};border:1px solid ${checked?'#A7F3D0':'var(--border)'};margin-bottom:6px;cursor:pointer;transition:all .15s"
        onclick="evToggleCheck('${e.id}','${item.id}',this)">
        <div style="width:18px;height:18px;border-radius:4px;border:2px solid ${checked?'var(--green2)':'var(--border2)'};background:${checked?'var(--green2)':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;color:white;margin-top:1px">${checked?'✓':''}</div>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:${checked?'500':'600'};color:${checked?'var(--green)':'var(--text)'};${checked?'text-decoration:line-through;opacity:.7':''}">${esc(item.label)}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">${esc(item.hint)}</div>
        </div>
      </div>`;
    }).join('');
  }
  const totalAll=Object.values(CHECKLISTS).flat().length;
  const doneAll=Object.values(CHECKLISTS).flat().filter(x=>checks[x.id]).length;
  const pct=Math.round((doneAll/totalAll)*100);
  const beschluesse=e.beschluesse||[];
  const scoreCritical=['v2','v4','v5','w1','w3','w5','n1','n2','n3'];
  const scoreDone=scoreCritical.filter(id=>checks[id]).length;
  const scoreColor=scoreDone>=8?'var(--green)':scoreDone>=5?'var(--gold)':'var(--red)';
  const toItems=(window._evCache?.[e.id]?.tops||[]).map(t=>({id:t.id,text:t.text,typ:t.typ}));
  const abstData=window._evCache?.[e.id]?.abstMap||{};

  const body=`
    <div style="background:linear-gradient(135deg,#1C1917,#292524);border-radius:12px;padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;gap:14px">
      <div style="flex:1">
        <div style="font-size:11px;color:rgba(255,255,255,.4);margin-bottom:2px">${esc(e.liegenschaft_name||'')} · ${fmtDate(e.termin_datum)}</div>
        <div style="font-size:11px;color:rgba(255,255,255,.5)">${diffDays>0?'in '+diffDays+' Tagen':diffDays===0?'<strong style="color:#EF4444">HEUTE</strong>':'vor '+Math.abs(diffDays)+' Tagen'} · ${esc(e.ort||'Kein Ort')}</div>
        <div style="margin-top:8px;background:rgba(255,255,255,.1);border-radius:4px;height:6px"><div style="height:100%;border-radius:4px;background:${pct>=100?'#22C55E':pct>60?'#D97706':'#EF4444'};width:${pct}%;transition:width .5s"></div></div>
        <div style="font-size:10px;color:rgba(255,255,255,.35);margin-top:4px">${doneAll}/${totalAll} Checklisten-Punkte erledigt</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:28px;font-weight:700;font-family:'Playfair Display';color:${scoreColor}">${scoreDone}/${scoreCritical.length}</div>
        <div style="font-size:9px;color:rgba(255,255,255,.35);letter-spacing:1px">RECHTS-<br>SICHERHEIT</div>
      </div>
    </div>
    <div style="display:flex;gap:2px;margin-bottom:14px;border-bottom:1px solid var(--border)">
      ${['tagesordnung','vor','waehrend','nach','beschluesse','protokoll'].map(tab=>{
        const labels={tagesordnung:'📋 Tagesordnung',vor:'🗓 Vorbereitung',waehrend:'🏛 Versammlung',nach:'📄 Nachbereitung',beschluesse:'🗳 Abstimmung',protokoll:'📝 Protokoll'};
        return `<button onclick="document.querySelectorAll('.ev-panel').forEach(x=>x.style.display='none');document.getElementById('evp-${e.id}-${tab}').style.display='block';document.querySelectorAll('.ev-tab').forEach(x=>x.classList.remove('active'));this.classList.add('active')"
          class="ev-tab nav-link" style="font-size:12px;padding:6px 10px" data-etab="${tab}">${labels[tab]}</button>`;
      }).join('')}
    </div>
    <div id="evp-${e.id}-tagesordnung" class="ev-panel">
      <div style="background:var(--gold4);border:1px solid var(--gold3);border-radius:9px;padding:10px 12px;margin-bottom:12px;font-size:11px;color:var(--gold)">⚠️ Jeden Beschluss-TOP <strong>einzeln und eindeutig</strong> formulieren. <strong>Kein Beschluss unter "Verschiedenes"!</strong></div>
      <div id="evTOList_${e.id}">${renderTOList(e.id)}</div>
      <div style="background:var(--bg3);border-radius:10px;padding:12px 14px;margin-top:12px;border:1px dashed var(--border2)">
        <div style="display:flex;gap:8px;margin-bottom:8px"><select id="evTOTyp_${e.id}" class="form-input" style="width:auto;margin:0;font-size:12px"><option value="beschluss">📊 Beschlussfassung</option><option value="info">ℹ️ Information</option><option value="verschiedenes">💬 Verschiedenes</option></select></div>
        <div style="display:flex;gap:8px"><input id="evTOInput_${e.id}" class="form-input" style="margin:0;font-size:12px;flex:1" placeholder="Tagesordnungspunkt-Titel..."><button class="btn btn-gold btn-sm" onclick="addTOPItem('${e.id}')">+ Hinzufügen</button></div>
      </div>
      <div style="margin-top:14px">
        <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">📋 Häufige Vorlagen</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="addTOPTemplate('${e.id}','info','Begrüßung und Eröffnung, Feststellung der Beschlussfähigkeit')">+ Begrüßung</button>
          <button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="addTOPTemplate('${e.id}','beschluss','Genehmigung der Jahresabrechnung')">+ Jahresabrechnung</button>
          <button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="addTOPTemplate('${e.id}','beschluss','Beschlussfassung über den Wirtschaftsplan')">+ Wirtschaftsplan</button>
          <button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="addTOPTemplate('${e.id}','beschluss','Verwalterbestellung / -abberufung')">+ Verwalterbestellung</button>
          <button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="addTOPTemplate('${e.id}','beschluss','Beschlussfassung Sonderumlage')">+ Sonderumlage</button>
          <button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="addTOPTemplate('${e.id}','verschiedenes','Verschiedenes (nur Information – kein Beschluss!)')">+ Verschiedenes ⚠️</button>
        </div>
      </div>
    </div>
    <div id="evp-${e.id}-vor" class="ev-panel" style="display:none">
      <div style="background:var(--gold4);border:1px solid var(--gold3);border-radius:9px;padding:10px 12px;margin-bottom:12px;font-size:11px;color:var(--gold)">💡 Einladung spätestens: <strong>${fmtDate(einladungFrist.toISOString())}</strong> · Empfohlen: <strong>${fmtDate(einladungFrist3.toISOString())}</strong></div>
      ${chkHtml(CHECKLISTS.vor)}
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-top:14px">
        <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">📨 Einladungsversand dokumentieren</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Versanddatum</div><input id="evEinlDatum_${e.id}" type="date" class="form-input" style="margin:0;font-size:12px" value="${window._evCache?.[e.id]?.einladung?.datum||''}" onchange="evSaveEinladung('${e.id}')"></div>
          <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Versandart</div><select id="evEinlArt_${e.id}" class="form-input" style="margin:0;font-size:12px" onchange="evSaveEinladung('${e.id}')">${['','E-Mail','Briefpost','Einschreiben','E-Mail + Post'].map(a=>`<option value="${a}" ${(window._evCache?.[e.id]?.einladung?.art||'')===a?'selected':''}>${a||'– Art wählen –'}</option>`).join('')}</select></div>
        </div>
        <div style="display:flex;gap:8px;align-items:center"><input id="evEinlAnzahl_${e.id}" type="number" min="0" class="form-input" style="margin:0;font-size:12px;width:100px" value="${window._evCache?.[e.id]?.einladung?.anzahl||''}" onchange="evSaveEinladung('${e.id}')"><button class="btn btn-gold btn-sm" onclick="evSaveEinladung('${e.id}');toast('✓ gespeichert')">Speichern</button></div>
      </div>
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-top:10px">
        <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">📋 Vollmachten erfassen</div>
        <div style="display:flex;gap:8px;align-items:center"><button onclick="evVollmacht('${e.id}',-1)" style="width:26px;height:26px;border-radius:50%;border:1px solid var(--border2);background:var(--bg);cursor:pointer;font-size:14px">−</button><div id="evVollmachtCount_${e.id}" style="font-size:20px;font-weight:700;color:var(--blue);min-width:32px;text-align:center">${window._evCache?.[e.id]?.einladung?.vollmachten||0}</div><button onclick="evVollmacht('${e.id}',1)" style="width:26px;height:26px;border-radius:50%;border:1px solid var(--blue2);background:var(--blue4);cursor:pointer;font-size:14px;color:var(--blue)">+</button><div style="font-size:11px;color:var(--text3)">eingegangene Vollmachten</div></div>
      </div>
    </div>
    <div id="evp-${e.id}-waehrend" class="ev-panel" style="display:none">
      <div style="background:var(--blue4);border:1px solid #BFDBFE;border-radius:9px;padding:10px 12px;margin-bottom:12px;font-size:11px;color:var(--blue)">⚠️ Kein wirksamer Beschluss unter "Verschiedenes"!</div>
      ${chkHtml(CHECKLISTS.waehrend)}
    </div>
    <div id="evp-${e.id}-nach" class="ev-panel" style="display:none">
      <div style="background:${anfTage>0&&beschluesse.length?'var(--red3)':'var(--green3)'};border:1px solid ${anfTage>0&&beschluesse.length?'#FECACA':'#A7F3D0'};border-radius:9px;padding:10px 12px;margin-bottom:12px;font-size:11px;color:${anfTage>0&&beschluesse.length?'var(--red)':'var(--green)'}">
        ${anfTage>0&&beschluesse.length?`⏳ Anfechtungsfrist läuft noch ${anfTage} Tage! Bis: ${fmtDate(anfFrist.toISOString())}`:'✅ Anfechtungsfrist abgelaufen oder keine Beschlüsse.'}
      </div>
      ${chkHtml(CHECKLISTS.nach)}
    </div>
    <div id="evp-${e.id}-beschluesse" class="ev-panel" style="display:none">
      <div style="background:var(--blue4);border:1px solid #BFDBFE;border-radius:9px;padding:10px 12px;margin-bottom:12px;font-size:11px;color:var(--blue)">🗳 Abstimmungsprinzip prüfen: <strong>Kopfprinzip</strong> · <strong>MEA-Prinzip</strong> · <strong>Objektprinzip</strong></div>
      ${(()=>{
        const beschlTops=toItems.filter(t=>t.typ==='beschluss');
        if(!beschlTops.length) return `<div style="color:var(--text3);font-size:12px;padding:12px 0;text-align:center">Erst TOPs in der Tagesordnung anlegen.</div>`;
        return beschlTops.map((t,idx)=>{
          const key='top_'+idx;
          const ab=abstData[key]||{ja:0,nein:0,enthaltung:0,prinzip:'kopf',ergebnis:''};
          const ang=ab.ergebnis==='angenommen', abgel=ab.ergebnis==='abgelehnt';
          return `<div style="background:var(--bg);border:1px solid ${ang?'#A7F3D0':abgel?'#FECACA':'var(--border)'};border-left:4px solid ${ang?'var(--green2)':abgel?'var(--red2)':'var(--border2)'};border-radius:10px;padding:12px 14px;margin-bottom:10px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
              <div style="width:22px;height:22px;border-radius:50%;background:var(--blue4);border:1px solid #BFDBFE;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--blue);flex-shrink:0">${idx+1}</div>
              <div style="flex:1;font-size:12px;font-weight:600;color:var(--text)">${esc(t.text)}</div>
              ${ab.ergebnis?`<span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:100px;background:${ang?'var(--green3)':'var(--red3)'};color:${ang?'var(--green)':'var(--red)'}">${ang?'✓ ANGENOMMEN':'✕ ABGELEHNT'}</span>`:''}
            </div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">
              ${['kopf','mea','objekt'].map(p=>`<button onclick="evSetPrinzip('${e.id}','${key}','${p}',this)" style="padding:3px 9px;border-radius:100px;border:1px solid ${ab.prinzip===p?'var(--blue2)':'var(--border2)'};background:${ab.prinzip===p?'var(--blue4)':'transparent'};font-size:10px;font-weight:700;color:${ab.prinzip===p?'var(--blue)':'var(--text3)'};cursor:pointer" data-p="${p}">${p==='kopf'?'👤 Kopf':p==='mea'?'📐 MEA':'🏠 Objekt'}</button>`).join('')}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;align-items:center">
              <div><div style="font-size:10px;color:var(--green);font-weight:700;margin-bottom:3px">✓ JA</div><div style="display:flex;align-items:center;gap:4px"><button onclick="evAbst('${e.id}','${key}','ja',-1)" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--border2);background:var(--bg3);cursor:pointer;font-size:12px">−</button><div id="evab_${e.id}_${key}_ja" style="font-size:16px;font-weight:700;color:var(--green);min-width:24px;text-align:center">${ab.ja||0}</div><button onclick="evAbst('${e.id}','${key}','ja',1)" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--green2);background:var(--green3);cursor:pointer;font-size:12px;color:var(--green)">+</button></div></div>
              <div><div style="font-size:10px;color:var(--red);font-weight:700;margin-bottom:3px">✕ NEIN</div><div style="display:flex;align-items:center;gap:4px"><button onclick="evAbst('${e.id}','${key}','nein',-1)" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--border2);background:var(--bg3);cursor:pointer;font-size:12px">−</button><div id="evab_${e.id}_${key}_nein" style="font-size:16px;font-weight:700;color:var(--red);min-width:24px;text-align:center">${ab.nein||0}</div><button onclick="evAbst('${e.id}','${key}','nein',1)" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--red2);background:var(--red3);cursor:pointer;font-size:12px;color:var(--red)">+</button></div></div>
              <div><div style="font-size:10px;color:var(--gold);font-weight:700;margin-bottom:3px">⊘ ENTHAL.</div><div style="display:flex;align-items:center;gap:4px"><button onclick="evAbst('${e.id}','${key}','enthaltung',-1)" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--border2);background:var(--bg3);cursor:pointer;font-size:12px">−</button><div id="evab_${e.id}_${key}_enthaltung" style="font-size:16px;font-weight:700;color:var(--gold);min-width:24px;text-align:center">${ab.enthaltung||0}</div><button onclick="evAbst('${e.id}','${key}','enthaltung',1)" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--gold3);background:var(--gold4);cursor:pointer;font-size:12px;color:var(--gold)">+</button></div></div>
              <div style="display:flex;flex-direction:column;gap:4px"><button onclick="evErgebnisFestlegen('${e.id}','${key}','angenommen')" style="padding:5px 8px;border-radius:6px;border:1px solid var(--green2);background:var(--green3);font-size:10px;font-weight:700;color:var(--green);cursor:pointer">✓ Annehmen</button><button onclick="evErgebnisFestlegen('${e.id}','${key}','abgelehnt')" style="padding:5px 8px;border-radius:6px;border:1px solid var(--red2);background:var(--red3);font-size:10px;font-weight:700;color:var(--red);cursor:pointer">✕ Ablehnen</button></div>
            </div>
          </div>`;
        }).join('');
      })()}
    </div>
    <div id="evp-${e.id}-protokoll" class="ev-panel" style="display:none">
      ${renderProtokollPanel(e)}
    </div>`;

  document.getElementById('modalTitle').textContent='🏛 '+e.titel;
  document.getElementById('modalBody').innerHTML=body;
  document.querySelector('.ev-tab')?.classList.add('active');
  document.getElementById('modalOverlay').classList.add('open');
}

export async function evToggleCheck(evId, checkId, el) {
  const checked=!el.classList.contains('checked');
  el.classList.toggle('checked',checked);
  el.style.background=checked?'var(--green3)':'var(--bg)';
  el.style.borderColor=checked?'#A7F3D0':'var(--border)';
  const box=el.querySelector('div');
  if(box){box.style.borderColor=checked?'var(--green2)':'var(--border2)';box.style.background=checked?'var(--green2)':'transparent';box.textContent=checked?'✓':'';}
  const lbl=el.querySelectorAll('div')[1]?.querySelector('div');
  if(lbl){lbl.style.textDecoration=checked?'line-through':'none';lbl.style.opacity=checked?'.7':'1';lbl.style.color=checked?'var(--green)':'var(--text)';}
  const {data:ev}=await window.db.from('termine').select('ev_checklisten').eq('id',evId).single();
  const checks=ev?.ev_checklisten||{};
  checks[checkId]=checked;
  await window.db.from('termine').update({ev_checklisten:checks}).eq('id',evId);
  toast(checked?'✓ Erledigt':'Offen gesetzt');
}

export function renderTOList(evId) {
  const ev=(window._lastTermine||[]).find(t=>t.id==evId)||{};
  const toItems=ev.ev_tagesordnung||[];
  if(!toItems.length) return `<div style="color:var(--text3);font-size:12px;padding:10px 0;text-align:center">Noch keine TOPs erfasst ⬇</div>`;
  const typIcons={beschluss:'📊',info:'ℹ️',verschiedenes:'💬'};
  const typLabels={beschluss:'Beschlussfassung',info:'Information',verschiedenes:'Verschiedenes'};
  return toItems.map((t,i)=>{
    const bg=t.typ==='verschiedenes'?'var(--gold4)':t.typ==='info'?'var(--bg)':'var(--blue4)';
    const bc=t.typ==='verschiedenes'?'var(--gold3)':t.typ==='info'?'var(--border)':'#BFDBFE';
    return `<div style="background:${bg};border:1px solid ${bc};border-radius:8px;padding:8px 12px;margin-bottom:6px;display:flex;align-items:flex-start;gap:10px">
      <div style="width:22px;height:22px;border-radius:50%;background:var(--bg3);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--text2);flex-shrink:0">${i+1}</div>
      <div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--text)">${esc(t.text)}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">${typIcons[t.typ]||'📋'} ${typLabels[t.typ]||t.typ}${t.typ==='verschiedenes'?' &nbsp;<strong style="color:var(--gold)">⚠️ kein Beschluss möglich!</strong>':''}</div></div>
      <button onclick="removeTOPItem('${evId}',${i})" style="background:none;border:none;color:var(--text4);cursor:pointer;font-size:14px;padding:2px 5px">✕</button>
    </div>`;
  }).join('');
}

export async function addTOPItem(evId) {
  const input=document.getElementById('evTOInput_'+evId), typSel=document.getElementById('evTOTyp_'+evId);
  const text=input?.value?.trim(); if(!text){toast('Bitte TOP-Text eingeben');return;}
  const {data:ev}=await window.db.from('termine').select('ev_tagesordnung').eq('id',evId).single();
  const toItems=[...(ev?.ev_tagesordnung||[])]; toItems.push({text,typ:typSel?.value||'beschluss'});
  await window.db.from('termine').update({ev_tagesordnung:toItems}).eq('id',evId);
  const t=(window._lastTermine||[]).find(x=>x.id==evId); if(t) t.ev_tagesordnung=toItems;
  input.value='';
  const listEl=document.getElementById('evTOList_'+evId); if(listEl) listEl.innerHTML=renderTOList(evId);
  toast('TOP hinzugefügt ✓');
}

export async function removeTOPItem(evId, idx) {
  const {data:ev}=await window.db.from('termine').select('ev_tagesordnung').eq('id',evId).single();
  const toItems=[...(ev?.ev_tagesordnung||[])]; toItems.splice(idx,1);
  await window.db.from('termine').update({ev_tagesordnung:toItems}).eq('id',evId);
  const t=(window._lastTermine||[]).find(x=>x.id==evId); if(t) t.ev_tagesordnung=toItems;
  const listEl=document.getElementById('evTOList_'+evId); if(listEl) listEl.innerHTML=renderTOList(evId);
  toast('TOP entfernt');
}

export async function addTOPTemplate(evId, typ, text) {
  const {data:ev}=await window.db.from('termine').select('ev_tagesordnung').eq('id',evId).single();
  const toItems=[...(ev?.ev_tagesordnung||[])];
  if(toItems.find(t=>t.text===text)){toast('Bereits in der Liste');return;}
  toItems.push({text,typ});
  await window.db.from('termine').update({ev_tagesordnung:toItems}).eq('id',evId);
  const t=(window._lastTermine||[]).find(x=>x.id==evId); if(t) t.ev_tagesordnung=toItems;
  const listEl=document.getElementById('evTOList_'+evId); if(listEl) listEl.innerHTML=renderTOList(evId);
  toast(text.substring(0,30)+'... ✓');
}

export async function evAbst(evId, topKey, field, delta) {
  const {data:ev}=await window.db.from('termine').select('ev_abstimmungen').eq('id',evId).single();
  const data=ev?.ev_abstimmungen||{};
  if(!data[topKey]) data[topKey]={ja:0,nein:0,enthaltung:0,prinzip:'kopf',ergebnis:''};
  data[topKey][field]=Math.max(0,(data[topKey][field]||0)+delta);
  await window.db.from('termine').update({ev_abstimmungen:data}).eq('id',evId);
  const t=(window._lastTermine||[]).find(x=>x.id==evId); if(t) t.ev_abstimmungen=data;
  const el=document.getElementById('evab_'+evId+'_'+topKey+'_'+field); if(el) el.textContent=data[topKey][field];
}

export async function evSetPrinzip(evId, topKey, prinzip, btn) {
  const {data:ev}=await window.db.from('termine').select('ev_abstimmungen').eq('id',evId).single();
  const data=ev?.ev_abstimmungen||{};
  if(!data[topKey]) data[topKey]={ja:0,nein:0,enthaltung:0,prinzip:'kopf',ergebnis:''};
  data[topKey].prinzip=prinzip;
  await window.db.from('termine').update({ev_abstimmungen:data}).eq('id',evId);
  const t=(window._lastTermine||[]).find(x=>x.id==evId); if(t) t.ev_abstimmungen=data;
  btn.closest('div').querySelectorAll('button[data-p]').forEach(b=>{
    const active=b.getAttribute('data-p')===prinzip;
    b.style.borderColor=active?'var(--blue2)':'var(--border2)';
    b.style.background=active?'var(--blue4)':'transparent';
    b.style.color=active?'var(--blue)':'var(--text3)';
  });
  toast('Prinzip: '+prinzip.toUpperCase());
}

export async function evErgebnisFestlegen(evId, topKey, ergebnis) {
  const {data:ev}=await window.db.from('termine').select('ev_abstimmungen').eq('id',evId).single();
  const data=ev?.ev_abstimmungen||{};
  if(!data[topKey]) data[topKey]={ja:0,nein:0,enthaltung:0,prinzip:'kopf',ergebnis:''};
  data[topKey].ergebnis=ergebnis;
  await window.db.from('termine').update({ev_abstimmungen:data}).eq('id',evId);
  const t=(window._lastTermine||[]).find(x=>x.id==evId); if(t) t.ev_abstimmungen=data;
  toast((ergebnis==='angenommen'?'✓ Angenommen':'✕ Abgelehnt')+' gespeichert!');
}

export async function evSaveEinladung(evId) {
  const datum=document.getElementById('evEinlDatum_'+evId)?.value;
  const art=document.getElementById('evEinlArt_'+evId)?.value;
  const anzahl=document.getElementById('evEinlAnzahl_'+evId)?.value;
  const einladung={datum,art,anzahl};
  await window.db.from('termine').update({ev_einladung:einladung}).eq('id',evId);
  const t=(window._lastTermine||[]).find(x=>x.id==evId); if(t) t.ev_einladung=einladung;
  toast('✓ Einladung gespeichert');
}

export async function evVollmacht(evId, delta) {
  const {data:ev}=await window.db.from('termine').select('ev_vollmachten').eq('id',evId).single();
  const neu=Math.max(0,(ev?.ev_vollmachten||0)+delta);
  await window.db.from('termine').update({ev_vollmachten:neu}).eq('id',evId);
  const t=(window._lastTermine||[]).find(x=>x.id==evId); if(t) t.ev_vollmachten=neu;
  const el=document.getElementById('evVollmachtCount_'+evId); if(el) el.textContent=neu;
  toast(delta>0?'Vollmacht +1':'Vollmacht −1');
}

export function renderProtokollPanel(e) {
  const prot=e.ev_protokoll||{}, toItems=e.ev_tagesordnung||[], abstData=e.ev_abstimmungen||{}, einl=e.ev_einladung||{}, vollm=e.ev_vollmachten||0;
  const topHtml=toItems.map((t,i)=>{
    const key='top_'+toItems.filter((x,j)=>x.typ==='beschluss'&&j<i).length;
    const ab=t.typ==='beschluss'?(abstData[key]||{}):null;
    return `<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:10px">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
        <div style="width:22px;height:22px;border-radius:50%;background:var(--blue4);border:1px solid #BFDBFE;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--blue);flex-shrink:0">${i+1}</div>
        <div style="flex:1;font-size:12px;font-weight:600;color:var(--text)">${esc(t.text)}</div>
      </div>
      <textarea id="evprot_${e.id}_disk_${i}" class="form-input" rows="2" style="margin:0;font-size:11px;resize:vertical" placeholder="Kurze Zusammenfassung der Diskussion..." onchange="evProtSave('${e.id}')">${esc(prot['disk_'+i]||'')}</textarea>
      ${t.typ==='beschluss'&&ab&&ab.ergebnis?`<div style="margin-top:8px;padding:8px 10px;border-radius:7px;background:${ab.ergebnis==='angenommen'?'var(--green3)':'var(--red3)'};border:1px solid ${ab.ergebnis==='angenommen'?'#A7F3D0':'#FECACA'};font-size:11px"><strong>${ab.ergebnis==='angenommen'?'✓ BESCHLUSS ANGENOMMEN':'✕ BESCHLUSS ABGELEHNT'}</strong>${ab.ja||ab.nein?` · Ja: ${ab.ja||0} / Nein: ${ab.nein||0} / Enthaltung: ${ab.enthaltung||0}`:''}</div>`:''}
    </div>`;
  }).join('');
  return `
    <div style="background:var(--gold4);border:1px solid var(--gold3);border-radius:9px;padding:10px 12px;margin-bottom:14px;font-size:11px;color:var(--gold)">⚖️ Alle Pflichtangaben müssen vollständig sein, bevor das Protokoll versandt wird.</div>
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">📋 Kopfdaten (Pflichtangaben)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Versammlungsbeginn</div><input id="evprot_${e.id}_beginn" type="time" class="form-input" style="margin:0;font-size:12px" value="${prot.beginn||''}" onchange="evProtSave('${e.id}')"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Versammlungsende</div><input id="evprot_${e.id}_ende" type="time" class="form-input" style="margin:0;font-size:12px" value="${prot.ende||''}" onchange="evProtSave('${e.id}')"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Versammlungsleitung</div><input id="evprot_${e.id}_leitung" class="form-input" style="margin:0;font-size:12px" value="${esc(prot.leitung||'')}" onchange="evProtSave('${e.id}')"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Protokollführer</div><input id="evprot_${e.id}_protokollfuehrer" class="form-input" style="margin:0;font-size:12px" value="${esc(prot.protokollfuehrer||'')}" onchange="evProtSave('${e.id}')"></div>
      </div>
    </div>
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">✅ Beschlussfähigkeit (§ 25 WEG)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Anwesend</div><input id="evprot_${e.id}_anwesend" type="number" min="0" class="form-input" style="margin:0;font-size:12px" value="${prot.anwesend||''}" onchange="evProtSave('${e.id}')"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Vollmachten</div><input id="evprot_${e.id}_vollmachten" type="number" min="0" class="form-input" style="margin:0;font-size:12px" value="${prot.vollmachten||vollm||''}" onchange="evProtSave('${e.id}')"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">MEA-Quorum (%)</div><input id="evprot_${e.id}_quorum" type="number" min="0" max="100" class="form-input" style="margin:0;font-size:12px" value="${prot.quorum||''}" onchange="evProtSave('${e.id}')"></div>
      </div>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="checkbox" id="evprot_${e.id}_beschlussf" ${prot.beschlussf?'checked':''} onchange="evProtSave('${e.id}')"> Beschlussfähigkeit festgestellt und protokolliert</label>
    </div>
    <div style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">📋 Tagesordnungspunkte &amp; Diskussion</div>
      ${topHtml||'<div style="color:var(--text3);font-size:12px;padding:10px 0">Erst TOPs in der Tagesordnung anlegen.</div>'}
    </div>
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">🔏 Abschluss &amp; Unterschriften</div>
      <div style="margin-bottom:8px"><textarea id="evprot_${e.id}_abschluss" class="form-input" rows="2" style="margin:0;font-size:11px;resize:vertical" placeholder="Nächste EV: voraussichtlich..." onchange="evProtSave('${e.id}')">${esc(prot.abschluss||'')}</textarea></div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="checkbox" id="evprot_${e.id}_sig_verwalter" ${prot.sig_verwalter?'checked':''} onchange="evProtSave('${e.id}')"> ✍️ Unterschrift Verwalter</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="checkbox" id="evprot_${e.id}_sig_beirat" ${prot.sig_beirat?'checked':''} onchange="evProtSave('${e.id}')"> ✍️ Unterschrift Beiratsvorsitzender</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="checkbox" id="evprot_${e.id}_sig_eigentuemer" ${prot.sig_eigentuemer?'checked':''} onchange="evProtSave('${e.id}')"> ✍️ Unterschrift Eigentümer (Zeuge)</label>
      </div>
      ${prot.sig_verwalter&&prot.sig_beirat&&prot.sig_eigentuemer?`<div style="margin-top:10px;padding:8px 12px;background:var(--green3);border:1px solid #A7F3D0;border-radius:7px;font-size:12px;font-weight:700;color:var(--green)">✅ Protokoll vollständig unterschrieben – rechtssicher!</div>`:`<div style="margin-top:10px;font-size:10px;color:var(--text3)">Alle 3 Unterschriften für rechtssichere Protokollierung empfohlen.</div>`}
    </div>
    <button class="btn btn-gold" onclick="evProtokollVorschau('${e.id}')">📄 Protokoll-Vorschau &amp; Export</button>`;
}

export async function evProtSave(evId) {
  const prot={};
  ['beginn','ende','leitung','protokollfuehrer','anwesend','vollmachten','quorum','abschluss'].forEach(f=>{
    const el=document.getElementById('evprot_'+evId+'_'+f); if(el) prot[f]=el.value;
  });
  ['beschlussf','sig_verwalter','sig_beirat','sig_eigentuemer'].forEach(f=>{
    const el=document.getElementById('evprot_'+evId+'_'+f); if(el) prot[f]=el.checked;
  });
  const ev=(window._lastTermine||[]).find(x=>x.id==evId)||{};
  const toItems=ev.ev_tagesordnung||[];
  toItems.forEach((_,i)=>{ const el=document.getElementById('evprot_'+evId+'_disk_'+i); if(el) prot['disk_'+i]=el.value; });
  await window.db.from('termine').update({ev_protokoll:prot}).eq('id',evId);
  const t=(window._lastTermine||[]).find(x=>x.id==evId); if(t) t.ev_protokoll=prot;
  toast('✓ Protokoll gespeichert');
}

export function evProtokollVorschau(evId) {
  const ev=(window._lastTermine||[]).find(t=>t.id==evId)||{};
  const prot=ev.ev_protokoll||{}, toItems=ev.ev_tagesordnung||[], abstData=ev.ev_abstimmungen||{};
  const topLines=toItems.map((t,i)=>{
    const key='top_'+toItems.filter((x,j)=>x.typ==='beschluss'&&j<i).length;
    const ab=t.typ==='beschluss'?(abstData[key]||{}):null;
    return `<div style="margin-bottom:14px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb">
      <div style="font-weight:700;margin-bottom:4px">TOP ${i+1}: ${t.text}</div>
      ${prot['disk_'+i]?`<div style="font-size:12px;color:#6b7280;margin-bottom:6px">${prot['disk_'+i]}</div>`:''}
      ${ab&&ab.ergebnis?`<div style="font-size:12px;font-weight:700;color:${ab.ergebnis==='angenommen'?'#16a34a':'#dc2626'}">${ab.ergebnis==='angenommen'?'BESCHLOSSEN':'ABGELEHNT'} · Ja: ${ab.ja||0} / Nein: ${ab.nein||0} / Enthaltung: ${ab.enthaltung||0}</div>`:''}
    </div>`;
  }).join('');
  document.getElementById('modalTitle').textContent='📄 Protokoll-Vorschau';
  document.getElementById('modalBody').innerHTML=`<div style="background:white;border-radius:10px;padding:16px;font-family:serif;color:#1a1a1a">
    <div style="text-align:center;margin-bottom:20px;border-bottom:2px solid #1a1a1a;padding-bottom:12px">
      <div style="font-size:20px;font-weight:700">PROTOKOLL – Eigentümerversammlung</div>
      <div style="font-size:13px;margin-top:4px">${esc(ev.liegenschaft_name||'')} · ${fmtDate(ev.termin_datum)} · ${esc(ev.ort||'')}</div>
    </div>
    <table style="width:100%;font-size:12px;margin-bottom:16px;border-collapse:collapse">
      <tr><td style="padding:3px 8px;color:#6b7280;width:160px">Beginn / Ende</td><td style="padding:3px 8px">${prot.beginn||'–'} Uhr / ${prot.ende||'–'} Uhr</td></tr>
      <tr><td style="padding:3px 8px;color:#6b7280">Versammlungsleitung</td><td style="padding:3px 8px">${prot.leitung||'–'}</td></tr>
      <tr><td style="padding:3px 8px;color:#6b7280">Protokollführer</td><td style="padding:3px 8px">${prot.protokollfuehrer||'–'}</td></tr>
      <tr><td style="padding:3px 8px;color:#6b7280">Anwesend</td><td style="padding:3px 8px">${prot.anwesend||'–'} Eigentümer + ${prot.vollmachten||'–'} Vollmachten</td></tr>
      <tr><td style="padding:3px 8px;color:#6b7280">Beschlussfähigkeit</td><td style="padding:3px 8px;font-weight:700;color:${prot.beschlussf?'#16a34a':'#dc2626'}">${prot.beschlussf?'✓ Festgestellt':'⚠️ Noch nicht bestätigt'}</td></tr>
    </table>
    <div style="font-size:13px;font-weight:700;margin-bottom:10px;border-bottom:1px solid #e5e7eb;padding-bottom:6px">Tagesordnungspunkte</div>
    ${topLines||'<div style="color:#6b7280;font-size:12px">Keine TOPs erfasst.</div>'}
    ${prot.abschluss?`<div style="margin-top:16px;padding:10px;border:1px solid #e5e7eb;border-radius:6px"><div style="font-weight:700;margin-bottom:4px">Abschluss</div><div style="font-size:12px">${esc(prot.abschluss)}</div></div>`:''}
    <div style="margin-top:24px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px">
      <div style="border-top:1px solid #1a1a1a;padding-top:8px;text-align:center;font-size:11px">Verwalter</div>
      <div style="border-top:1px solid #1a1a1a;padding-top:8px;text-align:center;font-size:11px">Beiratsvorsitzender</div>
      <div style="border-top:1px solid #1a1a1a;padding-top:8px;text-align:center;font-size:11px">Eigentümer (Zeuge)</div>
    </div>
  </div>
  <div style="display:flex;gap:8px;margin-top:12px">
    <button class="btn btn-gold" onclick="window.print()">🖨 Drucken / PDF</button>
    <button class="btn btn-ghost" onclick="closeModal()">Schließen</button>
  </div>`;
}

export function openNewEVModal() {
  document.getElementById('modalTitle').textContent='🏛 Neue Eigentümerversammlung planen';
  const liegs=APP.allLiegs||[], year=new Date().getFullYear();
  const defDate=new Date(Date.now()+35*86400000).toISOString().slice(0,10);
  const liegOpts=liegs.map(l=>`<option value="${l.id}">${esc(l.name)} (${esc(l.ort)})</option>`).join('');
  document.getElementById('modalBody').innerHTML=`
    <div class="form-group"><label class="form-label">Liegenschaft *</label><select id="newEvLieg" class="form-input"><option value="">– Bitte wählen –</option>${liegOpts}</select></div>
    <div class="form-group"><label class="form-label">Titel</label><input id="newEvTitel" class="form-input" value="Eigentümerversammlung ${year}"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="form-group"><label class="form-label">Datum *</label><input id="newEvDatum" class="form-input" type="date" value="${defDate}" oninput="(function(){const d=document.getElementById('newEvDatum').value;if(!d)return;const dt=new Date(d);const f14=new Date(dt);f14.setDate(f14.getDate()-14);const f21=new Date(dt);f21.setDate(f21.getDate()-21);document.getElementById('evFristMust').textContent=f14.toLocaleDateString('de-DE');document.getElementById('evFristOpt').textContent=f21.toLocaleDateString('de-DE');})()"></div>
      <div class="form-group"><label class="form-label">Uhrzeit</label><input id="newEvZeit" class="form-input" type="time" value="19:00"></div>
    </div>
    <div class="form-group"><label class="form-label">Versammlungsort</label><input id="newEvOrt" class="form-input" placeholder="Gemeinschaftsraum, Adresse..."></div>
    <div style="background:var(--gold4);border:1px solid var(--gold3);border-radius:9px;padding:12px 14px;margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:6px">⏰ Einladungsfristen (§ 24 WEG)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="background:var(--bg3);border-radius:7px;padding:8px 10px"><div style="font-size:10px;color:var(--text3);font-weight:600">SPÄTESTENS (14 Tage)</div><div style="font-size:13px;font-weight:700;color:var(--gold);font-family:'JetBrains Mono';margin-top:2px" id="evFristMust">–</div></div>
        <div style="background:var(--green3);border-radius:7px;padding:8px 10px"><div style="font-size:10px;color:var(--green);font-weight:600">EMPFOHLEN (21 Tage)</div><div style="font-size:13px;font-weight:700;color:var(--green);font-family:'JetBrains Mono';margin-top:2px" id="evFristOpt">–</div></div>
      </div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-gold" onclick="saveNewEV()">🏛 EV anlegen</button>
      <button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
  setTimeout(()=>document.getElementById('newEvDatum')?.dispatchEvent(new Event('input')),50);
}

export async function saveNewEV() {
  const liegenschaft_id=document.getElementById('newEvLieg')?.value;
  const titel=document.getElementById('newEvTitel')?.value?.trim();
  const datum=document.getElementById('newEvDatum')?.value;
  const zeit=document.getElementById('newEvZeit')?.value||'19:00';
  const ort=document.getElementById('newEvOrt')?.value?.trim();
  if(!liegenschaft_id||!datum){toast('⚠️ Bitte Liegenschaft und Datum ausfüllen');return;}
  const {error}=await window.db.from('termine').insert({
    liegenschaft_id:parseInt(liegenschaft_id),
    titel:titel||('Eigentümerversammlung '+new Date(datum).getFullYear()),
    termin_datum:datum+'T'+zeit+':00',
    termin_typ:'eigentümerversammlung',
    ort:ort||null,
  });
  if(error){toast('Fehler: '+error.message);return;}
  closeModal();
  toast('✓ EV angelegt – Checkliste öffnen!');
  switchView('termine');
}

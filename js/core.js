// ═══════════════════════════════════════════════════
// CORE — Auth, Navigation, Router, Modals
// ═══════════════════════════════════════════════════
import { APP, DEMO, NAV, NOTIFS, setDemoRole } from './state.js';
import { esc, fmtDate, evClass, evTag, evLabel, fmtDateTime, toast } from './utils.js';
import { getDashboardStats, getLiegenschaften, getLiegenschaftDetail, getTransaktionen,
         getTermine, getVertraege, getDokumente, getSchadensmeldungen, getDienstleister,
         getMeineWohnung, getVerwaltungsgebuehren } from './db.js';
import { tmplVerwDash, tmplVermieterDash, tmplMieterListe, tmplEinnahmen,
         tmplMeineWohnung, tmplZahlungen, tmplKontakt, tmplDokumente } from './views.js';
import { tmplLiegenschaften, tmplPropDetail, openProp, setLiegsFilter,
         openNeueLiegenschaftModal, saveNeueLiegenschaft,
         openNeueWohneinheitModal, saveNeueWohneinheit } from './liegenschaften.js';
import { selectApt, buildAptPanel, setAptTab, openAptKontaktForm, saveAptKontakt,
         aptKontaktDel, saveMietvertrag, toggleMVProp, aptNKJahr, aptNKManualAdd,
         aptNKArchivieren, aptArchivDetail, aptNKVorschau } from './wohneinheiten.js';
import { tmplFinanzenNeu } from './finanzen.js';
import { tmplDienstleister } from './dienstleister.js';
import { tmplSchaden, openSchadenModal, addTimeline, openModalLoading } from './schaden.js';
import { tmplVertraege, setVertragFilter, openVertragModal, vtTab,
         vertragArchivAdd, vertragArchivDel, vertragInArchiv,
         saveVertragNotiz, openNeuerVertragModal, saveNeuerVertrag } from './vertraege.js';
import { tmplTermine, loadEVData, openEvPlanModal, evToggleCheck, renderTOList,
         addTOPItem, removeTOPItem, addTOPTemplate, evAbst, evSetPrinzip,
         evErgebnisFestlegen, evSaveEinladung, evVollmacht, renderProtokollPanel,
         evProtSave, evProtokollVorschau, openNewEVModal, saveNewEV } from './termine.js';
import { tmplBewertung, bevTab, bevSelectLieg, renderBewertungDetail, updateVglWert,
         loadMietWE, refreshMietCalc, applyMietsteigerung, applyAlleMietsteigerungen,
         saveBewertungModal, saveBewertungDB, planMassnahme, saveMassnahmeDB, foerderInfo } from './bewertung.js';

// ── Theme ──
export function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme')==='dark';
  const next = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('pm-theme', next);
}
(function(){ const saved=localStorage.getItem('pm-theme'); if(saved) document.documentElement.setAttribute('data-theme',saved); })();

// ── Auth ──
export async function loadUserProfile(user) {
  APP.user = user;
  const { data: profile } = await window.db.from('profiles').select('*').eq('id',user.id).single();
  if (profile) { APP.profile = profile; APP.role = profile.role; }
}

export function showCover() {
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('cover-page').classList.add('active');
}
export function openLogin()  { document.getElementById('loginOverlay').classList.add('open'); }
export function closeLogin() { document.getElementById('loginOverlay').classList.remove('open'); }

export function selRole(role) {
  setDemoRole(role);
  document.querySelectorAll('.login-role-btn').forEach(b=>b.classList.toggle('active',b.dataset.role===role));
  document.getElementById('demoE').textContent = DEMO[role].e;
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPwd').value = '';
}
export function fillDemo() {
  const d = DEMO[window._DEMO_ROLE||'verwalter'];
  document.getElementById('loginEmail').value = d.e;
  document.getElementById('loginPwd').value = d.p;
}

export async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pwd   = document.getElementById('loginPwd').value;
  const errEl = document.getElementById('errMsg');
  const btn   = document.getElementById('loginBtn');
  errEl.classList.remove('show');
  if (!email||!pwd) { showErr('Bitte alle Felder ausfüllen.'); return; }
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-spinner"></span><span>Wird geprüft...</span>';
  const { error } = await window.db.auth.signInWithPassword({ email, password: pwd });
  if (error) {
    showErr('Anmeldung fehlgeschlagen: '+(error.message||'Unbekannter Fehler'));
    btn.disabled = false;
    btn.innerHTML = '<span>Anmelden</span><span>→</span>';
    return;
  }
  closeLogin();
  toast('Willkommen! ✓');
}
export function showErr(msg) {
  const e = document.getElementById('errMsg'); e.textContent = msg; e.classList.add('show');
}
export async function doLogout() { await window.db.auth.signOut(); toast('Erfolgreich abgemeldet 👋'); }

export function showApp() {
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('cover-page').classList.remove('active');
  document.getElementById('page-app').style.display = 'block';
  const p = APP.profile; if (!p) return;
  const cfg = {
    verwalter:{bg:'#FEF3C7',c:'#B45309',t:'VERWALTER'},
    vermieter:{bg:'#DBEAFE',c:'#1E40AF',t:'VERMIETER'},
    mieter:   {bg:'#DCFCE7',c:'#15803D',t:'MIETER'}
  };
  const rc = cfg[p.role]||cfg.mieter;
  const av = document.getElementById('navAv');
  av.textContent = (p.first_name[0]||'')+(p.last_name[0]||'');
  av.style.cssText = `background:${rc.bg};color:${rc.c};font-size:12px;font-weight:700;font-family:'Playfair Display'`;
  document.getElementById('navUname').textContent = p.first_name+' '+p.last_name;
  const rb = document.getElementById('navRole');
  rb.textContent = rc.t; rb.style.background = rc.bg; rb.style.color = rc.c;
  document.getElementById('drawerSub').textContent = p.first_name+' '+p.last_name;
  buildNav(); buildNotifs(); switchView('dashboard');
}

// ── Nav ──
export function buildNav() {
  const items = NAV[APP.role]||[];
  let nl='', dl='';
  items.forEach(n=>{
    nl += `<button class="nav-link" data-view="${n.v}" onclick="switchView('${n.v}')">${n.i} ${n.l}</button>`;
    dl += `<button class="drawer-link" data-view="${n.v}" onclick="switchView('${n.v}');closeDrawer()"><span class="di">${n.i}</span>${n.l}</button>`;
  });
  document.getElementById('navLinks').innerHTML = nl;
  document.getElementById('drawerLinks').innerHTML = dl;
}
export function setActiveNav(v) {
  document.querySelectorAll('.nav-link,.drawer-link').forEach(el=>el.classList.toggle('active',el.dataset.view===v));
}
export function buildNotifs() {
  const ns = NOTIFS[APP.role]||[];
  document.getElementById('notifBadge').textContent = ns.length;
  document.getElementById('notifList').innerHTML = ns.map(n=>`
    <div class="nd-item"><div class="nd-dot"></div><div class="nd-ico">${n.i}</div>
    <div><div class="nd-txt">${esc(n.t)}</div><div class="nd-time">${n.d}</div></div></div>`).join('');
}
export function toggleNotif() { document.getElementById('notifDrop').classList.toggle('open'); }
export function openDrawer()  { document.getElementById('drawer').classList.add('open'); }
export function closeDrawer() { document.getElementById('drawer').classList.remove('open'); }

// ── Router ──
export async function switchView(viewId) {
  APP.view = viewId;
  APP.selectedApt = null;
  setActiveNav(viewId);
  const el = document.getElementById('appContent');
  el.innerHTML = '<div style="display:flex;justify-content:center;padding:60px"><div class="loading-ring"></div></div>';
  try {
    switch (APP.role) {
      case 'verwalter': await renderVerwalter(viewId, el); break;
      case 'vermieter': await renderVermieter(viewId, el); break;
      case 'mieter':    await renderMieter(viewId, el);    break;
    }
  } catch(e) {
    el.innerHTML = `<div class="card"><p style="color:var(--red)">Fehler: ${esc(e.message)}</p></div>`;
    console.error(e);
  }
}

async function renderVerwalter(viewId, el) {
  switch (viewId) {
    case 'dashboard':       el.innerHTML = tmplVerwDash(await getDashboardStats()); break;
    case 'liegenschaften':  el.innerHTML = tmplLiegenschaften(await getLiegenschaften()); break;
    case 'property-detail': el.innerHTML = tmplPropDetail(await getLiegenschaftDetail(APP.currentProp).then(r=>{window._currentPropDetail=r;return r;})); break;
    case 'finanzen':        el.innerHTML = await tmplFinanzenNeu(); break;
    case 'dienstleister':   el.innerHTML = tmplDienstleister(await getDienstleister()); break;
    case 'schaden':         el.innerHTML = tmplSchaden(await getSchadensmeldungen()); break;
    case 'vertraege':       el.innerHTML = tmplVertraege(await getVertraege()); break;
    case 'termine':         el.innerHTML = tmplTermine(await getTermine().then(r=>{window._lastTermine=r;return r;})); break;
    case 'dokumente':       el.innerHTML = tmplDokumente(await getDokumente()); break;
    case 'bewertung':       el.innerHTML = await tmplBewertung(); break;
    default: el.innerHTML = '<div class="card">Ansicht nicht gefunden.</div>';
  }
}

async function renderVermieter(viewId, el) {
  switch (viewId) {
    case 'dashboard': {
      const liegs = await getLiegenschaften();
      const txs   = await getTransaktionen(10);
      el.innerHTML = tmplVermieterDash({
        stats: { total_miete:liegs.reduce((a,l)=>a+(l.stats?.total_miete||0),0), wohnungen:liegs.reduce((a,l)=>a+(l.stats?.total||0),0), leer:liegs.reduce((a,l)=>a+(l.stats?.vacant||0),0) },
        transaktionen: txs
      });
      break;
    }
    case 'meine-objekte':   el.innerHTML = tmplLiegenschaften(await getLiegenschaften()); break;
    case 'property-detail': el.innerHTML = tmplPropDetail(await getLiegenschaftDetail(APP.currentProp).then(r=>{window._currentPropDetail=r;return r;})); break;
    case 'mieter': {
      const all=[];
      for (const l of await getLiegenschaften()) {
        const d = await getLiegenschaftDetail(l.id);
        (d.wohneinheiten||[]).filter(w=>w.mieter_name).forEach(w=>all.push({...w,liegenschaft:l.name}));
      }
      el.innerHTML = tmplMieterListe(all);
      break;
    }
    case 'einnahmen':  el.innerHTML = tmplEinnahmen(await getTransaktionen(50)); break;
    case 'dokumente':  el.innerHTML = tmplDokumente(await getDokumente()); break;
    default: el.innerHTML = '<div class="card">Ansicht nicht verfügbar.</div>';
  }
}

async function renderMieter(viewId, el) {
  switch (viewId) {
    case 'dashboard':
    case 'meine-wohnung': el.innerHTML = tmplMeineWohnung(await getMeineWohnung()); break;
    case 'zahlungen':     el.innerHTML = tmplZahlungen(await getTransaktionen(30)); break;
    case 'dokumente':     el.innerHTML = tmplDokumente(await getDokumente()); break;
    case 'kontakt':       el.innerHTML = tmplKontakt(await getMeineWohnung()); break;
    default: el.innerHTML = '<div class="card">Ansicht nicht verfügbar.</div>';
  }
}

// ── Modal ──
export function openEventModal(ev) {
  const e = typeof ev==='string'?JSON.parse(ev):ev;
  document.getElementById('modalTitle').textContent = e.titel;
  let body = `<div class="ig">
    <div class="ig-item"><div class="ig-key">Datum</div><div class="ig-val">${fmtDate(e.termin_datum)}</div></div>
    <div class="ig-item"><div class="ig-key">Typ</div><div class="ig-val">${evLabel(e.termin_typ)}</div></div>
    <div class="ig-item ig-full"><div class="ig-key">Ort</div><div class="ig-val">${esc(e.ort||'–')}</div></div>
    <div class="ig-item ig-full"><div class="ig-key">Liegenschaft</div><div class="ig-val">${esc(e.liegenschaft_name||'–')}</div></div>
    ${e.beschreibung?`<div class="ig-item ig-full"><div class="ig-key">Beschreibung</div><div class="ig-val">${esc(e.beschreibung)}</div></div>`:''}
  </div>`;
  if (e.beschluesse?.length) {
    body += `<div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--text3);margin:14px 0 10px">Beschlüsse</div>`;
    e.beschluesse.forEach(r=>{
      body += `<div class="ri ${r.ergebnis==='angenommen'?'ri-pass':'ri-fail'}">
        <div class="ri-text">${esc(r.text)}</div>
        <div class="ri-vote">🗳 ${esc(r.abstimmung||'')} · ${r.ergebnis==='angenommen'?'✓ Angenommen':'✕ Abgelehnt'}</div></div>`;
    });
  }
  body += `<div style="margin-top:16px;display:flex;gap:7px;flex-wrap:wrap">
    <button class="btn btn-primary btn-sm" onclick="toast('Kalender ✓');closeModal()">📅 Kalender</button>
    <button class="btn btn-ghost btn-sm" onclick="toast('PDF...');closeModal()">📄 Protokoll PDF</button></div>`;
  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('modalOverlay').classList.add('open');
}

export function closeModal(e) {
  if (e&&e.target!==document.getElementById('modalOverlay')) return;
  document.getElementById('modalOverlay').classList.remove('open');
}

// ── Hero ──
export function buildHeroBuilding() {
  const el = document.getElementById('heroBuild'); if (!el) return;
  const towers = [{floors:5,units:[0,1,1,0,1,1,1,0,1,0,1,1,0,1,1]},{floors:7,units:[1,1,0,1,1,0,1,1,1,0,1,0,1,1,0,1,1,0,1,1,1]},{floors:4,units:[0,1,1,1,0,1,0,1,1,1,0,1]}];
  towers.forEach(t=>{
    const div=document.createElement('div'); div.className='b3d-tower';
    for (let f=0;f<t.floors;f++) {
      const row=document.createElement('div'); row.className='b3d-floor';
      row.style.cssText=`background:rgba(255,255,255,${0.02+f*0.01});animation-delay:${f*0.08}s`;
      const u1=t.units[f*2]||0, u2=t.units[f*2+1]!==undefined?t.units[f*2+1]:0;
      [u1,u2].forEach(occ=>{ const w=document.createElement('div'); w.className='b3d-win';
        w.style.background=occ?`rgba(255,220,120,${0.5+Math.random()*0.4})`:'rgba(255,255,255,0.05)';
        if(occ) w.style.boxShadow='0 0 4px rgba(255,200,80,.3)';
        w.onclick=()=>toast('Einheit – bitte anmelden'); row.appendChild(w); });
      div.appendChild(row);
    }
    el.appendChild(div);
  });
}
export function animateHeroStats() {
  function countUp(el,target,suffix='',duration=1200) {
    let start=0; const step=target/(duration/16);
    const id=setInterval(()=>{ start=Math.min(start+step,target); el.textContent=Math.round(start)+suffix; if(start>=target)clearInterval(id); },16);
  }
  setTimeout(()=>{ countUp(document.getElementById('hstatLieg'),3); countUp(document.getElementById('hstatWohn'),24); countUp(document.getElementById('hstatAusl'),88,'%'); },600);
}

// Click outside notif-dropdown closes it
document.addEventListener('click',e=>{
  const d=document.getElementById('notifDrop');
  const b=document.getElementById('notifBtn');
  if(d&&d.classList.contains('open')&&!d.contains(e.target)&&!b.contains(e.target)) d.classList.remove('open');
});

// Re-export everything needed on window (done in main.js)
export {
  tmplLiegenschaften, tmplPropDetail, openProp, setLiegsFilter,
  openNeueLiegenschaftModal, saveNeueLiegenschaft,
  openNeueWohneinheitModal, saveNeueWohneinheit,
  selectApt, buildAptPanel, setAptTab, openAptKontaktForm, saveAptKontakt,
  aptKontaktDel, saveMietvertrag, toggleMVProp, aptNKJahr, aptNKManualAdd,
  aptNKArchivieren, aptArchivDetail, aptNKVorschau,
  tmplFinanzenNeu, tmplDienstleister, tmplSchaden, openSchadenModal, addTimeline, openModalLoading,
  tmplVertraege, setVertragFilter, openVertragModal, vtTab, vertragArchivAdd, vertragArchivDel,
  vertragInArchiv, saveVertragNotiz, openNeuerVertragModal, saveNeuerVertrag,
  tmplTermine, loadEVData, openEvPlanModal, evToggleCheck, renderTOList, addTOPItem,
  removeTOPItem, addTOPTemplate, evAbst, evSetPrinzip, evErgebnisFestlegen, evSaveEinladung,
  evVollmacht, renderProtokollPanel, evProtSave, evProtokollVorschau, openNewEVModal, saveNewEV,
  tmplBewertung, bevTab, bevSelectLieg, renderBewertungDetail, updateVglWert,
  loadMietWE, refreshMietCalc, applyMietsteigerung, applyAlleMietsteigerungen,
  saveBewertungModal, saveBewertungDB, planMassnahme, saveMassnahmeDB, foerderInfo,
  APP
};

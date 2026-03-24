'use strict';

// ═══════════════════════════════════════════════════
// APP STATE
// ═══════════════════════════════════════════════════
let APP = {
  user: null,
  profile: null,
  role: '',
  view: '',
  selectedApt: null,
  currentProp: null,
  filters: { search: '', typ: '', ort: '', land: '', bundesland: '' },
  allLiegs: [],
  finTab: 'verwaltung',
  dlFilter: ''
};

// ═══ THEME TOGGLE ═══
function toggleTheme(){
  const isDark = document.documentElement.getAttribute('data-theme')==='dark';
  const next = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('pm-theme', next);
}
(function(){
  const saved = localStorage.getItem('pm-theme');
  if(saved) document.documentElement.setAttribute('data-theme', saved);
})();

const DEMO = {
  verwalter: { e: 'rico@propmanager.de',  p: 'Admin2024!' },
  vermieter: { e: 'meier@propmanager.de', p: 'Meier2024!' },
  mieter:    { e: 'braun@propmanager.de', p: 'Braun2024!' }
};
let DEMO_ROLE = 'verwalter';

const NOTIFS = {
  verwalter: [{i:'⚠️',t:'Vertrag Müllentsorgung abgelaufen',d:'vor 2 Std.'},{i:'🏠',t:'Wohnung 202 seit 45 Tagen leer',d:'vor 1 Tag'},{i:'📅',t:'Eigentümerversammlung in 9 Tagen',d:'vor 3 Tagen'}],
  vermieter: [{i:'💶',t:'Mietzahlung Mai eingegangen',d:'vor 1 Std.'},{i:'📋',t:'NK-Abrechnung verfügbar',d:'vor 2 Tagen'}],
  mieter:    [{i:'📄',t:'NK-Abrechnung 2024 verfügbar',d:'vor 3 Tagen'},{i:'🔧',t:'Heizungsrevision 22. Mai',d:'vor 5 Tagen'}],
};

// ═══════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════
window.addEventListener('load', async () => {
  buildHeroBuilding();
  animateHeroStats();

  const fallback = setTimeout(() => showCover(), 6000);

  try {
    const { data: { session } } = await db.auth.getSession();
    clearTimeout(fallback);
    if (session) {
      await loadUserProfile(session.user);
      showApp();
    } else {
      showCover();
    }
  } catch(e) {
    clearTimeout(fallback);
    console.error('Init Fehler:', e);
    showCover();
  }

  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await loadUserProfile(session.user);
      showApp();
    } else if (event === 'TOKEN_REFRESHED' && session) {
      APP.user = session.user; // Token still valid, silently update
    } else if (event === 'SIGNED_OUT') {
      APP.user = null; APP.profile = null; APP.role = '';
      document.getElementById('page-app').style.display = 'none';
      showCover();
    }
  });

  // ── Nach Idle / Tab-Wechsel: Session prüfen & ggf. erneuern ──
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || !APP.user) return;
    try {
      const { data: { session }, error } = await db.auth.getSession();
      if (error || !session) {
        // Token abgelaufen — zurück zum Login
        APP.user = null; APP.profile = null; APP.role = '';
        document.getElementById('page-app').style.display = 'none';
        showCover();
        toast('⏱ Sitzung abgelaufen — bitte erneut anmelden');
      }
      // Wenn Session noch gültig: Supabase hat sie ggf. gerade erneuert (TOKEN_REFRESHED event)
    } catch(e) { console.warn('Session-Check Fehler:', e); }
  });

  // ── Netzwerk wieder da: Gleicher Check ──
  window.addEventListener('online', async () => {
    if (!APP.user) return;
    const { data: { session } } = await db.auth.getSession().catch(()=>({data:{session:null}}));
    if (!session) {
      APP.user = null; APP.profile = null; APP.role = '';
      document.getElementById('page-app').style.display = 'none';
      showCover();
      toast('⏱ Sitzung abgelaufen — bitte erneut anmelden');
    }
  });
});

async function loadUserProfile(user) {
  APP.user = user;
  const { data: profile } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (profile) {
    APP.profile = profile;
    APP.role = profile.role;
  }
}

// ═══════════════════════════════════════════════════
// COVER & LOGIN
// ═══════════════════════════════════════════════════
function showCover() {
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('cover-page').classList.add('active');
}
function openLogin()  { document.getElementById('loginOverlay').classList.add('open'); }
function closeLogin() { document.getElementById('loginOverlay').classList.remove('open'); }

function selRole(role) {
  DEMO_ROLE = role;
  document.querySelectorAll('.login-role-btn').forEach(b => b.classList.toggle('active', b.dataset.role === role));
  document.getElementById('demoE').textContent = DEMO[role].e;
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPwd').value = '';
}
function fillDemo() {
  const d = DEMO[DEMO_ROLE];
  document.getElementById('loginEmail').value = d.e;
  document.getElementById('loginPwd').value = d.p;
}

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pwd   = document.getElementById('loginPwd').value;
  const errEl = document.getElementById('errMsg');
  const btn   = document.getElementById('loginBtn');
  errEl.classList.remove('show');
  if (!email || !pwd) { showErr('Bitte alle Felder ausfüllen.'); return; }

  const resetBtn = () => {
    btn.disabled = false;
    btn.innerHTML = '<span>Anmelden</span><span>→</span>';
  };

  btn.disabled = true;
  btn.innerHTML = '<span class="btn-spinner"></span><span>Wird geprüft...</span>';

  // Sicherheitsnetz: nach 10s automatisch zurücksetzen
  const timeoutId = setTimeout(() => {
    resetBtn();
    showErr('Zeitüberschreitung – bitte erneut versuchen.');
  }, 10000);

  try {
    const { data, error } = await db.auth.signInWithPassword({ email, password: pwd });
    clearTimeout(timeoutId);
    if (error) {
      showErr('Anmeldung fehlgeschlagen: ' + (error.message || 'Unbekannter Fehler'));
      resetBtn();
      return;
    }
    closeLogin();
    toast('Willkommen! ✓');
  } catch(e) {
    clearTimeout(timeoutId);
    showErr('Verbindungsfehler – bitte erneut versuchen.');
    resetBtn();
  }
}

function showErr(msg) {
  const e = document.getElementById('errMsg');
  e.textContent = msg;
  e.classList.add('show');
}

async function doLogout() {
  await db.auth.signOut();
  toast('Erfolgreich abgemeldet 👋');
}

// ═══════════════════════════════════════════════════
// APP ANZEIGEN
// ═══════════════════════════════════════════════════
function showApp() {
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('cover-page').classList.remove('active');
  document.getElementById('page-app').style.display = 'block';

  const p = APP.profile;
  if (!p) return;

  const cfg = {
    admin:             { bg:'#FCE7F3', c:'#9D174D', t:'ADMIN'            },
    geschaeftsfuehrer: { bg:'#EDE9FE', c:'#5B21B6', t:'GESCHÄFTSFÜHRER'  },
    bueroleiter:       { bg:'#FEF3C7', c:'#92400E', t:'BÜROLEITER'       },
    verwalter:         { bg:'#FEF3C7', c:'#B45309', t:'VERWALTER'        },
    vermieter:         { bg:'#DBEAFE', c:'#1E40AF', t:'VERMIETER'        },
    mieter:            { bg:'#DCFCE7', c:'#15803D', t:'MIETER'           },
  };
  const rc = cfg[p.role] || cfg.mieter;

  const av = document.getElementById('navAv');
  av.textContent = (p.first_name[0] || '') + (p.last_name[0] || '');
  av.style.cssText = `background:${rc.bg};color:${rc.c};font-size:12px;font-weight:700;font-family:'Playfair Display'`;
  document.getElementById('navUname').textContent = p.first_name + ' ' + p.last_name;
  const rb = document.getElementById('navRole');
  rb.textContent = rc.t; rb.style.background = rc.bg; rb.style.color = rc.c;
  document.getElementById('drawerSub').textContent = p.first_name + ' ' + p.last_name;

  buildNav();
  buildNotifs();
  switchView('dashboard');
}

// ═══════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════
const NAV = {
  // ── SYSTEM ──────────────────────────────────────────────────
  admin: [
    {v:'dashboard',          i:'⬡',  l:'Übersicht'},
    {v:'benutzerverwaltung', i:'👥',  l:'Benutzer'},
  ],
  // ── HAUSVERWALTUNG (intern) ──────────────────────────────────
  geschaeftsfuehrer: [
    {v:'dashboard',       i:'⬡',  l:'Übersicht'},
    {v:'liegenschaften',  i:'🏛',  l:'Liegenschaften'},
    {v:'finanzen',        i:'◈',  l:'Finanzen'},
    {v:'schaden',         i:'⚠️', l:'Schäden'},
    {v:'vertraege',       i:'◉',  l:'Verträge'},
    {v:'dokumente',       i:'📁', l:'Dokumente'},
    {v:'bewertung',       i:'📊', l:'Bewertung'},
  ],
  bueroleiter: [
    {v:'dashboard',       i:'⬡',  l:'Übersicht'},
    {v:'liegenschaften',  i:'🏛',  l:'Liegenschaften'},
    {v:'finanzen',        i:'◈',  l:'Finanzen'},
    {v:'dienstleister',   i:'🔧', l:'Dienstleister'},
    {v:'schaden',         i:'⚠️', l:'Schäden'},
    {v:'vertraege',       i:'◉',  l:'Verträge'},
    {v:'termine',         i:'◫',  l:'Termine'},
    {v:'dokumente',       i:'📁', l:'Dokumente'},
    {v:'bewertung',       i:'📊', l:'Bewertung'},
    {v:'teamverwaltung',  i:'🏢', l:'Team'},
  ],
  verwalter: [
    {v:'dashboard',       i:'⬡',  l:'Übersicht'},
    {v:'liegenschaften',  i:'🏛',  l:'Liegenschaften'},
    {v:'finanzen',        i:'◈',  l:'Finanzen'},
    {v:'dienstleister',   i:'🔧', l:'Dienstleister'},
    {v:'schaden',         i:'⚠️', l:'Schäden'},
    {v:'vertraege',       i:'◉',  l:'Verträge'},
    {v:'termine',         i:'◫',  l:'Termine'},
    {v:'dokumente',       i:'📁', l:'Dokumente'},
    {v:'bewertung',       i:'📊', l:'Bewertung'},
  ],
  // ── EXTERN ──────────────────────────────────────────────────
  vermieter: [
    {v:'dashboard',    i:'⬡',  l:'Übersicht'},
    {v:'meine-objekte',i:'🏛',  l:'Meine Objekte'},
    {v:'mieter',       i:'👥',  l:'Mieter'},
    {v:'einnahmen',    i:'◈',  l:'Einnahmen'},
    {v:'dokumente',    i:'📁', l:'Dokumente'},
  ],
  mieter: [
    {v:'dashboard',    i:'⬡',  l:'Übersicht'},
    {v:'meine-wohnung',i:'🏠',  l:'Meine Wohnung'},
    {v:'zahlungen',    i:'💳', l:'Zahlungen'},
    {v:'dokumente',    i:'📁', l:'Dokumente'},
    {v:'kontakt',      i:'📞', l:'Kontakt'},
  ],
};

// ═══════════════════════════════════════════════════
// RECHTE-SYSTEM
// ═══════════════════════════════════════════════════
const PERMISSIONS = {
  admin: {
    manage_users:true, assign_roles:true
    // Kein Zugriff auf Objekte, Finanzen oder operative Daten
  },
  geschaeftsfuehrer: {
    // Vollständiger LESE-Zugriff auf alle operativen Bereiche
    view_liegenschaften:true, view_finanzen:true, view_schaden:true,
    view_vertraege:true, view_termine:true, view_dokumente:true,
    view_bewertung:true, view_mieter:true, view_dienstleister:true,
    // KEIN Schreibzugriff → read_only = true
    read_only:true
  },
  bueroleiter: {
    // Vollständiger Schreibzugriff wie Verwalter PLUS Teamverwaltung
    view_liegenschaften:true, edit_liegenschaften:true, create_liegenschaft:true,
    view_finanzen:true,       edit_finanzen:true,
    view_schaden:true,        edit_schaden:true,
    view_vertraege:true,      edit_vertraege:true,
    view_termine:true,        edit_termine:true,
    view_dokumente:true,      edit_dokumente:true,
    view_bewertung:true,
    view_mieter:true,         edit_mieter:true,
    view_dienstleister:true,  edit_dienstleister:true,
    manage_team:true,         assign_verwalter:true,
  },
  verwalter: {
    view_liegenschaften:true, edit_liegenschaften:true,
    view_finanzen:true,       edit_finanzen:true,
    view_schaden:true,        edit_schaden:true,
    view_vertraege:true,      edit_vertraege:true,
    view_termine:true,        edit_termine:true,
    view_dokumente:true,      edit_dokumente:true,
    view_bewertung:true,
    view_mieter:true,         edit_mieter:true,
    view_dienstleister:true,  edit_dienstleister:true,
  },
  vermieter: {
    // Nur eigene Objekte (Filterung in getLiegenschaften)
    view_liegenschaften:true, view_finanzen:true,
    view_mieter:true,         view_dokumente:true,
  },
  mieter: {
    view_dokumente:true, create_schaden:true,
  }
};

/** Prüft ob der aktuell eingeloggte Benutzer die Aktion ausführen darf */
function can(action) {
  return !!(PERMISSIONS[APP.role]?.[action]);
}
/** true wenn die Rolle nur Lesezugriff hat (kein Schreiben, kein Erstellen) */
function isReadOnly() {
  return !!(PERMISSIONS[APP.role]?.read_only);
}
/** Intern-Rolle (Hausverwaltung) → hat Zugriff auf operative Objekte */
function isHausverwaltung() {
  return ['geschaeftsfuehrer','bueroleiter','verwalter'].includes(APP.role);
}

function buildNav() {
  const items = NAV[APP.role] || [];
  let nl = '', dl = '';
  items.forEach(n => {
    nl += `<button class="nav-link" data-view="${n.v}" onclick="switchView('${n.v}')">${n.i} ${n.l}</button>`;
    dl += `<button class="drawer-link" data-view="${n.v}" onclick="switchView('${n.v}');closeDrawer()"><span class="di">${n.i}</span>${n.l}</button>`;
  });
  document.getElementById('navLinks').innerHTML = nl;
  document.getElementById('drawerLinks').innerHTML = dl;
}

function setActiveNav(v) {
  document.querySelectorAll('.nav-link,.drawer-link').forEach(el => el.classList.toggle('active', el.dataset.view === v));
}

async function switchView(viewId) {
  APP.view = viewId;
  APP.selectedApt = null;
  setActiveNav(viewId);
  const el = document.getElementById('appContent');
  el.innerHTML = '<div style="display:flex;justify-content:center;padding:60px"><div class="loading-ring"></div></div>';
  try {
    switch (APP.role) {
      case 'admin':             await renderAdmin(viewId, el);            break;
      case 'geschaeftsfuehrer': await renderGeschaeftsfuehrer(viewId, el); break;
      case 'bueroleiter':       await renderBueroleiter(viewId, el);       break;
      case 'verwalter':         await renderVerwalter(viewId, el);         break;
      case 'vermieter':         await renderVermieter(viewId, el);         break;
      case 'mieter':            await renderMieter(viewId, el);            break;
    }
  } catch(e) {
    el.innerHTML = `<div class="card"><p style="color:var(--red)">Fehler: ${esc(e.message)}</p></div>`;
    console.error(e);
  }
}

// ═══════════════════════════════════════════════════
// DATEN: SUPABASE ABFRAGEN
// ═══════════════════════════════════════════════════

async function getLiegenschaften() {
  const { data, error } = await db
    .from('liegenschaften')
    .select('*, wohneinheiten(id, status, nettomiete, nebenkosten)')
    .eq('aktiv', true)
    .order('name');
  if (error) throw error;
  return (data || []).map(p => ({
    ...p,
    stats: {
      total:       p.wohneinheiten?.length || 0,
      occupied:    p.wohneinheiten?.filter(w => w.status === 'occupied').length || 0,
      vacant:      p.wohneinheiten?.filter(w => w.status === 'vacant').length || 0,
      total_miete: p.wohneinheiten?.reduce((a, w) => a + (parseFloat(w.nettomiete) || 0), 0) || 0,
    }
  }));
}

async function getLiegenschaftDetail(id) {
  const { data: prop, error } = await db
    .from('liegenschaften').select('*').eq('id', id).single();
  if (error) throw error;

  const { data: we } = await db
    .from('wohneinheiten')
    .select('*, eigentuemer:eigentuemer_id(first_name, last_name, phone), mieter:mieter_id(first_name, last_name, phone), mieter_vorname, mieter_nachname, mieter_email, mieter_telefon, mieter_iban')
    .eq('liegenschaft_id', id)
    .order('etage').order('nummer');

  return {
    ...prop,
    wohneinheiten: (we || []).map(w => ({
      ...w,
      eigentuemer_name:  w.eigentuemer ? w.eigentuemer.first_name + ' ' + w.eigentuemer.last_name : null,
      eigentuemer_phone: w.eigentuemer?.phone || null,
      mieter_name:       w.mieter ? w.mieter.first_name + ' ' + w.mieter.last_name
                         : (w.mieter_vorname ? w.mieter_vorname + ' ' + (w.mieter_nachname||'') : null),
      mieter_phone:      w.mieter?.phone || w.mieter_telefon || null,
      mieter_email_addr: w.mieter?.email || w.mieter_email || null,
      mieter_iban_nr:    w.mieter_iban || null,
    }))
  };
}

async function getTransaktionen(limit = 50) {
  let q = db.from('transaktionen')
    .select('*, liegenschaften(name)')
    .order('buchungsdatum', { ascending: false })
    .limit(limit);
  if (APP.role === 'mieter') {
    const wId = await getMeineWohnungId();
    if (wId) q = q.eq('wohneinheit_id', wId);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(t => ({ ...t, liegenschaft_name: t.liegenschaften?.name || null }));
}

async function getTermine() {
  const { data, error } = await db
    .from('termine')
    .select('*, liegenschaften(name), beschluesse(*)')
    .order('termin_datum', { ascending: true });
  if (error) throw error;
  return (data || []).map(t => ({
    ...t,
    liegenschaft_name: t.liegenschaften?.name || null,
    beschluesse: t.beschluesse || []
  }));
}

async function getVertraege() {
  const { data, error } = await db
    .from('vertraege').select('*, liegenschaften(name)').order('name');
  if (error) throw error;
  return (data || []).map(v => ({ ...v, liegenschaft_name: v.liegenschaften?.name || null }));
}

async function getDokumente() {
  const { data, error } = await db
    .from('dokumente')
    .select('*, liegenschaften(name)')
    .order('erstellt_am', { ascending: false });
  if (error) throw error;
  return (data || []).map(d => ({ ...d, liegenschaft_name: d.liegenschaften?.name || null }));
}

async function getMeineWohnungId() {
  const { data } = await db.from('wohneinheiten').select('id').eq('mieter_id', APP.user.id).single();
  return data?.id || null;
}

async function getMeineWohnung() {
  const { data, error } = await db
    .from('wohneinheiten')
    .select('*, liegenschaft:liegenschaft_id(name, strasse, plz, ort), eigentuemer:eigentuemer_id(first_name, last_name, phone)')
    .eq('mieter_id', APP.user.id)
    .single();
  if (error) return { error: 'Keine Wohnung gefunden.' };
  const termine = await getTermine();
  return {
    ...data,
    liegenschaft_name: data.liegenschaft?.name,
    strasse: data.liegenschaft?.strasse,
    plz:     data.liegenschaft?.plz,
    ort:     data.liegenschaft?.ort,
    kontakt_name:  data.eigentuemer ? data.eigentuemer.first_name + ' ' + data.eigentuemer.last_name : null,
    kontakt_phone: data.eigentuemer?.phone,
    kontakt_typ:   data.eigentuemer ? 'eigentuemer' : 'verwaltung',
    termine: termine.slice(0, 3)
  };
}

async function getVerwaltungsgebuehren() {
  const { data, error } = await db
    .from('verwaltungsgebuehren')
    .select('*, liegenschaften(name, ort)')
    .order('liegenschaft_id');
  if (error) throw error;
  return data || [];
}

async function getDienstleister() {
  const { data, error } = await db
    .from('dienstleister')
    .select('*, dienstleister_liegenschaften(liegenschaft_id, leistung, liegenschaften(name, ort))')
    .eq('aktiv', true)
    .order('name');
  if (error) throw error;
  return data || [];
}

async function getSchadensmeldungen() {
  const { data, error } = await db
    .from('schadensmeldungen')
    .select('*, liegenschaften(name,ort), wohneinheiten(nummer), dienstleister(name,telefon,kategorie)')
    .order('erstellt_am', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getDashboardStats() {
  const [liegs, termine, schaden, vertraege, txs] = await Promise.all([
    getLiegenschaften(),
    getTermine(),
    getSchadensmeldungen(),
    getVertraege(),
    getTransaktionen(50),
  ]);

  const total_we    = liegs.reduce((a,l) => a + (l.stats?.total    || 0), 0);
  const belegt      = liegs.reduce((a,l) => a + (l.stats?.occupied || 0), 0);
  const total_miete = liegs.reduce((a,l) => a + (l.stats?.total_miete || 0), 0);

  const now   = new Date(); now.setHours(0,0,0,0);
  const in30  = new Date(now); in30.setDate(in30.getDate() + 30);
  const in7   = new Date(now); in7.setDate(in7.getDate() + 7);

  // Schäden
  const schadenOffen   = schaden.filter(s => !['erledigt','abgeschlossen'].includes(s.status));
  const schadenNotfall = schadenOffen.filter(s => s.prioritaet === 'notfall');

  // Verträge ablaufend
  const vertraegeAblauf = vertraege.filter(v => {
    if (!v.ende_datum) return false;
    const d = new Date(v.ende_datum);
    return d >= now && d <= in30;
  });

  // Offene Zahlungen
  const offeneZahlungen = txs.filter(t => t.bezahlt === false || t.bezahlt === null);

  // Termine (7 Tage + alle für Kalender)
  const upcoming7  = termine.filter(t => { const d=new Date(t.termin_datum); return d>=now && d<=in7; });
  const upcoming30 = termine.filter(t => { const d=new Date(t.termin_datum); return d>=now; })
                            .sort((a,b)=>new Date(a.termin_datum)-new Date(b.termin_datum))
                            .slice(0, 8);

  // Pro Liegenschaft: Schäden + nächster Termin + offene Zahlungen
  const liegStatus = liegs.map(l => {
    const lSchaeden  = schadenOffen.filter(s => s.liegenschaft_id === l.id);
    const lTermine   = termine.filter(t => t.liegenschaft_id === l.id && new Date(t.termin_datum) >= now)
                              .sort((a,b)=>new Date(a.termin_datum)-new Date(b.termin_datum));
    const lVertraege = vertraegeAblauf.filter(v => v.liegenschaft_id === l.id);
    const lZahlungen = offeneZahlungen.filter(t => t.liegenschaft_id === l.id);
    return { ...l, lSchaeden, naechsterTermin: lTermine[0] || null, lVertraege, lZahlungen };
  });

  return {
    stats: { liegenschaften: liegs.length, wohnungen: total_we, belegt, leer: total_we - belegt, total_miete },
    schadenOffen: schadenOffen.length,
    schadenNotfall: schadenNotfall.length,
    schadenNotfallList: schadenNotfall.slice(0,3),
    vertraegeAblauf: vertraegeAblauf.length,
    offeneZahlungen: offeneZahlungen.length,
    offeneZahlungenBetrag: offeneZahlungen.reduce((a,t)=>a+parseFloat(t.betrag||0),0),
    upcoming7: upcoming7.length,
    upcoming30,
    allTermine: termine,
    liegStatus,
    txRecent: txs.slice(0,5),
  };
}

// ═══════════════════════════════════════════════════
// VIEWS
// ═══════════════════════════════════════════════════
async function renderVerwalter(viewId, el) {
  switch (viewId) {
    case 'dashboard': { const _dd = await getDashboardStats(); window._lastDashData = _dd; el.innerHTML = tmplVerwDash(_dd); break; }
    case 'liegenschaften':  el.innerHTML = tmplLiegenschaften(await getLiegenschaften()); break;
    case 'property-detail': {
      const _pd = await getLiegenschaftDetail(APP.currentProp);
      window._currentPropDetail = _pd;
      el.innerHTML = tmplPropDetail(_pd);
      if ((window._propTab||'wohneinheiten') !== 'wohneinheiten') await setPropTab(window._propTab);
      else if (APP.selectedApt) await selectApt(APP.selectedApt);
      break;
    }
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
        stats: {
          total_miete: liegs.reduce((a,l)=>a+(l.stats?.total_miete||0),0),
          wohnungen:   liegs.reduce((a,l)=>a+(l.stats?.total||0),0),
          leer:        liegs.reduce((a,l)=>a+(l.stats?.vacant||0),0),
        },
        transaktionen: txs
      });
      break;
    }
    case 'meine-objekte':   el.innerHTML = tmplLiegenschaften(await getLiegenschaften()); break;
    case 'property-detail': {
      const _pd2 = await getLiegenschaftDetail(APP.currentProp);
      window._currentPropDetail = _pd2;
      el.innerHTML = tmplPropDetail(_pd2);
      if ((window._propTab||'wohneinheiten') !== 'wohneinheiten') await setPropTab(window._propTab);
      else if (APP.selectedApt) await selectApt(APP.selectedApt);
      break;
    }
    case 'mieter': {
      const all = [];
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

// ── Admin: nur Benutzerverwaltung ────────────────────────────
async function renderAdmin(viewId, el) {
  switch (viewId) {
    case 'dashboard':
    case 'benutzerverwaltung':
      el.innerHTML = await tmplAdmin();
      break;
    default: el.innerHTML = '<div class="card">Ansicht nicht verfügbar.</div>';
  }
}

// ── Geschäftsführer: Lese-Vollzugriff via Verwalter-Renderer ──
async function renderGeschaeftsfuehrer(viewId, el) {
  // Exakt dieselben Views wie Verwalter — Edit-Buttons via can()/isReadOnly() ausgeblendet
  await renderVerwalter(viewId, el);
}

// ── Büroleiter: Verwalter-Renderer + Team-Tab ────────────────
async function renderBueroleiter(viewId, el) {
  if (viewId === 'teamverwaltung') {
    el.innerHTML = await tmplTeamverwaltung();
  } else {
    await renderVerwalter(viewId, el);
  }
}

// ═══════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════

function tmplVerwDash(d) {
  const s = d.stats;
  const auslastung = s.wohnungen > 0 ? Math.round((s.belegt / s.wohnungen) * 100) : 0;

  // Inject urgency CSS once
  if (!document.getElementById('urgency-css')) {
    const st = document.createElement('style');
    st.id = 'urgency-css';
    st.textContent = `
      .urgency-item {display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:12px;border:1px solid transparent;}
      .urgency-red  {background:var(--red3);border-color:#FECACA;color:var(--red);}
      .urgency-gold {background:var(--gold4);border-color:var(--gold3);color:var(--gold);}
      .urgency-blue {background:var(--bg3);border-color:var(--border2);color:var(--blue);}
      .urgency-green{background:var(--green3);border-color:#BBF7D0;color:var(--green);}
      .urgency-item > div:last-child {color:inherit;}
    `;
    document.head.appendChild(st);
  }

  // ── 7-Tage-Kalender ────────────────────────────────────────
  function miniCalendar() {
    const today = new Date(); today.setHours(0,0,0,0);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d2 = new Date(today); d2.setDate(today.getDate() + i);
      days.push(d2);
    }
    const wochentag = ['So','Mo','Di','Mi','Do','Fr','Sa'];
    return `
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px">
      ${days.map(day => {
        const iso   = day.toISOString().slice(0,10);
        const isToday = day.getTime() === today.getTime();
        const evs   = (d.allTermine||[]).filter(t => t.termin_datum?.slice(0,10) === iso);
        const dots  = evs.slice(0,3).map(e => {
          const col = {eigentümerversammlung:'var(--gold)',wartung:'var(--blue)',
                       besichtigung:'var(--teal)',übergabe:'var(--green)',sonstiges:'var(--text3)'}[e.termin_typ]||'var(--text3)';
          return `<div style="width:6px;height:6px;border-radius:50%;background:${col};margin:0 1px"></div>`;
        }).join('');
        return `
        <div onclick="${evs.length?`calDayClick('${iso}')`:'openNeuerTerminModal()'}"
             style="text-align:center;padding:8px 4px;border-radius:10px;cursor:pointer;
                    background:${isToday?'var(--gold2)':'var(--bg3)'};
                    border:1px solid ${isToday?'var(--gold)':'var(--border)'};
                    transition:background .15s"
             onmouseover="this.style.background='${isToday?'var(--gold2)':'var(--bg2)'}'"
             onmouseout="this.style.background='${isToday?'var(--gold2)':'var(--bg3)'}'">
          <div style="font-size:10px;color:${isToday?'var(--gold)':'var(--text3)'};font-weight:600">
            ${wochentag[day.getDay()]}</div>
          <div style="font-size:16px;font-weight:700;color:${isToday?'var(--gold)':'var(--text)'};margin:2px 0">
            ${day.getDate()}</div>
          <div style="display:flex;justify-content:center;min-height:8px;flex-wrap:wrap">${dots}</div>
        </div>`;
      }).join('')}
    </div>`;
  }

  // ── Liegenschaft-Karten ──────────────────────────────────────
  function liegCards() {
    return (d.liegStatus||[]).map(l => {
      const occ     = l.stats?.occupied || 0;
      const total   = l.stats?.total    || 0;
      const leer    = total - occ;
      const hasDmg  = l.lSchaeden?.length > 0;
      const hasVtg  = l.lVertraege?.length > 0;
      const hasZahl = l.lZahlungen?.length > 0;
      const allOk   = !hasDmg && !hasVtg && !hasZahl;

      const badges = [
        hasDmg  ? `<span class="tag tag-red"  style="font-size:10px">⚠ ${l.lSchaeden.length} Schaden</span>` : '',
        hasVtg  ? `<span class="tag tag-gold" style="font-size:10px">📋 ${l.lVertraege.length} Vertrag</span>` : '',
        leer > 0 ? `<span class="tag tag-teal" style="font-size:10px">🔑 ${leer} leer</span>` : '',
        allOk   ? `<span class="tag tag-green" style="font-size:10px">✓ Alles ok</span>` : '',
      ].filter(Boolean).join('');

      const naechsterTermin = l.naechsterTermin
        ? `<div style="font-size:10px;color:var(--text3);margin-top:4px">
             📅 ${fmtDate(l.naechsterTermin.termin_datum)} · ${esc(l.naechsterTermin.titel||l.naechsterTermin.termin_typ)}</div>`
        : '';

      const bar = total > 0
        ? `<div style="height:3px;border-radius:2px;background:var(--bg);margin-top:8px;overflow:hidden">
             <div style="height:100%;width:${Math.round(occ/total*100)}%;background:${leer>0?'var(--gold2)':'var(--green2)'};border-radius:2px"></div>
           </div>` : '';

      return `
      <div class="card" onclick="openProp(${l.id})" style="cursor:pointer;padding:14px 16px;
            border-left:3px solid ${hasDmg?'var(--red2)':hasVtg?'var(--gold2)':leer>0?'var(--teal2)':'var(--green2)'}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700;color:var(--text);
                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(l.name)}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:1px">${esc(l.strasse||'')}${l.ort?', '+esc(l.ort):''}</div>
            ${naechsterTermin}
          </div>
          <div style="text-align:right;white-space:nowrap">
            <div style="font-size:18px;font-weight:700;color:var(--text)">${occ}<span style="font-size:11px;color:var(--text3)">/${total}</span></div>
            <div style="font-size:10px;color:var(--text3)">belegt</div>
          </div>
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:8px">${badges}</div>
        ${bar}
      </div>`;
    }).join('');
  }

  // ── Termine-Liste ──────────────────────────────────────────
  function termineList() {
    if (!d.upcoming30?.length)
      return `<div style="color:var(--text3);font-size:12px;padding:20px 0;text-align:center">
                📅 Keine Termine in den nächsten 30 Tagen</div>`;
    return d.upcoming30.map(ev => {
      const evDate  = new Date(ev.termin_datum);
      const today   = new Date(); today.setHours(0,0,0,0);
      const diffD   = Math.round((evDate-today)/86400000);
      const urgency = diffD === 0 ? 'var(--red)' : diffD <= 3 ? 'var(--gold)' : 'var(--text3)';
      const diffLbl = diffD === 0 ? 'Heute' : diffD === 1 ? 'Morgen' : `in ${diffD}d`;
      const isWEG   = ev.termin_typ === 'eigentümerversammlung';
      return `
      <div style="display:flex;align-items:center;gap:10px;padding:9px 0;
                  border-bottom:1px solid var(--border);cursor:pointer"
           onclick='${isWEG ? `openEvPlanModal(${JSON.stringify(ev).replace(/'/g,"&#39;")})` : `openEventModal(${JSON.stringify(ev).replace(/'/g,"&#39;")})`}'>
        <div style="text-align:center;min-width:36px">
          <div style="font-size:18px">${{eigentümerversammlung:'🏛',wartung:'🔧',besichtigung:'👁',übergabe:'🔑',sonstiges:'📅'}[ev.termin_typ]||'📅'}</div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--text);
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(ev.titel||ev.termin_typ)}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:1px">
            ${esc(ev.liegenschaft_name||'')}${ev.ort?' · '+esc(ev.ort):''}
          </div>
        </div>
        <div style="text-align:right;white-space:nowrap">
          <div style="font-size:11px;font-weight:700;color:${urgency}">${diffLbl}</div>
          <div style="font-size:10px;color:var(--text3)">${fmtDate(ev.termin_datum)}</div>
        </div>
      </div>`;
    }).join('');
  }

  // ── Notfall-Banner ─────────────────────────────────────────
  const notfallBanner = d.schadenNotfall > 0 ? `
  <div onclick="switchView('schaden')" style="background:linear-gradient(135deg,#7f1d1d,#991b1b);
       color:white;border-radius:14px;padding:14px 18px;margin-bottom:12px;
       display:flex;align-items:center;gap:12px;cursor:pointer;animation:pulse 2s infinite">
    <span style="font-size:24px">🚨</span>
    <div style="flex:1">
      <div style="font-weight:700;font-size:14px">${d.schadenNotfall} NOTFALL-MELDUNG${d.schadenNotfall>1?'EN':''} AKTIV</div>
      <div style="font-size:11px;opacity:.75;margin-top:2px">
        ${d.schadenNotfallList.map(s=>`${esc(s.beschreibung||s.kategorie||'Schaden')}`).join(' · ')}
      </div>
    </div>
    <span style="font-size:18px;opacity:.7">→</span>
  </div>` : '';

  // ── Handlungsbedarf-Streifen ───────────────────────────────
  const urgencyItems = [
    d.schadenOffen > 0
      ? `<div onclick="switchView('schaden')" class="urgency-item urgency-red" style="cursor:pointer">
           <div style="font-size:20px">⚠️</div>
           <div><div style="font-weight:700">${d.schadenOffen} offene Schäden</div>
           <div style="font-size:11px;opacity:.7">${d.schadenNotfall > 0 ? d.schadenNotfall+' Notfall' : 'kein Notfall'}</div></div>
         </div>` : '',
    d.vertraegeAblauf > 0
      ? `<div onclick="switchView('vertraege')" class="urgency-item urgency-gold" style="cursor:pointer">
           <div style="font-size:20px">📋</div>
           <div><div style="font-weight:700">${d.vertraegeAblauf} Vertrag${d.vertraegeAblauf>1?'e':''} ablaufend</div>
           <div style="font-size:11px;opacity:.7">innerhalb 30 Tage</div></div>
         </div>` : '',
    d.offeneZahlungen > 0
      ? `<div onclick="switchView('finanzen')" class="urgency-item urgency-gold" style="cursor:pointer">
           <div style="font-size:20px">💶</div>
           <div><div style="font-weight:700">${d.offeneZahlungen} offene Zahlung${d.offeneZahlungen>1?'en':''}</div>
           <div style="font-size:11px;opacity:.7">${fmtEur(d.offeneZahlungenBetrag)} ausstehend</div></div>
         </div>` : '',
    d.upcoming7 > 0
      ? `<div onclick="switchView('termine')" class="urgency-item urgency-blue" style="cursor:pointer">
           <div style="font-size:20px">📅</div>
           <div><div style="font-weight:700">${d.upcoming7} Termin${d.upcoming7>1?'e':''} diese Woche</div>
           <div style="font-size:11px;opacity:.7">in den nächsten 7 Tagen</div></div>
         </div>` : '',
    (!d.schadenOffen && !d.vertraegeAblauf && !d.offeneZahlungen)
      ? `<div class="urgency-item urgency-green">
           <div style="font-size:20px">✅</div>
           <div><div style="font-weight:700">Alles in Ordnung</div>
           <div style="font-size:11px;opacity:.7">Keine dringenden Aufgaben</div></div>
         </div>` : '',
  ].filter(Boolean).join('');

  return `
  <!-- Welcome Banner -->
  <div class="welcome-banner" style="margin-bottom:14px"><div class="wb-shimmer"></div>
    <div class="wb-text">
      <div class="wb-greet">Guten Tag, ${esc(APP.profile.first_name)} 👋</div>
      <div class="wb-sub">${new Date().toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
    </div>
    <div class="wb-stats">
      <div><div class="wbs-v">${s.liegenschaften}</div><div class="wbs-l">Objekte</div></div>
      <div><div class="wbs-v">${s.belegt}/${s.wohnungen}</div><div class="wbs-l">belegt</div></div>
      <div><div class="wbs-v">${auslastung}%</div><div class="wbs-l">Auslastung</div></div>
      <div><div class="wbs-v">${fmtEur(s.total_miete)}</div><div class="wbs-l">Mietumsatz</div></div>
    </div>
  </div>

  <!-- Notfall -->
  ${notfallBanner}

  <!-- Handlungsbedarf -->
  ${urgencyItems ? `
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-bottom:16px">
    ${urgencyItems}
  </div>` : ''}

  <!-- Hauptbereich: 3-spaltig auf Desktop -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">

    <!-- Linke Spalte: 7-Tage-Kalender + Termine -->
    <div>
      <div class="section-header" style="margin-bottom:10px">
        <div class="section-title">📅 Wochenübersicht</div>
        ${!isReadOnly()?`<button class="btn btn-ghost btn-sm" onclick="openNeuerTerminModal()">+ Termin</button>`:''}
      </div>
      <div class="card" style="padding:14px;margin-bottom:12px">
        ${miniCalendar()}
      </div>
      <div class="card" style="padding:14px">
        <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--text3);margin-bottom:10px">NÄCHSTE TERMINE</div>
        ${termineList()}
        <button class="btn btn-ghost btn-sm" style="margin-top:10px;width:100%"
                onclick="switchView('termine')">Alle Termine →</button>
      </div>
    </div>

    <!-- Rechte Spalte: Liegenschafts-Status -->
    <div>
      <div class="section-header" style="margin-bottom:10px">
        <div class="section-title">🏢 Meine Objekte</div>
        <button class="btn btn-ghost btn-sm" onclick="switchView('liegenschaften')">Alle →</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${liegCards() || `<div class="card">${noDaten('Keine Liegenschaften.')}</div>`}
      </div>
    </div>

  </div>

  <!-- Schnellzugriff -->
  <div class="card" style="padding:14px">
    <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--text3);margin-bottom:12px">SCHNELLZUGRIFF</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-ghost" onclick="openNeuerTerminModal()">📅 Termin eintragen</button>
      <button class="btn btn-ghost" onclick="openNeueSchadenModal()">⚠️ Schaden melden</button>
      <button class="btn btn-ghost" onclick="openNeueBuchungModal()">💶 Buchung erfassen</button>
      <button class="btn btn-ghost" onclick="switchView('schaden')">🔧 Schäden verwalten</button>
      <button class="btn btn-ghost" onclick="switchView('vertraege')">📋 Verträge prüfen</button>
      <button class="btn btn-ghost" onclick="openDokumentHochladenModal()">📎 Dokument hochladen</button>
    </div>
  </div>`;
}

// Kalender-Tag angeklickt → zeigt Termine dieses Tages
function calDayClick(iso) {
  const evs = (window._lastDashData?.allTermine||[]).filter(t => t.termin_datum?.slice(0,10) === iso);
  if (!evs.length) { openNeuerTerminModal(); return; }
  if (evs.length === 1) {
    const e = evs[0];
    e.termin_typ === 'eigentümerversammlung' ? openEvPlanModal(e) : openEventModal(e);
    return;
  }
  // Mehrere Termine → Mini-Liste im Modal
  document.getElementById('modalTitle').textContent = `📅 ${new Date(iso).toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'})}`;
  document.getElementById('modalBody').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px">
      ${evs.map(e => `
        <div class="card" style="padding:12px;cursor:pointer"
             onclick='${e.termin_typ==="eigentümerversammlung"?`openEvPlanModal(${JSON.stringify(e).replace(/'/g,"&#39;")})`:`openEventModal(${JSON.stringify(e).replace(/'/g,"&#39;")})`}'>
          <div style="font-size:13px;font-weight:700">${esc(e.titel||e.termin_typ)}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px">
            ${esc(e.liegenschaft_name||'')}${e.ort?' · '+esc(e.ort):''}
          </div>
        </div>`).join('')}
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">Schließen</button>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

// ═══ NEUE LIEGENSCHAFT ═══
function openNeueLiegenschaftModal() {
  document.getElementById('modalTitle').textContent = '🏢 Neue Liegenschaft';
  document.getElementById('modalBody').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div style="grid-column:1/-1"><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Bezeichnung *</div>
          <input id="nlName" class="form-input" style="margin:0" placeholder="z.B. Wohnanlage Musterstraße"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Typ</div>
          <select id="nlTyp" class="form-input" style="margin:0">
            <option value="mehrfamilienhaus">Mehrfamilienhaus</option>
            <option value="wohnhaus">Wohnhaus</option>
            <option value="wohnungseigentum">WEG</option>
            <option value="sev">SEV</option>
            <option value="gewerbe">Gewerbe</option>
          </select></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Verwaltungsart</div>
          <select id="nlVerwArt" class="form-input" style="margin:0">
            <option value="weg">WEG-Verwaltung</option>
            <option value="sev">SEV</option>
            <option value="miethaus">Mietverwaltung</option>
          </select></div>
      </div>
      <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Straße & Hausnummer *</div>
        <input id="nlStrasse" class="form-input" style="margin:0" placeholder="Musterstraße 12"></div>
      <div style="display:grid;grid-template-columns:120px 1fr 1fr;gap:10px">
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">PLZ *</div>
          <input id="nlPlz" class="form-input" style="margin:0" placeholder="1010"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Ort *</div>
          <input id="nlOrt" class="form-input" style="margin:0" placeholder="Wien"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Land</div>
          <input id="nlLand" class="form-input" style="margin:0" value="Österreich"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Baujahr</div>
          <input id="nlBaujahr" type="number" class="form-input" style="margin:0" placeholder="1985"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Grundstück m²</div>
          <input id="nlFlaeche" type="number" class="form-input" style="margin:0" placeholder="500"></div>
      </div>
      <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Notiz</div>
        <textarea id="nlNotiz" class="form-input" rows="2" style="margin:0;resize:vertical" placeholder="Besonderheiten..."></textarea></div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-gold" onclick="saveNeueLiegenschaft()">💾 Liegenschaft anlegen</button>
        <button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>
      </div>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}
// [alte saveNeueLiegenschaft entfernt - neue Version weiter unten]
async function openNeueWohneinheitModal(liegenschaft_id) {
  document.getElementById('modalTitle').textContent = '🚪 Neue Wohneinheit';
  document.getElementById('modalBody').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Wohnungsnummer *</div>
          <input id="nwNr" class="form-input" style="margin:0" placeholder="Top 1 / W01"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Etage</div>
          <input id="nwEtage" class="form-input" style="margin:0" placeholder="EG / 1.OG"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Typ</div>
          <select id="nwTyp" class="form-input" style="margin:0">
            <option value="wohnung">Wohnung</option><option value="buero">Büro</option>
            <option value="gewerbe">Gewerbe</option><option value="garage">Garage/Stellplatz</option><option value="keller">Keller/Lager</option>
          </select></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Status</div>
          <select id="nwStatus" class="form-input" style="margin:0">
            <option value="vacant">Leer</option><option value="occupied">Vermietet</option><option value="owner">Eigentümer bewohnt</option>
          </select></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Fläche m²</div>
          <input id="nwFlaeche" type="number" class="form-input" style="margin:0" placeholder="75"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Nettomiete €/Mt.</div>
          <input id="nwNetto" type="number" class="form-input" style="margin:0" placeholder="800"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">NK-Voraus. €/Mt.</div>
          <input id="nwNK" type="number" class="form-input" style="margin:0" placeholder="150"></div>
      </div>
      <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Zimmer</div>
        <select id="nwZimmer" class="form-input" style="margin:0;width:auto">
          <option value="1">1</option><option value="1.5">1.5</option><option value="2">2</option><option value="2.5">2.5</option><option value="3">3</option><option value="3.5">3.5</option><option value="4">4</option><option value="4.5">4.5</option><option value="5">5</option><option value="6">6+</option>
        </select></div>
      <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Notiz</div>
        <textarea id="nwNotiz" class="form-input" rows="2" style="margin:0;resize:vertical" placeholder="Besonderheiten..."></textarea></div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-gold" onclick="saveNeueWohneinheit(${liegenschaft_id})">💾 Wohneinheit anlegen</button>
        <button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>
      </div>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}
async function saveNeueWohneinheit(liegenschaft_id) {
  const nummer=document.getElementById('nwNr')?.value?.trim();
  if(!nummer){toast('⚠️ Wohnungsnummer ist Pflicht');return;}
  const {data,error}=await db.from('wohneinheiten').insert({
    liegenschaft_id:parseInt(liegenschaft_id), nummer,
    etage:document.getElementById('nwEtage')?.value?.trim()||null,
    typ:document.getElementById('nwTyp')?.value||'wohnung',
    status:document.getElementById('nwStatus')?.value||'vacant',
    flaeche_qm:parseFloat(document.getElementById('nwFlaeche')?.value||0)||null,
    nettomiete:parseFloat(document.getElementById('nwNetto')?.value||0)||0,
    nebenkosten:parseFloat(document.getElementById('nwNK')?.value||0)||0,
    zimmer:parseFloat(document.getElementById('nwZimmer')?.value||0)||null,
    notiz:document.getElementById('nwNotiz')?.value?.trim()||null,
  }).select().single();
  if(error){toast('❌ Fehler: '+error.message);return;}
  closeModal(); toast('✓ Wohneinheit '+nummer+' angelegt');
  if(APP.currentProp){window._currentPropDetail=await getLiegenschaftDetail(APP.currentProp);switchView('property-detail');}
}

function tmplLiegenschaften(rows) {
  APP.allLiegs = rows;
  const orte = [...new Set(rows.map(p=>p.ort))].sort();
  const typen = [...new Set(rows.map(p=>p.verwaltungstyp))];

  function filtered() {
    const s = APP.filters.search.toLowerCase();
    const t = APP.filters.typ;
    const o = APP.filters.ort;
    return rows.filter(p => {
      if (t && p.verwaltungstyp !== t) return false;
      if (o && p.ort !== o) return false;
      if (s) {
        const haystack = [
          p.name, p.strasse, p.plz, p.ort, p.bundesland, p.land,
          p.verwaltungstyp, String(p.baujahr||'')
        ].join(' ').toLowerCase();
        if (!haystack.includes(s)) return false;
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
  ${readOnlyBanner()}
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

  <!-- SMART SEARCH BAR -->
  <div class="card" style="margin-bottom:14px;padding:14px 16px">
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <div style="flex:1;min-width:180px;position:relative">
        <span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);font-size:14px;pointer-events:none">🔍</span>
        <input id="liegsSearch" class="form-input" style="padding-left:32px;margin:0" placeholder="Suche: Name, Adresse, PLZ, Ort, Mieter..." oninput="_liegsRerender()" value="${esc(APP.filters.search)}">
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

  <div class="section-header"><div class="section-title">Liegenschaften</div>${can('create_liegenschaft')?`<button class="btn btn-gold btn-sm" onclick="openNeueLiegenschaftModal()">+ Neue Liegenschaft</button>`:''}</div>
  <div class="prop-grid" id="liegsGrid">${renderCards(f)}</div>`;
}

function openProp(id) {
  if (APP.currentProp !== id) window._propTab = 'wohneinheiten'; // Tab zurücksetzen bei Liegenschaftswechsel
  APP.currentProp = id;
  setActiveNav('liegenschaften');
  switchView('property-detail');
}

function setLiegsFilter(typ) {
  APP.filters.typ = typ;
  const sel = document.getElementById('liegsTyp');
  if (sel) sel.value = typ;
  // Highlight active KPI card
  document.querySelectorAll('.lieg-kpi').forEach(el =>
    el.classList.toggle('lieg-kpi-active', el.dataset.typ === typ)
  );
  if (window._liegsRerender) window._liegsRerender();
}

function tmplPropDetail(p) {
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
  const aptPanel = APP.selectedApt ? buildAptPanel(APP.selectedApt)
    : `<div class="dpe"><div class="dpe-icon">🏢</div><div class="dpe-text">Wohnung auswählen</div><p style="font-size:11px;color:var(--text3);text-align:center">Klicken Sie auf eine Einheit</p></div>`;
  // Wohneinheiten-Tab-HTML speichern (für spätere Wiederherstellung)
  const _wohnHtml = `<div class="detail-layout">
    <div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between">🏢 Gebäude-Navigator
        ${can('edit_liegenschaften')?`<button class="btn btn-gold btn-sm" onclick="openNeueWohneinheitModal(${p.id})">+ Wohneinheit</button>`:''}</div>
      <div class="bv-wrap">${bvRows||noDaten('Keine Wohneinheiten.')}</div>
      <div class="bv-legend">
        <div class="bv-li"><div class="bv-dot" style="background:var(--blue4);border-color:#BFDBFE"></div>Vermietet</div>
        <div class="bv-li"><div class="bv-dot" style="background:var(--green3);border-color:#A7F3D0"></div>Leer</div>
        <div class="bv-li"><div class="bv-dot" style="background:var(--gold4);border-color:var(--gold3)"></div>Eigennutz</div>
      </div>
    </div>
    <div class="card" id="aptPanel">${aptPanel}</div>
  </div>`;
  window._propWohneinheitenHtml = _wohnHtml;
  const _activePropTab = window._propTab || 'wohneinheiten';

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

  <!-- ── Liegenschaft-Tab-Navigation ── -->
  <div style="display:flex;gap:2px;margin-bottom:16px;border-bottom:1px solid var(--border);flex-wrap:wrap">
    ${[
      ['wohneinheiten','🏢 Wohneinheiten'],
      ['vertraege',    '📋 Verträge'],
      ['schaeden',     '⚠️ Schäden'],
      ['finanzen',     '💶 Finanzen'],
      ['dokumente',    '📁 Dokumente'],
      ['termine',      '📅 Termine'],
    ].map(([tab,lbl]) =>
      `<button onclick="setPropTab('${tab}')" class="nav-link prop-tab-btn${_activePropTab===tab?' active':''}"
        data-tab="${tab}" style="font-size:12px;padding:7px 12px">${lbl}</button>`
    ).join('')}
  </div>
  <div id="propTabContent">${_activePropTab==='wohneinheiten'?_wohnHtml:'<div style="text-align:center;padding:30px;color:var(--text3)">⏳ Lade...</div>'}</div>`;
}

async function getAptKontakte(weId) {
  const { data } = await db.from('wohneinheit_kontakte').select('*').eq('wohneinheit_id', weId).order('typ');
  return data || [];
}

async function getNKPositionen(weId) {
  const { data } = await db.from('nk_positionen').select('*').eq('wohneinheit_id', weId).order('kategorie');
  return data || [];
}

async function getNKAbrechnungen(weId) {
  const { data } = await db.from('nk_abrechnungen').select('*, nk_positionen(*)').eq('wohneinheit_id', weId).order('jahr', {ascending: false});
  return data || [];
}

async function selectApt(apt) {
  APP.selectedApt = apt;
  const panel = document.getElementById('aptPanel');
  if (!panel) return;
  panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:120px;color:var(--text3);font-size:12px">⏳ Lade Wohnungsdaten...</div>`;
  document.querySelectorAll('.bv-apt').forEach(el=>el.classList.toggle('selected', el.querySelector('.an')?.textContent===apt.nummer));
  try {
    const vertraege = window._allVertraege ||
      await db.from('vertraege').select('*, liegenschaften(name)').then(r=>(r.data||[]).map(v=>({...v,liegenschaft_name:v.liegenschaften?.name})));
    window._allVertraege = vertraege;

    const { data: txs } = await db.from('transaktionen')
      .select('*').eq('liegenschaft_id', apt.liegenschaft_id||APP.currentProp)
      .order('buchungsdatum',{ascending:false}).limit(50);

    const [kontakte, nkPositionen, nkAbrechnungen] = await Promise.all([
      getAptKontakte(apt.id),
      getNKPositionen(apt.id),
      getNKAbrechnungen(apt.id),
    ]);
    apt.kontakte = kontakte;
    panel.innerHTML = buildAptPanel(apt, vertraege, txs||[], kontakte, nkPositionen, nkAbrechnungen);
  } catch(e) {
    console.error('selectApt Fehler:', e);
    panel.innerHTML = `<div style="padding:20px;color:var(--red);font-size:12px">❌ Fehler beim Laden der Wohnungsdaten: ${esc(e.message||e)}</div>`;
  }
}

function buildAptPanel(a, vertraege=[], txs=[], kontakte=[], nkPositionen=[], nkAbrechnungen=[]) {
  const propVertraege = vertraege.filter(v=>!v.liegenschaft_id||v.liegenschaft_id===a.liegenschaft_id||v.liegenschaft_id===APP.currentProp);
  const mv = a.aktiverMV||null;
  const dbKaution = txs.find(t=>t.wohneinheit_id===a.id&&t.kategorie==='Kaution');
  if (!window._nkJahr) window._nkJahr = {};
  const nkaJahr = window._nkJahr[a.id] || new Date().getFullYear();
  const allWE = window._currentPropDetail?.wohneinheiten || [];
  const totalFlaeche = allWE.reduce((s,w)=>s+(parseFloat(w.flaeche_qm)||0),0)||1;
  const aptAnteil = (parseFloat(a.flaeche_qm)||0) / totalFlaeche;

  // ── BetrKV §2 umlagefähige Kategorien ──
  const kostenKategorien = {
    grundsteuer:   { label:'🏛 Grundsteuer (§2 Nr.1 BetrKV)',                   items:[], umlagefaehig:true  },
    wasser:        { label:'💧 Wasser & Abwasser (§2 Nr.2 BetrKV)',              items:[], umlagefaehig:true  },
    heizung:       { label:'🔥 Heizkosten / Warmwasser (§2 Nr.3-4 BetrKV)',     items:[], umlagefaehig:true  },
    aufzug:        { label:'🛗 Aufzug (§2 Nr.7 BetrKV)',                         items:[], umlagefaehig:true  },
    muell:         { label:'♻️ Müllabfuhr & Entsorgung (§2 Nr.5 BetrKV)',         items:[], umlagefaehig:true  },
    strassenrein:  { label:'🛣 Straßenreinigung & Winterdienst (§2 Nr.8 BetrKV)',items:[], umlagefaehig:true  },
    hausreinigung: { label:'🧹 Hausreinigung & Ungezieferbes. (§2 Nr.9 BetrKV)',items:[], umlagefaehig:true  },
    garten:        { label:'🌿 Gartenpflege (§2 Nr.10 BetrKV)',                  items:[], umlagefaehig:true  },
    beleuchtung:   { label:'💡 Beleuchtung Gemeinschaftsflächen (§2 Nr.11)',     items:[], umlagefaehig:true  },
    hausmeister:   { label:'🔧 Hausmeister (§2 Nr.14 BetrKV)',                  items:[], umlagefaehig:true  },
    versicherung:  { label:'🛡 Gebäude- & Haftpflichtversicherung (§2 Nr.13)',  items:[], umlagefaehig:true  },
    antenne:       { label:'📡 Gemeinschaftsantenne / Kabel (§2 Nr.15 BetrKV)', items:[], umlagefaehig:true  },
    sicherheit:    { label:'🔐 Brandschutz & Sicherheit',                       items:[], umlagefaehig:true  },
    sonstige:      { label:'📦 Sonstige Betriebskosten (§2 Nr.17 BetrKV)',       items:[], umlagefaehig:true  },
    nicht_umlagefaehig: { label:'🚫 Nicht umlagefähig (Verwalterkosten etc.)',  items:[], umlagefaehig:false },
  };
  // Mapping: dienstleister_kat_enum → BetrKV-Kategorie (Fallback wenn nk_kategorie fehlt)
  const katFallback = {
    versorgung:'wasser', hausmeister:'hausmeister', reinigung:'hausreinigung',
    versicherung:'versicherung', winterdienst:'strassenrein',
    sicherheit:'sicherheit', handwerker:'sonstige', sonstige:'sonstige'
  };
  propVertraege.forEach(v=>{
    if (v.vertrag_typ==='mietvertrag') return; // Mietverträge nicht in NK
    if (v.nk_umlagefaehig===false) { kostenKategorien.nicht_umlagefaehig.items.push({name:v.name,anbieter:v.anbieter,kosten:0,status:v.status}); return; }
    const katKey = v.nk_kategorie && kostenKategorien[v.nk_kategorie]
      ? v.nk_kategorie
      : (katFallback[v.kategorie||'sonstige']||'sonstige');
    const monatlich = v.periode==='jährlich'?parseFloat(v.kosten||0)/12:v.periode==='saisonal'?parseFloat(v.kosten||0)/12:parseFloat(v.kosten||0);
    kostenKategorien[katKey].items.push({name:v.name,anbieter:v.anbieter,kosten:monatlich,status:v.status,nk_umlagefaehig:v.nk_umlagefaehig!==false});
  });
  // NK-Positionen aus DB (Parameter von buildAptPanel)
  nkPositionen.forEach(m=>{ const k=kostenKategorien[m.kategorie]||kostenKategorien.sonstige; k.items.push({name:m.name,anbieter:'Manuell',kosten:parseFloat(m.kosten||0),_manual:true,_dbId:m.id}); });

  let gesamtJahrNK = 0;
  const kostenpositionen = Object.entries(kostenKategorien).map(([key,kat])=>{
    const summe = kat.items.reduce((s,i)=>s+i.kosten,0);
    const anteil = kat.umlagefaehig ? summe * aptAnteil * 12 : 0; // Nicht-umlagef. zählen nicht
    if (kat.umlagefaehig) gesamtJahrNK += anteil;
    return {...kat, key, summe, anteil};
  }).filter(k=>k.items.length>0);

  const vorauszahlung = (parseFloat(a.nebenkosten)||0) * 12;
  const differenz = gesamtJahrNK - vorauszahlung;
  const tabState = window._aptTab||'bewohner';
  window._aptTab = tabState;

  function renderBewohner() {
    const kontakte = a.kontakte || [];
    function kontaktCard(k) {
      const ico = k.typ==='eigentuemer'?'👑':k.typ==='mieter'?'🔑':k.typ==='notruf'?'🆘':k.typ==='handwerker'?'🔧':'👤';
      return `<div style="padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:8px;margin-bottom:6px;display:flex;align-items:flex-start;gap:8px">
        <div style="font-size:18px;flex-shrink:0">${ico}</div>
        <div style="flex:1"><div style="font-size:12px;font-weight:700;color:var(--text)">${esc(k.name)}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">${[k.email,k.telefon,k.notiz].filter(Boolean).map(x=>`<span>${esc(x)}</span>`).join(' · ')}</div>
        </div>
        <button onclick="aptKontaktDel('${a.id}','${k.id}')" style="background:none;border:none;color:var(--text4);cursor:pointer;font-size:12px">✕</button>
      </div>`;
    }
    const ek = kontakte.filter(k=>k.typ==='eigentuemer');
    const mk = kontakte.filter(k=>k.typ==='mieter');
    const sk = kontakte.filter(k=>!['eigentuemer','mieter'].includes(k.typ));
    return `
      <div style="margin-bottom:12px">
        <div style="font-size:10px;font-weight:700;color:var(--gold);letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px">👑 Eigentümer</div>
        ${a.eigentuemer_name?`<div style="padding:10px 12px;background:var(--bg3);border:1px solid var(--border);border-left:3px solid var(--gold2);border-radius:9px;margin-bottom:6px">
          <div style="font-size:13px;font-weight:700;color:var(--text)">${esc(a.eigentuemer_name)}</div>
          ${a.eigentuemer_phone?`<div style="font-size:11px;color:var(--text3);margin-top:3px">📞 ${esc(a.eigentuemer_phone)}</div>`:''}
          <div style="margin-top:8px;display:flex;gap:6px">
            ${a.eigentuemer_email?`<a class="btn btn-ghost btn-sm" style="font-size:10px;text-decoration:none" href="mailto:${esc(a.eigentuemer_email)}">✉️ E-Mail</a>`:`<button class="btn btn-ghost btn-sm" style="font-size:10px" disabled>✉️ E-Mail</button>`}
            ${a.eigentuemer_phone?`<a class="btn btn-ghost btn-sm" style="font-size:10px;text-decoration:none" href="tel:${esc(a.eigentuemer_phone)}">📞 Anrufen</a>`:`<button class="btn btn-ghost btn-sm" style="font-size:10px" disabled>📞 Anrufen</button>`}
          </div>
        </div>`:noDaten('Kein Eigentümer hinterlegt.')}
        ${ek.map(k=>kontaktCard(k)).join('')}
      </div>
      <div style="margin-bottom:12px">
        <div style="font-size:10px;font-weight:700;color:var(--green);letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px">🔑 Mieter / Bewohner</div>
        ${a.mieter_name?`<div style="padding:10px 12px;background:var(--bg3);border:1px solid var(--border);border-left:3px solid var(--green2);border-radius:9px;margin-bottom:6px">
          <div style="font-size:13px;font-weight:700;color:var(--text)">${esc(a.mieter_name)}</div>
          ${a.mieter_phone?`<div style="font-size:11px;color:var(--text3);margin-top:3px">📞 ${esc(a.mieter_phone)}</div>`:''}
          ${a.mieter_email_addr?`<div style="font-size:11px;color:var(--text3);margin-top:2px">✉️ ${esc(a.mieter_email_addr)}</div>`:''}
          ${a.mieter_iban_nr?`<div style="font-size:10px;color:var(--text3);margin-top:2px;font-family:'JetBrains Mono'">🏦 IBAN: ${esc(a.mieter_iban_nr)}</div>`:''}
          ${a.mv_start?`<div style="font-size:10px;color:var(--text3);margin-top:2px">📅 Mietbeginn: ${fmtDate(a.mv_start)}</div>`:''}
          <div style="margin-top:8px;display:flex;gap:6px">
            ${a.mieter_email_addr?`<a class="btn btn-ghost btn-sm" style="font-size:10px;text-decoration:none" href="mailto:${esc(a.mieter_email_addr)}">✉️ E-Mail</a>`:`<button class="btn btn-ghost btn-sm" style="font-size:10px" disabled>✉️ E-Mail</button>`}
            ${a.mieter_phone?`<a class="btn btn-ghost btn-sm" style="font-size:10px;text-decoration:none" href="tel:${esc(a.mieter_phone)}">📞 Anrufen</a>`:''}
            <button class="btn btn-ghost btn-sm" style="font-size:10px" onclick="setAptTab('${a.id}','vertrag')">✏️ Bearbeiten</button>
          </div>
        </div>`:`<div style="padding:12px;background:var(--red3);border:1px solid #FECACA;border-radius:9px;font-size:12px;color:var(--red)">
          <div style="font-weight:700;margin-bottom:6px">🔴 Kein Mieter eingetragen</div>
          ${a.status==='occupied'?`<div style="font-size:11px;color:var(--red);margin-bottom:6px">⚠️ Status zeigt noch „Vermietet", obwohl kein Mieter hinterlegt ist.</div><button class="btn btn-ghost btn-sm" style="font-size:11px;margin-bottom:8px" onclick="fixOccupiedStatus('${a.id}')">🔧 Status auf Leer korrigieren</button><br>`:''}
          <div style="font-size:11px;color:var(--text3);margin-bottom:8px">Im Tab „Vertrag" Vorname, Nachname und Mietbeginn eintragen, dann speichern.</div>
          <button class="btn btn-gold btn-sm" style="font-size:11px" onclick="setAptTab('${a.id}','vertrag')">🔑 Jetzt Mieter &amp; Vertrag anlegen →</button>
        </div>`}
        ${mk.map(k=>kontaktCard(k)).join('')}
      </div>
      ${sk.length?`<div style="margin-bottom:12px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px">👤 Weitere Kontakte</div>
        ${sk.map(k=>kontaktCard(k)).join('')}
      </div>`:''}
      <div id="aptKontaktForm_${a.id}" style="display:none;background:var(--bg3);border:1px dashed var(--border2);border-radius:9px;padding:12px;margin-top:8px">
        <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:8px">+ Neuer Kontakt</div>
        <select id="kfTyp_${a.id}" class="form-input" style="margin:0 0 6px 0;font-size:11px">
          <option value="sonstiges">Sonstige</option><option value="notruf">🆘 Notruf</option><option value="handwerker">🔧 Handwerker</option><option value="reinigung">🧹 Reinigung</option>
        </select>
        <input id="kfName_${a.id}" class="form-input" style="margin:0 0 6px 0;font-size:11px" placeholder="Name *">
        <input id="kfTel_${a.id}" class="form-input" style="margin:0 0 6px 0;font-size:11px" placeholder="Telefon">
        <input id="kfEmail_${a.id}" class="form-input" style="margin:0 0 6px 0;font-size:11px" placeholder="E-Mail">
        <input id="kfNotiz_${a.id}" class="form-input" style="margin:0 0 8px 0;font-size:11px" placeholder="Notiz / Rolle">
        <div style="display:flex;gap:6px">
          <button class="btn btn-gold btn-sm" onclick="saveAptKontakt('${a.id}')">💾 In DB speichern</button>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('aptKontaktForm_${a.id}').style.display='none'">Abbrechen</button>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" style="margin-top:8px;font-size:11px" onclick="openAptKontaktForm('${a.id}','sonstige')">+ Kontakt hinzufügen</button>`;
  }

  function renderVertrag() {
    // Aktiven Mietvertrag aus DB laden
    const saved = mv || {};
    if(!saved.kaution && dbKaution) { saved.kaution = dbKaution.betrag; saved.kaution_bezahlt = dbKaution.bezahlt===true; }
    return `
      <div style="background:var(--bg3);border-radius:10px;padding:12px 14px;margin-bottom:12px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">👤 MIETERDATEN</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Vorname *</div>
              <input id="mv_vorname_${a.id}" class="form-input" style="margin:0;font-size:12px" placeholder="Max" value="${esc(saved.vorname||a.mieter_vorname||'')}"></div>
            <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Nachname *</div>
              <input id="mv_nachname_${a.id}" class="form-input" style="margin:0;font-size:12px" placeholder="Mustermann" value="${esc(saved.nachname||a.mieter_nachname||'')}"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">📞 Telefon</div>
              <input id="mv_telefon_${a.id}" type="tel" class="form-input" style="margin:0;font-size:12px" placeholder="+49 89 …" value="${esc(saved.telefon||a.mieter_telefon||'')}"></div>
            <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">📧 E-Mail</div>
              <input id="mv_mieter_email_${a.id}" type="email" class="form-input" style="margin:0;font-size:12px" placeholder="mieter@email.de" value="${esc(saved.mieter_email||a.mieter_email_addr||'')}"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">🏦 IBAN</div>
              <input id="mv_iban_${a.id}" class="form-input" style="margin:0;font-size:12px;font-family:'JetBrains Mono'" placeholder="DE00 0000 0000 …" value="${esc(saved.iban||a.mieter_iban_nr||'')}"></div>
            <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Notiz Mieter</div>
              <input id="mv_mieter_notiz_${a.id}" class="form-input" style="margin:0;font-size:12px" placeholder="z.B. Haustiere, Besonderheiten" value="${esc(saved.notiz_m||'')}"></div>
          </div>
        </div>
      </div>
      <div style="background:var(--bg3);border-radius:10px;padding:12px 14px;margin-bottom:12px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">📄 MIETVERTRAG</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Mietbeginn *</div>
              <input id="mv_beginn_${a.id}" type="date" class="form-input" style="margin:0;font-size:12px" value="${saved.beginn||a.mietbeginn||''}"></div>
            <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Befristet bis</div>
              <input id="mv_ende_${a.id}" type="date" class="form-input" style="margin:0;font-size:12px" value="${saved.ende||''}"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Nettomiete €/Mt.</div>
              <input id="mv_netto_${a.id}" type="number" class="form-input" style="margin:0;font-size:12px" value="${saved.netto||a.nettomiete||''}"></div>
            <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">NK-Vorauszahlung €/Mt.</div>
              <input id="mv_nk_${a.id}" type="number" class="form-input" style="margin:0;font-size:12px" value="${saved.nk||a.nebenkosten||''}"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Kaution €</div>
              <input id="mv_kaution_${a.id}" type="number" class="form-input" style="margin:0;font-size:12px" value="${saved.kaution||''}"></div>
            <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Kündigungsfrist (Monate)</div>
              <input id="mv_kuend_${a.id}" type="number" class="form-input" style="margin:0;font-size:12px" placeholder="3" value="${saved.kuend||''}"></div>
          </div>
          <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Indexierung / Staffelmiete</div>
            <input id="mv_index_${a.id}" class="form-input" style="margin:0;font-size:12px" placeholder="z.B. VPI-Index jährlich" value="${saved.index||''}"></div>
          <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Besondere Vereinbarungen</div>
            <textarea id="mv_vereinb_${a.id}" class="form-input" rows="2" style="margin:0;font-size:11px;resize:vertical">${saved.vereinb||''}</textarea></div>
        </div>
        <button class="btn btn-gold btn-sm" style="margin-top:10px" onclick="saveMietvertrag('${a.id}')">💾 Mieter &amp; Vertrag speichern</button>
      </div>
      ${saved.kaution?`<div style="background:${saved.kaution_bezahlt?'var(--green3)':'var(--gold4)'};border:1px solid ${saved.kaution_bezahlt?'#A7F3D0':'var(--gold3)'};border-radius:9px;padding:10px 12px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
        <div><div style="font-size:11px;font-weight:700;color:${saved.kaution_bezahlt?'var(--green)':'var(--gold)'}">${saved.kaution_bezahlt?'✓ Kaution erhalten':'⏳ Kaution ausstehend'}</div>
          <div style="font-size:12px;color:var(--text)">${fmtEur(saved.kaution)}</div></div>
        <label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer">
          <input type="checkbox" ${saved.kaution_bezahlt?'checked':''} onchange="toggleMVProp('${a.id}','kaution_bezahlt',this.checked)"> Erhalten
        </label>
      </div>`:''}
      <div style="background:var(--bg3);border-radius:9px;padding:10px 12px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">💶 Zahlungshistorie</div>
        ${txs.filter(t=>t.typ==='einnahme'&&(t.wohneinheit_id===a.id||!t.wohneinheit_id)).slice(0,8).map(tx=>{
          const bezBadge=tx.bezahlt===true?`<span class="sp sp-green" style="font-size:9px">✓</span>`:tx.bezahlt===false?`<span class="sp sp-red" style="font-size:9px">⏳</span>`:''
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:11px">
            <div style="display:flex;gap:4px;align-items:center">${bezBadge}<span style="color:var(--text2)">${esc(tx.bezeichnung)}</span></div>
            <div style="display:flex;gap:8px;align-items:center">
              <span style="font-size:10px;color:var(--text3)">${fmtDate(tx.buchungsdatum)}</span>
              <span style="font-family:'JetBrains Mono';color:var(--green)">${tx.icon||'💶'} +${fmtEur(tx.betrag)}</span>
            </div>
          </div>`}).join('')||`<div style="font-size:11px;color:var(--text3)">Keine Transaktionen.</div>`}
      </div>`;
  }

  function renderNebenkosten() {
    const posHtml = kostenpositionen.map(kat=>{
      const borderCol = kat.umlagefaehig===false ? 'var(--red2)' : 'var(--border)';
      const bgCol     = kat.umlagefaehig===false ? 'var(--red3)' : 'var(--bg)';
      return `
      <div style="background:${bgCol};border:1px solid ${borderCol};border-radius:9px;padding:10px 12px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--text2)">${kat.label}</div>
            ${kat.umlagefaehig===false?'<div style="font-size:9px;color:var(--red);margin-top:1px">⚠️ Nicht umlagefähig – Vermieterkosten</div>':''}
          </div>
          ${kat.umlagefaehig!==false?`<div style="font-size:13px;font-weight:700;color:var(--text);font-family:'JetBrains Mono'">${fmtEur(kat.anteil)}/Jahr</div>`:
          '<div style="font-size:10px;color:var(--red);font-weight:700">nicht umlegbar</div>'}
        </div>
        ${kat.items.map(item=>`
          <div style="display:flex;justify-content:space-between;padding:4px 0;border-top:1px solid var(--border);font-size:11px">
            <span style="color:var(--text3)">${esc(item.name)} ${item.anbieter&&item.anbieter!=='Manuell'?'<span style="color:var(--text4)">· '+esc(item.anbieter)+'</span>':''}</span>
            ${kat.umlagefaehig!==false?`<span style="font-family:'JetBrains Mono';color:var(--text2)">${fmtEur(item.kosten*aptAnteil*12)}/J</span>`:
            '<span style="font-size:10px;color:var(--red)">Vermieterkosten</span>'}
          </div>`).join('')}
        ${kat.umlagefaehig!==false?`<div style="font-size:9px;color:var(--text4);margin-top:4px">Flächenschlüssel: ${Math.round(aptAnteil*1000)/10}% (${a.flaeche_qm}m² / ${Math.round(totalFlaeche)}m²)</div>`:''}
      </div>`;
    }).join('');

    const saldo = vorauszahlung - gesamtJahrNK;
    return `
      <div style="background:linear-gradient(135deg,#1C1917,#292524);border-radius:12px;padding:14px 16px;margin-bottom:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div>
            <div style="font-size:10px;color:rgba(255,255,255,.4);letter-spacing:1px">NK-ABRECHNUNG</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
              <button onclick="aptNKJahr('${a.id}',-1)" style="background:rgba(255,255,255,.1);border:none;color:white;cursor:pointer;border-radius:4px;padding:2px 8px">‹</button>
              <div style="font-family:'Playfair Display';font-size:20px;font-weight:700;color:#fff">${nkaJahr}</div>
              <button onclick="aptNKJahr('${a.id}',1)" style="background:rgba(255,255,255,.1);border:none;color:white;cursor:pointer;border-radius:4px;padding:2px 8px">›</button>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;font-weight:700;color:${saldo>=0?'var(--green)':'var(--red)'}">${saldo>=0?'✓ GUTHABEN':'⚠ NACHZAHLUNG'}</div>
            <div style="font-size:22px;font-weight:700;font-family:'Playfair Display';color:${saldo>=0?'var(--green)':'var(--red)'}">${fmtEur(Math.abs(saldo))}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          <div style="background:rgba(255,255,255,.07);border-radius:7px;padding:8px 10px">
            <div style="font-size:9px;color:rgba(255,255,255,.4)">VORAUSZAHLUNG/J.</div>
            <div style="font-size:14px;font-weight:700;color:#60A5FA;font-family:'JetBrains Mono';margin-top:2px">${fmtEur(vorauszahlung)}</div>
          </div>
          <div style="background:rgba(255,255,255,.07);border-radius:7px;padding:8px 10px">
            <div style="font-size:9px;color:rgba(255,255,255,.4)">ISTKOSTEN/J.</div>
            <div style="font-size:14px;font-weight:700;color:#FCD34D;font-family:'JetBrains Mono';margin-top:2px">${fmtEur(gesamtJahrNK)}</div>
          </div>
          <div style="background:rgba(255,255,255,.07);border-radius:7px;padding:8px 10px">
            <div style="font-size:9px;color:rgba(255,255,255,.4)">FLÄCHEN-ANT.</div>
            <div style="font-size:14px;font-weight:700;color:#A78BFA;font-family:'JetBrains Mono';margin-top:2px">${Math.round(aptAnteil*1000)/10}%</div>
          </div>
        </div>
      </div>
      ${propVertraege.length===0?`<div style="background:var(--gold4);border:1px solid var(--gold3);border-radius:9px;padding:10px 12px;margin-bottom:12px;font-size:11px;color:var(--gold)">
        💡 Noch keine Verträge für diese Liegenschaft. Unter <strong>Verträge</strong> anlegen – sie fließen automatisch ein.</div>`:''}
      <div style="margin-bottom:12px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">KOSTENPOSITIONEN (aus Verträgen)</div>
        ${posHtml||`<div style="color:var(--text3);font-size:12px">Keine Betriebskosten-Verträge vorhanden.</div>`}
      </div>
      <div style="background:var(--bg3);border:1px dashed var(--border2);border-radius:9px;padding:12px;margin-bottom:12px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">+ Manuelle Kostenposition</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">
          <input id="nkManName_${a.id}" class="form-input" style="margin:0;font-size:11px" placeholder="Bezeichnung">
          <select id="nkManKat_${a.id}" class="form-input" style="margin:0;font-size:11px">
            <option value="grundsteuer">🏛 Grundsteuer</option>
            <option value="wasser">💧 Wasser & Abwasser</option>
            <option value="heizung">🔥 Heizkosten / Warmwasser</option>
            <option value="muell">♻️ Müllabfuhr & Entsorgung</option>
            <option value="aufzug">🛫 Aufzug</option>
            <option value="strassenrein">🛣 Straßenreinigung & Winterdienst</option>
            <option value="hausreinigung">🧹 Hausreinigung</option>
            <option value="garten">🌿 Gartenpflege</option>
            <option value="beleuchtung">💡 Beleuchtung Gemeinschaftsflächen</option>
            <option value="hausmeister">🔧 Hausmeister</option>
            <option value="versicherung">🛡 Versicherung</option>
            <option value="antenne">📡 Kabel / Gemeinschaftsantenne</option>
            <option value="sicherheit">🔐 Brandschutz & Sicherheit</option>
            <option value="sonstige">📦 Sonstige Betriebskosten</option>
          </select>
        </div>
        <div style="display:flex;gap:6px">
          <input id="nkManKosten_${a.id}" type="number" class="form-input" style="margin:0;font-size:11px;flex:1" placeholder="€/Monat (Gesamtgebäude)">
          <button class="btn btn-gold btn-sm" onclick="aptNKManualAdd('${a.id}')">+</button>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-gold" onclick="aptNKVorschau('${a.id}')">📄 Abrechnung erstellen</button>
        <button class="btn btn-ghost btn-sm" onclick="aptNKArchivieren('${a.id}','${nkaJahr}')">🗄 Archivieren</button>
      </div>`;
  }

  function renderArchiv() {
    const archiv = nkAbrechnungen; // aus DB geladen via selectApt
    return `
      <div style="background:var(--bg3);border-radius:9px;padding:10px 12px;margin-bottom:12px;font-size:11px;color:var(--text3)">
        🗄 Archivierte Nebenkostenabrechnungen. Aktuelle NK → Tab „NK-Abrechnung".
      </div>
      ${archiv.length?archiv.map((ar,i)=>`
        <div style="padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;margin-bottom:8px;cursor:pointer" onclick="aptArchivDetail('${a.id}',${i})">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div><div style="font-size:13px;font-weight:700;color:var(--text)">NK-Abrechnung ${ar.jahr}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px">${ar.datum} · ${esc(ar.mieter||'')}</div></div>
            <div style="text-align:right">
              <div style="font-size:11px;font-weight:700;color:${ar.saldo>=0?'var(--green)':'var(--red)'}">${ar.saldo>=0?'Guthaben':'Nachzahlung'}</div>
              <div style="font-size:16px;font-weight:700;font-family:'Playfair Display';color:${ar.saldo>=0?'var(--green)':'var(--red)'}">${fmtEur(Math.abs(ar.saldo))}</div>
            </div>
          </div>
          <div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
            <div style="text-align:center;background:var(--bg3);border-radius:6px;padding:5px 8px">
              <div style="font-size:9px;color:var(--text4)">VORAUSZ.</div><div style="font-size:11px;font-weight:700;color:var(--blue)">${fmtEur(ar.vorauszahlung)}</div>
            </div>
            <div style="text-align:center;background:var(--bg3);border-radius:6px;padding:5px 8px">
              <div style="font-size:9px;color:var(--text4)">ISTKOSTEN</div><div style="font-size:11px;font-weight:700;color:var(--gold)">${fmtEur(ar.istkost)}</div>
            </div>
            <div style="text-align:center;background:var(--bg3);border-radius:6px;padding:5px 8px">
              <div style="font-size:9px;color:var(--text4)">POSITIONEN</div><div style="font-size:11px;font-weight:700;color:var(--text)">${ar.positionen||0}</div>
            </div>
          </div>
        </div>`).join(''):`<div style="color:var(--text3);font-size:12px;padding:10px 0">Noch keine archivierten Abrechnungen.</div>`}`;
  }

  const _sCfg={occupied:{l:'VERMIETET',c:'tag-blue',i:'🔵'},vacant:{l:'LEER',c:'tag-red',i:'🔴'},eigennutz:{l:'EIGENNUTZ',c:'tag-gold',i:'🟠'}};
  const _sc=_sCfg[a.status]||_sCfg.vacant;
  const statusBadge=`<button class="tag ${_sc.c}" style="cursor:pointer;border:none;font-weight:700;letter-spacing:.5px;padding:4px 10px;display:inline-flex;align-items:center;gap:4px" onclick="openStatusWechselModal('${a.id}','${a.status}')" title="Status ändern">${_sc.i} ${_sc.l} <span style="opacity:.6;font-size:9px">▾</span></button>`;

  return `<div class="apt-detail">
    <div class="apt-header">
      <div class="apt-num-box">${esc(a.nummer)}</div>
      <div><div style="font-size:10px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;color:var(--text3)">${esc(a.typ||'')}</div>
        <div class="apt-size-label">${a.flaeche_qm} m²</div></div>
      <div style="margin-left:auto">${statusBadge}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px">
      <div style="background:var(--bg3);border-radius:8px;padding:8px 10px;border-left:2px solid var(--green2)">
        <div style="font-size:9px;color:var(--text3);letter-spacing:.5px">NETTOMIETE/MT.</div>
        <div style="font-size:14px;font-weight:700;color:var(--green);font-family:'JetBrains Mono'">${fmtEur(a.nettomiete||0)}</div>
      </div>
      <div style="background:var(--bg3);border-radius:8px;padding:8px 10px;border-left:2px solid ${differenz>0?'var(--red2)':'var(--green2)'}">
        <div style="font-size:9px;color:var(--text3);letter-spacing:.5px">NK-SALDO/JAHR</div>
        <div style="font-size:14px;font-weight:700;color:${differenz>0?'var(--red)':'var(--green)'};font-family:'JetBrains Mono'">${differenz>0?'– ':'+ '}${fmtEur(Math.abs(differenz))}</div>
      </div>
    </div>
    <div style="display:flex;gap:2px;margin-bottom:12px;border-bottom:1px solid var(--border)">
      ${['bewohner','vertrag','nebenkosten','archiv'].map(tab=>{
        const labels={bewohner:'👤 Bewohner',vertrag:'📄 Vertrag',nebenkosten:'💶 NK-Abr.',archiv:'🗄 Archiv'};
        return `<button onclick="setAptTab('${a.id}','${tab}')" class="nav-link${tabState===tab?' active':''}" style="font-size:10px;padding:5px 8px">${labels[tab]}</button>`;
      }).join('')}
    </div>
    <div id="aptTabContent_${a.id}">
      ${tabState==='bewohner'?renderBewohner():tabState==='vertrag'?renderVertrag():tabState==='nebenkosten'?renderNebenkosten():renderArchiv()}
    </div>
  </div>`;
}

// ── APT TAB SWITCHING ──
function setAptTab(aptId, tab) {
  window._aptTab = tab;
  if(APP.selectedApt) selectApt(APP.selectedApt);
}

// ── PROP DETAIL REFRESH (KPIs + AptPanel) ──
async function refreshPropDetail(aptId) {
  const propId = window._currentPropDetail?.id || APP.currentProp;
  const freshDetail = await getLiegenschaftDetail(propId);
  window._currentPropDetail = freshDetail;
  const freshApt = aptId
    ? (freshDetail?.wohneinheiten||[]).find(w=>String(w.id)===String(aptId))
    : APP.selectedApt;
  if (freshApt) APP.selectedApt = freshApt;
  const el = document.getElementById('appContent');
  if (el) el.innerHTML = tmplPropDetail(freshDetail);
  const curTab = window._propTab || 'wohneinheiten';
  if (curTab !== 'wohneinheiten') {
    await setPropTab(curTab);
  } else if (freshApt) {
    await selectApt(freshApt);
  }
}

// ── PROPERTY TABS ──
async function setPropTab(tab) {
  window._propTab = tab;
  document.querySelectorAll('.prop-tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  const content = document.getElementById('propTabContent');
  if (!content) return;

  // Wohneinheiten-Tab: gespeichertes HTML wiederherstellen
  if (tab === 'wohneinheiten') {
    content.innerHTML = window._propWohneinheitenHtml || '';
    if (APP.selectedApt) await selectApt(APP.selectedApt);
    return;
  }

  content.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text3);font-size:13px">⏳ Lade Daten...</div>`;
  const propId = APP.currentProp;
  try {
    if (tab === 'vertraege') {
      const all = window._allVertraege || await getVertraege();
      window._allVertraege = all;
      const rows = all.filter(v => String(v.liegenschaft_id) === String(propId));
      content.innerHTML = buildPropVertraegeTab(rows, propId);

    } else if (tab === 'schaeden') {
      const { data } = await db.from('schadensmeldungen')
        .select('*, wohneinheiten(nummer)')
        .eq('liegenschaft_id', propId)
        .order('erstellt_am', {ascending: false});
      content.innerHTML = buildPropSchadenTab(data || []);

    } else if (tab === 'finanzen') {
      const { data } = await db.from('transaktionen')
        .select('*').eq('liegenschaft_id', propId)
        .order('buchungsdatum', {ascending: false}).limit(100);
      content.innerHTML = buildPropFinanzTab(data || []);

    } else if (tab === 'dokumente') {
      const { data } = await db.from('dokumente')
        .select('*').eq('liegenschaft_id', propId)
        .order('name', {ascending: true});
      content.innerHTML = buildPropDokumenteTab(data || [], propId);

    } else if (tab === 'termine') {
      const { data } = await db.from('termine')
        .select('*, beschluesse(*)')
        .eq('liegenschaft_id', propId)
        .order('termin_datum', {ascending: true});
      content.innerHTML = buildPropTermineTab(data || [], propId);
    }
  } catch(e) {
    content.innerHTML = `<div style="padding:20px;color:var(--red);font-size:12px">❌ Fehler: ${esc(e.message||String(e))}</div>`;
    console.error('setPropTab Fehler:', e);
  }
}

// ── Liegenschaft-Tab: Verträge ──
function buildPropVertraegeTab(rows, propId) {
  function vStatusBadge(v) {
    if(v.status==='ok')   return `<span class="tag tag-green" style="font-size:10px">✓ Aktiv</span>`;
    if(v.status==='warn') return `<span class="tag tag-gold"  style="font-size:10px">⚠ Bald</span>`;
    return                       `<span class="tag tag-red"   style="font-size:10px">🔴 Abgelaufen</span>`;
  }
  if (!rows.length) return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="section-title">Verträge & Dienstleistungen</div>
      ${can('edit_vertraege')?`<button class="btn btn-gold btn-sm" onclick="openNeuerVertragModal()">+ Neuer Vertrag</button>`:''}
    </div>
    <div class="card">${noDaten('Noch keine Verträge für diese Liegenschaft.')}</div>`;

  const monthly = rows.filter(v=>v.periode==='monatlich').reduce((a,v)=>a+parseFloat(v.kosten||0),0);
  const yearly  = rows.filter(v=>v.periode==='jährlich').reduce((a,v)=>a+parseFloat(v.kosten||0),0);
  const total   = monthly + yearly/12;
  const warn    = rows.filter(v=>v.status!=='ok').length;

  return `
  <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
    <div class="kpi-card" style="flex:1;min-width:130px">
      <div class="kpi-label">Verträge</div><div class="kpi-value kv-blue">${rows.length}</div>
      <div class="kpi-accent-line" style="background:var(--blue2)"></div></div>
    <div class="kpi-card" style="flex:1;min-width:130px">
      <div class="kpi-label">Monatsk. gesamt</div><div class="kpi-value kv-red">${fmtEur(total)}</div>
      <div class="kpi-accent-line" style="background:var(--red2)"></div></div>
    ${warn?`<div class="kpi-card" style="flex:1;min-width:130px">
      <div class="kpi-label">⚠ Handlungsbedarf</div><div class="kpi-value kv-gold">${warn}</div>
      <div class="kpi-accent-line" style="background:var(--gold2)"></div></div>`:''}
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <div class="section-title">Verträge & Dienstleistungen</div>
    ${can('edit_vertraege')?`<button class="btn btn-gold btn-sm" onclick="openNeuerVertragModal()">+ Neuer Vertrag</button>`:''}
  </div>
  <div class="contract-grid">
    ${rows.map(v=>{
      const days = v.ende_datum ? Math.round((new Date(v.ende_datum)-new Date())/86400000) : null;
      return `<div class="contract-card" onclick="openVertragModal(${v.id})" style="cursor:pointer">
        <div class="cc-icon">${v.icon||'📋'}</div>
        <div class="cc-name">${esc(v.name)}</div>
        <div class="cc-prov">${esc(v.anbieter||'–')}</div>
        <div class="cc-cost">${fmtEur(v.kosten)} / ${esc(v.periode)}</div>
        ${vStatusBadge(v)}
        ${days!==null&&days<=90?`<div style="font-size:10px;color:${days<=30?'var(--red)':'var(--gold)'};margin-top:4px;font-weight:600">
          ${days<0?'🔴 Seit '+Math.abs(days)+'d abgelaufen':'⏳ Endet in '+days+'d'}</div>`:''}
      </div>`;
    }).join('')}
  </div>`;
}

// ── Liegenschaft-Tab: Schäden ──
function buildPropSchadenTab(rows) {
  function prioBadge(p) {
    const cls={notfall:'tag-red',hoch:'tag-red',mittel:'tag-gold',niedrig:'tag-green'};
    const lbl={notfall:'🔴 Notfall',hoch:'🔴 Hoch',mittel:'⚠ Mittel',niedrig:'↓ Niedrig'};
    return `<span class="tag ${cls[p]||'tag-gold'}" style="font-size:10px">${lbl[p]||p}</span>`;
  }
  function statBadge(s) {
    const cls={gemeldet:'tag-red',in_bearbeitung:'tag-gold',erledigt:'tag-green',abgeschlossen:'tag-teal'};
    const lbl={gemeldet:'Gemeldet',in_bearbeitung:'In Bearbeitung',erledigt:'Erledigt',abgeschlossen:'Abgeschlossen'};
    return `<span class="tag ${cls[s]||''}" style="font-size:10px">${lbl[s]||s}</span>`;
  }
  const open   = rows.filter(s=>!['erledigt','abgeschlossen'].includes(s.status)).length;
  const urgent = rows.filter(s=>['notfall','hoch'].includes(s.prioritaet)&&s.status!=='abgeschlossen').length;

  return `
  <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
    <div class="kpi-card" style="flex:1;min-width:110px">
      <div class="kpi-label">Gesamt</div><div class="kpi-value">${rows.length}</div>
      <div class="kpi-accent-line" style="background:var(--border2)"></div></div>
    <div class="kpi-card" style="flex:1;min-width:110px">
      <div class="kpi-label">Offen</div><div class="kpi-value kv-gold">${open}</div>
      <div class="kpi-accent-line" style="background:var(--gold2)"></div></div>
    ${urgent?`<div class="kpi-card" style="flex:1;min-width:110px">
      <div class="kpi-label">🔴 Dringend</div><div class="kpi-value kv-red">${urgent}</div>
      <div class="kpi-accent-line" style="background:var(--red2)"></div></div>`:''}
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <div class="section-title">Schadensmeldungen</div>
    ${can('create_schaden')?`<button class="btn btn-gold btn-sm" onclick="openNeueSchadenModal()">+ Neue Meldung</button>`:''}
  </div>
  ${!rows.length ? `<div class="card">${noDaten('Keine Schadensmeldungen.')}</div>` :
    rows.map(s=>`
    <div class="card" style="padding:12px 14px;cursor:pointer;margin-bottom:8px" onclick="openSchadenModal(${s.id})">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:22px">${s.prioritaet==='notfall'?'🚨':s.prioritaet==='hoch'?'🔴':'⚠️'}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:3px">${esc(s.titel||s.beschreibung||'Schaden')}</div>
          <div style="font-size:11px;color:var(--text3)">${s.wohneinheiten?.nummer?`WE ${s.wohneinheiten.nummer} · `:''}${s.erstellt_am?fmtDate(s.erstellt_am):''}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          ${prioBadge(s.prioritaet)}
          ${statBadge(s.status)}
        </div>
      </div>
    </div>`).join('')}`;
}

// ── Liegenschaft-Tab: Finanzen ──
function buildPropFinanzTab(rows) {
  const ein  = rows.filter(t=>t.typ==='einnahme').reduce((a,t)=>a+parseFloat(t.betrag||0),0);
  const aus  = rows.filter(t=>t.typ==='ausgabe').reduce((a,t)=>a+parseFloat(t.betrag||0),0);
  const saldo = ein - aus;

  return `
  <div class="kpi-grid" style="margin-bottom:16px">
    <div class="kpi-card">
      <div class="kpi-label">Einnahmen</div><div class="kpi-value kv-green">${fmtEur(ein)}</div>
      <div class="kpi-accent-line" style="background:var(--green2)"></div></div>
    <div class="kpi-card">
      <div class="kpi-label">Ausgaben</div><div class="kpi-value kv-red">${fmtEur(aus)}</div>
      <div class="kpi-accent-line" style="background:var(--red2)"></div></div>
    <div class="kpi-card">
      <div class="kpi-label">Saldo</div>
      <div class="kpi-value" style="color:${saldo>=0?'var(--green)':'var(--red)'}">${fmtEur(saldo)}</div>
      <div class="kpi-accent-line" style="background:${saldo>=0?'var(--green2)':'var(--red2)'}"></div></div>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <div class="section-title">Buchungen (letzte 100)</div>
    ${can('create_buchung')?`<button class="btn btn-gold btn-sm" onclick="openNeueBuchungModal()">+ Buchung</button>`:''}
  </div>
  ${!rows.length?`<div class="card">${noDaten('Keine Buchungen für diese Liegenschaft.')}</div>`:
    rows.map(t=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg3);
                border-radius:9px;border:1px solid var(--border);margin-bottom:6px;
                border-left:3px solid ${t.typ==='einnahme'?'var(--green2)':'var(--red2)'}">
      <div style="font-size:18px">${t.typ==='einnahme'?'📥':'📤'}</div>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:600;color:var(--text)">${esc(t.kategorie||'Sonstige')}</div>
        <div style="font-size:10px;color:var(--text3)">${t.buchungsdatum?fmtDate(t.buchungsdatum):''}${t.notiz?' · '+esc(t.notiz):''}</div>
      </div>
      <div style="font-size:13px;font-weight:700;color:${t.typ==='einnahme'?'var(--green)':'var(--red)'}">
        ${t.typ==='einnahme'?'+':'–'}${fmtEur(t.betrag)}</div>
      <span class="tag ${t.bezahlt?'tag-green':'tag-gold'}" style="font-size:10px">${t.bezahlt?'✓ Bez.':'⏳ Off.'}</span>
    </div>`).join('')}`;
}

// ── Liegenschaft-Tab: Dokumente ──
function buildPropDokumenteTab(rows, propId) {
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <div class="section-title">Dokumente</div>
    ${can('edit_dokumente')?`<button class="btn btn-gold btn-sm" onclick="openDokumentHochladenModal(${propId})">📎 Hochladen</button>`:''}
  </div>
  ${!rows.length?`<div class="card">${noDaten('Noch keine Dokumente für diese Liegenschaft.')}</div>`:
    `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
      ${rows.map(d=>`
        <div class="card" style="padding:14px;cursor:pointer;text-align:center"
             onclick="${d.url?`window.open('${esc(d.url)}','_blank')`:`toast('Kein Dokument-Link hinterlegt')`}">
          <div style="font-size:28px;margin-bottom:6px">${d.icon||'📄'}</div>
          <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:2px">${esc(d.name)}</div>
          <div style="font-size:10px;color:var(--text3)">${esc(d.kategorie||'')}</div>
          ${d.notiz?`<div style="font-size:10px;color:var(--text4);margin-top:4px">${esc(d.notiz)}</div>`:''}
          ${d.url?`<div style="font-size:10px;color:var(--blue);margin-top:6px">🔗 Öffnen</div>`:''}
        </div>`).join('')}
    </div>`}`;
}

// ── Liegenschaft-Tab: Termine ──
function buildPropTermineTab(rows, propId) {
  const now      = new Date();
  const upcoming = rows.filter(t => new Date(t.termin_datum) >= now);
  const past     = rows.filter(t => new Date(t.termin_datum) <  now).reverse();

  const icons = {eigentümerversammlung:'🏛',wartung:'🔧',besichtigung:'👁',übergabe:'🔑',sonstiges:'📅'};
  function tCard(t) {
    const isPast = new Date(t.termin_datum) < now;
    const isWEG  = t.termin_typ === 'eigentümerversammlung';
    return `
    <div class="card" style="padding:12px 14px;cursor:pointer;margin-bottom:8px;${isPast?'opacity:.75':''}"
         onclick='${isWEG ? `openEvPlanModal(${JSON.stringify(t).replace(/'/g,"&#39;")})` : `openEventModal(${JSON.stringify(t).replace(/'/g,"&#39;")})`}'>
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:24px">${icons[t.termin_typ]||'📅'}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:var(--text)">${esc(t.titel||t.termin_typ)}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">
            ${t.termin_datum?fmtDate(t.termin_datum):'–'}${t.ort?' · '+esc(t.ort):''}
          </div>
        </div>
        <span class="tag ${isPast?'tag-teal':'tag-blue'}" style="font-size:10px">
          ${isPast?'✓ War':'Anstehend'}</span>
      </div>
    </div>`;
  }

  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <div class="section-title">Termine</div>
    ${can('create_termin')?`<button class="btn btn-gold btn-sm" onclick="openNeuerTerminModal()">+ Termin</button>`:''}
  </div>
  ${upcoming.length?`
    <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">
      Anstehend (${upcoming.length})</div>
    ${upcoming.map(tCard).join('')}`:''}
  ${past.length?`
    <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin:${upcoming.length?'16px':0} 0 8px">
      Vergangen (${past.length})</div>
    ${past.map(tCard).join('')}`:''}
  ${!rows.length?`<div class="card">${noDaten('Keine Termine für diese Liegenschaft.')}</div>`:''}`;
}

// ── STATUS WECHSEL ──
async function openStatusWechselModal(aptId, currentStatus) {
  const apt = APP.selectedApt;
  const aptName = apt ? `WE ${apt.nummer}` : `WE ${aptId}`;
  // Mieter gilt als vollständig wenn Vor- UND Nachname gesetzt
  const hasTenant = !!(apt?.mieter_vorname?.trim() && apt?.mieter_nachname?.trim());
  const stats = [
    {val:'vacant',    label:'Leer',      icon:'🔴', desc:'Nicht vermietet, leer stehend.'},
    {val:'eigennutz', label:'Eigennutz', icon:'🟠', desc:'Vom Eigentümer selbst genutzt.'},
    {val:'occupied',  label:'Vermietet', icon:'🔵', desc:'Aktives Mietverhältnis besteht.'},
  ];
  const curLabel = stats.find(s=>s.val===currentStatus)?.label || currentStatus;
  let warnHtml = '';
  if (currentStatus==='occupied') {
    if (hasTenant) {
      const mn = [apt.mieter_vorname, apt.mieter_nachname].join(' ');
      warnHtml = `<div style="background:var(--red4);border:1px solid var(--red2);border-radius:9px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:var(--red)">
        ⚠️ <strong>Achtung:</strong> Diese Wohnung ist vermietet an <strong>${esc(mn)}</strong>.<br>
        Die Mieterdaten werden beim Statuswechsel als <em>Ehemaliger Mieter</em> archiviert.
      </div>`;
    } else {
      warnHtml = `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:9px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:var(--text3)">
        ℹ️ Kein vollständiger Mieter eingetragen — Status wird einfach zurückgesetzt, kein Archiveintrag nötig.
      </div>`;
    }
  }
  document.getElementById('modalTitle').textContent = `🔄 Status ändern — ${aptName}`;
  document.getElementById('modalBody').innerHTML = `
    <div style="font-size:12px;color:var(--text3);margin-bottom:14px">Aktueller Status: <strong style="color:var(--text)">${curLabel}</strong> — Wähle neuen Status:</div>
    ${warnHtml}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
      ${stats.map(s=>`
        <button onclick="selectNewStatus('${aptId}','${s.val}','${currentStatus}')"
          style="padding:16px 8px;border-radius:12px;border:2px solid ${s.val===currentStatus?'var(--blue2)':'var(--border)'};background:${s.val===currentStatus?'var(--bg2)':'var(--bg3)'};cursor:${s.val===currentStatus?'not-allowed':'pointer'};text-align:center;transition:all .15s;${s.val===currentStatus?'opacity:.45;':''}"
          ${s.val===currentStatus?'disabled':''}>
          <div style="font-size:26px;margin-bottom:5px">${s.icon}</div>
          <div style="font-size:12px;font-weight:700;color:var(--text)">${s.label}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:4px;line-height:1.3">${s.desc}</div>
        </button>`).join('')}
    </div>
    <div id="statusWechselConfirm_${aptId}"></div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

function selectNewStatus(aptId, newStatus, currentStatus) {
  if (newStatus===currentStatus) return;
  const apt = APP.selectedApt;
  const hasTenant = !!(apt?.mieter_vorname?.trim() && apt?.mieter_nachname?.trim());
  const labels = {vacant:'Leer',occupied:'Vermietet',eigennutz:'Eigennutz'};
  let archHtml = '';
  // Archiv-Vorschau nur wenn vollständiger Mieter vorhanden
  if (currentStatus==='occupied' && hasTenant) {
    const mn = [apt.mieter_vorname, apt.mieter_nachname].join(' ');
    archHtml = `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:11px">
      <div style="font-weight:700;color:var(--text);margin-bottom:6px">📦 Wird archiviert als „Ehemaliger Mieter":</div>
      <div style="color:var(--text2)">👤 <strong>${esc(mn)}</strong></div>
      ${apt.mieter_email?`<div style="color:var(--text2)">📧 ${esc(apt.mieter_email)}</div>`:''}
      ${apt.mieter_telefon?`<div style="color:var(--text2)">📞 ${esc(apt.mieter_telefon)}</div>`:''}
      <div style="color:var(--text2)">📅 Mietbeginn: ${apt.mietbeginn?new Date(apt.mietbeginn).toLocaleDateString('de-DE'):'–'}</div>
      <div style="color:var(--text2)">💶 Nettomiete: ${fmtEur(apt.nettomiete||0)}/Mo</div>
    </div>`;
  }
  const c = document.getElementById('statusWechselConfirm_'+aptId);
  if (!c) return;
  c.innerHTML = `<div style="border-top:1px solid var(--border);padding-top:12px">
    ${archHtml}
    <div style="font-size:12px;color:var(--text2);margin-bottom:12px">
      Statuswechsel bestätigen: <strong>${labels[currentStatus]}</strong> → <strong style="color:var(--blue)">${labels[newStatus]}</strong>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-sm" style="background:var(--blue);color:#fff;border:none" onclick="saveStatusWechsel('${aptId}','${newStatus}','${currentStatus}')">✓ Jetzt ändern</button>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">Abbrechen</button>
    </div>
  </div>`;
}

async function saveStatusWechsel(aptId, newStatus, currentStatus) {
  const apt = APP.selectedApt;
  // Archivieren nur wenn vollständiger Mieter (Vor- UND Nachname) vorhanden
  const hasTenant = !!(apt?.mieter_vorname?.trim() && apt?.mieter_nachname?.trim());
  if (currentStatus==='occupied' && hasTenant) {
    const mn = [apt.mieter_vorname, apt.mieter_nachname].join(' ');
    const {error: archErr} = await db.from('wohneinheit_kontakte').insert({
      wohneinheit_id: aptId, name: mn, typ: 'ehemaliger_mieter',
      telefon: apt.mieter_telefon||null, email: apt.mieter_email||null,
      notiz: `Mietbeginn: ${apt.mietbeginn||'–'} | Nettomiete: ${fmtEur(apt.nettomiete||0)}/Mo | Archiviert am: ${new Date().toLocaleDateString('de-DE')}`
    });
    if (archErr) console.error('❌ Archivierung:', archErr);
    else toast('📦 Mieter archiviert');
  }
  // DB Update — Felder zurücksetzen wenn von occupied weg
  const upd = {status: newStatus};
  if (currentStatus==='occupied' && newStatus!=='occupied') {
    Object.assign(upd, {
      mieter_vorname:null, mieter_nachname:null, mieter_email:null,
      mieter_telefon:null, mieter_iban:null,
      mietbeginn:null, mietende:null, nettomiete:0, nebenkosten:0
    });
  }
  const {error} = await db.from('wohneinheiten').update(upd).eq('id', aptId).select();
  if (error) { toast('❌ '+error.message); return; }
  closeModal();
  const labels={vacant:'Leer',occupied:'Vermietet',eigennutz:'Eigennutz'};
  toast('✓ Status geändert → '+labels[newStatus]);
  await refreshPropDetail(aptId);
}

async function fixOccupiedStatus(aptId) {
  const {error} = await db.from('wohneinheiten').update({
    status:'vacant', mieter_vorname:null, mieter_nachname:null, mieter_email:null,
    mieter_telefon:null, mieter_iban:null, mietbeginn:null, mietende:null, nettomiete:0, nebenkosten:0
  }).eq('id', aptId);
  if(error){toast('❌ '+error.message);return;}
  toast('✓ Status auf Leer korrigiert');
  await refreshPropDetail(aptId);
}

// ── KONTAKT MANAGEMENT ──
function openAptKontaktForm(aptId, typ) {
  const form=document.getElementById('aptKontaktForm_'+aptId);
  if(form){form.style.display='block';const s=document.getElementById('kfTyp_'+aptId);if(s)s.value=typ;}
}
async function saveAptKontakt(aptId) {
  const name=document.getElementById('kfName_'+aptId)?.value?.trim();
  const typ=document.getElementById('kfTyp_'+aptId)?.value;
  const tel=document.getElementById('kfTel_'+aptId)?.value?.trim();
  const email=document.getElementById('kfEmail_'+aptId)?.value?.trim();
  const notiz=document.getElementById('kfNotiz_'+aptId)?.value?.trim();
  if(!name){toast('Bitte Name eingeben');return;}
  const {error} = await db.from('wohneinheit_kontakte').insert({
    wohneinheit_id: aptId, name, typ: typ||'sonstiges',
    telefon: tel||null, email: email||null, notiz: notiz||null
  });
  if(error){toast('❌ '+error.message);return;}
  toast('✓ Kontakt gespeichert');
  if(APP.currentProp) window._currentPropDetail = await getLiegenschaftDetail(APP.currentProp);
  if(APP.selectedApt) selectApt(APP.selectedApt);
}
async function aptKontaktDel(aptId, kontaktId){
  await db.from('wohneinheit_kontakte').delete().eq('id', kontaktId);
  toast('Kontakt entfernt');
  if(APP.currentProp) window._currentPropDetail = await getLiegenschaftDetail(APP.currentProp);
  if(APP.selectedApt) selectApt(APP.selectedApt);
}
// ── MIETVERTRAG ──
async function saveMietvertrag(aptId){
  // Formularfelder lesen
  const vorname  = document.getElementById('mv_vorname_'+aptId)?.value?.trim();
  const nachname = document.getElementById('mv_nachname_'+aptId)?.value?.trim();
  const email    = document.getElementById('mv_mieter_email_'+aptId)?.value?.trim();
  const telefon  = document.getElementById('mv_telefon_'+aptId)?.value?.trim();
  const iban     = document.getElementById('mv_iban_'+aptId)?.value?.trim();
  const notiz_m  = document.getElementById('mv_mieter_notiz_'+aptId)?.value?.trim();
  const beginn   = document.getElementById('mv_beginn_'+aptId)?.value;
  const ende     = document.getElementById('mv_ende_'+aptId)?.value;
  const netto    = parseFloat(document.getElementById('mv_netto_'+aptId)?.value)||0;
  const nk       = parseFloat(document.getElementById('mv_nk_'+aptId)?.value)||0;
  const kaution  = parseFloat(document.getElementById('mv_kaution_'+aptId)?.value)||0;
  const kuend    = parseInt(document.getElementById('mv_kuend_'+aptId)?.value)||3;
  const notiz_v  = document.getElementById('mv_vereinb_'+aptId)?.value?.trim();

  if(!vorname||!nachname||!beginn){toast('⚠️ Vorname, Nachname und Mietbeginn sind Pflicht');return;}

  try {
    // 1. Mieter anlegen oder updaten
    const apt = window._currentPropDetail?.wohneinheiten?.find(w=>w.id==aptId);
    let mieter_id = apt?.mieter_id_neu;
    if(mieter_id){
      await db.from('mieter').update({vorname,nachname,email:email||null,telefon:telefon||null,iban:iban||null,notiz:notiz_m||null,geaendert_am:new Date().toISOString()}).eq('id',mieter_id);
    } else {
      const {data:nm,error:me}=await db.from('mieter').insert({vorname,nachname,email:email||null,telefon:telefon||null,iban:iban||null,notiz:notiz_m||null}).select('id').single();
      if(me){toast('❌ Mieter: '+me.message);return;}
      mieter_id=nm.id;
    }
    // 2. Alten aktiven MV auf abgelaufen setzen
    await db.from('mietvertraege').update({status:'abgelaufen',geaendert_am:new Date().toISOString()}).eq('wohneinheit_id',aptId).eq('status','aktiv');
    // 3. Neuen MV anlegen
    const {error:mve}=await db.from('mietvertraege').insert({
      wohneinheit_id:aptId, mieter_id, start_datum:beginn, ende_datum:ende||null,
      nettomiete:netto, nk_vorauszahlung:nk, kaution, kuendigungsfrist:kuend,
      notiz:notiz_v||null, status:'aktiv'
    });
    if(mve){toast('❌ Mietvertrag: '+mve.message);return;}
    // 4. Wohneinheit Status aktualisieren
    await db.from('wohneinheiten').update({status:'occupied',nettomiete:netto,nebenkosten:nk,mietbeginn:beginn,mietende:ende||null,mieter_vorname:vorname,mieter_nachname:nachname,mieter_email:email||null,mieter_telefon:telefon||null,mieter_iban:iban||null}).eq('id',aptId);
    toast('✓ Mietvertrag gespeichert');
    await refreshPropDetail(aptId);
  } catch(e){ toast('❌ Fehler: '+e.message); }
}
async function toggleMVProp(aptId,prop,val){
  if(prop==='kaution_bezahlt'){
    const {data:mv}=await db.from('mietvertraege').select('id').eq('wohneinheit_id',aptId).eq('status','aktiv').single();
    if(mv?.id){
      const upd={kaution_bezahlt:val};
      if(val) upd.kaution_datum=new Date().toISOString().split('T')[0];
      await db.from('mietvertraege').update(upd).eq('id',mv.id);
    }
  }
  toast('✓');
}
// ── NEBENKOSTEN ──
function aptNKJahr(aptId,delta){
  if(!window._nkJahr) window._nkJahr = {};
  window._nkJahr[aptId] = (window._nkJahr[aptId]||new Date().getFullYear()) + delta;
  if(APP.selectedApt)selectApt(APP.selectedApt);
}
async function aptNKManualAdd(aptId){
  const name=document.getElementById('nkManName_'+aptId)?.value?.trim();
  const kat=document.getElementById('nkManKat_'+aptId)?.value;
  const kosten=parseFloat(document.getElementById('nkManKosten_'+aptId)?.value||0);
  const apt=APP.selectedApt;
  if(!name||!kosten){toast('Name + Kosten pflicht');return;}
  const jahr=window._nkJahr?.[aptId]||new Date().getFullYear();
  const {error}=await db.from('nk_positionen').insert({
    wohneinheit_id: aptId,
    liegenschaft_id: apt?.liegenschaft_id||null,
    jahr, name, kategorie: kat||'sonstiges', kosten, umlagefaehig: true
  });
  if(error){toast('❌ '+error.message);return;}
  toast('✓ Kostenposition in DB gespeichert');
  if(APP.selectedApt)selectApt(APP.selectedApt);
}
async function aptNKArchivieren(aptId,jahr){
  const a=APP.selectedApt;if(!a)return;
  const v=window._allVertraege||[];
  const pV=v.filter(x=>!x.liegenschaft_id||x.liegenschaft_id===a.liegenschaft_id||x.liegenschaft_id===APP.currentProp);
  const allWE=window._currentPropDetail?.wohneinheiten||[];
  const totF=allWE.reduce((s,w)=>s+(parseFloat(w.flaeche_qm)||0),0)||1;
  const ant=(parseFloat(a.flaeche_qm)||0)/totF;
  const istkost=pV.reduce((s,x)=>{const mt=x.periode==='jährlich'?parseFloat(x.kosten||0)/12:parseFloat(x.kosten||0);return s+mt*ant*12;},0);
  const vz=(parseFloat(a.aktiverMV?.nk_vorauszahlung||a.nebenkosten||0))*12;
  const jahrInt=parseInt(jahr)||new Date().getFullYear();
  // In DB speichern (UPSERT falls Jahr schon existiert)
  const {data:nka,error:e1}=await db.from('nk_abrechnungen').upsert({
    wohneinheit_id: aptId,
    liegenschaft_id: a.liegenschaft_id||null,
    jahr: jahrInt,
    mieter_name: a.mieter_name||'',
    vorauszahlung: vz,
    istkost: istkost,
    status: 'abgeschlossen'
  },{onConflict:'wohneinheit_id,jahr'}).select().single();
  if(e1){toast('❌ '+e1.message);return;}
  toast('✓ NK-Abrechnung '+jahrInt+' in DB gespeichert');
  if(APP.selectedApt)selectApt(APP.selectedApt);
}
async function aptArchivDetail(aptId, archivId){
  const {data:ar}=await db.from('nk_abrechnungen').select('*, nk_positionen(*)').eq('id',archivId).single();
  if(!ar)return;
  const saldo=parseFloat(ar.vorauszahlung||0)-parseFloat(ar.istkost||0);
  document.getElementById('modalTitle').textContent='📄 NK-Abrechnung '+ar.jahr;
  const posHtml=(ar.nk_positionen||[]).map(p=>`
    <div style="display:flex;justify-content:space-between;font-size:11px;padding:4px 0;border-bottom:1px solid var(--border)">
      <span style="color:var(--text2)">${esc(p.name)} <span style="color:var(--text4);font-size:10px">${p.kategorie||''}</span></span>
      <span style="font-family:'JetBrains Mono'">${fmtEur(p.kosten)}</span>
    </div>`).join('');
  document.getElementById('modalBody').innerHTML=`
    <div style="background:linear-gradient(135deg,#1C1917,#292524);border-radius:10px;padding:14px;margin-bottom:14px">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        <div><div style="font-size:9px;color:rgba(255,255,255,.4)">VORAUSZAHLUNG</div><div style="font-size:18px;font-weight:700;color:#60A5FA;font-family:'Playfair Display'">${fmtEur(ar.vorauszahlung)}</div></div>
        <div><div style="font-size:9px;color:rgba(255,255,255,.4)">ISTKOSTEN</div><div style="font-size:18px;font-weight:700;color:#FCD34D;font-family:'Playfair Display'">${fmtEur(ar.istkost)}</div></div>
        <div><div style="font-size:9px;color:rgba(255,255,255,.4)">${saldo>=0?'GUTHABEN':'NACHZAHLUNG'}</div><div style="font-size:18px;font-weight:700;color:${saldo>=0?'#22C55E':'#EF4444'};font-family:'Playfair Display'">${fmtEur(Math.abs(saldo))}</div></div>
      </div>
    </div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:10px">Mieter: ${esc(ar.mieter_name||'–')} · Status: ${ar.status}</div>
    ${posHtml?`<div style="margin-bottom:12px">${posHtml}</div>`:''}
    <div style="margin-top:14px;display:flex;gap:8px">
      <button class="btn btn-gold" onclick="window.print()">🖨 Drucken</button>
      <button class="btn btn-ghost" onclick="closeModal()">Schließen</button>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}
function aptNKVorschau(aptId){
  const a=APP.selectedApt;if(!a)return;
  const v=window._allVertraege||[];
  const pV=v.filter(x=>!x.liegenschaft_id||x.liegenschaft_id===a.liegenschaft_id||x.liegenschaft_id===APP.currentProp);
  const allWE=window._currentPropDetail?.wohneinheiten||[];
  const totF=allWE.reduce((s,w)=>s+(parseFloat(w.flaeche_qm)||0),0)||1;
  const ant=(parseFloat(a.flaeche_qm)||0)/totF;
  if(!window._nkJahr) window._nkJahr={};
  const jahr=window._nkJahr[aptId]||new Date().getFullYear();
  const vz=(parseFloat(a.nebenkosten)||0)*12;
  let istges=0;
  const posRows=pV.map(vtrag=>{
    const mt=vtrag.periode==='jährlich'?parseFloat(vtrag.kosten||0)/12:parseFloat(vtrag.kosten||0);
    const jahresant=mt*ant*12; istges+=jahresant;
    return `<tr><td style="padding:5px 8px;font-size:11px">${esc(vtrag.name)}</td><td style="padding:5px 8px;font-size:11px;color:#6b7280">${esc(vtrag.anbieter||'')}</td><td style="padding:5px 8px;text-align:right;font-size:11px">${fmtEur(mt*12)}</td><td style="padding:5px 8px;text-align:right;font-size:11px;font-weight:600">${fmtEur(jahresant)}</td></tr>`;
  }).join('');
  const saldo=vz-istges;
  document.getElementById('modalTitle').textContent='📄 NK-Abrechnung Vorschau '+jahr;
  document.getElementById('modalBody').innerHTML=`
    <div style="background:white;border-radius:10px;padding:20px;font-family:serif;color:#1a1a1a;font-size:12px">
      <div style="text-align:center;border-bottom:2px solid #1a1a1a;padding-bottom:10px;margin-bottom:14px">
        <div style="font-size:18px;font-weight:700">NEBENKOSTENABRECHNUNG ${jahr}</div>
        <div>WE ${esc(a.nummer)} · ${esc(a.typ||'')} · ${a.flaeche_qm} m²</div>
        ${a.mieter_name?`<div style="color:#6b7280">Mieter: ${esc(a.mieter_name)}</div>`:''}
        <div style="color:#6b7280">01.01.${jahr} – 31.12.${jahr}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
        <thead><tr style="border-bottom:1px solid #e5e7eb">
          <th style="padding:5px 8px;font-size:10px;text-align:left;color:#6b7280">POSITION</th>
          <th style="padding:5px 8px;font-size:10px;text-align:left;color:#6b7280">ANBIETER</th>
          <th style="padding:5px 8px;font-size:10px;text-align:right;color:#6b7280">GESAMT/J.</th>
          <th style="padding:5px 8px;font-size:10px;text-align:right;color:#6b7280">ANTEIL ${Math.round(ant*1000)/10}%</th>
        </tr></thead>
        <tbody>${posRows||'<tr><td colspan="4" style="padding:10px;color:#6b7280;text-align:center">Keine Positionen</td></tr>'}</tbody>
        <tfoot><tr style="border-top:2px solid #1a1a1a">
          <td colspan="3" style="padding:8px;font-weight:700">ISTKOSTEN GESAMT</td>
          <td style="padding:8px;text-align:right;font-weight:700">${fmtEur(istges)}</td>
        </tr></tfoot>
      </table>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding:12px;background:#f9fafb;border-radius:8px;margin-bottom:14px">
        <div style="text-align:center"><div style="font-size:10px;color:#6b7280">VORAUSZAHLUNGEN</div><div style="font-size:16px;font-weight:700;color:#2563eb">${fmtEur(vz)}</div></div>
        <div style="text-align:center"><div style="font-size:10px;color:#6b7280">ISTKOSTEN</div><div style="font-size:16px;font-weight:700;color:#d97706">${fmtEur(istges)}</div></div>
        <div style="text-align:center"><div style="font-size:10px;color:#6b7280">${saldo>=0?'GUTHABEN':'NACHZAHLUNG'}</div><div style="font-size:16px;font-weight:700;color:${saldo>=0?'#16a34a':'#dc2626'}">${fmtEur(Math.abs(saldo))}</div></div>
      </div>
      <div style="font-size:10px;color:#6b7280;text-align:center">Flächenschlüssel: ${a.flaeche_qm}m² / ${Math.round(totF)}m² = ${Math.round(ant*1000)/10}%</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn btn-gold" onclick="aptNKArchivieren('${aptId}','${jahr}');closeModal()">🗄 Archivieren</button>
      <button class="btn btn-ghost" onclick="window.print()">🖨 Drucken</button>
      <button class="btn btn-ghost" onclick="closeModal()">Schließen</button>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

function tmplFinanzen(txs) {
  const ein = txs.filter(t=>t.typ==='einnahme');
  const aus = txs.filter(t=>t.typ==='ausgabe');
  const totalEin = ein.reduce((a,t)=>a+parseFloat(t.betrag||0),0);
  const totalAus = aus.reduce((a,t)=>a+parseFloat(t.betrag||0),0);
  const byMonth = {};
  txs.forEach(t=>{ const m=(t.buchungsdatum||'').slice(0,7); if(!m)return; if(!byMonth[m])byMonth[m]={ein:0,aus:0}; t.typ==='einnahme'?byMonth[m].ein+=parseFloat(t.betrag||0):byMonth[m].aus+=parseFloat(t.betrag||0); });
  const months = Object.keys(byMonth).sort().slice(-6);
  const maxV = Math.max(...months.map(m=>byMonth[m].ein),1);
  const bars = months.map(m=>{
    const {ein,aus}=byMonth[m];
    return `<div class="bar-col"><div style="display:flex;flex-direction:column-reverse;flex:1;width:100%">
      <div class="bar-seg" style="height:${(aus/maxV)*85}px;background:linear-gradient(var(--blue3),var(--blue2))"></div>
      <div class="bar-seg" style="height:${((ein-aus)/maxV)*85}px;background:linear-gradient(var(--green3),var(--green2))"></div>
    </div><div class="bar-lbl">${m.slice(-2)}</div></div>`;
  }).join('');
  const katAus = {};
  aus.forEach(t=>{ katAus[t.kategorie]=(katAus[t.kategorie]||0)+parseFloat(t.betrag||0); });
  const katRows = Object.entries(katAus).map(([k,v])=>{
    const pct = totalAus>0?Math.round((v/totalAus)*100):0;
    return `<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="font-size:12px;color:var(--text2)">${esc(k)}</span>
      <span style="font-family:'JetBrains Mono';font-size:11px;color:var(--gold)">${fmtEur(v)}</span></div>
      <div class="prog-wrap"><div class="prog-bar" style="width:${pct}%;background:linear-gradient(90deg,#B45309,#D97706)"></div></div></div>`;
  }).join('');
  const txRows = txs.slice(0,25).map(tx=>`
    <div class="tx-item">
      <div class="tx-ico" style="background:${tx.typ==='einnahme'?'var(--green3)':'var(--red3)'}">${tx.icon||'💶'}</div>
      <div class="tx-body"><div class="tx-name">${esc(tx.bezeichnung)}</div>
        <div class="tx-meta">${fmtDate(tx.buchungsdatum)} · ${esc(tx.liegenschaft_name||'Allgemein')}</div></div>
      <div class="tx-amt ${tx.typ==='einnahme'?'tx-in':'tx-out'}">${tx.typ==='einnahme'?'+':'-'}${fmtEur(tx.betrag)}</div>
    </div>`).join('');
  return `
  <div class="kpi-grid">
    <div class="kpi-card"><div class="kpi-label">Einnahmen</div><div class="kpi-value kv-green">${fmtEur(totalEin)}</div><div class="kpi-accent-line" style="background:var(--green2)"></div></div>
    <div class="kpi-card"><div class="kpi-label">Ausgaben</div><div class="kpi-value kv-red">${fmtEur(totalAus)}</div><div class="kpi-accent-line" style="background:var(--red2)"></div></div>
    <div class="kpi-card"><div class="kpi-label">Reingewinn</div><div class="kpi-value kv-blue">${fmtEur(totalEin-totalAus)}</div><div class="kpi-accent-line" style="background:var(--blue2)"></div></div>
    <div class="kpi-card"><div class="kpi-label">Marge</div><div class="kpi-value kv-gold">${totalEin>0?Math.round(((totalEin-totalAus)/totalEin)*100):0}%</div><div class="kpi-accent-line" style="background:var(--gold2)"></div></div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-bottom:16px">
    <div class="card"><div class="card-title">📊 Monatsverlauf</div><div class="bar-chart">${bars||noDaten()}</div>
      <div class="chart-legend"><div class="cl-item"><div class="cl-dot" style="background:var(--green2)"></div>Einnahmen</div><div class="cl-item"><div class="cl-dot" style="background:var(--blue2)"></div>Ausgaben</div></div></div>
    <div class="card"><div class="card-title">🥧 Kostenstruktur</div>${katRows||noDaten()}</div>
  </div>
  <div class="card"><div class="section-header"><div class="section-title">Alle Buchungen</div>${can('edit_finanzen')?`<button class="btn btn-gold btn-sm" onclick="openNeueBuchungModal()">+ Neue Buchung</button>`:''}</div>
    <div class="tx-list">${txRows||noDaten()}</div></div>`;
}

// ═══ FINANZEN NEU (mit Tabs: Verwaltung / Liegenschaften) ═══
async function tmplFinanzenNeu() {
  const [txs, vg, liegs, allWE] = await Promise.all([
    getTransaktionen(200),
    getVerwaltungsgebuehren(),
    getLiegenschaften(),
    db.from('wohneinheiten').select('id,nummer,liegenschaft_id,mieter_vorname,mieter_nachname,nettomiete,nebenkosten,mietbeginn,status,liegenschaften(name)').then(r=>r.data||[])
  ]);
  const totalVG   = vg.reduce((a,v)=>a+parseFloat(v.betrag||0),0);
  const ein = txs.filter(t=>t.typ==='einnahme');
  const aus = txs.filter(t=>t.typ==='ausgabe');
  const totalEin  = ein.reduce((a,t)=>a+parseFloat(t.betrag||0),0);
  const totalAus  = aus.reduce((a,t)=>a+parseFloat(t.betrag||0),0);

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

  const txRows = txs.slice(0,30).map(tx=>{
    const bezahltBadge = tx.bezahlt===true
      ? `<span class="sp sp-green" style="font-size:10px">✓ bezahlt</span>`
      : tx.bezahlt===false
        ? `<span class="sp sp-red" style="font-size:10px">⏳ offen</span>`
        : '';
    const kat = tx.kategorie ? `· ${esc(tx.kategorie)}` : '';
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
      <div class="kpi-sub up">/Monat</div>
      <div class="kpi-accent-line" style="background:var(--gold2)"></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Mietumsatz (Eigentümer)</div>
      <div class="kpi-value kv-green">${fmtEur(totalEin)}</div>
      <div class="kpi-sub">Einnahmen gesamt</div>
      <div class="kpi-accent-line" style="background:var(--green2)"></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Ausgaben</div>
      <div class="kpi-value kv-red">${fmtEur(totalAus)}</div>
      <div class="kpi-sub down">Kosten gesamt</div>
      <div class="kpi-accent-line" style="background:var(--red2)"></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Reingewinn (Eigentümer)</div>
      <div class="kpi-value kv-blue">${fmtEur(totalEin-totalAus)}</div>
      <div class="kpi-sub">${totalEin>0?Math.round(((totalEin-totalAus)/totalEin)*100):0}% Marge</div>
      <div class="kpi-accent-line" style="background:var(--blue2)"></div>
    </div>
  </div>

  <!-- TABS -->
  <div style="display:flex;gap:4px;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:0">
    ${['verwaltung','liegenschaften','mieten','buchungen'].map(tab=>`
      <button onclick="APP.finTab='${tab}';document.querySelectorAll('.fin-tab').forEach(x=>x.classList.toggle('active',x.dataset.tab==='${tab}'));document.querySelectorAll('.fin-panel').forEach(x=>x.style.display=x.dataset.tab==='${tab}'?'block':'none')" 
        class="fin-tab nav-link ${APP.finTab===tab?'active':''}" data-tab="${tab}">
        ${{verwaltung:'🏛 Verwaltungsgebühren',liegenschaften:'📊 Liegenschaften',mieten:'🏠 Mieten',buchungen:'💶 Buchungen'}[tab]}
      </button>`).join('')}
  </div>

  <div class="fin-panel" data-tab="verwaltung" style="display:${APP.finTab==='verwaltung'?'block':'none'}">
    <div class="card"><div class="card-title">🏛️ Meine Verwaltungsgebühren – Rico's Einkommen</div>
      <div style="background:var(--gold4);border:1px solid var(--gold3);border-radius:10px;padding:12px 14px;margin-bottom:14px;font-size:12px;color:var(--gold)">
        ℹ️ Die Verwaltungsgebühr ist das Einkommen der Verwaltung (Rico) – getrennt vom Mietumsatz der Eigentümer.
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
        const netto=parseFloat(w.nettomiete||0);
        const nk=parseFloat(w.nebenkosten||0);
        const warmmiete=netto+nk;
        const lName=w.liegenschaften?.name||'–';
        const letzteZahlung=txs.find(t=>t.wohneinheit_id===w.id&&t.kategorie==='Miete');
        const bezahlt=letzteZahlung?.bezahlt;
        return `<div class="tbl-row" style="grid-template-columns:1.4fr .8fr .8fr .9fr .9fr .7fr" onclick="openProp(${w.liegenschaft_id})">
          <div class="tbl-cell"><strong>${esc(w.mieter_vorname)} ${esc(w.mieter_nachname||'')}</strong></div>
          <div class="tbl-cell" style="font-size:11px;color:var(--text3)">${esc(lName)}</div>
          <div class="tbl-cell"><span class="tag tag-blue">${esc(w.nummer)}</span></div>
          <div class="tbl-cell"><span style="color:var(--green);font-family:'JetBrains Mono';font-size:12px">${fmtEur(netto)}</span></div>
          <div class="tbl-cell"><span style="color:var(--blue2);font-family:'JetBrains Mono';font-size:12px">${fmtEur(warmmiete)}</span><div style="font-size:10px;color:var(--text3)">inkl. NK ${fmtEur(nk)}</div></div>
          <div class="tbl-cell">${w.mietbeginn?`<span class="tag tag-green" style="font-size:10px">${fmtDate(w.mietbeginn)}</span>`:'-'}</div>
        </div>`;
      }).join('')||noDaten('Keine aktiven Mietverhältnisse.')}
      <div style="border-top:2px solid var(--border);margin-top:12px;padding-top:12px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:700;color:var(--text)">Gesamtumsatz/Monat</span>
        <div style="text-align:right">
          <div style="font-family:'JetBrains Mono';font-size:18px;font-weight:700;color:var(--green)">${fmtEur(allWE.filter(w=>w.mieter_vorname).reduce((s,w)=>s+parseFloat(w.nettomiete||0)+parseFloat(w.nebenkosten||0),0))}</div>
          <div style="font-size:10px;color:var(--text3)">${fmtEur(allWE.filter(w=>w.mieter_vorname).reduce((s,w)=>s+parseFloat(w.nettomiete||0),0))} Netto + NK</div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-title">💶 Letzte Mietzahlungen</div>
      ${txs.filter(t=>t.kategorie==='Miete').slice(0,15).map(tx=>{
        const badge=tx.bezahlt===true?`<span class="sp sp-green" style="font-size:10px">✓ bezahlt</span>`:`<span class="sp sp-red" style="font-size:10px">⏳ offen</span>`;
        return `<div class="tx-item">
          <div class="tx-ico" style="background:var(--green3)">${tx.icon||'💶'}</div>
          <div class="tx-body"><div class="tx-name">${esc(tx.bezeichnung)}</div><div class="tx-meta">${fmtDate(tx.buchungsdatum)}</div></div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            <div class="tx-amt tx-in">+${fmtEur(tx.betrag)}</div>${badge}
          </div>
        </div>`;
      }).join('')||noDaten('Noch keine Mietzahlungen.')}
    </div>
  </div>

  <div class="fin-panel" data-tab="buchungen" style="display:${APP.finTab==='buchungen'?'block':'none'}">
    <div class="card">
      <div class="section-header"><div class="section-title">Alle Buchungen</div>${can('edit_finanzen')?`<button class="btn btn-gold btn-sm" onclick="openNeueBuchungModal()">+ Neue Buchung</button>`:''}</div>
      ${txRows||noDaten()}
    </div>
  </div>`;
}

// ═══ DIENSTLEISTER ═══
function tmplDienstleister(rows) {
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
          ${d.email?`<a class="btn btn-ghost btn-sm" href="mailto:${esc(d.email)}" style="text-decoration:none">&#9993; E-Mail</a>`:`<button class="btn btn-ghost btn-sm" disabled>&#9993; E-Mail</button>`}
          ${d.telefon?`<a class="btn btn-ghost btn-sm" href="tel:${esc(d.telefon)}" style="text-decoration:none">&#128222; Anruf</a>`:''}
        </div>
      </div>`;
    }).join('');
  }

  const filtered = APP.dlFilter ? rows.filter(r=>r.kategorie===APP.dlFilter) : rows;
  return `
  <div class="section-header">
    <div class="section-title">Dienstleister & Firmen</div>
    <button class="btn btn-gold btn-sm" onclick="openNeuerDLModal()">+ Hinzufügen</button>
  </div>
  <!-- Filter-Chips -->
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
    <button class="btn btn-ghost btn-sm dl-filter-btn ${!APP.dlFilter?'active':''}" data-kat="" onclick="APP.dlFilter='';_dlRerender()">Alle (${rows.length})</button>
    ${kats.map(k=>`<button class="btn btn-ghost btn-sm dl-filter-btn ${APP.dlFilter===k?'active':''}" data-kat="${esc(k)}" onclick="APP.dlFilter='${esc(k)}';_dlRerender()">${katIcons[k]||'📋'} ${katLabels[k]||k} (${rows.filter(r=>r.kategorie===k).length})</button>`).join('')}
  </div>
  <div style="font-size:11px;color:var(--text3);margin-bottom:10px" id="dlCount">${filtered.length} Dienstleister</div>
  <div class="contract-grid" id="dlGrid">${renderDLCards(filtered)}</div>`;
}

// ═══ SCHADENSMELDUNGEN / HAVARIE ═══
function tmplSchaden(rows) {
  const prioColor = {notfall:'var(--red)',hoch:'#EA580C',mittel:'var(--gold)',niedrig:'var(--green)'};
  const prioIcon  = {notfall:'🚨',hoch:'🔴',mittel:'🟡',niedrig:'🟢'};
  const statLabel = {gemeldet:'GEMELDET',in_bearbeitung:'IN ARBEIT',erledigt:'ERLEDIGT',abgeschlossen:'ABGESCHLOSSEN'};
  const statTag   = {gemeldet:'tag-red',in_bearbeitung:'tag-gold',erledigt:'tag-green',abgeschlossen:'tag-teal'};

  const offen  = rows.filter(r=>r.status!=='erledigt'&&r.status!=='abgeschlossen');
  const erled  = rows.filter(r=>r.status==='erledigt'||r.status==='abgeschlossen');
  const notfall = rows.filter(r=>r.prioritaet==='notfall'&&r.status!=='erledigt');

  function renderRow(s) {
    return `<div class="tbl-row schaden-row" style="grid-template-columns:.3fr 1.8fr 1fr 1fr auto;cursor:pointer;border-left:3px solid ${prioColor[s.prioritaet]||'var(--border)'}" 
      onclick="openSchadenModal(${s.id})"
      title="Klicken für Details: ${esc(s.titel)}">
      <div style="font-size:18px;text-align:center">${prioIcon[s.prioritaet]||'⚠️'}</div>
      <div class="tbl-cell">
        <strong>${esc(s.titel)}</strong>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">
          ${esc(s.liegenschaften?.name||'?')} ${s.wohneinheiten?'· Wohnung '+s.wohneinheiten.nummer:''}
        </div>
      </div>
      <div class="tbl-cell">
        ${s.dienstleister?`<span style="font-size:11px">${esc(s.dienstleister.name)}</span>
          ${s.dienstleister.telefon?`<div style="font-size:10px;color:var(--blue2);font-family:'JetBrains Mono'">${esc(s.dienstleister.telefon)}</div>`:''}`:'<span style="color:var(--text3);font-size:11px">nicht zugewiesen</span>'}
      </div>
      <div class="tbl-cell" style="font-size:10px;color:var(--text3)">${fmtDate(s.erstellt_am)}</div>
      <div><span class="tag ${statTag[s.status]||'tag-gold'}">${statLabel[s.status]||s.status}</span></div>
    </div>`;
  }

  // Schaden-Filter State
  if (!window._schadenFilter) window._schadenFilter = 'alle';

  window._filterSchaden = function(typ) {
    window._schadenFilter = typ;
    document.querySelectorAll('.skpi').forEach(el => el.classList.remove('skpi-active'));
    const el = document.getElementById('skpi-'+typ);
    if (el) el.classList.add('skpi-active');
    let list;
    if      (typ==='notfall') list = rows.filter(r=>r.prioritaet==='notfall'&&r.status!=='erledigt');
    else if (typ==='offen')   list = rows.filter(r=>r.status!=='erledigt'&&r.status!=='abgeschlossen');
    else if (typ==='erledigt')list = rows.filter(r=>r.status==='erledigt'||r.status==='abgeschlossen');
    else                      list = rows;
    const hdr = typ==='erledigt' ? 'Erledigte Schadensmeldungen' : typ==='notfall' ? '🚨 Notfall-Meldungen' : 'Offene Schadensmeldungen';
    document.getElementById('schadenListTitle').textContent = hdr;
    document.getElementById('schadenListBody').innerHTML = list.length ? list.map(renderRow).join('') : noDaten('✅ Keine Einträge in dieser Kategorie.');
  };

  return `
  <div class="kpi-grid" style="cursor:pointer">
    <div id="skpi-notfall" class="kpi-card skpi ${notfall.length>0?'skpi-active':''}" style="${notfall.length?'border-left:3px solid var(--red)':''}" onclick="_filterSchaden('notfall')">
      <div class="kpi-label">🚨 Notfälle</div>
      <div class="kpi-value ${notfall.length>0?'kv-red':'kv-green'}">${notfall.length}</div>
      <div class="kpi-sub">Sofort handeln</div>
      <div class="kpi-accent-line" style="background:var(--red2)"></div>
    </div>
    <div id="skpi-offen" class="kpi-card skpi" onclick="_filterSchaden('offen')">
      <div class="kpi-label">🔴 Offen</div>
      <div class="kpi-value kv-gold">${offen.length}</div>
      <div class="kpi-sub">Aktiv</div>
      <div class="kpi-accent-line" style="background:var(--gold2)"></div>
    </div>
    <div id="skpi-erledigt" class="kpi-card skpi" onclick="_filterSchaden('erledigt')">
      <div class="kpi-label">✅ Erledigt</div>
      <div class="kpi-value kv-green">${erled.length}</div>
      <div class="kpi-sub">Abgeschlossen</div>
      <div class="kpi-accent-line" style="background:var(--green2)"></div>
    </div>
    <div id="skpi-alle" class="kpi-card skpi" onclick="_filterSchaden('alle')">
      <div class="kpi-label">Alle</div>
      <div class="kpi-value">${rows.length}</div>
      <div class="kpi-sub">Gesamt</div>
      <div class="kpi-accent-line" style="background:var(--border2)"></div>
    </div>
  </div>
  <div class="section-header">
    <div class="section-title" id="schadenListTitle">Offene Schadensmeldungen</div>
    ${can('edit_schaden')||can('create_schaden')?`<button class="btn btn-gold btn-sm" onclick="openNeueSchadenModal()">+ Schaden melden</button>`:''}
  </div>
  <div class="card">
    <div class="tbl-header" style="grid-template-columns:.3fr 1.8fr 1fr 1fr auto">
      <span>Prio</span><span>Titel &amp; Ort</span><span>Dienstleister</span><span>Datum</span><span>Status</span>
    </div>
    <div id="schadenListBody">${offen.length ? offen.map(renderRow).join('') : noDaten('Keine offenen Schadensmeldungen. ✅')}</div>
  </div>`;
}

function tmplVertraege(rows) {
  if (!rows.length) return `<div class="card">${noDaten('Noch keine Verträge.')}</div>`;
  window._allVertraege = rows;

  const monthly  = rows.filter(v=>v.periode==='monatlich').reduce((a,v)=>a+parseFloat(v.kosten||0),0);
  const yearly   = rows.filter(v=>v.periode==='jährlich').reduce((a,v)=>a+parseFloat(v.kosten||0),0);
  const monatsges = monthly + yearly/12;
  const active   = rows.filter(v=>v.status==='ok').length;
  const warn     = rows.filter(v=>v.status==='warn').length;
  const abgel    = rows.filter(v=>v.status==='alert').length;

  // Grouping by Liegenschaft
  const liegsMap = {};
  rows.forEach(v=>{
    const key = v.liegenschaft_name||'Liegenschaftsübergreifend';
    if(!liegsMap[key]) liegsMap[key]=[];
    liegsMap[key].push(v);
  });

  function statusBadge(v) {
    if(v.status==='ok')    return `<span class="tag tag-green" style="font-size:10px;padding:3px 8px">✓ Aktiv</span>`;
    if(v.status==='warn')  return `<span class="tag tag-gold"  style="font-size:10px;padding:3px 8px">⚠ Ablauf bald</span>`;
    return                        `<span class="tag tag-red"   style="font-size:10px;padding:3px 8px">🔴 Abgelaufen</span>`;
  }

  function daysUntil(dateStr) {
    if(!dateStr) return null;
    const d = new Date(dateStr); d.setHours(0,0,0,0);
    const t = new Date(); t.setHours(0,0,0,0);
    return Math.round((d-t)/86400000);
  }

  function vertragCard(v) {
    const days = daysUntil(v.ende_datum);
    const daysHtml = days!==null
      ? days < 0   ? `<div style="font-size:10px;color:var(--red);font-weight:600;margin-top:4px">🔴 Seit ${Math.abs(days)}d abgelaufen</div>`
      : days <= 30 ? `<div style="font-size:10px;color:var(--gold);font-weight:600;margin-top:4px">⏳ Läuft in ${days}d ab</div>`
      : days <= 90 ? `<div style="font-size:10px;color:var(--gold);margin-top:4px">Endet: ${new Date(v.ende_datum).toLocaleDateString('de-DE')}</div>`
      : ''
      : '';
    const archived = v._archiviert;
    return `<div class="contract-card${archived?' cc-archived':''}" onclick='openVertragModal(${v.id})' style="${archived?'opacity:.6;':''}cursor:pointer">
      <div class="cc-icon">${v.icon||'📋'}</div>
      <div class="cc-name">${esc(v.name)}</div>
      <div class="cc-prov">${esc(v.anbieter||'–')} · ${esc(v.liegenschaft_name||'Alle')}</div>
      <div class="cc-cost">${fmtEur(v.kosten)} / ${esc(v.periode)}</div>
      ${statusBadge(v)}
      ${daysHtml}
    </div>`;
  }

  // Filter state
  const f = window._vertragFilter||'alle';
  window._vertragFilter = f;

  // Sortierte Liegenschafts-Keys: alphabetisch, "Liegenschaftsübergreifend" zuletzt
  const liegKeys = Object.keys(liegsMap).sort((a,b) => {
    if (a==='Liegenschaftsübergreifend') return 1;
    if (b==='Liegenschaftsübergreifend') return -1;
    return a.localeCompare(b,'de');
  });

  // Pro Liegenschaft eine Sektion rendern
  const liegSections = liegKeys.map(liegName => {
    const liegRows = liegsMap[liegName];
    let lFiltered = liegRows;
    if(f==='warn')  lFiltered = liegRows.filter(v=>v.status==='warn');
    if(f==='alert') lFiltered = liegRows.filter(v=>v.status==='alert');
    if(f==='ok')    lFiltered = liegRows.filter(v=>v.status==='ok');
    if(!lFiltered.length) return '';

    const lMon   = lFiltered.filter(v=>v.periode==='monatlich').reduce((a,v)=>a+parseFloat(v.kosten||0),0);
    const lYear  = lFiltered.filter(v=>v.periode==='jährlich').reduce((a,v)=>a+parseFloat(v.kosten||0),0);
    const lTotal = lMon + lYear/12;
    const lAlert = lFiltered.filter(v=>v.status==='alert').length;
    const lWarn  = lFiltered.filter(v=>v.status==='warn').length;
    const isGlobal = liegName==='Liegenschaftsübergreifend';

    const badgeHtml = lAlert
      ? `<span class="tag tag-red"  style="font-size:10px;padding:2px 8px">🔴 ${lAlert} abgelaufen</span>`
      : lWarn
      ? `<span class="tag tag-gold" style="font-size:10px;padding:2px 8px">⚠ ${lWarn} bald fällig</span>`
      : `<span class="tag tag-green" style="font-size:10px;padding:2px 8px">✓ Alles ok</span>`;

    return `
      <div style="margin-bottom:20px">
        <!-- Liegenschafts-Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;
                    padding:12px 16px;background:var(--bg3);border-radius:12px;
                    border:1px solid var(--border);margin-bottom:10px;
                    border-left:4px solid ${lAlert?'var(--red2)':lWarn?'var(--gold2)':'var(--green2)'}">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="font-size:22px">${isGlobal?'🌐':'🏢'}</div>
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--text)">${esc(liegName)}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px">
                ${lFiltered.length} Vertrag${lFiltered.length!==1?'e':''}
                &nbsp;·&nbsp;${fmtEur(lTotal)}/Mt. gesamt
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            ${badgeHtml}
            ${can('edit_vertraege')?`<button class="btn btn-ghost btn-sm" style="font-size:11px"
              onclick="openNeuerVertragModal('${esc(liegName)}')">+ Vertrag</button>`:''}
          </div>
        </div>
        <!-- Vertrags-Karten dieser Liegenschaft -->
        <div class="contract-grid">${lFiltered.map(vertragCard).join('')}</div>
      </div>`;
  }).join('');

  const hasResults = liegSections.trim().length > 0;

  return `
  <div class="kpi-grid" style="margin-bottom:16px">
    <div class="kpi-card clickable" onclick="setVertragFilter('alle')" style="${f==='alle'?'border-left:3px solid var(--blue2)':''}">
      <div class="kpi-label">Verträge gesamt</div><div class="kpi-value kv-blue">${rows.length}</div>
      <div class="kpi-sub">${active} aktiv · ${warn+abgel} Handlungsbedarf</div>
      <div class="kpi-accent-line" style="background:var(--blue2)"></div></div>
    <div class="kpi-card clickable" onclick="setVertragFilter('alle')">
      <div class="kpi-label">Monatsk. gesamt</div><div class="kpi-value kv-red">${fmtEur(monatsges)}</div>
      <div class="kpi-sub">${fmtEur(monthly)}/Mt. fix + ${fmtEur(yearly/12)}/Mt. anteilig</div>
      <div class="kpi-accent-line" style="background:var(--red2)"></div></div>
    <div class="kpi-card clickable" onclick="setVertragFilter(window._vertragFilter==='warn'?'alle':'warn')" style="${f==='warn'?'border-left:3px solid var(--gold)':''}">
      <div class="kpi-label">⚠ Ablauf bald</div><div class="kpi-value kv-gold">${warn}</div>
      <div class="kpi-sub">Verlängerung prüfen</div>
      <div class="kpi-accent-line" style="background:var(--gold2)"></div></div>
    <div class="kpi-card clickable" onclick="setVertragFilter(window._vertragFilter==='alert'?'alle':'alert')" style="${abgel?'border-left:3px solid var(--red)':''}${f==='alert'?'border-left:3px solid var(--red2)':''}">
      <div class="kpi-label">🔴 Abgelaufen</div><div class="kpi-value kv-red">${abgel}</div>
      <div class="kpi-sub">sofort handeln</div>
      <div class="kpi-accent-line" style="background:var(--red2)"></div></div>
  </div>

  <div class="section-header" style="margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <div class="section-title">Verträge nach Liegenschaft</div>
      <div style="display:flex;gap:4px">
        ${['alle','ok','warn','alert'].map(fl=>{
          const lbl={alle:'Alle',ok:'✓ Aktiv',warn:'⚠ Bald',alert:'🔴 Abgelaufen'}[fl];
          return `<button onclick="setVertragFilter('${fl}')" class="btn btn-ghost btn-sm"
            style="font-size:11px;${f===fl?'background:var(--bg3);border-color:var(--border2);':''}">${lbl}</button>`;
        }).join('')}
      </div>
    </div>
    ${can('edit_vertraege')?`<button class="btn btn-gold btn-sm" onclick="openNeuerVertragModal()">+ Neuer Vertrag</button>`:''}
  </div>

  ${hasResults ? liegSections : `<div class="card">${noDaten('Keine Verträge in dieser Filterauswahl.')}</div>`}`;
}

function setVertragFilter(f) {
  window._vertragFilter = f;
  switchView('vertraege');
}

async function openVertragModal(id) {
  const v = (window._allVertraege||[]).find(x=>x.id===id);
  if (!v) { toast('Vertrag nicht gefunden'); return; }
  // Archiv aus DB vorladen
  if(!window._vertragArchivCache) window._vertragArchivCache={};
  window._vertragArchivCache[id] = await getVertragArchiv(id);

  const days = v.ende_datum ? Math.round((new Date(v.ende_datum)-new Date())/86400000) : null;
  const statusColor = v.status==='ok'?'var(--green)':v.status==='warn'?'var(--gold)':'var(--red)';
  const statusLabel = v.status==='ok'?'✓ Aktiv':v.status==='warn'?'⚠ Ablauf bald':'🔴 Abgelaufen';

  // Archiv aus DB-Cache
  const archiv = window._vertragArchivCache?.[id] || [];

  const archivHtml = archiv.length
    ? archiv.map((a,i)=>`
      <div style="padding:10px 12px;border-radius:9px;background:var(--bg);border:1px solid var(--border);margin-bottom:6px;opacity:.75">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <div style="font-size:11px;font-weight:700;color:var(--text2)">${esc(a.anbieter||v.anbieter)} — ${esc(a.beschreibung||'Vorgängervertrag')}</div>
          <button onclick="vertragArchivDel(${id},${i})" style="background:none;border:none;color:var(--text4);cursor:pointer;font-size:13px">✕</button>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--text3)">
          ${a.von?`<span>📅 ${a.von}${a.bis?' → '+a.bis:''}</span>`:''}
          ${a.kosten?`<span>💶 ${a.kosten}</span>`:''}
          ${a.notiz?`<span>📝 ${esc(a.notiz)}</span>`:''}
        </div>
      </div>`).join('')
    : `<div style="color:var(--text3);font-size:12px;padding:8px 0">Noch keine archivierten Verträge erfasst.</div>`;

  const body = `
    <!-- Status Header -->
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

    <!-- TABS -->
    <div style="display:flex;gap:2px;margin-bottom:14px;border-bottom:1px solid var(--border)">
      <button onclick="vtTab(this,'vt-aktuell')" class="nav-link active" style="font-size:12px;padding:6px 12px">📄 Aktueller Vertrag</button>
      <button onclick="vtTab(this,'vt-dokumente')" class="nav-link" style="font-size:12px;padding:6px 12px">📎 Dokumente</button>
      <button onclick="vtTab(this,'vt-archiv')" class="nav-link" style="font-size:12px;padding:6px 12px">🗄 Archiv (${archiv.length})</button>
      <button onclick="vtTab(this,'vt-notizen')" class="nav-link" style="font-size:12px;padding:6px 12px">📝 Notizen</button>
    </div>

    <!-- TAB: Aktueller Vertrag -->
    <div id="vt-aktuell">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div style="background:var(--bg3);border-radius:10px;padding:12px 14px">
          <div style="font-size:10px;color:var(--text3);font-weight:600;letter-spacing:.5px;margin-bottom:8px">VERTRAGSDETAILS</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--text3)">Kosten</span><span style="font-weight:700;color:var(--text)">${fmtEur(v.kosten)} / ${esc(v.periode)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--text3)">Anbieter</span><span style="color:var(--text)">${esc(v.anbieter||'–')}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--text3)">Liegenschaft</span><span style="color:var(--text)">${esc(v.liegenschaft_name||'Alle')}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--text3)">Status</span><span style="font-weight:700;color:${statusColor}">${statusLabel}</span></div>
          </div>
        </div>
        <div style="background:var(--bg3);border-radius:10px;padding:12px 14px">
          <div style="font-size:10px;color:var(--text3);font-weight:600;letter-spacing:.5px;margin-bottom:8px">LAUFZEIT</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--text3)">Beginn</span><span style="color:var(--text)">${v.beginn_datum?fmtDate(v.beginn_datum):'–'}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--text3)">Ende</span><span style="font-weight:${days!==null&&days<=90?'700':'400'};color:${days!==null&&days<=30?'var(--red)':days!==null&&days<=90?'var(--gold)':'var(--text)'}">${v.ende_datum?fmtDate(v.ende_datum):'unbefristet'}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--text3)">Kündigung</span><span style="color:var(--text)">${v.kuendigungsfrist||'–'}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--text3)">Verlängerung</span><span style="color:var(--text)">${v.verlaengerung||'–'}</span></div>
          </div>
        </div>
      </div>
      ${v.notiz?`<div style="background:var(--bg3);border-radius:10px;padding:12px 14px;margin-bottom:14px"><div style="font-size:10px;color:var(--text3);font-weight:600;letter-spacing:.5px;margin-bottom:6px">LEISTUNGSBESCHREIBUNG</div><div style="font-size:12px;color:var(--text);line-height:1.6">${esc(v.notiz)}</div></div>`:''}
      ${v.status!=='ok'?`
      <div style="background:${v.status==='alert'?'var(--red3)':'var(--gold4)'};border:1px solid ${v.status==='alert'?'#FECACA':'var(--gold3)'};border-radius:9px;padding:12px 14px;margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:${v.status==='alert'?'var(--red)':'var(--gold)'};margin-bottom:6px">${v.status==='alert'?'🔴 Handlungsbedarf – Vertrag abgelaufen!':'⚠️ Vertrag läuft bald ab!'}</div>
        <div style="font-size:11px;color:var(--text2)">Optionen: Vertrag verlängern, neu ausschreiben oder kündigen. Alten Vertrag danach ins Archiv verschieben.</div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <button class="btn btn-gold btn-sm" onclick="openVertragVerlaengernModal(${id})">🔄 Verlängern</button>
          <button class="btn btn-ghost btn-sm" onclick="toast('Ausschreibung starten...')">📢 Neu ausschreiben</button>
          <button class="btn btn-ghost btn-sm" onclick="vertragInArchiv(${id})">🗄 In Archiv</button>
        </div>
      </div>`:''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="openVertragBearbeitenModal(${id})">✏️ Bearbeiten</button>
        <button class="btn btn-ghost btn-sm" onclick="vertragInArchiv(${id})">🗄 Als abgelaufen archivieren</button>
      </div>
    </div>

    <!-- TAB: Dokumente -->
    <div id="vt-dokumente" style="display:none">
      <div style="background:var(--bg3);border:1px dashed var(--border2);border-radius:10px;padding:20px;text-align:center;margin-bottom:12px">
        <div style="font-size:24px;margin-bottom:6px">📎</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:10px">Vertragsdokumente, Anlagen, Kündigungsschreiben hochladen</div>
        <button class="btn btn-gold btn-sm" onclick="toast('Dokument hochladen...')">+ Dokument hochladen</button>
      </div>
      ${v.dokument_url?`<div style="padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:9px;display:flex;align-items:center;gap:10px">
        <div style="font-size:20px">📄</div>
        <div style="flex:1;font-size:12px;color:var(--text)">Vertragsdokument</div>
        <button class="btn btn-ghost btn-sm" onclick="window.open('${v.dokument_url}')">⬇ Öffnen</button>
      </div>`:`<div style="color:var(--text3);font-size:12px;padding:4px 0">Noch keine Dokumente hinterlegt.</div>`}
    </div>

    <!-- TAB: Archiv -->
    <div id="vt-archiv" style="display:none">
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:9px;padding:10px 12px;margin-bottom:12px;font-size:11px;color:var(--text3)">
        🗄 Hier werden frühere Vertragsversionen mit diesem Anbieter dokumentiert. Damit bleibt die Historie lückenlos nachvollziehbar.
      </div>
      <div id="vtArchivList_${id}">${archivHtml}</div>
      <!-- Neuen Archiveintrag hinzufügen -->
      <div style="background:var(--bg3);border:1px dashed var(--border2);border-radius:10px;padding:12px 14px;margin-top:10px">
        <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">+ Vergangenen Vertrag erfassen</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Gültig von</div>
            <input id="vaVon_${id}" type="date" class="form-input" style="margin:0;font-size:12px"></div>
          <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Gültig bis</div>
            <input id="vaBis_${id}" type="date" class="form-input" style="margin:0;font-size:12px"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Kosten (damals)</div>
            <input id="vaKosten_${id}" class="form-input" style="margin:0;font-size:12px" placeholder="z.B. 250 € / monatlich"></div>
          <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Beschreibung</div>
            <input id="vaBeschr_${id}" class="form-input" style="margin:0;font-size:12px" placeholder="z.B. Altertrag 2022–2024"></div>
        </div>
        <div style="margin-bottom:8px"><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Notiz / Kündigungsgrund</div>
          <input id="vaNotiz_${id}" class="form-input" style="margin:0;font-size:12px" placeholder="z.B. Preiserhöhung, daher Neuvergabe"></div>
        <button class="btn btn-gold btn-sm" onclick="vertragArchivAdd(${id})">+ Archiveintrag speichern</button>
      </div>
    </div>

    <!-- TAB: Notizen -->
    <div id="vt-notizen" style="display:none">
      <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">INTERNE NOTIZEN ZUM VERTRAG</div>
      <textarea id="vtNotiz_${id}" class="form-input" rows="6" style="margin:0;font-size:12px;resize:vertical" 
        placeholder="Interne Notizen, Gesprächsprotokolle mit Anbieter, Eskalationen..." 
        onchange="saveVertragNotiz('${id}',this.value)">${esc(row.notiz||'')+''}</textarea>
      <div style="margin-top:8px;font-size:10px;color:var(--text3)">Notizen werden lokal gespeichert.</div>
    </div>
  `;

  document.getElementById('modalTitle').textContent = v.icon+' '+v.name;
  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('modalOverlay').classList.add('open');
}

function vtTab(btn, panelId) {
  document.querySelectorAll('#modalBody .nav-link').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  ['vt-aktuell','vt-dokumente','vt-archiv','vt-notizen'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.style.display = id===panelId?'block':'none';
  });
}

async function vertragArchivAdd(id) {
  const von=document.getElementById('vaVon_'+id)?.value||null;
  const bis=document.getElementById('vaBis_'+id)?.value||null;
  const kosten=document.getElementById('vaKosten_'+id)?.value?.trim()||null;
  const beschr=document.getElementById('vaBeschr_'+id)?.value?.trim()||null;
  const notiz=document.getElementById('vaNotiz_'+id)?.value?.trim()||null;
  if(!von&&!kosten&&!beschr){toast('Bitte mindestens ein Feld ausfüllen');return;}
  const {error}=await db.from('vertrag_archiv').insert({vertrag_id:id,von,bis,kosten_text:kosten,beschreibung:beschr,notiz});
  if(error){toast('❌ Fehler: '+error.message);return;}
  toast('✓ Archiveintrag in DB gespeichert');
  openVertragModal(id);
}

async function vertragArchivDel(archivId, vertragId) {
  const {error}=await db.from('vertrag_archiv').delete().eq('id',archivId);
  if(error){toast('❌ Fehler: '+error.message);return;}
  toast('Archiveintrag entfernt');
  openVertragModal(vertragId);
}

async function vertragInArchiv(id) {
  const v=(window._allVertraege||[]).find(x=>x.id===id);
  if(!v)return;
  const {error}=await db.from('vertrag_archiv').insert({
    vertrag_id:id, von:v.beginn_datum||null,
    bis:v.ende_datum||new Date().toISOString().split('T')[0],
    kosten_text:fmtEur(v.kosten)+' / '+(v.periode||''),
    beschreibung:'Abgelaufener Vertrag',
    notiz:'Archiviert am '+new Date().toLocaleDateString('de-DE')
  });
  if(error){toast('❌ Fehler: '+error.message);return;}
  toast('✓ In DB archiviert');
  openVertragModal(id);
}


// ════════════════════════════════════════════════════════
// NEUE LIEGENSCHAFT MODAL
// ════════════════════════════════════════════════════════
function openNeueLiegenschaftModal() {
  document.getElementById('modalTitle').textContent = '🏢 Neue Liegenschaft';
  document.getElementById('modalBody').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">

      <!-- ── Adress-Autocomplete ── -->
      <div style="background:var(--bg3);border:1px solid var(--gold);border-radius:10px;padding:12px">
        <div style="font-size:10px;color:var(--gold);font-weight:700;letter-spacing:.05em;margin-bottom:6px">🔍 ADRESSE SUCHEN – FELDER WERDEN AUTOMATISCH BEFÜLLT</div>
        <div style="position:relative">
          <input id="nlAdresseQuery" class="form-input" style="margin:0;width:100%;box-sizing:border-box"
            placeholder="z.B. Hauptstraße 12, München …"
            autocomplete="off"
            oninput="nlOnInput()"
            onkeydown="nlKeyDown(event)"
            onblur="setTimeout(nlHideSuggestions,180)">
          <div id="nlSuggestions" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg2);border:1px solid var(--border);border-radius:0 0 10px 10px;box-shadow:0 8px 24px rgba(0,0,0,.35);z-index:9999;overflow:hidden;margin-top:2px"></div>
        </div>
        <div id="nlLookupStatus" style="font-size:11px;margin-top:6px;min-height:16px;color:var(--text3)">
          Tippen Sie eine Adresse – Vorschläge erscheinen automatisch.
        </div>
      </div>

      <!-- ── Formularfelder ── -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="grid-column:1/-1"><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Name / Bezeichnung *</div>
          <input id="nlName" class="form-input" style="margin:0" placeholder="z.B. Wohnanlage Hauptstraße"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Straße + Nr. *</div>
          <input id="nlStrasse" class="form-input" style="margin:0" placeholder="Hauptstraße 12"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">PLZ *</div>
          <input id="nlPlz" class="form-input" style="margin:0" placeholder="80331"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Ort *</div>
          <input id="nlOrt" class="form-input" style="margin:0" placeholder="München"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Land</div>
          <input id="nlLand" class="form-input" style="margin:0" placeholder="Deutschland"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Bundesland</div>
          <input id="nlBundesland" class="form-input" style="margin:0" placeholder="Bayern"></div>
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

// ── Adress-Autocomplete via OpenStreetMap Nominatim ───────────────────────
let _nlDebounce = null;
let _nlResults  = [];
let _nlSelected = -1;

function nlOnInput() {
  const q = document.getElementById('nlAdresseQuery')?.value?.trim();
  clearTimeout(_nlDebounce);
  nlHideSuggestions();
  const status = document.getElementById('nlLookupStatus');
  if (!q || q.length < 4) {
    status.textContent = 'Tippen Sie eine Adresse – Vorschläge erscheinen automatisch.';
    status.style.color = 'var(--text3)';
    return;
  }
  status.textContent = '🔍 Suche…';
  status.style.color = 'var(--text3)';
  _nlDebounce = setTimeout(() => _nlFetch(q), 350);
}

async function _nlFetch(q) {
  const status = document.getElementById('nlLookupStatus');
  try {
    const url = 'https://nominatim.openstreetmap.org/search?'
      + new URLSearchParams({ q, format: 'json', addressdetails: '1', limit: '6', 'accept-language': 'de' });
    const resp = await fetch(url, { headers: { 'User-Agent': 'PropManager/1.0' } });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    _nlResults = (await resp.json()).filter(r => r.address?.road); // nur echte Straßenadressen
    if (_nlResults.length) {
      nlShowSuggestions(_nlResults);
      status.textContent = _nlResults.length + ' Vorschläge – Pfeil ↓ oder klicken zum Auswählen.';
      status.style.color = 'var(--text3)';
    } else {
      status.textContent = '❌ Keine Ergebnisse – Adresse verfeinern oder Felder manuell ausfüllen.';
      status.style.color = '#EF4444';
    }
  } catch(e) {
    status.textContent = '⚠️ Verbindungsfehler (' + e.message + ')';
    status.style.color = '#F59E0B';
  }
}

function nlShowSuggestions(results) {
  const box = document.getElementById('nlSuggestions');
  if (!box) return;
  _nlSelected = -1;
  box.innerHTML = results.map((r, i) => {
    const a    = r.address || {};
    const main = [a.road, a.house_number].filter(Boolean).join(' ') || r.display_name.split(',')[0];
    const sub  = [a.postcode, a.city || a.town || a.village, a.state, a.country].filter(Boolean).join(', ');
    return `<div class="nl-sug" data-i="${i}"
      onmousedown="event.preventDefault();nlSelectSuggestion(${i})"
      onmouseenter="nlHighlight(${i})"
      style="padding:9px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .1s">
      <div style="font-size:13px;font-weight:600;color:var(--text1)">${esc(main)}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:1px">${esc(sub)}</div>
    </div>`;
  }).join('');
  box.style.display = 'block';
}

function nlHighlight(idx) {
  _nlSelected = idx;
  document.querySelectorAll('.nl-sug').forEach((el, i) => {
    el.style.background = i === idx ? 'var(--bg3)' : '';
  });
}

function nlHideSuggestions() {
  const box = document.getElementById('nlSuggestions');
  if (box) box.style.display = 'none';
  _nlSelected = -1;
}

function nlKeyDown(e) {
  if (!_nlResults.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    nlHighlight(Math.min(_nlSelected + 1, _nlResults.length - 1));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    nlHighlight(Math.max(_nlSelected - 1, 0));
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (_nlSelected >= 0) nlSelectSuggestion(_nlSelected);
    else if (_nlResults.length) nlSelectSuggestion(0);
  } else if (e.key === 'Escape') {
    nlHideSuggestions();
  }
}

async function nlSelectSuggestion(idx) {
  const r = _nlResults[idx];
  if (!r) return;
  const a       = r.address || {};
  const strasse = [a.road, a.house_number].filter(Boolean).join(' ');
  const ort     = a.city || a.town || a.village || a.municipality || '';
  const plz     = a.postcode || '';
  const bl      = a.state || '';
  const land    = a.country || '';
  // Suchfeld auf gewählte Adresse setzen
  document.getElementById('nlAdresseQuery').value = [strasse, plz, ort].filter(Boolean).join(', ');
  nlHideSuggestions();
  // Formularfelder befüllen
  if (strasse) document.getElementById('nlStrasse').value   = strasse;
  if (plz)     document.getElementById('nlPlz').value       = plz;
  if (ort)     document.getElementById('nlOrt').value       = ort;
  if (bl)      document.getElementById('nlBundesland').value= bl;
  if (land)    document.getElementById('nlLand').value      = land;
  const nameEl = document.getElementById('nlName');
  if (!nameEl.value && strasse) nameEl.value = strasse;
  const status = document.getElementById('nlLookupStatus');
  status.style.color = '#22C55E';
  status.textContent = '✓ Adresse übernommen – Felder wurden befüllt.';
  // Gebäudedaten via Overpass nachladen (Baujahr, Stockwerke etc.)
  await _lookupGebaeude(parseFloat(r.lat), parseFloat(r.lon), status);
}

async function _lookupGebaeude(lat, lon, statusEl) {
  try {
    const q = `[out:json][timeout:8];way[building](around:25,${lat},${lon});out tags;`;
    const resp = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(q)
    });
    if (!resp.ok) return;
    const data = await resp.json();
    if (!data.elements?.length) return;
    const tags   = data.elements[0].tags || {};
    const extras = [];
    const baujahr = tags['start_date'] || tags['year_of_construction'] || tags['construction:date'];
    if (baujahr && /^\d{4}$/.test(String(baujahr))) {
      document.getElementById('nlBaujahr').value = baujahr;
      extras.push('Baujahr ' + baujahr);
    }
    const levels = tags['building:levels'];
    if (levels) extras.push(levels + ' Stockwerke');
    const btype = tags['building'];
    if (btype && btype !== 'yes') extras.push('Typ: ' + btype);
    if (extras.length) statusEl.textContent += ' · 🏢 ' + extras.join(', ');
  } catch(_) { /* nicht-kritisch */ }
}

async function saveNeueLiegenschaft() {
  const name      = document.getElementById('nlName')?.value?.trim();
  const strasse   = document.getElementById('nlStrasse')?.value?.trim();
  const plz       = document.getElementById('nlPlz')?.value?.trim();
  const ort       = document.getElementById('nlOrt')?.value?.trim();
  const land      = document.getElementById('nlLand')?.value?.trim();
  const bundesland= document.getElementById('nlBundesland')?.value?.trim();
  const typ       = document.getElementById('nlTyp')?.value;
  const baujahr   = parseInt(document.getElementById('nlBaujahr')?.value)||null;
  const flaeche   = parseFloat(document.getElementById('nlFlaeche')?.value)||null;
  const grundbuch = document.getElementById('nlGrundbuch')?.value?.trim();
  const notiz     = document.getElementById('nlNotiz')?.value?.trim();
  if (!name || !strasse || !plz || !ort) { toast('⚠️ Name, Straße, PLZ und Ort sind Pflicht'); return; }
  const { data, error } = await db.from('liegenschaften').insert({
    name, strasse, plz, ort,
    land: land||'Österreich',
    bundesland: bundesland||null,
    verwaltungstyp: typ||'WEG',
    baujahr, gesamtflaeche: flaeche,
    grundbuch_nr: grundbuch||null,
    notiz: notiz||null
  }).select().single();
  if (error) { toast('❌ '+error.message); return; }
  closeModal();
  toast('✓ Liegenschaft "'+name+'" angelegt!');
  APP.allLiegs = await getLiegenschaften();
  switchView('liegenschaften');
}

// ════════════════════════════════════════════════════════
// NEUE WOHNEINHEIT MODAL
// ════════════════════════════════════════════════════════
function openNeueWohneinheitModal(liegenschaftId) {
  const prop = window._currentPropDetail;
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
            <option value="wohnung">Wohnung</option>
            <option value="gewerbe">Gewerbe</option>
            <option value="garage">Garage/Stellplatz</option>
            <option value="keller">Keller/Lager</option>
          </select></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Fläche m²</div>
          <input id="nwFlaeche" type="number" class="form-input" style="margin:0" placeholder="65"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Zimmer</div>
          <input id="nwZimmer" type="number" class="form-input" style="margin:0" placeholder="3"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Status</div>
          <select id="nwStatus" class="form-input" style="margin:0">
            <option value="vacant">Leer</option>
            <option value="occupied">Vermietet</option>
            <option value="owner">Eigennutz</option>
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

async function saveNeueWohneinheit(liegenschaftId) {
  const nummer  = document.getElementById('nwNummer')?.value?.trim();
  const etage   = parseInt(document.getElementById('nwEtage')?.value)||0;
  const typ     = document.getElementById('nwTyp')?.value||'wohnung';
  const flaeche = parseFloat(document.getElementById('nwFlaeche')?.value)||null;
  // zimmer: Spalte existiert nicht in DB Schema
  const status  = document.getElementById('nwStatus')?.value||'vacant';
  const netto   = parseFloat(document.getElementById('nwNetto')?.value)||0;
  const nk      = parseFloat(document.getElementById('nwNK')?.value)||0;
  const notiz   = document.getElementById('nwNotiz')?.value?.trim();
  if (!nummer) { toast('⚠️ Nummer ist Pflicht'); return; }
  const { error } = await db.from('wohneinheiten').insert({
    liegenschaft_id: liegenschaftId,
    nummer, etage, typ, flaeche_qm: flaeche,
    status, nettomiete: netto, nebenkosten: nk,
    notiz: notiz||null
  });
  if (error) { toast('❌ '+error.message); return; }
  closeModal();
  toast('✓ Wohneinheit "'+nummer+'" angelegt!');
  window._currentPropDetail = await getLiegenschaftDetail(liegenschaftId);
  switchView('property-detail');
}

async function saveVertragNotiz(id, notiz) {
  await db.from('vertraege').update({notiz}).eq('id',id);
}

function openNeuerVertragModal() {
  const liegs = window._allVertraege ? [...new Map((window._allVertraege||[]).map(v=>[v.liegenschaft_id,{id:v.liegenschaft_id,name:v.liegenschaft_name}])).values()].filter(x=>x.id) : [];
  document.getElementById('modalTitle').textContent = '📋 Neuer Vertrag';
  document.getElementById('modalBody').innerHTML = `
    <div style="background:var(--bg3);border-radius:9px;padding:10px 12px;margin-bottom:14px;font-size:11px;color:var(--text3)">
      Verträge mit Dienstleistern, Versorgern, Versicherungen etc. hier erfassen.
    </div>
    <div class="form-group"><label class="form-label">Vertragsname *</label>
      <input id="nvName" class="form-input" placeholder="z.B. Aufzugswartung, Gebäudeversicherung..."></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="form-group"><label class="form-label">Anbieter / Firma</label>
        <input id="nvAnbieter" class="form-input" placeholder="Firmenname"></div>
      <div class="form-group"><label class="form-label">Liegenschaft</label>
        <select id="nvLieg" class="form-input">
          <option value="">Alle / übergreifend</option>
          ${liegs.map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join('')}
        </select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="form-group"><label class="form-label">Kosten</label>
        <input id="nvKosten" type="number" class="form-input" placeholder="0.00"></div>
      <div class="form-group"><label class="form-label">Periode</label>
        <select id="nvPeriode" class="form-input">
          <option value="monatlich">monatlich</option>
          <option value="jährlich">jährlich</option>
          <option value="einmalig">einmalig</option>
          <option value="quartalsweise">quartalsweise</option>
        </select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="form-group"><label class="form-label">Vertragsbeginn</label>
        <input id="nvStart" type="date" class="form-input"></div>
      <div class="form-group"><label class="form-label">Vertragsende</label>
        <input id="nvEnde" type="date" class="form-input"></div>
    </div>
    <div class="form-group"><label class="form-label">Beschreibung / Leistungen</label>
      <textarea id="nvBeschr" class="form-input" rows="3" placeholder="Kurze Beschreibung der Leistung..."></textarea></div>
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn btn-gold" onclick="saveNeuerVertrag()">💾 Vertrag speichern</button>
      <button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

async function saveNeuerVertrag() {
  const name   = document.getElementById('nvName')?.value?.trim();
  const lieid  = document.getElementById('nvLieg')?.value;
  const kosten = document.getElementById('nvKosten')?.value;
  const periode= document.getElementById('nvPeriode')?.value;
  const start  = document.getElementById('nvStart')?.value;
  const ende   = document.getElementById('nvEnde')?.value;
  const beschr = document.getElementById('nvBeschr')?.value?.trim();
  const anb    = document.getElementById('nvAnbieter')?.value?.trim();
  if (!name) { toast('⚠️ Bitte Name eingeben'); return; }
  const now = new Date();
  const status = ende && new Date(ende) < now ? 'alert' : ende && new Date(ende) < new Date(now.getTime()+90*86400000) ? 'warn' : 'ok';
  const { data, error } = await db.from('vertraege').insert({
    name, anbieter: anb||null, liegenschaft_id: lieid?parseInt(lieid):null,
    kosten: parseFloat(kosten)||0, periode: periode||'monatlich',
    beginn_datum: start||null, ende_datum: ende||null,
    notiz: beschr||null, status,
  }).select().single();
  if (error) { toast('Fehler: '+error.message); return; }
  closeModal();
  toast('✓ Vertrag gespeichert');
  switchView('vertraege');
}

function tmplTermine(rows) {
  const today = new Date(); today.setHours(0,0,0,0);
  const evList = rows.filter(e => e.termin_typ === 'eigentümerversammlung');
  const andereList = rows.filter(e => e.termin_typ !== 'eigentümerversammlung');

  // Phase berechnen (0=Vorbereitung, 1=Bereit, 2=Versammlung heute, 3=Nachbereitung, 4=Abgeschlossen)
  function evPhase(ev) {
    const d = new Date(ev.termin_datum); d.setHours(0,0,0,0);
    const diffDays = Math.round((d - today) / 86400000);
    const hasProt = ev.beschluesse?.length > 0;
    if (diffDays > 14)  return { phase:0, label:'Vorbereitung', color:'var(--text3)', icon:'📋' };
    if (diffDays > 0)   return { phase:1, label:'Einladung läuft', color:'var(--gold)', icon:'📨' };
    if (diffDays === 0) return { phase:2, label:'Heute!', color:'var(--red)', icon:'🔴' };
    if (!hasProt)       return { phase:3, label:'Protokoll ausstehend', color:'var(--red2)', icon:'⚠️' };
    // Anfechtungsfrist: 1 Monat nach Protokollzugang (~heute+30)
    const anfFrist = new Date(d); anfFrist.setMonth(anfFrist.getMonth()+1);
    if (today <= anfFrist) return { phase:3, label:'Anfechtungsfrist läuft', color:'var(--gold)', icon:'⏳' };
    return { phase:4, label:'Abgeschlossen', color:'var(--green)', icon:'✅' };
  }

  // Checklisten-Fortschritt aus DB-Cache (_evCache)
  function evCheckProgress(id) {
    try {
      const saved = window._evCache?.[id]?.checksMap||{};
      const total = 16; // gesamt Checkboxen
      const done = Object.values(saved).filter(Boolean).length;
      return { done, total, pct: Math.round((done/total)*100) };
    } catch(e) { return {done:0,total:16,pct:0}; }
  }

  function evCard(ev) {
    const ph = evPhase(ev);
    const chk = evCheckProgress(ev.id);
    const d = new Date(ev.termin_datum); d.setHours(0,0,0,0);
    const diffDays = Math.round((d - today) / 86400000);
    const anfFrist = ph.phase >= 3 ? (() => { const f=new Date(d); f.setMonth(f.getMonth()+1); return f; })() : null;
    const anfTage = anfFrist ? Math.max(0, Math.round((anfFrist - today) / 86400000)) : null;

    // Phase-Stepper
    const steps = [
      {i:'📋',l:'Vorbereitung'}, {i:'📨',l:'Einladung'}, {i:'🏛',l:'Versammlung'}, {i:'📄',l:'Protokoll'}, {i:'✅',l:'Archiviert'}
    ];
    const stepHtml = steps.map((s,idx)=>{
      const active = idx === ph.phase;
      const done   = idx < ph.phase;
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1">
        <div style="width:30px;height:30px;border-radius:50%;border:2px solid ${done?'var(--green2)':active?ph.color:'var(--border2)'};background:${done?'var(--green3)':active?ph.color+'20':'transparent'};display:flex;align-items:center;justify-content:center;font-size:12px;transition:all .2s">${done?'✓':s.i}</div>
        <div style="font-size:9px;color:${active?ph.color:done?'var(--green)':'var(--text3)'};text-align:center;font-weight:${active?'700':'400'}">${s.l}</div>
      </div>`;
    }).join('<div style="flex:1;height:2px;background:var(--border);margin-top:14px"></div>');

    return `<div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:18px 20px;cursor:pointer;transition:all .2s var(--ease);box-shadow:var(--sh1);border-left:4px solid ${ph.color}" 
        onmouseover="this.style.boxShadow='var(--sh3)';this.style.transform='translateY(-2px)'" 
        onmouseout="this.style.boxShadow='var(--sh1)';this.style.transform=''" 
        onclick='openEvPlanModal(${JSON.stringify(ev).replace(/'/g,"&#39;")})'>

      <!-- Header -->
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
          <div style="font-size:11px;font-weight:700;color:${ph.color};display:flex;align-items:center;gap:4px;justify-content:flex-end">${ph.icon} ${ph.label}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">
            ${diffDays > 0 ? 'in '+diffDays+' Tagen' : diffDays === 0 ? '<strong>HEUTE</strong>' : 'vor '+Math.abs(diffDays)+' Tagen'}
          </div>
        </div>
      </div>

      <!-- Phase-Stepper -->
      <div style="display:flex;align-items:flex-start;gap:0;margin-bottom:14px;padding:10px;background:var(--bg);border-radius:10px">${stepHtml}</div>

      <!-- Fortschritt + Infos -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div style="background:var(--bg3);border-radius:8px;padding:8px 10px">
          <div style="font-size:10px;color:var(--text3);font-weight:600;letter-spacing:.5px">CHECKLISTE</div>
          <div style="font-size:13px;font-weight:700;color:var(--text);margin-top:2px">${chk.done}/${chk.total}</div>
          <div style="background:var(--bg4);border-radius:2px;height:3px;margin-top:4px"><div style="height:100%;border-radius:2px;background:${chk.pct>=100?'var(--green2)':chk.pct>60?'var(--gold)':'var(--red2)'};width:${chk.pct}%"></div></div>
        </div>
        <div style="background:var(--bg3);border-radius:8px;padding:8px 10px">
          <div style="font-size:10px;color:var(--text3);font-weight:600;letter-spacing:.5px">BESCHLÜSSE</div>
          <div style="font-size:13px;font-weight:700;color:var(--text);margin-top:2px">${ev.beschluesse?.length||0} ${ev.beschluesse?.length===1?'Beschluss':'Beschlüsse'}</div>
          <div style="font-size:10px;color:var(--green);margin-top:2px">${ev.beschluesse?.filter(b=>b.ergebnis==='angenommen').length||0} ✓ angenommen</div>
        </div>
        <div style="background:var(--bg3);border-radius:8px;padding:8px 10px">
          <div style="font-size:10px;color:var(--text3);font-weight:600;letter-spacing:.5px">ANFECHTUNG</div>
          ${anfFrist
            ? anfTage > 0
              ? `<div style="font-size:12px;font-weight:700;color:var(--gold);margin-top:2px">⏳ ${anfTage}d</div><div style="font-size:10px;color:var(--text3)">Frist läuft</div>`
              : `<div style="font-size:12px;font-weight:700;color:var(--green);margin-top:2px">✅ Frei</div><div style="font-size:10px;color:var(--text3)">Frist abgelaufen</div>`
            : `<div style="font-size:12px;font-weight:700;color:var(--text3);margin-top:2px">–</div><div style="font-size:10px;color:var(--text3)">noch offen</div>`
          }
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

  // KPIs
  const evGesamt = evList.length;
  const evOffen  = evList.filter(e=>evPhase(e).phase<4).length;
  const evAnf    = evList.filter(e=>{ const ph=evPhase(e); const d=new Date(e.termin_datum); const f=new Date(d); f.setMonth(f.getMonth()+1); return ph.phase===3 && today<=f; }).length;
  const evToday  = evList.filter(e=>{ const d=new Date(e.termin_datum); d.setHours(0,0,0,0); return d.getTime()===today.getTime(); }).length;

  // Beschlusssammlung: alle Beschlüsse aus allen EVs
  const allBeschluesse = evList.flatMap(ev=>(ev.beschluesse||[]).map(b=>({...b, ev_titel:ev.titel, ev_datum:ev.termin_datum, liegenschaft:ev.liegenschaft_name})));
  const beschlAngenommen = allBeschluesse.filter(b=>b.ergebnis==='angenommen').length;

  const beschlSammlungHtml = allBeschluesse.length ? allBeschluesse.map((b,i)=>{
    const ang = b.ergebnis==='angenommen';
    return `<div style="padding:10px 14px;border-radius:10px;background:var(--bg);border:1px solid ${ang?'#A7F3D0':'#FECACA'};border-left:4px solid ${ang?'var(--green2)':'var(--red2)'};margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px">
        <span style="font-size:10px;font-weight:700;font-family:'JetBrains Mono';color:var(--text3)">TOP ${b.top_nr||i+1}</span>
        <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;background:${ang?'var(--green3)':'var(--red3)'};color:${ang?'var(--green)':'var(--red)'}">${ang?'✓ ANGENOMMEN':'✕ ABGELEHNT'}</span>
        <span style="font-size:10px;color:var(--text3)">📍 ${esc(b.liegenschaft||'')} · ${esc(b.ev_titel||'')} · ${fmtDate(b.ev_datum)}</span>
      </div>
      <div style="font-size:12px;color:var(--text);font-weight:500">${esc(b.text)}</div>
      ${b.abstimmung?`<div style="font-size:11px;color:var(--text3);margin-top:3px">🗳 ${esc(b.abstimmung)}</div>`:''}
    </div>`;
  }).join('') : `<div style="color:var(--text3);font-size:12px;padding:12px 0;text-align:center">Noch keine Beschlüsse erfasst. Beschlüsse werden im EV-Modal unter „Beschlüsse & Abstimmung" eingetragen.</div>`;

  // Tabs für Termine-View
  const termineTabState = window._termineTab || 'ev';
  window._termineTab = termineTabState;

  return `
  <!-- View Tabs -->
  <div style="display:flex;gap:2px;margin-bottom:18px;border-bottom:1px solid var(--border)">
    <button onclick="window._termineTab='ev';switchView('termine')" class="nav-link${termineTabState==='ev'?' active':''}" style="font-size:13px;padding:8px 14px">🏛 Eigentümerversammlungen</button>
    <button onclick="window._termineTab='beschlusssammlung';switchView('termine')" class="nav-link${termineTabState==='beschlusssammlung'?' active':''}" style="font-size:13px;padding:8px 14px">📚 Beschlusssammlung</button>
    <button onclick="window._termineTab='andere';switchView('termine')" class="nav-link${termineTabState==='andere'?' active':''}" style="font-size:13px;padding:8px 14px">📅 Weitere Termine</button>
  </div>

  ${termineTabState === 'ev' ? `
  <!-- EV KPIs -->
  <div class="kpi-grid" style="margin-bottom:16px">
    <div class="kpi-card"><div class="kpi-label">EV Gesamt</div><div class="kpi-value kv-blue">${evGesamt}</div><div class="kpi-sub">geplant / archiviert</div><div class="kpi-accent-line" style="background:var(--blue2)"></div></div>
    <div class="kpi-card"><div class="kpi-label">Aktive Planungen</div><div class="kpi-value kv-gold">${evOffen}</div><div class="kpi-sub">in Bearbeitung</div><div class="kpi-accent-line" style="background:var(--gold2)"></div></div>
    <div class="kpi-card ${evToday?'':''}" ${evToday?'style="border-left:3px solid var(--red)"':''}><div class="kpi-label">${evToday?'🔴 ':''}Heute</div><div class="kpi-value ${evToday?'kv-red':''}">${evToday||0}</div><div class="kpi-sub">${evToday?'Versammlung läuft!':'keine EV heute'}</div><div class="kpi-accent-line" style="background:${evToday?'var(--red2)':'var(--border2)'}"></div></div>
    <div class="kpi-card ${evAnf?'':''}" ${evAnf?'style="border-left:3px solid var(--gold)"':''}><div class="kpi-label">⏳ Anfechtungsfrist</div><div class="kpi-value kv-gold">${evAnf}</div><div class="kpi-sub">${evAnf?'Fristen laufen!':'keine aktiven Fristen'}</div><div class="kpi-accent-line" style="background:var(--gold2)"></div></div>
  </div>
  <div class="section-header" style="margin-bottom:12px">
    <div class="section-title">🏛 Eigentümerversammlungen</div>
    <button class="btn btn-gold btn-sm" onclick="openNewEVModal()">+ Neue EV planen</button>
  </div>
  ${evList.length
    ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:14px;margin-bottom:24px">${evList.map(evCard).join('')}</div>`
    : `<div class="card" style="margin-bottom:24px">${noDaten('Keine Eigentümerversammlungen geplant.')}</div>`
  }
  ` : termineTabState === 'beschlusssammlung' ? `
  <!-- Beschlusssammlung -->
  <div class="kpi-grid" style="margin-bottom:16px">
    <div class="kpi-card"><div class="kpi-label">Beschlüsse Gesamt</div><div class="kpi-value kv-blue">${allBeschluesse.length}</div><div class="kpi-sub">aus ${evGesamt} Versammlungen</div><div class="kpi-accent-line" style="background:var(--blue2)"></div></div>
    <div class="kpi-card"><div class="kpi-label">Angenommen</div><div class="kpi-value kv-green">${beschlAngenommen}</div><div class="kpi-sub">${allBeschluesse.length?Math.round(beschlAngenommen/allBeschluesse.length*100):0}% Zustimmungsrate</div><div class="kpi-accent-line" style="background:var(--green2)"></div></div>
    <div class="kpi-card"><div class="kpi-label">Abgelehnt</div><div class="kpi-value kv-red">${allBeschluesse.length-beschlAngenommen}</div><div class="kpi-sub">nicht beschlossen</div><div class="kpi-accent-line" style="background:var(--red2)"></div></div>
  </div>
  <div class="section-header" style="margin-bottom:12px">
    <div class="section-title">📚 Beschlusssammlung (gem. § 24 Abs. 7 WEG)</div>
  </div>
  <div style="background:var(--gold4);border:1px solid var(--gold3);border-radius:9px;padding:10px 14px;margin-bottom:14px;font-size:11px;color:var(--gold)">
    ⚠️ Die Beschlusssammlung ist gesetzlich vorgeschrieben (§ 24 Abs. 7 WEG). Jeder Beschluss muss <strong>unverzüglich</strong> eingetragen werden. Die Sammlung muss für alle Eigentümer zugänglich sein.
  </div>
  <div class="card">${beschlSammlungHtml}</div>
  ` : `
  <!-- Andere Termine -->
  <div class="section-header" style="margin-bottom:12px">
    <div class="section-title">📅 Weitere Termine</div>
    ${can('edit_termine')?`<button class="btn btn-ghost btn-sm" onclick="openNeuerTerminModal()">+ Termin</button>`:''}
  </div>
  <div class="card">${andereHtml||noDaten('Keine weiteren Termine.')}</div>
  `}`;
}

// ═══ EV DATEN AUS DB LADEN ═══
async function loadEVData(evId) {
  const {data:t} = await db.from('termine')
    .select('ev_checklisten,ev_tagesordnung,ev_abstimmungen,ev_protokoll,ev_einladung,ev_vollmachten')
    .eq('id', evId).single();
  if(!t) return { checksMap:{}, tops:[], abstMap:{}, protokoll:{}, einladung:{} };
  return {
    checksMap:  t.ev_checklisten  || {},
    tops:       t.ev_tagesordnung || [],
    abstMap:    t.ev_abstimmungen || {},
    protokoll:  t.ev_protokoll    || {},
    einladung:  { ...(t.ev_einladung||{}), vollmachten: t.ev_vollmachten||0 }
  };
}

// ═══ EV PLANUNGS-MODAL ═══
async function openEvPlanModal(ev) {
  const e = typeof ev==='string'?JSON.parse(ev):ev;
  // Alle EV-Daten aus DB laden
  if(!window._evCache) window._evCache={};
  openModalLoading('⏳ Lade EV-Daten...');
  window._evCache[e.id] = await loadEVData(e.id);
  const today = new Date(); today.setHours(0,0,0,0);
  const evDate = new Date(e.termin_datum); evDate.setHours(0,0,0,0);
  const diffDays = Math.round((evDate - today) / 86400000);
  const anfFrist = new Date(evDate); anfFrist.setMonth(anfFrist.getMonth()+1);
  const anfTage = Math.max(0, Math.round((anfFrist - today) / 86400000));
  const einladungFrist = new Date(evDate); einladungFrist.setDate(einladungFrist.getDate()-14);
  const einladungFrist3 = new Date(evDate); einladungFrist3.setDate(einladungFrist3.getDate()-21);

  // Checks aus DB-Cache
  const checks = window._evCache?.[e.id]?.checksMap || {};

  const CHECKLISTS = {
    vor: [
      { id:'v1', label:'Termin & Ort festgelegt',      hint:'Gut erreichbar, nicht öffentlich, nahe am Objekt, keine Urlaubszeiten' },
      { id:'v2', label:'Tagesordnung erstellt',          hint:'Alle TOP einzeln & eindeutig formuliert – kein Sammelthema, kein Beschluss unter Verschiedenes' },
      { id:'v3', label:'Eigentümeranträge eingeholt',   hint:'Rechtzeitig angefordert und in TO aufgenommen' },
      { id:'v4', label:'Einladung versandt (mind. 2 Wo.)', hint:`Spätestens: ${fmtDate(einladungFrist.toISOString())} – besser: ${fmtDate(einladungFrist3.toISOString())}` },
      { id:'v5', label:'Unterlagen beigefügt',           hint:'Jahresabrechnung, Wirtschaftsplan, Angebote, Gutachten' },
      { id:'v6', label:'Vollmachtsmuster versandt',       hint:'Vertretungshinweise und Muster beigefügt' },
      { id:'v7', label:'Eigentümerliste aktuell',         hint:'Mit Miteigentumsanteilen gepflegt' },
      { id:'v8', label:'Protokollgerüst vorbereitet',     hint:'Anwesenheitsliste, Beschlusssammlung bereit' },
    ],
    waehrend: [
      { id:'w1', label:'Einladung + Beschlussfähigkeit geprüft', hint:'Zu Beginn protokolliert' },
      { id:'w2', label:'Versammlungsleitung gewählt',             hint:'Verwalter, Eigentümer oder Neutraler' },
      { id:'w3', label:'Alle TOP der Reihe nach behandelt',       hint:'Keine Beschlüsse unter Verschiedenes gefasst' },
      { id:'w4', label:'Abstimmungen korrekt durchgeführt',        hint:'Kopf-/MEA-/Objektprinzip je nach Regelung, Ergebnisse bekanntgegeben' },
      { id:'w5', label:'Protokoll laufend geführt',                hint:'TOP, Diskussion, Beschlusstext, Ja/Nein/Enthaltung' },
      { id:'w6', label:'Verschiedenes: nur Info & Diskussion',     hint:'Ausdrücklich kein Beschluss unter Verschiedenes' },
    ],
    nach: [
      { id:'n1', label:'Protokoll vollständig erstellt',    hint:'Datum, Ort, Beginn/Ende, Teilnehmer, Beschlussfähigkeit, exakte Beschlusstexte + Abstimmungsergebnisse' },
      { id:'n2', label:'Protokoll unterschrieben',           hint:'Verwalter + Beiratsvorsitzender + Eigentümer' },
      { id:'n3', label:'Beschlusssammlung aktualisiert',     hint:'Beschlüsse unverzüglich eingetragen' },
      { id:'n4', label:'Protokoll an Eigentümer versandt',   hint:'Zeitnah, mit Frist für Rückfragen/Einsprüche' },
      { id:'n5', label:'Beschlüsse umgesetzt / beauftragt', hint:'Dienstleister, Verträge, Maßnahmen angestoßen' },
      { id:'n6', label:'Anfechtungsfrist überwacht',         hint:`Frist läuft bis: ${fmtDate(anfFrist.toISOString())} (${anfTage} Tage verbleibend)` },
    ]
  };

  function chkHtml(list, phase) {
    return list.map(item => {
      const checked = !!checks[item.id];
      return `<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border-radius:8px;background:${checked?'var(--green3)':'var(--bg)'};border:1px solid ${checked?'#A7F3D0':'var(--border)'};margin-bottom:6px;cursor:pointer;transition:all .15s" 
        onclick="evToggleCheck('${e.id}','${item.id}',this)">
        <div style="width:18px;height:18px;border-radius:4px;border:2px solid ${checked?'var(--green2)':'var(--border2)'};background:${checked?'var(--green2)':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;color:white;margin-top:1px">${checked?'✓':''}</div>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:${checked?'500':'600'};color:${checked?'var(--green)':'var(--text)'};${checked?'text-decoration:line-through;opacity:.7':''};line-height:1.3">${esc(item.label)}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">${esc(item.hint)}</div>
        </div>
      </div>`;
    }).join('');
  }

  const totalAll = Object.values(CHECKLISTS).flat().length;
  const doneAll  = Object.values(CHECKLISTS).flat().filter(x=>checks[x.id]).length;
  const pct = Math.round((doneAll/totalAll)*100);

  // Beschlüsse
  const beschluesse = e.beschluesse||[];
  const beschHtml = beschluesse.length ? beschluesse.map((b,i)=>{
    const angenommen = b.ergebnis==='angenommen';
    return `<div style="padding:10px 12px;border-radius:10px;background:var(--bg);border:1px solid ${angenommen?'#A7F3D0':'#FECACA'};border-left:4px solid ${angenommen?'var(--green2)':'var(--red2)'};margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
        <span style="font-size:11px;font-weight:700;font-family:'JetBrains Mono';color:var(--text3)">TOP ${i+1}</span>
        <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:100px;background:${angenommen?'var(--green3)':'var(--red3)'};color:${angenommen?'var(--green)':'var(--red)'}">${angenommen?'✓ ANGENOMMEN':'✕ ABGELEHNT'}</span>
      </div>
      <div style="font-size:13px;color:var(--text);font-weight:500;margin-bottom:4px">${esc(b.text)}</div>
      ${b.abstimmung?`<div style="font-size:11px;color:var(--text3)">🗳 ${esc(b.abstimmung)}</div>`:''}
    </div>`;
  }).join('') : `<div style="color:var(--text3);font-size:12px;padding:10px 0">Noch keine Beschlüsse erfasst.</div>`;

  // Anfechtungsschutz-Score
  const scoreCritical = ['v2','v4','v5','w1','w3','w5','n1','n2','n3'];
  const scoreDone = scoreCritical.filter(id=>checks[id]).length;
  const scoreColor = scoreDone>=8?'var(--green)':scoreDone>=5?'var(--gold)':'var(--red)';

  // Tagesordnung aus DB-Cache
  const toItems = (window._evCache?.[e.id]?.tops||[]).map(t=>({id:t.id,text:t.text,typ:t.typ}));
  const renderTOHtml = (items) => {
    if(!items.length) return `<div style="color:var(--text3);font-size:12px;padding:10px 0;text-align:center">Noch keine TOPs. Vorlagen nutzen oder manuell hinzufügen.</div>`;
    return items.map((t,i)=>{
      const bg = t.typ==='verschiedenes'?'var(--gold4)':t.typ==='info'?'var(--bg)':'var(--blue4)';
      const bc = t.typ==='verschiedenes'?'var(--gold3)':t.typ==='info'?'var(--border)':'#BFDBFE';
      const tl = {beschluss:'📊 Beschlussfassung',info:'ℹ️ Information',verschiedenes:'💬 Verschiedenes'}[t.typ]||t.typ;
      return `<div style="background:${bg};border:1px solid ${bc};border-radius:8px;padding:8px 12px;margin-bottom:6px;display:flex;align-items:flex-start;gap:10px">
        <div style="width:24px;height:24px;border-radius:50%;background:var(--bg3);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--text2);flex-shrink:0">${i+1}</div>
        <div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--text)">${esc(t.text)}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">${tl}${t.typ==='verschiedenes'?' &nbsp;⚠️ KEIN BESCHLUSS MÖGLICH!':''}</div></div>
        <button onclick="removeTOPItem('${e.id}',${i})" style="background:none;border:none;color:var(--text4);cursor:pointer;font-size:13px;padding:2px 4px">✕</button>
      </div>`;
    }).join('');
  };
  const toListHtml = renderTOHtml(toItems);

  const body = `
    <!-- Fortschritt Header -->
    <div style="background:linear-gradient(135deg,#1C1917,#292524);border-radius:12px;padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;gap:14px">
      <div style="flex:1">
        <div style="font-size:11px;color:rgba(255,255,255,.4);letter-spacing:1px;margin-bottom:2px">${esc(ev.liegenschaft_name||'')} · ${fmtDate(e.termin_datum)}</div>
        <div style="font-size:11px;color:rgba(255,255,255,.5)">${diffDays>0?'in '+diffDays+' Tagen':diffDays===0?'<strong style="color:#EF4444">HEUTE</strong>':'vor '+Math.abs(diffDays)+' Tagen'} · ${esc(e.ort||'Kein Ort')}</div>
        <div style="margin-top:8px;background:rgba(255,255,255,.1);border-radius:4px;height:6px"><div style="height:100%;border-radius:4px;background:${pct>=100?'#22C55E':pct>60?'#D97706':'#EF4444'};width:${pct}%;transition:width .5s"></div></div>
        <div style="font-size:10px;color:rgba(255,255,255,.35);margin-top:4px">${doneAll}/${totalAll} Checklisten-Punkte erledigt</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:28px;font-weight:700;font-family:'Playfair Display';color:${scoreColor}">${scoreDone}/${scoreCritical.length}</div>
        <div style="font-size:9px;color:rgba(255,255,255,.35);letter-spacing:1px">RECHTS-<br>SICHERHEIT</div>
      </div>
    </div>

    <!-- TABS für 3 Phasen -->
    <div style="display:flex;flex-wrap:wrap;gap:2px;margin-bottom:14px;border-bottom:1px solid var(--border)">
      ${['tagesordnung','vor','waehrend','nach','beschluesse','protokoll'].map(tab=>{
        const labels={tagesordnung:'📋 Tagesordnung',vor:'🗓 Vorbereitung',waehrend:'🏛 Versammlung',nach:'📄 Nachbereitung',beschluesse:'🗳 Abstimmung',protokoll:'📝 Protokoll'};
        return `<button onclick="document.querySelectorAll('.ev-panel').forEach(x=>x.style.display='none');document.getElementById('evp-${e.id}-${tab}').style.display='block';document.querySelectorAll('.ev-tab').forEach(x=>x.classList.remove('active'));this.classList.add('active')" 
          class="ev-tab nav-link" style="font-size:12px;padding:6px 10px" data-etab="${tab}">${labels[tab]}</button>`;
      }).join('')}
    </div>

    <div id="evp-${e.id}-tagesordnung" class="ev-panel">
      <div style="background:var(--gold4);border:1px solid var(--gold3);border-radius:9px;padding:10px 12px;margin-bottom:12px;font-size:11px;color:var(--gold)">
        ⚠️ Jeden Beschluss-TOP <strong>einzeln und eindeutig</strong> formulieren. Keine Sammelthemen. <strong>Kein Beschluss unter "Verschiedenes" möglich!</strong>
      </div>
      <div id="evTOList_${e.id}">${renderTOList(e.id)}</div>
      <div style="background:var(--bg3);border-radius:10px;padding:12px 14px;margin-top:12px;border:1px dashed var(--border2)">
        <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:8px;letter-spacing:.5px;text-transform:uppercase">+ Neuen TOP hinzufügen</div>
        <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          <select id="evTOTyp_${e.id}" class="form-input" style="width:auto;margin:0;font-size:12px;flex-shrink:0">
            <option value="beschluss">📊 Beschlussfassung</option>
            <option value="info">ℹ️ Information</option>
            <option value="verschiedenes">💬 Verschiedenes (kein Beschluss!)</option>
          </select>
        </div>
        <div style="display:flex;gap:8px">
          <input id="evTOInput_${e.id}" class="form-input" style="margin:0;font-size:12px;flex:1" placeholder="Tagesordnungspunkt-Titel...">
          <button class="btn btn-gold btn-sm" onclick="addTOPItem('${e.id}')">+ Hinzufügen</button>
        </div>
      </div>
      <div style="margin-top:14px">
        <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:4px">📋 Häufige Vorlagen</div>
        <div style="font-size:10px;color:var(--text3);margin-bottom:8px">Klick öffnet Editor mit vorausgefülltem Beschlusstext zum Bearbeiten</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="openVorlageEditor('${e.id}','begruessung')">✏️ Begrüßung/Eröffnung</button>
          <button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="openVorlageEditor('${e.id}','jahresabrechnung')">✏️ Jahresabrechnung</button>
          <button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="openVorlageEditor('${e.id}','wirtschaftsplan')">✏️ Wirtschaftsplan</button>
          <button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="openVorlageEditor('${e.id}','instandhaltung')">✏️ Instandhaltung</button>
          <button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="openVorlageEditor('${e.id}','verwalterbestellung')">✏️ Verwalterbestellung</button>
          <button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="openVorlageEditor('${e.id}','sonderumlage')">✏️ Sonderumlage</button>
          <button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="openVorlageEditor('${e.id}','beiratswahl')">✏️ Beiratswahl</button>
          <button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="openVorlageEditor('${e.id}','verwaltungsbericht')">✏️ Verwaltungsbericht</button>
          <button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="openVorlageEditor('${e.id}','verschiedenes')">✏️ Verschiedenes ⚠️</button>
        </div>
        <!-- Vorlage-Editor (wird bei Klick eingeblendet) -->
        <div id="evVorlageEditor_${e.id}" style="display:none;margin-top:12px;background:var(--bg);border:2px solid var(--blue2);border-radius:12px;padding:14px 16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="font-size:11px;font-weight:700;color:var(--blue);letter-spacing:.5px;text-transform:uppercase">✏️ Vorlage bearbeiten</div>
            <button onclick="document.getElementById('evVorlageEditor_${e.id}').style.display='none'" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;padding:2px 6px">✕</button>
          </div>
          <div style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:8px">
            <div>
              <div style="font-size:10px;color:var(--text3);margin-bottom:3px">TOP-Titel (erscheint in der Tagesordnung)</div>
              <input id="evVorlTitel_${e.id}" class="form-input" style="margin:0;font-size:12px;font-weight:600">
            </div>
            <div>
              <div style="font-size:10px;color:var(--text3);margin-bottom:3px">Typ</div>
              <select id="evVorlTyp_${e.id}" class="form-input" style="margin:0;font-size:12px">
                <option value="beschluss">📊 Beschlussfassung</option>
                <option value="info">ℹ️ Information</option>
                <option value="verschiedenes">💬 Verschiedenes</option>
              </select>
            </div>
          </div>
          <div style="margin-bottom:10px">
            <div style="font-size:10px;color:var(--text3);margin-bottom:3px">Vollständiger Beschluss-/Antragstext <span style="color:var(--text4)">(Platzhalter in [ ] durch echte Werte ersetzen)</span></div>
            <textarea id="evVorlText_${e.id}" class="form-input" style="margin:0;font-size:12px;min-height:180px;resize:vertical;line-height:1.6;font-family:inherit"></textarea>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn btn-primary btn-sm" onclick="addTOPFromVorlage('${e.id}')">✓ In Tagesordnung aufnehmen</button>
            <button class="btn btn-ghost btn-sm" onclick="document.getElementById('evVorlageEditor_${e.id}').style.display='none'">Abbrechen</button>
            <div style="font-size:10px;color:var(--text3);flex:1;text-align:right">Text wird mit TOP gespeichert und kann im Protokoll verwendet werden</div>
          </div>
        </div>
      </div>
    </div>

    <div id="evp-${e.id}-vor" class="ev-panel" style="display:none">
      <div style="background:var(--gold4);border:1px solid var(--gold3);border-radius:9px;padding:10px 12px;margin-bottom:12px;font-size:11px;color:var(--gold)">💡 Einladung mind. 2 Wochen vorher – empfohlen 3–4 Wochen. Spätestens: <strong>${fmtDate(einladungFrist.toISOString())}</strong> · Empfohlen: <strong>${fmtDate(einladungFrist3.toISOString())}</strong></div>
      ${chkHtml(CHECKLISTS.vor, 'vor')}
      
      <!-- Einladungsversand-Tracker -->
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-top:14px">
        <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">📨 Einladungsversand dokumentieren</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div>
            <div style="font-size:10px;color:var(--text3);margin-bottom:3px">Versanddatum</div>
            <input id="evEinlDatum_${e.id}" type="date" class="form-input" style="margin:0;font-size:12px" 
              value="${window._evCache?.[e.id]?.einladung?.datum||''}"
              onchange="evSaveEinladung('${e.id}')">
          </div>
          <div>
            <div style="font-size:10px;color:var(--text3);margin-bottom:3px">Versandart</div>
            <select id="evEinlArt_${e.id}" class="form-input" style="margin:0;font-size:12px" onchange="evSaveEinladung('${e.id}')">
              ${['','E-Mail','Briefpost','Einschreiben','E-Mail + Post','Portal'].map(a=>{
                const sel = window._evCache?.[e.id]?.einladung?.art||'';
                return `<option value="${a}" ${sel===a?'selected':''}>${a||'– Art wählen –'}</option>`;
              }).join('')}
            </select>
          </div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:3px">Anzahl versandte Einladungen + Vollmachten</div>
          <div style="display:flex;gap:8px;align-items:center">
            <input id="evEinlAnzahl_${e.id}" type="number" min="0" class="form-input" style="margin:0;font-size:12px;width:100px" 
              placeholder="z.B. 12"
              value="${window._evCache?.[e.id]?.einladung?.anzahl||''}"
              onchange="evSaveEinladung('${e.id}')">
            <button class="btn btn-gold btn-sm" onclick="evSaveEinladung('${e.id}');toast('✓ Einladungsversand gespeichert')">Speichern</button>
            ${(()=>{const d=window._evCache?.[e.id]?.einladung||{};
              if(!d.datum)return '';
              const versandt=new Date(d.datum); versandt.setHours(0,0,0,0);
              const diffV=Math.round((evDate-versandt)/86400000);
              const ok=diffV>=14; const gut=diffV>=21;
              return `<div style="padding:4px 10px;border-radius:8px;background:${gut?'var(--green3)':ok?'var(--gold4)':'var(--red3)'};border:1px solid ${gut?'#A7F3D0':ok?'var(--gold3)':'#FECACA'};font-size:10px;font-weight:700;color:${gut?'var(--green)':ok?'var(--gold)':'var(--red)'}">
                ${gut?'✓ Frist eingehalten ('+diffV+'d)':ok?'⚠️ Knapp ('+diffV+'d)':'✕ Zu spät ('+diffV+'d)'}
              </div>`;
            })()}
          </div>
        </div>
        ${(()=>{const d=window._evCache?.[e.id]?.einladung||{};
          if(!d.datum||!d.art)return '';
          return `<div style="margin-top:8px;padding:8px 10px;background:var(--green3);border:1px solid #A7F3D0;border-radius:7px;font-size:11px;color:var(--green)">✓ Dokumentiert: ${d.art} am ${new Date(d.datum).toLocaleDateString('de-DE')}${d.anzahl?' · '+d.anzahl+' Einladungen':''}</div>`;
        })()}
      </div>

      <!-- Vollmacht-Tracking -->
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-top:10px">
        <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">📋 Vollmachten erfassen</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <div>
            <div style="font-size:10px;color:var(--text3);margin-bottom:3px">Eingegangene Vollmachten</div>
            <div style="display:flex;align-items:center;gap:6px">
              <button onclick="evVollmacht('${e.id}',-1)" style="width:26px;height:26px;border-radius:50%;border:1px solid var(--border2);background:var(--bg);cursor:pointer;font-size:14px;color:var(--text2)">−</button>
              <div id="evVollmachtCount_${e.id}" style="font-size:20px;font-weight:700;color:var(--blue);min-width:32px;text-align:center">${window._evCache?.[e.id]?.einladung?.vollmachten||0}</div>
              <button onclick="evVollmacht('${e.id}',1)" style="width:26px;height:26px;border-radius:50%;border:1px solid var(--blue2);background:var(--blue4);cursor:pointer;font-size:14px;color:var(--blue)">+</button>
            </div>
          </div>
          <div style="font-size:11px;color:var(--text3);flex:1">Vollmachten müssen vor Versammlungsbeginn geprüft und in die Anwesenheitsliste eingetragen werden. Original archivieren!</div>
        </div>
      </div>
    </div>

    <div id="evp-${e.id}-waehrend" class="ev-panel" style="display:none">
      <div style="background:var(--blue4);border:1px solid #BFDBFE;border-radius:9px;padding:10px 12px;margin-bottom:12px;font-size:11px;color:var(--blue)">⚠️ Kein wirksamer Beschluss unter "Verschiedenes" möglich! Abstimmungsmodus (Kopf-/MEA-/Objektprinzip) vorab klären.</div>
      ${chkHtml(CHECKLISTS.waehrend, 'waehrend')}
    </div>

    <div id="evp-${e.id}-nach" class="ev-panel" style="display:none">
      <div style="background:${anfTage>0&&beschluesse.length?'var(--red3)':'var(--green3)'};border:1px solid ${anfTage>0&&beschluesse.length?'#FECACA':'#A7F3D0'};border-radius:9px;padding:10px 12px;margin-bottom:12px;font-size:11px;color:${anfTage>0&&beschluesse.length?'var(--red)':'var(--green)'}">
        ${anfTage>0&&beschluesse.length?`⏳ Anfechtungsfrist läuft noch ${anfTage} Tage! Frist bis: ${fmtDate(anfFrist.toISOString())}`:'✅ Anfechtungsfrist abgelaufen oder keine Beschlüsse – Versammlung rechtssicher abgeschlossen.'}
      </div>
      ${chkHtml(CHECKLISTS.nach, 'nach')}
    </div>

    <div id="evp-${e.id}-beschluesse" class="ev-panel" style="display:none">
      <div style="background:var(--blue4);border:1px solid #BFDBFE;border-radius:9px;padding:10px 12px;margin-bottom:12px;font-size:11px;color:var(--blue)">
        🗳 Abstimmungen hier direkt erfassen. Abstimmungsprinzip vorab im Gemeinschaftsvertrag/WEG prüfen: <strong>Kopfprinzip</strong> (1 Eigentümer = 1 Stimme), <strong>MEA-Prinzip</strong> (nach Miteigentumsanteilen) oder <strong>Objektprinzip</strong> (1 WE = 1 Stimme).
      </div>
      ${(() => {
        const toItems2 = (window._evCache?.[e.id]?.tops||[]).map(t=>({id:t.id,text:t.text,typ:t.typ}));
        const abstData = window._evCache?.[e.id]?.abstMap||{};
        const beschlTops = toItems2.filter(t=>t.typ==='beschluss');
        if (!beschlTops.length) return `<div style="color:var(--text3);font-size:12px;padding:12px 0;text-align:center">Noch keine Beschluss-TOPs in der Tagesordnung. Erst TOPs anlegen, dann hier abstimmen.</div>`;
        return beschlTops.map((t, idx) => {
          const key = 'top_'+idx;
          const ab = abstData[key] || {ja:0, nein:0, enthaltung:0, prinzip:'kopf', ergebnis:''};
          const total = (ab.ja||0) + (ab.nein||0) + (ab.enthaltung||0);
          const ang = ab.ergebnis==='angenommen';
          const abgel = ab.ergebnis==='abgelehnt';
          return `<div style="background:var(--bg);border:1px solid ${ang?'#A7F3D0':abgel?'#FECACA':'var(--border)'};border-left:4px solid ${ang?'var(--green2)':abgel?'var(--red2)':'var(--border2)'};border-radius:10px;padding:12px 14px;margin-bottom:10px">
            <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px">
              <div style="width:22px;height:22px;border-radius:50%;background:var(--blue4);border:1px solid #BFDBFE;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--blue);flex-shrink:0">${idx+1}</div>
              <div style="flex:1;font-size:12px;font-weight:600;color:var(--text)">${esc(t.text)}</div>
              ${ab.ergebnis?`<span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:100px;background:${ang?'var(--green3)':'var(--red3)'};color:${ang?'var(--green)':'var(--red)'};flex-shrink:0">${ang?'✓ ANGENOMMEN':'✕ ABGELEHNT'}</span>`:''}
            </div>
            <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end">
              <div>
                <div style="font-size:10px;color:var(--text3);font-weight:600;margin-bottom:6px;letter-spacing:.5px">ABSTIMMUNGSPRINZIP</div>
                <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px">
                  ${['kopf','mea','objekt'].map(p=>`<button onclick="evSetPrinzip('${e.id}','${key}','${p}',this)" 
                    style="padding:3px 9px;border-radius:100px;border:1px solid ${ab.prinzip===p?'var(--blue2)':'var(--border2)'};background:${ab.prinzip===p?'var(--blue4)':'transparent'};font-size:10px;font-weight:700;color:${ab.prinzip===p?'var(--blue)':'var(--text3)'};cursor:pointer" 
                    data-p="${p}">${p==='kopf'?'👤 Kopf':p==='mea'?'📐 MEA':'🏠 Objekt'}</button>`).join('')}
                </div>
                <div style="font-size:10px;color:var(--text3);font-weight:600;margin-bottom:6px;letter-spacing:.5px">ABSTIMMUNGSERGEBNIS</div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
                  <div>
                    <div style="font-size:10px;color:var(--green);font-weight:700;margin-bottom:3px">✓ JA</div>
                    <div style="display:flex;align-items:center;gap:4px">
                      <button onclick="evAbst('${e.id}','${key}','ja',-1)" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--border2);background:var(--bg3);cursor:pointer;font-size:12px;color:var(--text2);line-height:1">−</button>
                      <div id="evab_${e.id}_${key}_ja" style="font-size:16px;font-weight:700;color:var(--green);min-width:24px;text-align:center">${ab.ja||0}</div>
                      <button onclick="evAbst('${e.id}','${key}','ja',1)" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--green2);background:var(--green3);cursor:pointer;font-size:12px;color:var(--green);line-height:1">+</button>
                    </div>
                  </div>
                  <div>
                    <div style="font-size:10px;color:var(--red);font-weight:700;margin-bottom:3px">✕ NEIN</div>
                    <div style="display:flex;align-items:center;gap:4px">
                      <button onclick="evAbst('${e.id}','${key}','nein',-1)" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--border2);background:var(--bg3);cursor:pointer;font-size:12px;color:var(--text2);line-height:1">−</button>
                      <div id="evab_${e.id}_${key}_nein" style="font-size:16px;font-weight:700;color:var(--red);min-width:24px;text-align:center">${ab.nein||0}</div>
                      <button onclick="evAbst('${e.id}','${key}','nein',1)" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--red2);background:var(--red3);cursor:pointer;font-size:12px;color:var(--red);line-height:1">+</button>
                    </div>
                  </div>
                  <div>
                    <div style="font-size:10px;color:var(--gold);font-weight:700;margin-bottom:3px">⊘ ENTHAL.</div>
                    <div style="display:flex;align-items:center;gap:4px">
                      <button onclick="evAbst('${e.id}','${key}','enthaltung',-1)" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--border2);background:var(--bg3);cursor:pointer;font-size:12px;color:var(--text2);line-height:1">−</button>
                      <div id="evab_${e.id}_${key}_enthaltung" style="font-size:16px;font-weight:700;color:var(--gold);min-width:24px;text-align:center">${ab.enthaltung||0}</div>
                      <button onclick="evAbst('${e.id}','${key}','enthaltung',1)" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--gold3);background:var(--gold4);cursor:pointer;font-size:12px;color:var(--gold);line-height:1">+</button>
                    </div>
                  </div>
                </div>
              </div>
              <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
                <div style="font-size:10px;color:var(--text3);text-align:right">${total} Stimmen</div>
                <button onclick="evErgebnisFestlegen('${e.id}','${key}','angenommen')" style="padding:6px 12px;border-radius:8px;border:1px solid var(--green2);background:var(--green3);font-size:11px;font-weight:700;color:var(--green);cursor:pointer;width:120px">✓ Angenommen</button>
                <button onclick="evErgebnisFestlegen('${e.id}','${key}','abgelehnt')" style="padding:6px 12px;border-radius:8px;border:1px solid var(--red2);background:var(--red3);font-size:11px;font-weight:700;color:var(--red);cursor:pointer;width:120px">✕ Abgelehnt</button>
              </div>
            </div>
          </div>`;
        }).join('');
      })()}
      <div style="margin-top:12px;padding:10px 12px;background:var(--bg3);border-radius:8px;border:1px dashed var(--border2)">
        <div style="font-size:11px;color:var(--text3)">💡 Beschlüsse werden automatisch in der <strong>Beschlusssammlung</strong> gespeichert (§ 24 Abs. 7 WEG). Für das Protokoll → Tab „Protokoll".</div>
      </div>
    </div>

    <div id="evp-${e.id}-protokoll" class="ev-panel" style="display:none">
      ${renderProtokollPanel(e)}
    </div>
  `;

  // Tab-Aktivierung: ersten Tab aktiv setzen
  document.getElementById('modalTitle').textContent = '🏛 ' + e.titel;
  document.getElementById('modalBody').innerHTML = body;
  // Ersten Tab aktivieren
  document.querySelector('.ev-tab')?.classList.add('active');
  // Breiteres Modal für EV (alle 6 Tabs + Editor brauchen Platz)
  document.getElementById('mainModal')?.classList.add('modal-ev');
  document.getElementById('modalOverlay').classList.add('open');
}

// Check togglen
async function evToggleCheck(evId, checkId, el) {
  // Optimistisch UI updaten
  const checked = !el.classList.contains('checked');
  el.classList.toggle('checked', checked);
  el.style.background = checked ? 'var(--green3)' : 'var(--bg)';
  el.style.borderColor = checked ? '#A7F3D0' : 'var(--border)';
  const box = el.querySelector('div');
  if(box){box.style.borderColor=checked?'var(--green2)':'var(--border2)';box.style.background=checked?'var(--green2)':'transparent';box.textContent=checked?'✓':'';}
  const lbl = el.querySelectorAll('div')[1]?.querySelector('div');
  if(lbl){lbl.style.textDecoration=checked?'line-through':'none';lbl.style.opacity=checked?'.7':'1';lbl.style.color=checked?'var(--green)':'var(--text)';}
  // In DB speichern via JSONB merge
  const {data:ev}=await db.from('termine').select('ev_checklisten').eq('id',evId).single();
  const checks=ev?.ev_checklisten||{};
  checks[checkId]=checked;
  await db.from('termine').update({ev_checklisten:checks}).eq('id',evId);
  toast(checked ? '✓ Erledigt' : 'Offen gesetzt');
}

// ═══ TAGESORDNUNG ═══
function renderTOList(evId) {
  const ev = (window._lastTermine||[]).find(t=>t.id==evId)||{};
  const toItems = ev.ev_tagesordnung||[];
  const typIcons = {beschluss:'📊',info:'ℹ️',verschiedenes:'💬'};
  const typLabels = {beschluss:'Beschlussfassung',info:'Information',verschiedenes:'Verschiedenes'};
  if (!toItems.length) return `<div style="color:var(--text3);font-size:12px;padding:10px 0;text-align:center">Noch keine TOPs erfasst. Vorlagen verwenden oder manuell hinzufügen ⬇</div>`;
  return toItems.map((t,i)=>{
    const bg = t.typ==='verschiedenes'?'var(--gold4)':t.typ==='info'?'var(--bg)':'var(--blue4)';
    const bc = t.typ==='verschiedenes'?'var(--gold3)':t.typ==='info'?'var(--border)':'#BFDBFE';
    const hasText = !!(t.beschluss_text && t.beschluss_text.trim());
    const collapseId = `evBT_${evId}_${i}`;
    return `<div style="background:${bg};border:1px solid ${bc};border-radius:8px;padding:8px 12px;margin-bottom:6px">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <div style="width:22px;height:22px;border-radius:50%;background:var(--bg3);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--text2);flex-shrink:0;margin-top:1px">${i+1}</div>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600;color:var(--text)">${esc(t.text)}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px;display:flex;align-items:center;gap:8px">
            ${typIcons[t.typ]||'📋'} ${typLabels[t.typ]||t.typ}${t.typ==='verschiedenes'?' &nbsp;<strong style="color:var(--gold)">⚠️ kein Beschluss möglich!</strong>':''}
            ${hasText?`<button onclick="document.getElementById('${collapseId}').style.display=document.getElementById('${collapseId}').style.display==='none'?'block':'none'" style="background:none;border:none;color:var(--blue);cursor:pointer;font-size:10px;padding:0;font-weight:600">📄 Beschlusstext</button>`:''}
          </div>
        </div>
        <button onclick="removeTOPItem('${evId}','${t.id}')" style="background:none;border:none;color:var(--text4);cursor:pointer;font-size:14px;padding:2px 5px;line-height:1">✕</button>
      </div>
      ${hasText?`<div id="${collapseId}" style="display:none;margin-top:8px;padding:10px 12px;background:rgba(0,0,0,.04);border-radius:6px;border-left:3px solid var(--blue2)">
        <div style="font-size:9px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px">Beschluss-/Antragstext</div>
        <pre style="font-size:11px;color:var(--text2);white-space:pre-wrap;font-family:inherit;margin:0;line-height:1.6">${esc(t.beschluss_text)}</pre>
      </div>`:''}
    </div>`;
  }).join('');
}

async function addTOPItem(evId) {
  const input = document.getElementById('evTOInput_'+evId);
  const typSel = document.getElementById('evTOTyp_'+evId);
  const text = input?.value?.trim();
  if (!text) { toast('Bitte TOP-Text eingeben'); return; }
  const {data:ev}=await db.from('termine').select('ev_tagesordnung').eq('id',evId).single();
  const toItems=[...(ev?.ev_tagesordnung||[])];
  toItems.push({ text, typ: typSel?.value||'beschluss' });
  await db.from('termine').update({ev_tagesordnung:toItems}).eq('id',evId);
  // Update cache
  const t=(window._lastTermine||[]).find(x=>x.id==evId);
  if(t) t.ev_tagesordnung=toItems;
  input.value = '';
  const listEl = document.getElementById('evTOList_'+evId);
  if (listEl) listEl.innerHTML = renderTOList(evId);
  toast('TOP hinzugefügt ✓');
}

async function removeTOPItem(evId, idx) {
  const {data:ev}=await db.from('termine').select('ev_tagesordnung').eq('id',evId).single();
  const toItems=[...(ev?.ev_tagesordnung||[])];
  toItems.splice(idx, 1);
  await db.from('termine').update({ev_tagesordnung:toItems}).eq('id',evId);
  const t=(window._lastTermine||[]).find(x=>x.id==evId);
  if(t) t.ev_tagesordnung=toItems;
  const listEl = document.getElementById('evTOList_'+evId);
  if (listEl) listEl.innerHTML = renderTOList(evId);
  toast('TOP entfernt');
}

// ═══ VORLAGE-TEMPLATES MIT WEG-BESCHLUSSTEXT ═══
const EV_VORLAGEN = {
  begruessung: {
    typ: 'info',
    titel: 'Begrüßung und Eröffnung, Feststellung der Beschlussfähigkeit',
    text: `Der Versammlungsleiter begrüßt die erschienenen Eigentümer der [LIEGENSCHAFT] und eröffnet die Eigentümerversammlung [JAHR].

Feststellung der Beschlussfähigkeit:
• Erschienen / vertreten: [Anzahl] von [Gesamt] Eigentümern
• Vertretene Miteigentumsanteile: [MEA] von [Gesamt-MEA] MEA
• Beschlussfähigkeit gemäß § 25 Abs. 3 WEG: ☐ Ja  ☐ Nein

Versammlungsleitung: [Name]
Protokollführung: [Name]`
  },
  jahresabrechnung: {
    typ: 'beschluss',
    titel: 'Genehmigung der Jahresabrechnung [VORJAHR]',
    text: `Beschluss: Genehmigung der Jahresabrechnung [VORJAHR] für [LIEGENSCHAFT]

Die Jahresabrechnung [VORJAHR] in der vorliegenden Form wird genehmigt.

Gesamtabrechnung: [Betrag €]
Einzelabrechnungen der Wohneinheiten: gem. Anlage

Nachzahlungen / Guthaben werden innerhalb von 4 Wochen
nach Versammlungsdatum fällig (bis [Datum]).

Abstimmung:  __ Ja  /  __ Nein  /  __ Enthaltungen
Ergebnis: ☐ Angenommen  ☐ Abgelehnt`
  },
  wirtschaftsplan: {
    typ: 'beschluss',
    titel: 'Beschlussfassung über den Wirtschaftsplan [JAHR]',
    text: `Beschluss: Wirtschaftsplan [JAHR] für [LIEGENSCHAFT]

Der Wirtschaftsplan [JAHR] in der vorliegenden Form wird beschlossen.

Gesamtwirtschaftsplan: [Betrag €]
Hausgeld je Einheit: ab 01.01.[JAHR] monatlich [Betrag €]
(Einzelaufstellung gem. Anlage)

Die Vorauszahlungen sind jeweils zum 1. des Monats fällig.
Bankverbindung: [IBAN der WEG]

Abstimmung:  __ Ja  /  __ Nein  /  __ Enthaltungen
Ergebnis: ☐ Angenommen  ☐ Abgelehnt`
  },
  instandhaltung: {
    typ: 'beschluss',
    titel: 'Beschlussfassung Instandhaltungsmaßnahme',
    text: `Beschluss: Instandhaltungsmaßnahme [LIEGENSCHAFT]

Es wird die Durchführung folgender Maßnahme beschlossen:

Maßnahme: [genaue Beschreibung der Maßnahme]
Betroffenes Bauteil: [Gebäudeteil / Bereich / Gewerk]
Kostenschätzung: max. [Betrag €] brutto inkl. MwSt.

Beauftragung: Der Verwalter wird ermächtigt,
  [Dienstleister / oder: nach Einholung von mind. 3 Angeboten]
  zu beauftragen.

Finanzierung: ☐ Instandhaltungsrücklage  ☐ Sonderumlage  ☐ Beides
Ausführungszeitraum: [Zeitraum / Quartal / Jahr]

Abstimmung:  __ Ja  /  __ Nein  /  __ Enthaltungen
Ergebnis: ☐ Angenommen  ☐ Abgelehnt`
  },
  verwalterbestellung: {
    typ: 'beschluss',
    titel: 'Verwalterbestellung / -abberufung',
    text: `Beschluss: Verwalterbestellung für [LIEGENSCHAFT]

VARIANTE A – Bestellung:
[Firma / Name] wird als WEG-Verwalter bestellt.
Amtszeit: [Datum] bis [Datum] (max. 5 Jahre gem. § 26 WEG)
Verwalterhonorar: [Betrag €] netto p. Monat je Einheit
Grundlage: Verwaltervertrag in der vorliegenden Fassung

VARIANTE B – Abberufung:
[Firma / Name] wird mit Wirkung zum [Datum] als Verwalter abberufen.
Der bestehende Verwaltervertrag wird fristlos / ordentlich gekündigt.

Abstimmung:  __ Ja  /  __ Nein  /  __ Enthaltungen
Ergebnis: ☐ Angenommen  ☐ Abgelehnt`
  },
  sonderumlage: {
    typ: 'beschluss',
    titel: 'Beschlussfassung Sonderumlage',
    text: `Beschluss: Sonderumlage [LIEGENSCHAFT]

Es wird eine Sonderumlage zur Finanzierung von
[genaue Bezeichnung der Maßnahme / des Zwecks]
beschlossen.

Gesamtbetrag der Sonderumlage: [Betrag €]
Verteilungsschlüssel: Miteigentumsanteile (MEA)
Anteil je 1/1000 MEA: [Betrag €]

Fälligkeit: [Datum]
Bankverbindung: [IBAN der WEG]

Abstimmung:  __ Ja  /  __ Nein  /  __ Enthaltungen
Ergebnis: ☐ Angenommen  ☐ Abgelehnt`
  },
  beiratswahl: {
    typ: 'beschluss',
    titel: 'Wahl des Verwaltungsbeirats',
    text: `Beschluss: Wahl des Verwaltungsbeirats [LIEGENSCHAFT]

Es werden folgende Eigentümer in den Verwaltungsbeirat gewählt:

1. [Name, Wohnung] – Vorsitz
2. [Name, Wohnung] – stellv. Vorsitz
3. [Name, Wohnung] – Beisitzer

Amtszeit: bis zur nächsten ordentlichen Eigentümerversammlung
(§ 29 WEG – Amtszeit max. bis zur nächsten Wahl)

Abstimmung (je Kandidat oder Gesamtliste):
__ Ja  /  __ Nein  /  __ Enthaltungen
Ergebnis: ☐ Angenommen  ☐ Abgelehnt`
  },
  verwaltungsbericht: {
    typ: 'info',
    titel: 'Berichte der Verwaltung',
    text: `Bericht der Hausverwaltung – Wirtschaftsjahr [VORJAHR]
Liegenschaft: [LIEGENSCHAFT]

1. Durchgeführte Instandhaltungsmaßnahmen [VORJAHR]:
   • [Maßnahme 1] – Kosten: [€]
   • [Maßnahme 2] – Kosten: [€]

2. Aktuelle Finanzlage per [Datum]:
   • Instandhaltungsrücklage: [Betrag €]
   • Hausgeldaußenstände: [Betrag €] ([Anzahl] Einheiten)
   • Girokonto: [Betrag €]

3. Geplante Maßnahmen [JAHR]:
   • [Maßnahme] – geplante Kosten: [€]

4. Sonstiges:
   [Weitere Punkte]

Fragen der Eigentümer werden beantwortet.`
  },
  verschiedenes: {
    typ: 'verschiedenes',
    titel: 'Verschiedenes (nur Information – kein Beschluss!)',
    text: `Verschiedenes – Wünsche und Fragen der Eigentümer

⚠️ WICHTIG: Unter diesem Tagesordnungspunkt können KEINE
rechtswirksamen Beschlüsse der WEG gefasst werden!
(§ 23 Abs. 2 WEG – Beschlussfähigkeit nur bei angekündigten TOPs)

Nur Information, Diskussion und Anregungen für künftige Versammlungen.

Themen / eingegangene Wortmeldungen:
• [Thema / Frage 1]
• [Thema / Frage 2]`
  }
};

// Vorlage-Editor öffnen (befüllt Panel mit vorausgefülltem Template)
function openVorlageEditor(evId, key) {
  const v = EV_VORLAGEN[key];
  if (!v) return;
  const editor = document.getElementById('evVorlageEditor_' + evId);
  if (!editor) return;
  // Liegenschafts-Info aus gecachten Daten holen
  const ev = (window._lastTermine || []).find(t => t.id == evId) || {};
  const lieg = ev.liegenschaft_name || 'Liegenschaft';
  const jahr = ev.termin_datum ? new Date(ev.termin_datum).getFullYear() : new Date().getFullYear();
  const vorjahr = jahr - 1;
  // Platzhalter ersetzen
  const text = v.text
    .replace(/\[LIEGENSCHAFT\]/g, lieg)
    .replace(/\[JAHR\]/g, jahr)
    .replace(/\[VORJAHR\]/g, vorjahr);
  const titel = v.titel
    .replace(/\[LIEGENSCHAFT\]/g, lieg)
    .replace(/\[JAHR\]/g, jahr)
    .replace(/\[VORJAHR\]/g, vorjahr);
  document.getElementById('evVorlTitel_' + evId).value = titel;
  document.getElementById('evVorlTyp_'  + evId).value = v.typ;
  document.getElementById('evVorlText_' + evId).value = text;
  editor.style.display = 'block';
  setTimeout(() => editor.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
}

// TOP aus Vorlage-Editor in Tagesordnung aufnehmen
async function addTOPFromVorlage(evId) {
  const titel = document.getElementById('evVorlTitel_' + evId)?.value?.trim();
  const typ   = document.getElementById('evVorlTyp_'   + evId)?.value || 'beschluss';
  const btext = document.getElementById('evVorlText_'  + evId)?.value?.trim();
  if (!titel) { toast('⚠️ TOP-Titel ist Pflicht'); return; }
  const { data: ev } = await db.from('termine').select('ev_tagesordnung').eq('id', evId).single();
  const toItems = [...(ev?.ev_tagesordnung || [])];
  if (toItems.find(t => t.text === titel)) { toast('Bereits in der Tagesordnung'); return; }
  toItems.push({ text: titel, typ, beschluss_text: btext || null });
  await db.from('termine').update({ ev_tagesordnung: toItems }).eq('id', evId);
  const t = (window._lastTermine || []).find(x => x.id == evId);
  if (t) t.ev_tagesordnung = toItems;
  const listEl = document.getElementById('evTOList_' + evId);
  if (listEl) listEl.innerHTML = renderTOList(evId);
  document.getElementById('evVorlageEditor_' + evId).style.display = 'none';
  toast('✓ TOP mit Beschlusstext aufgenommen');
}

async function addTOPTemplate(evId, typ, text) {
  const {data:ev}=await db.from('termine').select('ev_tagesordnung').eq('id',evId).single();
  const toItems=[...(ev?.ev_tagesordnung||[])];
  if (toItems.find(t=>t.text===text)) { toast('Bereits in der Liste'); return; }
  toItems.push({ text, typ });
  await db.from('termine').update({ev_tagesordnung:toItems}).eq('id',evId);
  const t=(window._lastTermine||[]).find(x=>x.id==evId);
  if(t) t.ev_tagesordnung=toItems;
  const listEl = document.getElementById('evTOList_'+evId);
  if (listEl) listEl.innerHTML = renderTOList(evId);
  toast(text.substring(0,30)+'... ✓');
}

// ═══ ABSTIMMUNGS-RECORDER ═══
async function evAbst(evId, topKey, field, delta) {
  const {data:ev}=await db.from('termine').select('ev_abstimmungen').eq('id',evId).single();
  const data=ev?.ev_abstimmungen||{};
  if (!data[topKey]) data[topKey] = {ja:0,nein:0,enthaltung:0,prinzip:'kopf',ergebnis:''};
  data[topKey][field] = Math.max(0, (data[topKey][field]||0) + delta);
  await db.from('termine').update({ev_abstimmungen:data}).eq('id',evId);
  const t=(window._lastTermine||[]).find(x=>x.id==evId);
  if(t) t.ev_abstimmungen=data;
  const el = document.getElementById('evab_'+evId+'_'+topKey+'_'+field);
  if (el) el.textContent = data[topKey][field];
}

async function evSetPrinzip(evId, topKey, prinzip, btn) {
  const {data:ev}=await db.from('termine').select('ev_abstimmungen').eq('id',evId).single();
  const data=ev?.ev_abstimmungen||{};
  if (!data[topKey]) data[topKey] = {ja:0,nein:0,enthaltung:0,prinzip:'kopf',ergebnis:''};
  data[topKey].prinzip = prinzip;
  await db.from('termine').update({ev_abstimmungen:data}).eq('id',evId);
  const t=(window._lastTermine||[]).find(x=>x.id==evId);
  if(t) t.ev_abstimmungen=data;
  btn.closest('div').querySelectorAll('button[data-p]').forEach(b=>{
    const active = b.getAttribute('data-p')===prinzip;
    b.style.borderColor = active?'var(--blue2)':'var(--border2)';
    b.style.background  = active?'var(--blue4)':'transparent';
    b.style.color       = active?'var(--blue)':'var(--text3)';
  });
  toast('Prinzip: '+prinzip.toUpperCase());
}

async function evErgebnisFestlegen(evId, topKey, ergebnis) {
  const {data:ev}=await db.from('termine').select('ev_abstimmungen').eq('id',evId).single();
  const data=ev?.ev_abstimmungen||{};
  if (!data[topKey]) data[topKey] = {ja:0,nein:0,enthaltung:0,prinzip:'kopf',ergebnis:''};
  data[topKey].ergebnis = ergebnis;
  await db.from('termine').update({ev_abstimmungen:data}).eq('id',evId);
  const t=(window._lastTermine||[]).find(x=>x.id==evId);
  if(t) t.ev_abstimmungen=data;
  toast((ergebnis==='angenommen'?'✓ Angenommen':'✕ Abgelehnt')+' gespeichert!');
  // Reload panel
  const panel = document.getElementById('evp-'+evId+'-beschluesse');
  if (panel && panel.style.display!=='none') {
    // Re-render by re-opening active tab
    const ab = data[topKey];
    const rowEl = document.getElementById('evab_'+evId+'_'+topKey+'_ja')?.closest('[style*="border-left"]');
    if (rowEl) {
      const ang = ergebnis==='angenommen';
      rowEl.style.borderColor = ang?'#A7F3D0':'#FECACA';
      rowEl.style.borderLeftColor = ang?'var(--green2)':'var(--red2)';
    }
  }
}

// ═══ EINLADUNGSVERSAND ═══
async function evSaveEinladung(evId) {
  const datum  = document.getElementById('evEinlDatum_'+evId)?.value;
  const art    = document.getElementById('evEinlArt_'+evId)?.value;
  const anzahl = document.getElementById('evEinlAnzahl_'+evId)?.value;
  const einladung={datum,art,anzahl};
  await db.from('termine').update({ev_einladung:einladung}).eq('id',evId);
  const t=(window._lastTermine||[]).find(x=>x.id==evId);
  if(t) t.ev_einladung=einladung;
  toast('✓ Einladung gespeichert');
}

// ═══ VOLLMACHT-COUNTER ═══
async function evVollmacht(evId, delta) {
  const {data:ev}=await db.from('termine').select('ev_vollmachten').eq('id',evId).single();
  const neu = Math.max(0, (ev?.ev_vollmachten||0) + delta);
  await db.from('termine').update({ev_vollmachten:neu}).eq('id',evId);
  const t=(window._lastTermine||[]).find(x=>x.id==evId);
  if(t) t.ev_vollmachten=neu;
  const el = document.getElementById('evVollmachtCount_'+evId);
  if (el) el.textContent = neu;
  toast(delta>0?'Vollmacht +1':'Vollmacht −1');
}

// ═══ PROTOKOLL-PANEL ═══
function renderProtokollPanel(e) {
  const prot    = e.ev_protokoll||{};
  const toItems = e.ev_tagesordnung||[];
  const abstData= e.ev_abstimmungen||{};
  const einl    = e.ev_einladung||{};
  const vollm   = e.ev_vollmachten||0;

  const topHtml = toItems.map((t,i)=>{
    const key = 'top_'+toItems.filter((x,j)=>x.typ==='beschluss'&&j<i).length;
    const ab = t.typ==='beschluss' ? (abstData[key]||{}) : null;
    const diskKey = 'disk_'+i;
    return `<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:10px">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
        <div style="width:22px;height:22px;border-radius:50%;background:var(--blue4);border:1px solid #BFDBFE;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--blue);flex-shrink:0">${i+1}</div>
        <div style="font-size:12px;font-weight:600;color:var(--text);flex:1">${esc(t.text)}</div>
        <span style="font-size:9px;padding:2px 7px;border-radius:100px;background:${t.typ==='beschluss'?'var(--blue4)':t.typ==='verschiedenes'?'var(--gold4)':'var(--bg3)'};color:${t.typ==='beschluss'?'var(--blue)':t.typ==='verschiedenes'?'var(--gold)':'var(--text3)'};border:1px solid ${t.typ==='beschluss'?'#BFDBFE':t.typ==='verschiedenes'?'var(--gold3)':'var(--border)'}">${t.typ==='beschluss'?'📊 Beschluss':t.typ==='verschiedenes'?'💬 Verschiedenes':'ℹ️ Info'}</span>
      </div>
      <textarea id="evprot_${e.id}_${diskKey}" class="form-input" rows="2" style="margin:0;font-size:11px;resize:vertical" 
        placeholder="Kurze Zusammenfassung der Diskussion..." 
        onchange="evProtSave('${e.id}')">${esc(prot[diskKey]||'')}</textarea>
      ${t.typ==='beschluss'&&ab&&ab.ergebnis?`
      <div style="margin-top:8px;padding:8px 10px;border-radius:7px;background:${ab.ergebnis==='angenommen'?'var(--green3)':'var(--red3)'};border:1px solid ${ab.ergebnis==='angenommen'?'#A7F3D0':'#FECACA'};font-size:11px">
        <strong>${ab.ergebnis==='angenommen'?'✓ BESCHLUSS ANGENOMMEN':'✕ BESCHLUSS ABGELEHNT'}</strong>
        ${ab.ja||ab.nein?` · Ja: ${ab.ja||0} / Nein: ${ab.nein||0} / Enthaltung: ${ab.enthaltung||0} (${ab.prinzip||'Kopf'}prinzip)`:''}
      </div>`:t.typ==='verschiedenes'?`<div style="margin-top:6px;font-size:10px;color:var(--gold);font-weight:600">⚠️ Kein Beschluss unter Verschiedenes möglich – nur Information und Diskussion!</div>`:''}
    </div>`;
  }).join('');

  return `
    <div style="background:var(--gold4);border:1px solid var(--gold3);border-radius:9px;padding:10px 12px;margin-bottom:14px;font-size:11px;color:var(--gold)">
      ⚖️ Das Protokoll ist Grundlage für die <strong>Anfechtungsfestigkeit</strong>. Alle Pflichtangaben gem. WEG müssen vollständig sein, bevor es versandt wird.
    </div>
    
    <!-- Kopfdaten -->
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">📋 Kopfdaten (Pflichtangaben)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Versammlungsbeginn</div>
          <input id="evprot_${e.id}_beginn" type="time" class="form-input" style="margin:0;font-size:12px" value="${prot.beginn||''}" onchange="evProtSave('${e.id}')"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Versammlungsende</div>
          <input id="evprot_${e.id}_ende" type="time" class="form-input" style="margin:0;font-size:12px" value="${prot.ende||''}" onchange="evProtSave('${e.id}')"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Versammlungsleitung</div>
          <input id="evprot_${e.id}_leitung" class="form-input" style="margin:0;font-size:12px" placeholder="Name des Versammlungsleiters" value="${esc(prot.leitung||'')}" onchange="evProtSave('${e.id}')"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Protokollführer</div>
          <input id="evprot_${e.id}_protokollfuehrer" class="form-input" style="margin:0;font-size:12px" placeholder="Name des Protokollführers" value="${esc(prot.protokollfuehrer||'')}" onchange="evProtSave('${e.id}')"></div>
      </div>
    </div>

    <!-- Beschlussfähigkeit -->
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">✅ Beschlussfähigkeit (§ 25 WEG)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Anwesend (Eigentümer)</div>
          <input id="evprot_${e.id}_anwesend" type="number" min="0" class="form-input" style="margin:0;font-size:12px" value="${prot.anwesend||''}" onchange="evProtSave('${e.id}')"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Vollmachten (vertreten)</div>
          <input id="evprot_${e.id}_vollmachten" type="number" min="0" class="form-input" style="margin:0;font-size:12px" value="${prot.vollmachten||vollm||''}" onchange="evProtSave('${e.id}')"></div>
        <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">MEA-Quorum (%)</div>
          <input id="evprot_${e.id}_quorum" type="number" min="0" max="100" class="form-input" style="margin:0;font-size:12px" placeholder="z.B. 65" value="${prot.quorum||''}" onchange="evProtSave('${e.id}')"></div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
          <input type="checkbox" id="evprot_${e.id}_beschlussf" ${prot.beschlussf?'checked':''} onchange="evProtSave('${e.id}')">
          Beschlussfähigkeit festgestellt und protokolliert
        </label>
      </div>
      ${einl.datum?`<div style="margin-top:8px;font-size:11px;color:var(--green)">✓ Einladung versandt am ${new Date(einl.datum).toLocaleDateString('de-DE')} via ${einl.art||'–'} (${einl.anzahl||'?'} Einladungen)</div>`:''}
    </div>

    <!-- TOPs & Diskussion -->
    <div style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">📋 Tagesordnungspunkte & Diskussion</div>
      ${topHtml || '<div style="color:var(--text3);font-size:12px;padding:10px 0">Erst TOPs in der Tagesordnung anlegen.</div>'}
    </div>

    <!-- Abschluss & Unterschriften -->
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">🔏 Abschluss & Unterschriften</div>
      <div style="margin-bottom:8px"><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Nächste Versammlung / offene Punkte</div>
        <textarea id="evprot_${e.id}_abschluss" class="form-input" rows="2" style="margin:0;font-size:11px;resize:vertical" placeholder="z.B. Nächste EV: voraussichtlich April 2026 · Offene Punkte: ..." onchange="evProtSave('${e.id}')">${esc(prot.abschluss||'')}</textarea>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="checkbox" id="evprot_${e.id}_sig_verwalter" ${prot.sig_verwalter?'checked':''} onchange="evProtSave('${e.id}')"> ✍️ Unterschrift Verwalter</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="checkbox" id="evprot_${e.id}_sig_beirat" ${prot.sig_beirat?'checked':''} onchange="evProtSave('${e.id}')"> ✍️ Unterschrift Beiratsvorsitzender</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="checkbox" id="evprot_${e.id}_sig_eigentuemer" ${prot.sig_eigentuemer?'checked':''} onchange="evProtSave('${e.id}')"> ✍️ Unterschrift Eigentümer (Zeuge)</label>
      </div>
      ${(prot.sig_verwalter&&prot.sig_beirat&&prot.sig_eigentuemer)?
        `<div style="margin-top:10px;padding:8px 12px;background:var(--green3);border:1px solid #A7F3D0;border-radius:7px;font-size:12px;font-weight:700;color:var(--green)">✅ Protokoll vollständig unterschrieben – rechtssicher!</div>`:
        `<div style="margin-top:10px;font-size:10px;color:var(--text3)">Alle 3 Unterschriften für rechtssichere Protokollierung empfohlen.</div>`
      }
    </div>

    <button class="btn btn-gold" onclick="evProtokollVorschau('${e.id}')">📄 Protokoll-Vorschau & Export</button>
  `;
}

async function evProtSave(evId) {
  const prot = {};
  ['beginn','ende','leitung','protokollfuehrer','anwesend','vollmachten','quorum','abschluss'].forEach(f=>{
    const el = document.getElementById('evprot_'+evId+'_'+f);
    if(el) prot[f] = el.value;
  });
  ['beschlussf','sig_verwalter','sig_beirat','sig_eigentuemer'].forEach(f=>{
    const el = document.getElementById('evprot_'+evId+'_'+f);
    if(el) prot[f] = el.checked;
  });
  const ev=(window._lastTermine||[]).find(x=>x.id==evId)||{};
  const toItems=ev.ev_tagesordnung||[];
  toItems.forEach((_,i)=>{
    const el = document.getElementById('evprot_'+evId+'_disk_'+i);
    if(el) prot['disk_'+i] = el.value;
  });
  await db.from('termine').update({ev_protokoll:prot}).eq('id',evId);
  const t=(window._lastTermine||[]).find(x=>x.id==evId);
  if(t) t.ev_protokoll=prot;
  toast('✓ Protokoll gespeichert');
}

function evProtokollVorschau(evId) {
  const ev=(window._lastTermine||[]).find(t=>t.id==evId)||{};
  const prot    = ev.ev_protokoll||{};
  const toItems = ev.ev_tagesordnung||[];
  const abstData= ev.ev_abstimmungen||{};
  
  const topLines = toItems.map((t,i)=>{
    const key = 'top_'+toItems.filter((x,j)=>x.typ==='beschluss'&&j<i).length;
    const ab = t.typ==='beschluss' ? (abstData[key]||{}) : null;
    const disk = prot['disk_'+i]||'';
    return `
      <div style="margin-bottom:14px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb">
        <div style="font-weight:700;margin-bottom:4px">TOP ${i+1}: ${t.text}</div>
        ${disk?`<div style="font-size:12px;color:#6b7280;margin-bottom:6px">${disk}</div>`:''}
        ${ab&&ab.ergebnis?`<div style="font-size:12px;font-weight:700;color:${ab.ergebnis==='angenommen'?'#16a34a':'#dc2626'}">
          ${ab.ergebnis==='angenommen'?'BESCHLOSSEN':'ABGELEHNT'} · Ja: ${ab.ja||0} / Nein: ${ab.nein||0} / Enthaltung: ${ab.enthaltung||0} (${ab.prinzip||'Kopf'}prinzip)
        </div>`:''}
        ${t.typ==='verschiedenes'?'<div style="font-size:11px;color:#d97706">⚠️ Kein Beschluss – nur Information/Diskussion.</div>':''}
      </div>`;
  }).join('');

  const html = `<div style="font-family:serif;max-width:700px;margin:0 auto;padding:20px;color:#1a1a1a">
    <div style="text-align:center;margin-bottom:20px;border-bottom:2px solid #1a1a1a;padding-bottom:12px">
      <div style="font-size:20px;font-weight:700">PROTOKOLL</div>
      <div style="font-size:14px">Eigentümerversammlung</div>
      <div style="font-size:13px;margin-top:4px">${ev.liegenschaft_name||''} · ${fmtDate(ev.termin_datum)}</div>
    </div>
    <table style="width:100%;font-size:12px;margin-bottom:16px;border-collapse:collapse">
      <tr><td style="padding:3px 8px;color:#6b7280;width:160px">Versammlungsort</td><td style="padding:3px 8px">${ev.ort||'–'}</td></tr>
      <tr><td style="padding:3px 8px;color:#6b7280">Beginn / Ende</td><td style="padding:3px 8px">${prot.beginn||'–'} Uhr / ${prot.ende||'–'} Uhr</td></tr>
      <tr><td style="padding:3px 8px;color:#6b7280">Versammlungsleitung</td><td style="padding:3px 8px">${prot.leitung||'–'}</td></tr>
      <tr><td style="padding:3px 8px;color:#6b7280">Protokollführer</td><td style="padding:3px 8px">${prot.protokollfuehrer||'–'}</td></tr>
      <tr><td style="padding:3px 8px;color:#6b7280">Anwesend</td><td style="padding:3px 8px">${prot.anwesend||'–'} Eigentümer + ${prot.vollmachten||'–'} Vollmachten</td></tr>
      <tr><td style="padding:3px 8px;color:#6b7280">Beschlussfähigkeit</td><td style="padding:3px 8px;font-weight:700;color:${prot.beschlussf?'#16a34a':'#dc2626'}">${prot.beschlussf?'✓ Festgestellt und protokolliert':'⚠️ Noch nicht bestätigt'}</td></tr>
    </table>
    <div style="font-size:13px;font-weight:700;margin-bottom:10px;border-bottom:1px solid #e5e7eb;padding-bottom:6px">Tagesordnungspunkte</div>
    ${topLines||'<div style="color:#6b7280;font-size:12px">Keine TOPs erfasst.</div>'}
    ${prot.abschluss?`<div style="margin-top:16px;padding:10px;border:1px solid #e5e7eb;border-radius:6px"><div style="font-weight:700;margin-bottom:4px">Abschluss / Nächste Versammlung</div><div style="font-size:12px">${prot.abschluss}</div></div>`:''}
    <div style="margin-top:24px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px">
      <div style="border-top:1px solid #1a1a1a;padding-top:8px;text-align:center;font-size:11px">Verwalter</div>
      <div style="border-top:1px solid #1a1a1a;padding-top:8px;text-align:center;font-size:11px">Beiratsvorsitzender</div>
      <div style="border-top:1px solid #1a1a1a;padding-top:8px;text-align:center;font-size:11px">Eigentümer (Zeuge)</div>
    </div>
  </div>`;

  document.getElementById('modalTitle').textContent = '📄 Protokoll-Vorschau';
  document.getElementById('modalBody').innerHTML = `<div style="background:white;border-radius:10px;padding:4px">${html}</div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn btn-gold" onclick="window.print()">🖨 Drucken / PDF</button>
      <button class="btn btn-ghost" onclick="closeModal()">Schließen</button>
    </div>`;
}

function openNewEVModal() {
  document.getElementById('modalTitle').textContent = '🏛 Neue Eigentümerversammlung planen';
  const liegs = APP.allLiegs || [];
  const year = new Date().getFullYear();
  const defDate = new Date(Date.now()+35*86400000).toISOString().slice(0,10);
  const liegOpts = liegs.map(l=>`<option value="${l.id}">${esc(l.name)} (${esc(l.ort)})</option>`).join('');
  document.getElementById('modalBody').innerHTML = `
    <div style="background:linear-gradient(135deg,#1C1917,#292524);border-radius:10px;padding:12px 14px;margin-bottom:14px;font-size:11px;color:rgba(255,255,255,.5)">
      🏛 Eine Eigentümerversammlung muss rechtzeitig eingeladen, sorgfältig protokolliert und rechtssicher durchgeführt werden. <br>
      Die App führt dich durch alle 3 Phasen: Vorbereitung → Versammlung → Nachbereitung.
    </div>
    <div class="form-group"><label class="form-label">Liegenschaft *</label>
      <select id="newEvLieg" class="form-input"><option value="">– Bitte wählen –</option>${liegOpts}</select></div>
    <div class="form-group"><label class="form-label">Titel der Versammlung</label>
      <input id="newEvTitel" class="form-input" value="Eigentümerversammlung ${year}"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="form-group"><label class="form-label">Datum *</label>
        <input id="newEvDatum" class="form-input" type="date" value="${defDate}"
          oninput="(function(){
            const d=document.getElementById('newEvDatum').value;
            if(!d)return;
            const dt=new Date(d);
            const f14=new Date(dt); f14.setDate(f14.getDate()-14);
            const f21=new Date(dt); f21.setDate(f21.getDate()-21);
            document.getElementById('evFristMust').textContent=f14.toLocaleDateString('de-DE');
            document.getElementById('evFristOpt').textContent=f21.toLocaleDateString('de-DE');
          })()"></div>
      <div class="form-group"><label class="form-label">Uhrzeit</label>
        <input id="newEvZeit" class="form-input" type="time" value="19:00"></div>
    </div>
    <div class="form-group"><label class="form-label">Versammlungsort</label>
      <input id="newEvOrt" class="form-input" placeholder="Gemeinschaftsraum, genaue Adresse..."></div>
    <div style="background:var(--gold4);border:1px solid var(--gold3);border-radius:9px;padding:12px 14px;margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:6px">⏰ Einladungsfristen (§ 24 WEG)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="background:var(--bg3);border-radius:7px;padding:8px 10px">
          <div style="font-size:10px;color:var(--text3);font-weight:600">SPÄTESTENS (14 Tage)</div>
          <div style="font-size:13px;font-weight:700;color:var(--gold);font-family:'JetBrains Mono';margin-top:2px" id="evFristMust">–</div>
        </div>
        <div style="background:var(--green3);border-radius:7px;padding:8px 10px">
          <div style="font-size:10px;color:var(--green);font-weight:600">EMPFOHLEN (21 Tage)</div>
          <div style="font-size:13px;font-weight:700;color:var(--green);font-family:'JetBrains Mono';margin-top:2px" id="evFristOpt">–</div>
        </div>
      </div>
      <div style="font-size:10px;color:var(--gold);opacity:.7;margin-top:6px">Tip: Früh einladen = mehr Zeit für Vollmachten und Unterlagen-Prüfung</div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-gold" onclick="saveNewEV()">🏛 EV anlegen & Checkliste öffnen</button>
      <button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
  // Fristen sofort berechnen
  setTimeout(()=>document.getElementById('newEvDatum')?.dispatchEvent(new Event('input')),50);
}

async function saveNewEV() {
  const liegenschaft_id = document.getElementById('newEvLieg')?.value;
  const titel = document.getElementById('newEvTitel')?.value?.trim();
  const datum = document.getElementById('newEvDatum')?.value;
  const zeit  = document.getElementById('newEvZeit')?.value||'19:00';
  const ort   = document.getElementById('newEvOrt')?.value?.trim();
  if (!liegenschaft_id || !datum) { toast('⚠️ Bitte Liegenschaft und Datum ausfüllen'); return; }
  const { data, error } = await db.from('termine').insert({
    liegenschaft_id: parseInt(liegenschaft_id),
    titel: titel || ('Eigentümerversammlung '+new Date(datum).getFullYear()),
    termin_datum: datum+'T'+zeit+':00',
    termin_typ: 'eigentümerversammlung',
    ort: ort||null,
  }).select().single();
  if (error) { toast('Fehler: '+error.message); return; }
  closeModal();
  toast('✓ EV angelegt – Checkliste öffnen!');
  switchView('termine');
}

function tmplDokumente(rows) {
  const items = rows.map(d=>`
    <div class="doc-item" onclick="${d.url?`window.open('${esc(d.url)}','_blank')`:`toast('Kein Dokument-Link hinterlegt')`}" style="cursor:pointer">
      <div style="font-size:20px;flex-shrink:0">${d.icon||'📄'}</div>
      <div style="flex:1"><div style="font-size:12px;font-weight:500;color:var(--text)">${esc(d.name)}</div>
        <div style="font-size:10px;color:var(--text3);font-family:'JetBrains Mono'">${fmtDate(d.erstellt_am)} · ${esc(d.liegenschaft_name||'Allgemein')}</div></div>
      <div style="color:var(--gold);font-size:14px">⬇</div>
    </div>`).join('');
  return `<div class="section-header"><div class="section-title">Dokumente & Archiv</div><button class="btn btn-gold btn-sm" onclick="openDokumentHochladenModal()">+ Hochladen</button></div>
  <div class="card">${items||noDaten('Keine Dokumente.')}</div>`;
}

function tmplVermieterDash(d) {
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

function tmplMieterListe(tenants) {
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

function tmplEinnahmen(txs) {
  const ein = txs.filter(t=>t.typ==='einnahme');
  const total = ein.reduce((a,t)=>a+parseFloat(t.betrag||0),0);
  const rows = ein.map(tx=>`
    <div class="tx-item"><div class="tx-ico" style="background:var(--green3)">🏠</div>
    <div class="tx-body"><div class="tx-name">${esc(tx.bezeichnung)}</div><div class="tx-meta">${fmtDate(tx.buchungsdatum)}</div></div>
    <div class="tx-amt tx-in">+${fmtEur(tx.betrag)}</div></div>`).join('');
  return `<div class="kpi-grid"><div class="kpi-card"><div class="kpi-label">Einnahmen gesamt</div><div class="kpi-value kv-green">${fmtEur(total)}</div><div class="kpi-accent-line" style="background:var(--green2)"></div></div></div>
  <div class="card"><div class="card-title">Einnahmen</div><div class="tx-list">${rows||noDaten()}</div></div>`;
}

function tmplMeineWohnung(d) {
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

function tmplZahlungen(txs) {
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

function tmplKontakt(d) {
  return `
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:16px">
    <div class="card"><div class="card-title">${d.kontakt_typ==='verwaltung'?'🏛️ Hausverwaltung':'👑 Vermieter'}</div>
      <div class="info-block" style="margin-top:12px"><div class="ib-name">${esc(d.kontakt_name||'–')}</div><div class="ib-contact">${esc(d.kontakt_phone||'–')}</div></div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">
        ${d.kontakt_phone?`<a class="btn btn-primary" style="justify-content:center;text-decoration:none" href="tel:${esc(d.kontakt_phone)}">📞 Anrufen</a>`:`<button class="btn btn-primary" style="justify-content:center" disabled>📞 Anrufen</button>`}
        ${d.kontakt_email?`<a class="btn btn-ghost" style="justify-content:center;text-decoration:none" href="mailto:${esc(d.kontakt_email)}">✉️ E-Mail senden</a>`:`<button class="btn btn-ghost" style="justify-content:center" disabled>✉️ E-Mail senden</button>`}
      </div>
    </div>
    <div class="card"><div class="card-title">🆘 Notfallkontakte</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">
        ${[{i:'🔥',n:'Feuerwehr',t:'112'},{i:'🚑',n:'Notruf',t:'112'},{i:'👮',n:'Polizei',t:'110'},{i:'💧',n:'Wasser',t:'+49 800 001'},{i:'⚡',n:'Strom',t:'+49 800 002'},{i:'🔧',n:'Notfall',t:'+49 800 003'}]
        .map(c=>`<a class="btn btn-ghost" href="tel:${c.t}" style="flex-direction:column;align-items:center;padding:11px;height:auto;gap:3px;width:100%;text-decoration:none"><span>${c.i}</span><span style="font-size:10px">${c.n}</span><span style="font-size:10px;font-family:'JetBrains Mono';color:var(--gold)">${c.t}</span></a>`).join('')}
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

// ═══════════════════════════════════════════════════
// UNIVERSAL MODAL SYSTEM
// ═══════════════════════════════════════════════════

async function openSchadenModal(schadenId) {
  openModalLoading('Schadensmeldung lädt...');
  try {
    const { data: s, error } = await db
      .from('schadensmeldungen')
      .select('*, liegenschaften(name,ort,strasse,plz), wohneinheiten(nummer,etage,typ,flaeche_qm,nettomiete), dienstleister(name,telefon,email,notfall_nr,kategorie,kontaktperson)')
      .eq('id', schadenId)
      .single();
    if (error) throw error;

    const { data: timeline } = await db
      .from('schaden_timeline')
      .select('*')
      .eq('schaden_id', schadenId)
      .order('zeitpunkt', { ascending: true });

    const prioColor = {notfall:'var(--red)',hoch:'#EA580C',mittel:'var(--gold)',niedrig:'var(--green)'};
    const prioIcon  = {notfall:'🚨',hoch:'🔴',mittel:'🟡',niedrig:'🟢'};
    const statLabel = {gemeldet:'Gemeldet',in_bearbeitung:'In Bearbeitung',erledigt:'Erledigt',abgeschlossen:'Abgeschlossen'};
    const statColor = {gemeldet:'var(--red)',in_bearbeitung:'var(--gold)',erledigt:'var(--green)',abgeschlossen:'var(--teal)'};
    const ktLabel   = {eigentuemer:'Eigentümer',mieter:'Mieter',versicherung:'Versicherung',verwaltung:'Verwaltung'};
    const ktColor   = {eigentuemer:'var(--blue)',mieter:'var(--green)',versicherung:'var(--teal)',verwaltung:'var(--gold)'};
    const viaIcon   = {Telefon:'📞','E-Mail':'✉️',App:'📱',persönlich:'🤝'};

    const tlHtml = (timeline||[]).map((t,i) => `
      <div style="display:flex;gap:12px;position:relative">
        <div style="display:flex;flex-direction:column;align-items:center;gap:0">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--bg3);border:2px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;z-index:1">${esc(t.icon||'📋')}</div>
          ${i<(timeline.length-1)?`<div style="width:2px;flex:1;min-height:20px;background:var(--border);margin:2px 0"></div>`:''}
        </div>
        <div style="padding-bottom:${i<(timeline.length-1)?'14':'4'}px;flex:1">
          <div style="font-size:12px;font-weight:600;color:var(--text)">${esc(t.aktion)}</div>
          <div style="font-size:11px;color:var(--text2);margin:2px 0">${esc(t.person||'')}</div>
          ${t.notiz?`<div style="font-size:11px;color:var(--text3);background:var(--bg3);border-radius:6px;padding:6px 8px;margin-top:4px;border-left:2px solid var(--border2)">${esc(t.notiz)}</div>`:''}
          <div style="font-size:10px;color:var(--text4);font-family:'JetBrains Mono';margin-top:3px">${fmtDateTime(t.zeitpunkt)}</div>
        </div>
      </div>`).join('');

    const kostenHtml = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="ig-item">
          <div class="ig-key">Geschätzte Kosten</div>
          <div class="ig-val" style="color:var(--gold);font-size:15px">${s.kosten_geschaetzt?fmtEur(s.kosten_geschaetzt):'noch offen'}</div>
        </div>
        <div class="ig-item">
          <div class="ig-key">Finale Kosten</div>
          <div class="ig-val" style="color:${s.kosten_final?'var(--green)':'var(--text3)'};font-size:15px">${s.kosten_final?fmtEur(s.kosten_final):'ausstehend'}</div>
        </div>
        <div class="ig-item ig-full" style="background:${ktColor[s.kostentraeger]||'var(--bg)'}15;border:1px solid ${ktColor[s.kostentraeger]||'var(--border)'}40">
          <div class="ig-key">💳 Kostenträger</div>
          <div style="font-size:14px;font-weight:700;color:${ktColor[s.kostentraeger]||'var(--text)'}">${ktLabel[s.kostentraeger]||s.kostentraeger||'unbekannt'}</div>
          ${s.versicherung_nr?`<div style="font-size:11px;color:var(--text3);font-family:'JetBrains Mono';margin-top:3px">📋 Versicherungsnr: ${esc(s.versicherung_nr)}</div>`:''}
        </div>
      </div>`;

    const body = `
      <!-- STATUS HEADER -->
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

      <!-- KETTE: 4 Blöcke -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">

        <!-- Block 1: WO -->
        <div class="ig-item" style="cursor:pointer" onclick="closeModal();openProp(${s.liegenschaft_id})">
          <div class="ig-key">🏛 Liegenschaft <span style="color:var(--gold)">(→ öffnen)</span></div>
          <div class="ig-val" style="font-size:13px">${esc(s.liegenschaften?.name||'–')}</div>
          <div style="font-size:10px;color:var(--text3)">${esc(s.liegenschaften?.strasse||'')} · ${esc(s.liegenschaften?.ort||'')}</div>
          ${s.wohneinheiten?`<div style="margin-top:5px;font-size:11px;background:var(--blue4);color:var(--blue);padding:3px 7px;border-radius:5px;display:inline-block">Wohnung ${esc(s.wohneinheiten.nummer)} · ${esc(s.wohneinheiten.typ||'')} · ${s.wohneinheiten.flaeche_qm}m²</div>`:''}
        </div>

        <!-- Block 2: WER hat gemeldet -->
        <div class="ig-item">
          <div class="ig-key">👤 Gemeldet von</div>
          <div class="ig-val" style="font-size:13px">${esc(s.gemeldet_von||'–')}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:3px">
            ${s.gemeldet_via?`${viaIcon[s.gemeldet_via]||'📋'} via ${esc(s.gemeldet_via)}`:'–'}
          </div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">${fmtDateTime(s.erstellt_am)}</div>
        </div>

        <!-- Block 3: DIENSTLEISTER -->
        ${s.dienstleister ? `
        <div class="ig-item">
          <div class="ig-key">🔧 Beauftragter Dienstleister</div>
          <div class="ig-val" style="font-size:13px">${esc(s.dienstleister.name)}</div>
          ${s.dienstleister.kontaktperson?`<div style="font-size:11px;color:var(--text3)">👤 ${esc(s.dienstleister.kontaktperson)}</div>`:''}
          ${s.dienstleister.telefon?`<div style="font-size:11px;color:var(--blue2);font-family:'JetBrains Mono';margin-top:3px">📞 ${esc(s.dienstleister.telefon)}</div>`:''}
          ${s.dienstleister.notfall_nr?`<div style="font-size:11px;color:var(--red);font-family:'JetBrains Mono'">🚨 ${esc(s.dienstleister.notfall_nr)}</div>`:''}
          ${s.beauftragt_am?`<div style="font-size:10px;color:var(--text3);margin-top:4px">Beauftragt: ${fmtDateTime(s.beauftragt_am)}</div>`:''}
        </div>` : `<div class="ig-item"><div class="ig-key">🔧 Dienstleister</div><div style="color:var(--red2);font-size:12px">⚠️ Noch nicht zugewiesen</div><button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="toast('Dienstleister zuweisen...')">Zuweisen</button></div>`}

        <!-- Block 4: KOSTEN -->
        <div class="ig-item">
          <div class="ig-key">💶 Kosten & Kostenträger</div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:4px">
            <span style="font-size:12px;color:var(--text3)">Geschätzt</span>
            <span style="font-family:'JetBrains Mono';font-size:13px;color:var(--gold)">${s.kosten_geschaetzt?fmtEur(s.kosten_geschaetzt):'–'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:2px">
            <span style="font-size:12px;color:var(--text3)">Final</span>
            <span style="font-family:'JetBrains Mono';font-size:13px;color:${s.kosten_final?'var(--green)':'var(--text4)'}">${s.kosten_final?fmtEur(s.kosten_final):'ausstehend'}</span>
          </div>
          <div style="margin-top:6px;padding:5px 8px;border-radius:6px;background:${ktColor[s.kostentraeger]||'var(--bg)'}20;border:1px solid ${ktColor[s.kostentraeger]||'var(--border)'}30">
            <span style="font-size:11px;font-weight:700;color:${ktColor[s.kostentraeger]||'var(--text)'}">
              💳 ${ktLabel[s.kostentraeger]||s.kostentraeger||'unbekannt'}
            </span>
            ${s.versicherung_nr?`<div style="font-size:10px;color:var(--text3);font-family:'JetBrains Mono';margin-top:2px">Nr: ${esc(s.versicherung_nr)}</div>`:''}
          </div>
        </div>
      </div>

      <!-- VERWALTER NOTIZ -->
      ${s.notiz_verwalter?`
      <div style="background:var(--gold4);border:1px solid var(--gold3);border-radius:10px;padding:10px 13px;margin-bottom:14px">
        <div style="font-size:10px;font-weight:700;color:var(--gold);letter-spacing:.8px;text-transform:uppercase;margin-bottom:4px">📌 Notiz Verwalter</div>
        <div style="font-size:12px;color:var(--text)">${esc(s.notiz_verwalter)}</div>
      </div>`:''}

      <!-- TIMELINE -->
      <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--text3);margin-bottom:12px;display:flex;align-items:center;gap:8px">
        📋 Aktivitäts-Timeline
        <div style="flex:1;height:1px;background:var(--border)"></div>
      </div>
      <div style="padding-left:4px">
        ${tlHtml || `<div style="color:var(--text3);font-size:12px">Noch keine Einträge.</div>`}
        <!-- Neuer Eintrag -->
        <div style="display:flex;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
          <input id="tlInput" class="form-input" style="margin:0;font-size:12px" placeholder="Neue Aktivität hinzufügen...">
          <button class="btn btn-gold btn-sm" onclick="addTimeline(${schadenId})">+ Eintrag</button>
        </div>
      </div>

      <!-- AKTIONEN -->
      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
        <button class="btn btn-primary btn-sm" onclick="openSchadenStatusModal(${schadenId})">✏️ Status ändern</button>
        ${s.dienstleister
          ? `<button class="btn btn-ghost btn-sm" onclick="openDLZuweisenModal(${schadenId})">🔧 DL wechseln</button>
             ${s.dienstleister.telefon?`<a class="btn btn-ghost btn-sm" href="tel:${esc(s.dienstleister.telefon)}" style="text-decoration:none">📞 ${esc(s.dienstleister.name)}</a>`:''}
             ${s.dienstleister.email?`<a class="btn btn-ghost btn-sm" href="mailto:${esc(s.dienstleister.email)}" style="text-decoration:none">✉️ E-Mail</a>`:''}`
          : `<button class="btn btn-ghost btn-sm" onclick="openDLZuweisenModal(${schadenId})">🔧 DL zuweisen</button>`}
        <button class="btn btn-ghost btn-sm" onclick="openSchadenKostenModal(${schadenId})">💶 Kosten</button>
        ${s.status!=='erledigt'&&s.status!=='abgeschlossen'?`<button class="btn btn-ghost btn-sm" style="color:var(--green);border-color:var(--green2)" onclick="schadenErledigen(${schadenId})">✅ Erledigen</button>`:''}
      </div>`;

    document.getElementById('modalTitle').textContent = '🔧 ' + s.titel;
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modalOverlay').classList.add('open');
  } catch(e) {
    document.getElementById('modalBody').innerHTML = `<p style="color:var(--red)">Fehler: ${esc(e.message)}</p>`;
  }
}

async function addTimeline(schadenId) {
  const input = document.getElementById('tlInput');
  const text = input?.value?.trim();
  if (!text) return;
  await db.from('schaden_timeline').insert({
    schaden_id: schadenId,
    aktion: text,
    person: `${APP.profile.first_name} ${APP.profile.last_name} (Verwalter)`,
    icon: '📋'
  });
  input.value = '';
  toast('Eintrag hinzugefügt ✓');
  openSchadenModal(schadenId);
}

function openModalLoading(text='Lädt...') {
  document.getElementById('modalTitle').textContent = text;
  document.getElementById('modalBody').innerHTML = `<div style="display:flex;justify-content:center;padding:40px"><div class="loading-ring"></div></div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

function fmtDateTime(d) {
  if (!d) return '–';
  try { return new Date(d).toLocaleString('de-DE', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
  catch(e) { return d; }
}

// ═══════════════════════════════════════════════════
// EVENT MODAL
// ═══════════════════════════════════════════════════
function openEventModal(ev) {
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
function closeModal(e) {
  if (e && e.target!==document.getElementById('modalOverlay')) return;
  document.getElementById('modalOverlay').classList.remove('open');
  document.getElementById('mainModal')?.classList.remove('modal-ev');
}

// ═══════════════════════════════════════════════════
// NOTIFICATIONS & DRAWER
// ═══════════════════════════════════════════════════
function buildNotifs() {
  const ns = NOTIFS[APP.role]||[];
  document.getElementById('notifBadge').textContent = ns.length;
  document.getElementById('notifList').innerHTML = ns.map(n=>`
    <div class="nd-item"><div class="nd-dot"></div><div class="nd-ico">${n.i}</div>
    <div><div class="nd-txt">${esc(n.t)}</div><div class="nd-time">${n.d}</div></div></div>`).join('');
}
function toggleNotif() { document.getElementById('notifDrop').classList.toggle('open'); }
function openDrawer()  { document.getElementById('drawer').classList.add('open'); }
function closeDrawer() { document.getElementById('drawer').classList.remove('open'); }

// ═══════════════════════════════════════════════════
// HERO
// ═══════════════════════════════════════════════════
function buildHeroBuilding() {
  const el = document.getElementById('heroBuild');
  if (!el) return;
  const towers = [
    {floors:5,units:[0,1,1,0,1,1,1,0,1,0,1,1,0,1,1]},
    {floors:7,units:[1,1,0,1,1,0,1,1,1,0,1,0,1,1,0,1,1,0,1,1,1]},
    {floors:4,units:[0,1,1,1,0,1,0,1,1,1,0,1]},
  ];
  towers.forEach(t=>{
    const div = document.createElement('div');
    div.className='b3d-tower';
    for (let f=0;f<t.floors;f++) {
      const row=document.createElement('div');
      row.className='b3d-floor';
      row.style.cssText=`background:rgba(255,255,255,${0.02+f*0.01});animation-delay:${f*0.08}s`;
      const u1=t.units[f*2]||0, u2=t.units[f*2+1]!==undefined?t.units[f*2+1]:0;
      [u1,u2].forEach(occ=>{
        const w=document.createElement('div');
        w.className='b3d-win';
        w.style.background=occ?`rgba(255,220,120,${0.5+Math.random()*0.4})`:'rgba(255,255,255,0.05)';
        if(occ) w.style.boxShadow='0 0 4px rgba(255,200,80,.3)';
        w.onclick=()=>toast('Einheit – bitte anmelden');
        row.appendChild(w);
      });
      div.appendChild(row);
    }
    el.appendChild(div);
  });
}

function animateHeroStats() {
  function countUp(el,target,suffix='',duration=1200){
    let start=0; const step=target/(duration/16);
    const id=setInterval(()=>{ start=Math.min(start+step,target); el.textContent=Math.round(start)+suffix; if(start>=target)clearInterval(id); },16);
  }
  setTimeout(()=>{
    countUp(document.getElementById('hstatLieg'),3);
    countUp(document.getElementById('hstatWohn'),24);
    countUp(document.getElementById('hstatAusl'),88,'%');
  },600);
}

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════
function esc(str) {
  if(!str)return'';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtEur(v) {
  return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',minimumFractionDigits:0,maximumFractionDigits:0}).format(parseFloat(v)||0);
}
function fmtDate(d) {
  if(!d)return'–';
  try{return new Date(d).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});}catch(e){return d;}
}
function evClass(t){return t==='eigentümerversammlung'?'ev-cyan':t==='wartung'?'ev-gold':'ev-green';}
function evTag(t)  {return t==='eigentümerversammlung'?'tag-blue':t==='wartung'?'tag-gold':'tag-green';}
function evLabel(t){return{eigentümerversammlung:'EIGENTÜMER',wartung:'WARTUNG',besichtigung:'BESICHTIGUNG',sonstiges:'TERMIN'}[t]||'TERMIN';}
function noDaten(msg='Keine Daten vorhanden.'){return`<p style="color:var(--text3);font-size:12px;padding:8px 0">${msg}</p>`;}
function buildingMini(p) {
  const floors   = Math.min(p.anzahl_etagen || 4, 7);
  const totalWE  = p.stats?.total || 4;
  const occupied = p.stats?.occupied || 0;
  const cols     = Math.min(Math.max(Math.round(totalWE / floors), 2), 5);
  const occRate  = totalWE > 0 ? occupied / totalWE : 0.65;
  const W = 240, H = 130, GROUND = H - 14;
  const floorH   = Math.floor((GROUND - 22) / floors);
  const winW     = Math.min(Math.floor((W * 0.62) / cols) - 7, 24);
  const winH     = Math.floor(floorH * 0.54);
  const winGapX  = 7;
  const bldgW    = cols * (winW + winGapX) + winGapX + 12;
  const bldgX    = Math.round((W - bldgW) / 2);
  const bldgY    = GROUND - floors * floorH - 10;
  const bldgH    = GROUND - bldgY;
  // Stable pseudo-RNG seeded by property id
  const rng = s => (Math.abs(Math.sin(s * 9301 + p.id * 49297)) * 233280 % 233280) / 233280;
  // Windows
  let wins = '';
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const wx = bldgX + 6 + c * (winW + winGapX);
      const wy = bldgY + f * floorH + Math.floor((floorH - winH) / 2);
      const isLit = rng(f * 17 + c * 31) < (occRate * 0.82 + 0.18);
      if (isLit) {
        wins += `<rect x="${wx}" y="${wy}" width="${winW}" height="${winH}" rx="1.5" fill="#FFD95A" opacity="0.88"/>`;
        wins += `<rect x="${wx+1}" y="${wy+1}" width="${winW-2}" height="3" rx="1" fill="#fff8d0" opacity="0.45"/>`;
      } else {
        wins += `<rect x="${wx}" y="${wy}" width="${winW}" height="${winH}" rx="1.5" fill="rgba(255,255,255,0.07)"/>`;
      }
    }
  }
  // Floor lines
  const floors_lines = Array.from({length: floors - 1}, (_, f) =>
    `<line x1="${bldgX+4}" y1="${bldgY+(f+1)*floorH}" x2="${bldgX+bldgW-4}" y2="${bldgY+(f+1)*floorH}" stroke="rgba(255,255,255,0.04)" stroke-width="0.5"/>`
  ).join('');
  // Stars (stable)
  const stars = Array.from({length: 12}, (_, i) => {
    const sx = (rng(i * 41 + 3) * (W - 30) + 12).toFixed(1);
    const sy = (rng(i * 67 + 7) * (bldgY - 6) + 3).toFixed(1);
    const op = (rng(i * 13 + 1) * 0.38 + 0.14).toFixed(2);
    return `<circle cx="${sx}" cy="${sy}" r="0.8" fill="white" opacity="${op}"/>`;
  }).join('');
  // Rooftop
  const roof = p.verwaltungstyp === 'WEG'
    ? `<rect x="${bldgX + bldgW/2 - 12}" y="${bldgY-17}" width="24" height="17" rx="2" fill="rgba(42,37,30,0.92)"/>
       <rect x="${bldgX + bldgW/2 - 18}" y="${bldgY-20}" width="36" height="6" rx="1" fill="rgba(55,49,40,0.75)"/>
       <rect x="${bldgX + bldgW/2 - 2}" y="${bldgY-28}" width="4" height="10" rx="1" fill="rgba(70,62,50,0.6)"/>`
    : `<rect x="${bldgX+5}" y="${bldgY-9}" width="${bldgW-10}" height="9" rx="1.5" fill="rgba(45,40,32,0.85)"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;width:100%;height:100%;z-index:0">
    <defs>
      <linearGradient id="gs${p.id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#060504"/><stop offset="65%" stop-color="#0f0d09"/><stop offset="100%" stop-color="#1c1711"/>
      </linearGradient>
      <linearGradient id="gb${p.id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2e2820"/><stop offset="100%" stop-color="#1a1612"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#gs${p.id})"/>
    ${stars}
    <circle cx="${W-22}" cy="17" r="9" fill="rgba(255,250,215,0.1)"/>
    <circle cx="${W-19}" cy="15" r="9" fill="rgba(6,5,4,0.98)"/>
    <rect x="${bldgX+6}" y="${bldgY+7}" width="${bldgW}" height="${bldgH}" rx="3" fill="rgba(0,0,0,0.38)"/>
    <rect x="${bldgX}" y="${bldgY}" width="${bldgW}" height="${bldgH}" rx="3" fill="url(#gb${p.id})" stroke="rgba(255,255,255,0.07)" stroke-width="0.5"/>
    ${floors_lines}
    ${wins}
    ${roof}
    <rect x="${bldgX+bldgW/2-5}" y="${GROUND-10}" width="10" height="10" rx="1" fill="rgba(180,83,9,0.38)" stroke="rgba(217,119,6,0.3)" stroke-width="0.5"/>
    <rect x="0" y="${GROUND}" width="${W}" height="${H-GROUND}" fill="rgba(20,17,11,0.92)"/>
    <line x1="${bldgX-4}" y1="${GROUND}" x2="${bldgX+bldgW+4}" y2="${GROUND}" stroke="rgba(255,220,80,0.06)" stroke-width="1"/>
  </svg>`;
}

// ═══════════════════════════════════════════════════════════════
// BEWERTUNG — Immobilienbewertung · Wertentwicklung · Mietsteigerung
// ═══════════════════════════════════════════════════════════════

async function getBewertungData() {
  const liegs = await getLiegenschaften();
  window._bewLiegsCache = liegs;
  const { data: bewertungen } = await db.from('bewertungen').select('*').order('bewertungsdatum',{ascending:false});
  const { data: mietsLog }   = await db.from('mietsteigerungs_log')
    .select('*, wohneinheiten(nummer,etage,liegenschaften(name))').order('datum',{ascending:false}).limit(50);
  return { liegs, bewertungen: bewertungen||[], mietsLog: mietsLog||[] };
}

function calcErtragswert(jahresmiete, lz=0.04, bwkPct=0.20) {
  return Math.round(jahresmiete * (1-bwkPct) / lz);
}

function getMietsteigerungVPI(alteMiete, vpiAlt, vpiNeu) {
  if(!vpiAlt||!vpiNeu) return { neueMiete: alteMiete, aenderung: 0, pct: 0 };
  const neueMiete = Math.round(alteMiete*(vpiNeu/vpiAlt)*100)/100;
  return { neueMiete, aenderung: neueMiete-alteMiete, pct: ((vpiNeu/vpiAlt)-1)*100 };
}

async function tmplBewertung() {
  const { liegs, bewertungen, mietsLog } = await getBewertungData();
  const MASSNAHMEN = [
    {titel:'Heizungstausch (Wärmepumpe)',     kat:'energie', kosten:20000, wert_pct:7.0, rend:1.0, prio:1, desc:'Fossiler Ausstieg, Förderungen bis 50%, Zukunftssicherheit' },
    {titel:'Thermische Sanierung (Fassade)',  kat:'energie', kosten:18000, wert_pct:6.0, rend:0.8, prio:1, desc:'Energieausweis +1-2 Klassen, Heizkostensenkung ~30%' },
    {titel:'Dachdämmung / Dachsanierung',     kat:'energie', kosten:22000, wert_pct:5.0, rend:0.5, prio:1, desc:'Pflicht bei >20% Wärmedurchgang, förderfähig' },
    {titel:'Lifteinbau',                      kat:'komfort', kosten:45000, wert_pct:12.0,rend:1.5, prio:2, desc:'Barrierefreiheit, OG-Wohnungen +15-20% wertvoller' },
    {titel:'Photovoltaikanlage',              kat:'energie', kosten:15000, wert_pct:2.5, rend:1.2, prio:2, desc:'Mieterstrommodell möglich, Gemeinschaftsstrom' },
    {titel:'Fenstererneuerung (3-fach)',      kat:'energie', kosten: 8500, wert_pct:3.0, rend:0.4, prio:2, desc:'Schallschutz, Wärmeschutz, Sicherheit' },
    {titel:'Badezimmersanierung je WE',       kat:'innen',   kosten: 6500, wert_pct:5.0, rend:0.6, prio:3, desc:'Zeitgemäße Ausstattung, höhere Mietpreise erreichbar' },
    {titel:'Photovoltaik + Batteriespeicher', kat:'energie', kosten:22000, wert_pct:3.5, rend:1.5, prio:2, desc:'Energieautarkie, E-Ladestationen möglich' },
    {titel:'Smart-Home / Videogegensprechanlage', kat:'komfort', kosten:3200, wert_pct:1.0, rend:0.3, prio:3, desc:'App-Zugang, Türkamera, Mehrwert für Mieter' },
    {titel:'Allgemeinflächengestaltung',      kat:'außen',   kosten: 4500, wert_pct:1.5, rend:0.2, prio:3, desc:'Eingang, Stiegenhaus, Briefkastenanlage — erster Eindruck' },
    {titel:'Kellerausbau / Abstellräume',     kat:'fläche',  kosten: 9000, wert_pct:2.0, rend:0.4, prio:3, desc:'Zusätzliche Mieteinnahmen, Nachfrage hoch' },
  ].sort((a,b)=>(b.wert_pct/b.kosten)-(a.wert_pct/a.kosten));

  const portfolio = liegs.map(l => {
    const jahresmiete = (l.stats?.total_miete||0)*12;
    const ertragswert = calcErtragswert(jahresmiete);
    const lastBew = bewertungen.find(b=>b.liegenschaft_id===l.id);
    const flaeche = l.nutzflaeche_m2 || (l.stats?.total||0)*65;
    return { ...l, jahresmiete, ertragswert, flaeche, lastBew };
  });
  const totalWert = portfolio.reduce((a,l)=>a+l.ertragswert,0);
  const totalJM   = portfolio.reduce((a,l)=>a+l.jahresmiete,0);
  const avgRend   = totalWert>0?(totalJM/totalWert*100):0;
  const liegsOpts = liegs.map(l=>`<option value="${l.id}">${esc(l.name)} — ${esc(l.ort)}</option>`).join('');
  const katClr    = {energie:'var(--blue)',innen:'var(--teal2)',komfort:'var(--gold)',außen:'var(--green)',fläche:'var(--purple2)'};

  const portfolioRows = portfolio.map((l,i)=>{
    const rend = l.ertragswert>0?(l.jahresmiete/l.ertragswert*100):0;
    const m2   = l.flaeche>0?Math.round(l.ertragswert/l.flaeche):0;
    return `<tr style="${i%2?'background:var(--bg2)':''};border-bottom:1px solid var(--border);cursor:pointer" onclick="bevSelectLieg(${l.id})">
      <td style="padding:11px 14px"><div style="font-weight:700;color:var(--text1)">${esc(l.name)}</div><div style="font-size:11px;color:var(--text3)">${esc(l.strasse)}, ${esc(l.plz)} ${esc(l.ort)}</div></td>
      <td style="padding:11px 14px;text-align:right">${l.stats?.total||0}</td>
      <td style="padding:11px 14px;text-align:right;font-weight:600;color:var(--green)">${fmtEur(l.jahresmiete)}</td>
      <td style="padding:11px 14px;text-align:right;font-weight:700;color:var(--gold)">${fmtEur(l.ertragswert)}</td>
      <td style="padding:11px 14px;text-align:right"><span style="color:${rend>=4?'var(--green)':rend>=3?'var(--gold)':'var(--red)'}">${rend.toFixed(2)}%</span></td>
      <td style="padding:11px 14px;text-align:right;color:var(--text2)">${m2>0?fmtEur(m2)+'/m²':'-'}</td>
      <td style="padding:11px 14px;text-align:center;font-size:11px;color:var(--text3)">${l.lastBew?fmtDate(l.lastBew.bewertungsdatum):'<span style="color:var(--red)">offen</span>'}</td>
      <td style="padding:11px 14px;text-align:center"><button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();bevSelectLieg(${l.id})">Detail →</button></td>
    </tr>`;
  }).join('');

  const mietsLogHtml = mietsLog.length===0 ? noDaten('Noch keine Anpassungen protokolliert.') :
    mietsLog.slice(0,10).map(m=>`<div class="tx-item">
      <div class="tx-ico" style="background:var(--green3)">📈</div>
      <div class="tx-body">
        <div class="tx-name">${esc(m.wohneinheiten?.liegenschaften?.name||'')} · WE ${esc(m.wohneinheiten?.nummer||'')}</div>
        <div class="tx-meta">${fmtDate(m.datum)} · ${esc(m.grund||'VPI-Anpassung')}</div>
      </div>
      <div class="tx-amt tx-in">+${fmtEur((m.neue_miete||0)-(m.alte_miete||0))}/Mo</div>
    </div>`).join('');

  const massnahmenCards = MASSNAHMEN.map(m=>{
    const kc = katClr[m.kat]||'var(--text2)';
    return `<div class="card" style="padding:16px;transition:transform .15s" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <div>
          <div style="font-weight:700;font-size:13px;color:var(--text1)">${esc(m.titel)}</div>
          <span style="font-size:10px;padding:2px 7px;border-radius:10px;background:${kc}22;color:${kc};font-weight:600;text-transform:uppercase">${m.kat}</span>
        </div>
        <div style="padding:3px 9px;border-radius:10px;font-size:10px;font-weight:700;background:${m.prio===1?'var(--red3)':m.prio===2?'var(--gold3)':'var(--green3)'};color:${m.prio===1?'var(--red)':m.prio===2?'var(--gold)':'var(--green)'}">${m.prio===1?'⬆ Hoch':m.prio===2?'↔ Mittel':'↓ Optional'}</div>
      </div>
      <p style="font-size:11px;color:var(--text3);margin:0 0 12px;line-height:1.5">${esc(m.desc)}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;text-align:center;margin-bottom:10px">
        <div style="background:var(--bg2);border-radius:8px;padding:7px">
          <div style="font-size:10px;color:var(--text3)">Investition</div>
          <div style="font-weight:700;color:var(--red);font-size:12px">${fmtEur(m.kosten)}</div>
        </div>
        <div style="background:var(--bg2);border-radius:8px;padding:7px">
          <div style="font-size:10px;color:var(--text3)">Wertsteigerung</div>
          <div style="font-weight:700;color:var(--green);font-size:12px">+${m.wert_pct}%</div>
        </div>
        <div style="background:var(--bg2);border-radius:8px;padding:7px">
          <div style="font-size:10px;color:var(--text3)">Rendite +</div>
          <div style="font-weight:700;color:var(--blue);font-size:12px">+${m.rend}%</div>
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-sm btn-primary" style="flex:1" onclick="planMassnahme('${esc(m.titel)}',${m.kosten},${m.wert_pct})">+ Planen</button>
        <button class="btn btn-sm btn-ghost" onclick="foerderInfo('${m.kat}')">🔍 Förderung</button>
      </div>
    </div>`;
  }).join('');

  return `
<div style="max-width:1100px;margin:0 auto">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
    <div>
      <h2 style="margin:0;font-size:20px;color:var(--text1)">📊 Immobilienbewertung &amp; Wertentwicklung</h2>
      <p style="margin:4px 0 0;font-size:12px;color:var(--text3)">Ertragswert · Vergleichswert · Mietsteigerungen · Maßnahmen-ROI</p>
    </div>
  </div>
  <div class="kpi-grid" style="margin-bottom:20px">
    <div class="kpi-card" style="border-left:3px solid var(--gold2)">
      <div class="kpi-label">Portfolio-Gesamtwert</div>
      <div class="kpi-value kv-gold">${fmtEur(totalWert)}</div>
      <div class="kpi-sub">Ertragswert · ${liegs.length} Liegenschaften</div><div class="kpi-icon">🏛️</div>
    </div>
    <div class="kpi-card" style="border-left:3px solid var(--blue2)">
      <div class="kpi-label">Jahres-Mietertrag</div>
      <div class="kpi-value kv-blue">${fmtEur(totalJM)}</div>
      <div class="kpi-sub">${fmtEur(totalJM/12)}/Monat</div><div class="kpi-icon">💶</div>
    </div>
    <div class="kpi-card" style="border-left:3px solid var(--green2)">
      <div class="kpi-label">⌀ Bruttorendite</div>
      <div class="kpi-value kv-green">${avgRend.toFixed(2)}%</div>
      <div class="kpi-sub">Mietrendite Portfolio</div><div class="kpi-icon">📈</div>
    </div>
    <div class="kpi-card" style="border-left:3px solid var(--teal2)">
      <div class="kpi-label">Wohneinheiten</div>
      <div class="kpi-value kv-teal">${liegs.reduce((a,l)=>a+(l.stats?.total||0),0)}</div>
      <div class="kpi-sub">${liegs.length} Liegenschaften</div><div class="kpi-icon">🏠</div>
    </div>
  </div>
  <div style="display:flex;gap:6px;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:10px">
    <button onclick="bevTab('bev-portfolio')"  id="btab-bev-portfolio"  class="nav-link active" style="font-size:12px;padding:7px 14px">🏛 Portfolio-Wert</button>
    <button onclick="bevTab('bev-detail')"     id="btab-bev-detail"     class="nav-link"        style="font-size:12px;padding:7px 14px">🔍 Detailbewertung</button>
    <button onclick="bevTab('bev-miete')"      id="btab-bev-miete"      class="nav-link"        style="font-size:12px;padding:7px 14px">📈 Mietsteigerungen</button>
    <button onclick="bevTab('bev-massnahmen')" id="btab-bev-massnahmen" class="nav-link"        style="font-size:12px;padding:7px 14px">🔧 Maßnahmen-ROI</button>
  </div>

  <div id="bev-portfolio">
    <div class="card" style="padding:0;overflow:hidden">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:var(--bg2);border-bottom:2px solid var(--border)">
          <th style="padding:11px 14px;text-align:left;color:var(--text2)">Liegenschaft</th>
          <th style="padding:11px 14px;text-align:right;color:var(--text2)">WE</th>
          <th style="padding:11px 14px;text-align:right;color:var(--text2)">Jahresmiete</th>
          <th style="padding:11px 14px;text-align:right;color:var(--text2)">Ertragswert</th>
          <th style="padding:11px 14px;text-align:right;color:var(--text2)">Rendite</th>
          <th style="padding:11px 14px;text-align:right;color:var(--text2)">€/m²</th>
          <th style="padding:11px 14px;text-align:center;color:var(--text2)">Bewertet</th>
          <th style="padding:11px 14px;text-align:center;color:var(--text2)">Detail</th>
        </tr></thead>
        <tbody>${portfolioRows}</tbody>
        <tfoot><tr style="background:var(--bg3);border-top:2px solid var(--border);font-weight:700">
          <td style="padding:11px 14px">Gesamt</td>
          <td style="padding:11px 14px;text-align:right">${liegs.reduce((a,l)=>a+(l.stats?.total||0),0)}</td>
          <td style="padding:11px 14px;text-align:right;color:var(--green)">${fmtEur(totalJM)}</td>
          <td style="padding:11px 14px;text-align:right;color:var(--gold)">${fmtEur(totalWert)}</td>
          <td style="padding:11px 14px;text-align:right;color:var(--blue)">${avgRend.toFixed(2)}%</td>
          <td colspan="3"></td>
        </tr></tfoot>
      </table>
    </div>
    <p style="font-size:11px;color:var(--text3);margin-top:10px;padding:0 4px">
      ⓘ <strong>Ertragswertverfahren</strong> (§16 ImmoWertV): Jahresreinertrag (Miete −20% BWK) ÷ Liegenschaftszinssatz 4,0%.
      Interne Planungshilfe — keine Haftung für Kaufentscheidungen.
    </p>
  </div>

  <div id="bev-detail" style="display:none">
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:5px">Liegenschaft</label>
          <select id="bewLiegSel" onchange="renderBewertungDetail(this.value)" style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text1);font-size:13px">
            <option value="">— bitte wählen —</option>${liegsOpts}
          </select>
        </div>
        <div>
          <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:5px">Liegenschaftszinssatz</label>
          <select id="bewLiegZins" onchange="renderBewertungDetail(document.getElementById('bewLiegSel').value)" style="padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text1);font-size:13px">
            <option value="0.030">3,0% — Toplage</option>
            <option value="0.035">3,5% — Gute Lage</option>
            <option value="0.040" selected>4,0% — Normallage</option>
            <option value="0.045">4,5% — Einfache Lage</option>
            <option value="0.050">5,0% — Randlage</option>
          </select>
        </div>
      </div>
    </div>
    <div id="bevDetailContent">${noDaten('Liegenschaft wählen um Detailbewertung anzuzeigen.')}</div>
  </div>

  <div id="bev-miete" style="display:none">
    <div class="card" style="margin-bottom:16px">
      <div class="card-title">📈 Gesetzliche Mietsteigerung — VPI-Anpassung</div>
      <div style="background:var(--bg3);border-radius:10px;padding:14px;margin-bottom:16px;font-size:12px;line-height:1.8;color:var(--text2)">
        <strong>🇦🇹 Österreich MRG §16:</strong> Indexmiete — Anpassung sobald VPI ≥ 5% Schwelle überschritten. Richtwert-VPI: <strong>111,8</strong> (Basis 2020=100, Jan. 2024).<br>
        <strong>🇩🇪 Deutschland §558 BGB:</strong> Max. +20% in 36 Monaten, Mietspiegel als Obergrenze. Indexmiete §557b BGB: jährliche VPI-Anpassung wenn vertraglich vereinbart.
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px">
        <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Liegenschaft</label>
          <select id="mietLiegSel" onchange="loadMietWE(this.value)" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text1);font-size:12px">
            <option value="">— wählen —</option>${liegsOpts}
          </select>
        </div>
        <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">VPI Basis (alt)</label>
          <input id="mietVpiAlt" type="number" value="100" step="0.1" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text1);font-size:12px" oninput="refreshMietCalc()">
        </div>
        <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">VPI aktuell (neu)</label>
          <input id="mietVpiNeu" type="number" value="111.8" step="0.1" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text1);font-size:12px" oninput="refreshMietCalc()">
        </div>
        <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Steigerung</label>
          <div id="mietPctBadge" style="padding:8px;border-radius:8px;background:var(--green3);color:var(--green);font-weight:700;font-size:15px;text-align:center">+11,80%</div>
        </div>
      </div>
      <div id="mietWETable">${noDaten('Liegenschaft wählen für WE-Liste.')}</div>
    </div>
    <div class="card"><div class="card-title">📋 Letzte Mietanpassungen</div><div id="mietLogList">${mietsLogHtml}</div></div>
  </div>

  <div id="bev-massnahmen" style="display:none">
    <p style="font-size:12px;color:var(--text3);margin-bottom:14px">Empfehlungen nach Preis/Leistung-Ratio sortiert — ROI-Analyse für nachhaltige Wertsteigerung.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">${massnahmenCards}</div>
  </div>
</div>`;
}

function bevTab(id) {
  ['bev-portfolio','bev-detail','bev-miete','bev-massnahmen'].forEach(t=>{
    const el=document.getElementById(t); if(el) el.style.display=t===id?'':'none';
    const btn=document.getElementById('btab-'+t); if(btn) btn.classList.toggle('active',t===id);
  });
}

function bevSelectLieg(id) {
  bevTab('bev-detail');
  const sel=document.getElementById('bewLiegSel'); if(sel) sel.value=id;
  renderBewertungDetail(id);
}

async function renderBewertungDetail(liegenschaftId) {
  const el=document.getElementById('bevDetailContent');
  if(!el) return;
  if(!liegenschaftId){ el.innerHTML=noDaten('Liegenschaft wählen.'); return; }
  el.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3)">⏳ Berechnung…</div>';
  const lz=parseFloat(document.getElementById('bewLiegZins')?.value)||0.04;
  const { data:prop }   = await db.from('liegenschaften').select('*').eq('id',liegenschaftId).single();
  const { data:wes }    = await db.from('wohneinheiten').select('*, mieter:mieter_id(first_name,last_name)').eq('liegenschaft_id',liegenschaftId).order('etage').order('nummer');
  const { data:hist }   = await db.from('bewertungen').select('*').eq('liegenschaft_id',liegenschaftId).order('bewertungsdatum',{ascending:false}).limit(12);
  const we=wes||[];
  const jahresmiete=we.reduce((a,w)=>a+(parseFloat(w.nettomiete)||0)*12,0);
  const jahresNK   =we.reduce((a,w)=>a+(parseFloat(w.nebenkosten)||0)*12,0);
  const bwkPct=0.20;
  const reinertrag=jahresmiete*(1-bwkPct);
  const ertragswert=Math.round(reinertrag/lz);
  const flaeche=prop?.nutzflaeche_m2||we.length*65;
  const m2Wert=flaeche>0?Math.round(ertragswert/flaeche):0;
  const rendite=ertragswert>0?(jahresmiete/ertragswert*100):0;
  const belegung=we.length>0?Math.round(we.filter(w=>w.status==='occupied').length/we.length*100):0;

  const weRows=we.map(w=>{
    const jm=(parseFloat(w.nettomiete)||0)*12;
    const wv=jm>0?Math.round(jm*(1-bwkPct)/lz):0;
    const mn=w.mieter?esc(w.mieter.first_name+' '+w.mieter.last_name):(w.mieter_vorname?esc(w.mieter_vorname+' '+w.mieter_nachname):'<span style="color:var(--text3)">leer</span>');
    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:9px 12px"><strong>WE ${esc(w.nummer)}</strong> <span style="font-size:11px;color:var(--text3)">E${w.etage||0}</span></td>
      <td style="padding:9px 12px;font-size:11px;color:var(--text2)">${mn}</td>
      <td style="padding:9px 12px;text-align:right">${fmtEur(parseFloat(w.nettomiete)||0)}/Mo</td>
      <td style="padding:9px 12px;text-align:right;font-weight:700;color:var(--gold)">${wv>0?fmtEur(wv):'-'}</td>
      <td style="padding:9px 12px;text-align:center"><span style="padding:2px 8px;border-radius:8px;font-size:10px;background:${w.status==='occupied'?'var(--green3)':'var(--red3)'};color:${w.status==='occupied'?'var(--green)':'var(--red)'}">${w.status==='occupied'?'vermietet':'leer'}</span></td>
    </tr>`;
  }).join('');

  const histHtml=(hist||[]).length>0
    ?`<table style="width:100%;border-collapse:collapse;font-size:12px">
      <tr style="background:var(--bg2)"><th style="padding:8px;text-align:left">Datum</th><th style="padding:8px;text-align:left">Methode</th><th style="padding:8px;text-align:right">Wert</th><th style="padding:8px;text-align:left">Notiz</th></tr>
      ${(hist||[]).map(b=>`<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:8px">${fmtDate(b.bewertungsdatum)}</td>
        <td style="padding:8px;color:var(--text3)">${esc(b.methode||'Ertragswert')}</td>
        <td style="padding:8px;text-align:right;font-weight:700;color:var(--gold)">${fmtEur(b.wert)}</td>
        <td style="padding:8px;font-size:11px;color:var(--text3)">${esc(b.notiz||'')}</td>
      </tr>`).join('')}
    </table>`
    :noDaten('Noch keine gespeicherten Bewertungen.');

  el.innerHTML=`
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-bottom:16px">
    <div class="kpi-card" style="border-left:3px solid var(--gold2)">
      <div class="kpi-label">Ertragswert (LZ ${(lz*100).toFixed(1)}%)</div>
      <div class="kpi-value kv-gold">${fmtEur(ertragswert)}</div>
      <div class="kpi-sub">Reinertrag: ${fmtEur(reinertrag)}/Jahr</div><div class="kpi-icon">🏛️</div>
    </div>
    <div class="kpi-card" style="border-left:3px solid var(--blue2)">
      <div class="kpi-label">Wert pro m²</div>
      <div class="kpi-value kv-blue">${fmtEur(m2Wert)}</div>
      <div class="kpi-sub">Fläche: ~${flaeche} m²</div><div class="kpi-icon">📐</div>
    </div>
    <div class="kpi-card" style="border-left:3px solid var(--green2)">
      <div class="kpi-label">Jahres-Mietertrag</div>
      <div class="kpi-value kv-green">${fmtEur(jahresmiete)}</div>
      <div class="kpi-sub">Rendite: ${rendite.toFixed(2)}% brutto</div><div class="kpi-icon">💶</div>
    </div>
    <div class="kpi-card" style="border-left:3px solid var(--teal2)">
      <div class="kpi-label">Belegungsgrad</div>
      <div class="kpi-value ${belegung===100?'kv-green':belegung>=80?'kv-gold':'kv-red'}">${belegung}%</div>
      <div class="kpi-sub">${we.filter(w=>w.status==='occupied').length}/${we.length} WE belegt</div><div class="kpi-icon">🏠</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
    <div class="card">
      <div class="card-title">🏠 WE-Einzelbewertung</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <tr style="background:var(--bg2)">
            <th style="padding:8px 12px;text-align:left">WE</th>
            <th style="padding:8px 12px;text-align:left">Mieter</th>
            <th style="padding:8px 12px;text-align:right">Miete</th>
            <th style="padding:8px 12px;text-align:right">Wert</th>
            <th style="padding:8px 12px;text-align:center">Status</th>
          </tr>
          ${weRows}
          <tr style="background:var(--bg3);font-weight:700;border-top:2px solid var(--border)">
            <td colspan="2" style="padding:9px 12px">Gesamt</td>
            <td style="padding:9px 12px;text-align:right;color:var(--green)">${fmtEur(we.reduce((a,w)=>a+(parseFloat(w.nettomiete)||0),0))}/Mo</td>
            <td style="padding:9px 12px;text-align:right;color:var(--gold)">${fmtEur(ertragswert)}</td>
            <td></td>
          </tr>
        </table>
      </div>
    </div>
    <div class="card">
      <div class="card-title">📋 Berechnungsgrundlage</div>
      <div style="font-size:12px;line-height:1.9;color:var(--text2)">
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)"><span>Jahresmiete brutto</span><strong>${fmtEur(jahresmiete)}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)"><span>Bewirtschaftungskosten (−20%)</span><strong style="color:var(--red)">−${fmtEur(jahresmiete*bwkPct)}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-weight:700"><span>Jahresreinertrag</span><strong style="color:var(--gold)">${fmtEur(reinertrag)}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)"><span>÷ Liegenschaftszinssatz</span><strong>${(lz*100).toFixed(1)}%</strong></div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:15px;font-weight:700"><span>= Ertragswert</span><strong style="color:var(--gold)">${fmtEur(ertragswert)}</strong></div>
        <div style="margin-top:10px;padding:10px;background:var(--bg2);border-radius:8px">
          <div style="font-size:10px;color:var(--text3);margin-bottom:6px">VERGLEICHSWERT (€/m² eingeben)</div>
          <div style="display:flex;gap:8px;align-items:center">
            <input id="vglPreisM2" type="number" placeholder="€/m²" value="3200" style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text1);font-size:12px" oninput="updateVglWert(${flaeche})">
            <span style="font-size:11px;color:var(--text2)">× ${flaeche} m²</span>
          </div>
          <div id="vglWertResult" style="margin-top:6px;font-weight:700;font-size:13px;color:var(--blue)">${fmtEur(3200*flaeche)} (Vergleichswert)</div>
        </div>
      </div>
      <button class="btn btn-primary" style="width:100%;margin-top:12px" onclick="saveBewertungModal(${liegenschaftId},${ertragswert})">💾 Bewertung speichern</button>
    </div>
  </div>
  <div class="card">
    <div class="card-title">📈 Bewertungshistorie</div>${histHtml}
  </div>`;
}

function updateVglWert(flaeche) {
  const p=parseFloat(document.getElementById('vglPreisM2')?.value)||0;
  const el=document.getElementById('vglWertResult');
  if(el) el.textContent=fmtEur(p*flaeche)+' (Vergleichswert)';
}

async function loadMietWE(liegenschaftId) {
  const el=document.getElementById('mietWETable'); if(!el) return;
  if(!liegenschaftId){ el.innerHTML=noDaten('Liegenschaft wählen.'); return; }
  const { data:wes } = await db.from('wohneinheiten')
    .select('*, mieter:mieter_id(first_name,last_name)').eq('liegenschaft_id',liegenschaftId).eq('status','occupied').order('etage').order('nummer');
  window._mietWEs = wes||[];
  refreshMietCalc();
}

function refreshMietCalc() {
  const vpiAlt=parseFloat(document.getElementById('mietVpiAlt')?.value)||100;
  const vpiNeu=parseFloat(document.getElementById('mietVpiNeu')?.value)||100;
  const pct=((vpiNeu/vpiAlt)-1)*100;
  const badge=document.getElementById('mietPctBadge');
  if(badge){
    badge.textContent=(pct>=0?'+':'')+pct.toFixed(2)+'%';
    badge.style.background=pct>0?'var(--green3)':'var(--red3)';
    badge.style.color=pct>0?'var(--green)':'var(--red)';
  }
  const wes=window._mietWEs||[];
  if(!wes.length) return;
  const el=document.getElementById('mietWETable'); if(!el) return;
  const rows=wes.map(w=>{
    const alte=parseFloat(w.nettomiete)||0;
    const { neueMiete, aenderung }=getMietsteigerungVPI(alte,vpiAlt,vpiNeu);
    const mn=w.mieter?esc(w.mieter.first_name+' '+w.mieter.last_name):(esc(w.mieter_vorname||'')+' '+esc(w.mieter_nachname||'')).trim();
    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:9px 12px"><strong>WE ${esc(w.nummer)}</strong> <span style="font-size:11px;color:var(--text3)">E${w.etage||0}</span></td>
      <td style="padding:9px 12px;font-size:12px;color:var(--text2)">${mn||'–'}</td>
      <td style="padding:9px 12px;text-align:right">${fmtEur(alte)}</td>
      <td style="padding:9px 12px;text-align:right;font-weight:700;color:var(--green)">${fmtEur(neueMiete)}</td>
      <td style="padding:9px 12px;text-align:right;color:${aenderung>=0?'var(--green)':'var(--red)'};font-weight:600">${aenderung>=0?'+':''}${fmtEur(aenderung)}/Mo</td>
      <td style="padding:9px 12px">
        <button class="btn btn-sm btn-primary" onclick="applyMietsteigerung(${w.id},${alte},${neueMiete},'VPI ${vpiAlt}→${vpiNeu}')">Anwenden</button>
      </td>
    </tr>`;
  }).join('');
  el.innerHTML=`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
    <tr style="background:var(--bg2)">
      <th style="padding:8px 12px;text-align:left">WE</th><th style="padding:8px 12px;text-align:left">Mieter</th>
      <th style="padding:8px 12px;text-align:right">Aktuell</th><th style="padding:8px 12px;text-align:right">Nach Anpassung</th>
      <th style="padding:8px 12px;text-align:right">+/−</th><th style="padding:8px 12px">Aktion</th>
    </tr>${rows}
  </table></div>
  <div style="margin-top:12px;display:flex;gap:10px">
    <button class="btn btn-primary" onclick="applyAlleMietsteigerungen()">✓ Alle ${wes.length} WE anwenden</button>
  </div>`;
}

async function applyMietsteigerung(weId, alteMiete, neueMiete, grund) {
  if(!confirm('Mietanpassung:\n'+fmtEur(alteMiete)+' → '+fmtEur(neueMiete)+'/Monat\n\nAnwenden?')) return;
  const { error }=await db.from('wohneinheiten').update({nettomiete:neueMiete}).eq('id',weId);
  if(error){ toast('Fehler: '+error.message); return; }
  await db.from('mietsteigerungs_log').insert({wohneinheit_id:weId,datum:new Date().toISOString().split('T')[0],alte_miete:alteMiete,neue_miete:neueMiete,grund});
  toast('Mietanpassung gespeichert!');
  loadMietWE(document.getElementById('mietLiegSel')?.value);
}

async function applyAlleMietsteigerungen() {
  const wes=window._mietWEs||[]; if(!wes.length) return;
  const vpiAlt=parseFloat(document.getElementById('mietVpiAlt').value)||100;
  const vpiNeu=parseFloat(document.getElementById('mietVpiNeu').value)||100;
  if(!confirm('Alle '+wes.length+' Wohneinheiten anpassen?\nVPI: '+vpiAlt+' → '+vpiNeu)) return;
  for(const w of wes){
    const alte=parseFloat(w.nettomiete)||0;
    const { neueMiete }=getMietsteigerungVPI(alte,vpiAlt,vpiNeu);
    await db.from('wohneinheiten').update({nettomiete:neueMiete}).eq('id',w.id);
    await db.from('mietsteigerungs_log').insert({wohneinheit_id:w.id,datum:new Date().toISOString().split('T')[0],alte_miete:alte,neue_miete:neueMiete,grund:'VPI '+vpiAlt+'→'+vpiNeu});
  }
  toast(wes.length+' Mieten erfolgreich angepasst!');
  loadMietWE(document.getElementById('mietLiegSel')?.value);
}

function saveBewertungModal(liegenschaftId, ertragswert) {
  const html=`
    <div class="modal-header"><h3 style="margin:0">💾 Bewertung speichern</h3></div>
    <div class="modal-body" style="padding:20px;display:grid;gap:14px">
      <div><label style="font-size:11px;color:var(--text3)">Bewertungswert (€)</label>
        <input id="sbWert" type="number" value="${ertragswert}" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text1);margin-top:4px">
      </div>
      <div><label style="font-size:11px;color:var(--text3)">Methode</label>
        <select id="sbMethode" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text1);margin-top:4px">
          <option value="ertragswert">Ertragswertverfahren</option>
          <option value="vergleichswert">Vergleichswertverfahren</option>
          <option value="sachwert">Sachwertverfahren</option>
          <option value="gutachten">Externes Gutachten</option>
        </select>
      </div>
      <div><label style="font-size:11px;color:var(--text3)">Datum</label>
        <input id="sbDatum" type="date" value="${new Date().toISOString().split('T')[0]}" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text1);margin-top:4px">
      </div>
      <div><label style="font-size:11px;color:var(--text3)">Notiz</label>
        <textarea id="sbNotiz" rows="2" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text1);resize:vertical;margin-top:4px"></textarea>
      </div>
      <button class="btn btn-primary" onclick="saveBewertungDB(${liegenschaftId})">💾 Speichern</button>
    </div>`;
  document.getElementById('modalBody').innerHTML=html;
  document.getElementById('appModal').classList.add('open');
}

async function saveBewertungDB(liegenschaftId) {
  const wert=parseFloat(document.getElementById('sbWert').value);
  const methode=document.getElementById('sbMethode').value;
  const datum=document.getElementById('sbDatum').value;
  const notiz=document.getElementById('sbNotiz').value;
  const { error }=await db.from('bewertungen').insert({liegenschaft_id:liegenschaftId,wert,methode,bewertungsdatum:datum,notiz,erstellt_von:APP.userId});
  if(error){ toast('Fehler: '+error.message); return; }
  toast('Bewertung gespeichert!');
  closeModal();
  renderBewertungDetail(liegenschaftId);
}

function planMassnahme(titel, kosten, wert_pct) {
  const liegsOpts=(window._bewLiegsCache||[]).map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join('');
  const html=`
    <div class="modal-header"><h3 style="margin:0">🔧 Maßnahme planen</h3></div>
    <div class="modal-body" style="padding:20px;display:grid;gap:12px">
      <div><label style="font-size:11px;color:var(--text3)">Maßnahme</label>
        <input id="pmTitel" type="text" value="${esc(titel)}" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text1);margin-top:4px">
      </div>
      <div><label style="font-size:11px;color:var(--text3)">Liegenschaft</label>
        <select id="pmLieg" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text1);margin-top:4px">${liegsOpts}</select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="font-size:11px;color:var(--text3)">Kosten (€)</label>
          <input id="pmKosten" type="number" value="${kosten}" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text1);margin-top:4px">
        </div>
        <div><label style="font-size:11px;color:var(--text3)">Wertsteigerung (%)</label>
          <input id="pmWert" type="number" value="${wert_pct}" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text1);margin-top:4px">
        </div>
      </div>
      <div><label style="font-size:11px;color:var(--text3)">Geplant für</label>
        <input id="pmDatum" type="date" value="${new Date(Date.now()+90*864e5).toISOString().split('T')[0]}" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text1);margin-top:4px">
      </div>
      <button class="btn btn-primary" onclick="saveMassnahmeDB()">📋 In Planung aufnehmen</button>
    </div>`;
  document.getElementById('modalBody').innerHTML=html;
  document.getElementById('appModal').classList.add('open');
}

async function saveMassnahmeDB() {
  const titel=document.getElementById('pmTitel').value;
  const liegenschaft_id=document.getElementById('pmLieg').value;
  const kosten=parseFloat(document.getElementById('pmKosten').value);
  const wertsteigerung_pct=parseFloat(document.getElementById('pmWert').value);
  const geplant_datum=document.getElementById('pmDatum').value;
  const { error }=await db.from('massnahmen').insert({titel,liegenschaft_id,kosten_geschaetzt:kosten,wertsteigerung_pct,status:'geplant',geplant_datum});
  if(error){ toast('Fehler: '+error.message); return; }
  toast('Maßnahme eingeplant!');
  closeModal();
}

function foerderInfo(kat) {
  const info={
    energie:'🇦🇹 AT: Sanierungsscheck (bis €14.000), Raus-aus-Gas-Förderung, Klimabonus\n🇩🇪 DE: BEG-Förderung BAFA/KfW bis 35% Zuschuss, §35c EStG Steuerabzug',
    komfort:'🇦🇹 AT: Barrierefreiheit-Förderung Länder, WBF\n🇩🇪 DE: KfW 455, Pflegeversicherung §40 SGB XI',
    innen:'🇦🇹 AT: Wohnbauförderung bei Mietgebäuden\n🇩🇪 DE: Modernisierungsumlage §559 BGB (8%/Jahr der Kosten)',
    außen:'Keine spezifische Förderung — steuerlich als Erhaltungsaufwand absetzbar',
    fläche:'🇦🇹 AT: Wohnbauförderung bei Ausbau\n🇩🇪 DE: Steuerliche AfA bei Umbaumaßnahmen',
  };
  alert(info[kat]||'Keine Förderinfo verfügbar.');
}

// ═══════════════════════════════════════════════════
// NEUE SCHADENSMELDUNG
// ═══════════════════════════════════════════════════
async function openNeueSchadenModal() {
  const liegs = APP.allLiegs || await getLiegenschaften();
  const { data: dls } = await db.from('dienstleister').select('id,name,kategorie').order('name');
  const liegsOpts = liegs.map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join('');
  const dlOpts = `<option value="">– kein Dienstleister –</option>`+(dls||[]).map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('');
  document.getElementById('modalTitle').textContent = '🔧 Neue Schadensmeldung';
  document.getElementById('modalBody').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="form-group"><label class="form-label">Liegenschaft *</label>
        <select id="nsLieg" class="form-input" onchange="nsLiegChanged(this.value)">${liegsOpts}</select></div>
      <div class="form-group"><label class="form-label">Wohneinheit (optional)</label>
        <select id="nsWE" class="form-input"><option value="">– gesamte Liegenschaft –</option></select></div>
      <div class="form-group"><label class="form-label">Titel *</label>
        <input id="nsTitel" class="form-input" placeholder="z.B. Wasserhahn tropft Wohnung 101"></div>
      <div class="form-group"><label class="form-label">Beschreibung</label>
        <textarea id="nsBeschr" class="form-input" rows="3" placeholder="Details zum Schaden..."></textarea></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group"><label class="form-label">Priorität *</label>
          <select id="nsPrio" class="form-input">
            <option value="niedrig">🟢 Niedrig</option>
            <option value="mittel" selected>🟡 Mittel</option>
            <option value="hoch">🔴 Hoch</option>
            <option value="notfall">🚨 NOTFALL</option>
          </select></div>
        <div class="form-group"><label class="form-label">Gemeldet von</label>
          <input id="nsGemeldetVon" class="form-input" placeholder="Name des Melders"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group"><label class="form-label">Gemeldet via</label>
          <select id="nsVia" class="form-input">
            <option value="persönlich">🤝 Persönlich</option>
            <option value="Telefon">📞 Telefon</option>
            <option value="E-Mail">✉️ E-Mail</option>
            <option value="App" selected>📱 App</option>
          </select></div>
        <div class="form-group"><label class="form-label">Kostenträger</label>
          <select id="nsKt" class="form-input">
            <option value="eigentuemer">Eigentümer</option>
            <option value="versicherung">Versicherung</option>
            <option value="mieter">Mieter</option>
            <option value="verwaltung">Verwaltung</option>
          </select></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group"><label class="form-label">Geschätzte Kosten (€)</label>
          <input id="nsKosten" type="number" class="form-input" placeholder="0"></div>
        <div class="form-group"><label class="form-label">Dienstleister</label>
          <select id="nsDL" class="form-input">${dlOpts}</select></div>
      </div>
      <div class="form-group"><label class="form-label">Notiz (intern)</label>
        <textarea id="nsNotiz" class="form-input" rows="2" placeholder="Interne Verwalter-Notiz..."></textarea></div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-gold" onclick="saveNeueSchaden()">💾 Meldung speichern</button>
        <button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>
      </div>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
  // Wohneinheiten für erste Liegenschaft laden
  if (liegs.length) nsLiegChanged(liegs[0].id);
}

async function nsLiegChanged(liegId) {
  const { data: wes } = await db.from('wohneinheiten').select('id,nummer').eq('liegenschaft_id', liegId).order('nummer');
  const sel = document.getElementById('nsWE');
  if (!sel) return;
  sel.innerHTML = `<option value="">– gesamte Liegenschaft –</option>`+(wes||[]).map(w=>`<option value="${w.id}">Wohnung ${esc(w.nummer)}</option>`).join('');
}

async function saveNeueSchaden() {
  const lieg = document.getElementById('nsLieg')?.value;
  const titel = document.getElementById('nsTitel')?.value?.trim();
  if (!lieg || !titel) { toast('⚠️ Liegenschaft und Titel sind Pflicht'); return; }
  const weId = document.getElementById('nsWE')?.value || null;
  const dlId = document.getElementById('nsDL')?.value || null;
  const kosten = parseFloat(document.getElementById('nsKosten')?.value) || null;
  const { error } = await db.from('schadensmeldungen').insert({
    liegenschaft_id: parseInt(lieg),
    wohneinheit_id: weId ? parseInt(weId) : null,
    dienstleister_id: dlId ? parseInt(dlId) : null,
    titel,
    beschreibung: document.getElementById('nsBeschr')?.value?.trim() || null,
    prioritaet: document.getElementById('nsPrio')?.value || 'mittel',
    status: 'gemeldet',
    gemeldet_von: document.getElementById('nsGemeldetVon')?.value?.trim() || null,
    gemeldet_via: document.getElementById('nsVia')?.value || null,
    kostentraeger: document.getElementById('nsKt')?.value || 'eigentuemer',
    kosten_geschaetzt: kosten,
    notiz_verwalter: document.getElementById('nsNotiz')?.value?.trim() || null,
    beauftragt_am: dlId ? new Date().toISOString() : null,
  });
  if (error) { toast('❌ ' + error.message); return; }
  closeModal();
  toast('✓ Schadensmeldung angelegt');
  switchView('schaden');
}

// ═══ SCHADEN STATUS ÄNDERN ═══
async function openSchadenStatusModal(schadenId) {
  const { data: s } = await db.from('schadensmeldungen').select('status,titel').eq('id', schadenId).single();
  const statOpts = [
    {v:'gemeldet',l:'📋 Gemeldet'},
    {v:'in_bearbeitung',l:'🔧 In Bearbeitung'},
    {v:'erledigt',l:'✅ Erledigt'},
    {v:'abgeschlossen',l:'🏁 Abgeschlossen'},
  ].map(o=>`<option value="${o.v}"${s?.status===o.v?' selected':''}>${o.l}</option>`).join('');
  document.getElementById('modalTitle').textContent = '✏️ Status ändern';
  document.getElementById('modalBody').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="font-size:13px;color:var(--text2)">Schaden: <strong>${esc(s?.titel||'')}</strong></div>
      <div class="form-group"><label class="form-label">Neuer Status</label>
        <select id="ssStatus" class="form-input">${statOpts}</select></div>
      <div class="form-group"><label class="form-label">Notiz (optional)</label>
        <input id="ssNotiz" class="form-input" placeholder="Grund / Bemerkung..."></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" onclick="saveSchadenStatus(${schadenId})">✓ Speichern</button>
        <button class="btn btn-ghost" onclick="openSchadenModal(${schadenId})">Abbrechen</button>
      </div>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

async function saveSchadenStatus(schadenId) {
  const status = document.getElementById('ssStatus')?.value;
  const notiz = document.getElementById('ssNotiz')?.value?.trim();
  const { error } = await db.from('schadensmeldungen').update({ status }).eq('id', schadenId);
  if (error) { toast('❌ ' + error.message); return; }
  if (notiz) {
    await db.from('schaden_timeline').insert({
      schaden_id: schadenId, aktion: 'Status geändert: '+status,
      notiz, person: `${APP.profile.first_name} ${APP.profile.last_name} (Verwalter)`, icon: '✏️'
    });
  }
  toast('✓ Status aktualisiert');
  openSchadenModal(schadenId);
}

// ═══ SCHADEN ERLEDIGEN ═══
async function schadenErledigen(schadenId) {
  const { error } = await db.from('schadensmeldungen').update({ status: 'erledigt' }).eq('id', schadenId);
  if (error) { toast('❌ ' + error.message); return; }
  await db.from('schaden_timeline').insert({
    schaden_id: schadenId, aktion: 'Schaden als erledigt markiert',
    person: `${APP.profile.first_name} ${APP.profile.last_name} (Verwalter)`, icon: '✅'
  });
  toast('✅ Schaden erledigt');
  closeModal();
  switchView('schaden');
}

// ═══ SCHADEN: DIENSTLEISTER ZUWEISEN ═══
async function openDLZuweisenModal(schadenId) {
  const { data: dls } = await db.from('dienstleister').select('id,name,kategorie,telefon').order('name');
  const { data: s } = await db.from('schadensmeldungen').select('dienstleister_id,titel').eq('id', schadenId).single();
  const dlOpts = `<option value="">– kein Dienstleister –</option>`+(dls||[]).map(d=>`<option value="${d.id}"${s?.dienstleister_id===d.id?' selected':''}>${esc(d.name)}</option>`).join('');
  document.getElementById('modalTitle').textContent = '🔧 Dienstleister zuweisen';
  document.getElementById('modalBody').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="font-size:13px;color:var(--text2)">Schaden: <strong>${esc(s?.titel||'')}</strong></div>
      <div class="form-group"><label class="form-label">Dienstleister</label>
        <select id="dlzSel" class="form-input">${dlOpts}</select></div>
      <div class="form-group"><label class="form-label">Notiz / Auftrag</label>
        <textarea id="dlzNotiz" class="form-input" rows="2" placeholder="Beauftragungsdetails..."></textarea></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-gold" onclick="saveDLZuweisen(${schadenId})">✓ Zuweisen</button>
        <button class="btn btn-ghost" onclick="openSchadenModal(${schadenId})">Abbrechen</button>
      </div>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

async function saveDLZuweisen(schadenId) {
  const dlId = document.getElementById('dlzSel')?.value || null;
  const notiz = document.getElementById('dlzNotiz')?.value?.trim();
  const { data: dl } = dlId ? await db.from('dienstleister').select('name').eq('id', dlId).single() : { data: null };
  const { error } = await db.from('schadensmeldungen').update({
    dienstleister_id: dlId ? parseInt(dlId) : null,
    beauftragt_am: dlId ? new Date().toISOString() : null,
    status: dlId ? 'in_bearbeitung' : 'gemeldet',
  }).eq('id', schadenId);
  if (error) { toast('❌ ' + error.message); return; }
  if (dlId) {
    await db.from('schaden_timeline').insert({
      schaden_id: schadenId,
      aktion: `Dienstleister beauftragt: ${dl?.name||''}`,
      notiz: notiz || null,
      person: `${APP.profile.first_name} ${APP.profile.last_name} (Verwalter)`,
      icon: '🔧'
    });
  }
  toast('✓ Dienstleister zugewiesen');
  openSchadenModal(schadenId);
}

// ═══ SCHADEN: KOSTEN BEARBEITEN ═══
async function openSchadenKostenModal(schadenId) {
  const { data: s } = await db.from('schadensmeldungen').select('titel,kosten_geschaetzt,kosten_final,kostentraeger,versicherung_nr').eq('id', schadenId).single();
  const ktOpts = [
    {v:'eigentuemer',l:'👑 Eigentümer'},
    {v:'versicherung',l:'🛡️ Versicherung'},
    {v:'mieter',l:'🏠 Mieter'},
    {v:'verwaltung',l:'🏛 Verwaltung'},
  ].map(o=>`<option value="${o.v}"${s?.kostentraeger===o.v?' selected':''}>${o.l}</option>`).join('');
  document.getElementById('modalTitle').textContent = '💶 Kosten bearbeiten';
  document.getElementById('modalBody').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="font-size:13px;color:var(--text2)"><strong>${esc(s?.titel||'')}</strong></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group"><label class="form-label">Geschätzte Kosten (€)</label>
          <input id="skGeschaetzt" type="number" class="form-input" value="${s?.kosten_geschaetzt||''}"></div>
        <div class="form-group"><label class="form-label">Finale Kosten (€)</label>
          <input id="skFinal" type="number" class="form-input" value="${s?.kosten_final||''}"></div>
      </div>
      <div class="form-group"><label class="form-label">Kostenträger</label>
        <select id="skKt" class="form-input">${ktOpts}</select></div>
      <div class="form-group"><label class="form-label">Versicherungs-Nr.</label>
        <input id="skVersNr" class="form-input" value="${esc(s?.versicherung_nr||'')}" placeholder="z.B. ALZ-2024-NOTF-001"></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-gold" onclick="saveSchadenKosten(${schadenId})">💾 Speichern</button>
        <button class="btn btn-ghost" onclick="openSchadenModal(${schadenId})">Abbrechen</button>
      </div>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

async function saveSchadenKosten(schadenId) {
  const gesch = parseFloat(document.getElementById('skGeschaetzt')?.value) || null;
  const final = parseFloat(document.getElementById('skFinal')?.value) || null;
  const kt    = document.getElementById('skKt')?.value;
  const vNr   = document.getElementById('skVersNr')?.value?.trim() || null;
  const { error } = await db.from('schadensmeldungen').update({
    kosten_geschaetzt: gesch, kosten_final: final,
    kostentraeger: kt, versicherung_nr: vNr
  }).eq('id', schadenId);
  if (error) { toast('❌ ' + error.message); return; }
  toast('✓ Kosten gespeichert');
  openSchadenModal(schadenId);
}

// ═══════════════════════════════════════════════════
// NEUE BUCHUNG
// ═══════════════════════════════════════════════════
async function openNeueBuchungModal() {
  const liegs = APP.allLiegs || await getLiegenschaften();
  const liegsOpts = liegs.map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join('');
  document.getElementById('modalTitle').textContent = '💶 Neue Buchung';
  document.getElementById('modalBody').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group"><label class="form-label">Typ *</label>
          <select id="nbTyp" class="form-input">
            <option value="einnahme">📈 Einnahme</option>
            <option value="ausgabe">📉 Ausgabe</option>
          </select></div>
        <div class="form-group"><label class="form-label">Betrag (€) *</label>
          <input id="nbBetrag" type="number" step="0.01" class="form-input" placeholder="0.00"></div>
      </div>
      <div class="form-group"><label class="form-label">Bezeichnung *</label>
        <input id="nbBez" class="form-input" placeholder="z.B. Miete März 2026 – Thomas Müller"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group"><label class="form-label">Liegenschaft</label>
          <select id="nbLieg" class="form-input"><option value="">– alle –</option>${liegsOpts}</select></div>
        <div class="form-group"><label class="form-label">Kategorie</label>
          <select id="nbKat" class="form-input">
            <option value="Miete">🏠 Miete</option>
            <option value="Nebenkosten">💧 Nebenkosten</option>
            <option value="Wartung">🔧 Wartung</option>
            <option value="Betrieb">⚙️ Betrieb</option>
            <option value="Versicherung">🛡️ Versicherung</option>
            <option value="Verwaltung">🏛 Verwaltung</option>
            <option value="Reparatur">🔨 Reparatur</option>
            <option value="Sonstiges">📋 Sonstiges</option>
          </select></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group"><label class="form-label">Datum *</label>
          <input id="nbDatum" type="date" class="form-input" value="${new Date().toISOString().split('T')[0]}"></div>
        <div class="form-group"><label class="form-label">Status</label>
          <select id="nbBezahlt" class="form-input">
            <option value="true">✅ Bezahlt</option>
            <option value="false">⏳ Offen</option>
          </select></div>
      </div>
      <div class="form-group"><label class="form-label">Notiz</label>
        <input id="nbNotiz" class="form-input" placeholder="Optionale Notiz..."></div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-gold" onclick="saveNeueBuchung()">💾 Buchung speichern</button>
        <button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>
      </div>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

async function saveNeueBuchung() {
  const bez    = document.getElementById('nbBez')?.value?.trim();
  const betrag = parseFloat(document.getElementById('nbBetrag')?.value);
  const datum  = document.getElementById('nbDatum')?.value;
  if (!bez || !betrag || !datum) { toast('⚠️ Bezeichnung, Betrag und Datum sind Pflicht'); return; }
  const liegId = document.getElementById('nbLieg')?.value || null;
  const { error } = await db.from('transaktionen').insert({
    bezeichnung: bez,
    betrag: Math.abs(betrag),
    typ: document.getElementById('nbTyp')?.value || 'ausgabe',
    kategorie: document.getElementById('nbKat')?.value || 'Sonstiges',
    buchungsdatum: datum,
    liegenschaft_id: liegId ? parseInt(liegId) : null,
    bezahlt: document.getElementById('nbBezahlt')?.value === 'true',
    notiz: document.getElementById('nbNotiz')?.value?.trim() || null,
  });
  if (error) { toast('❌ ' + error.message); return; }
  closeModal();
  toast('✓ Buchung gespeichert');
  switchView('finanzen');
}

// ═══════════════════════════════════════════════════
// NEUER TERMIN
// ═══════════════════════════════════════════════════
async function openNeuerTerminModal() {
  const liegs = APP.allLiegs || await getLiegenschaften();
  const liegsOpts = `<option value="">– kein Bezug –</option>`+liegs.map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join('');
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('modalTitle').textContent = '📅 Neuer Termin';
  document.getElementById('modalBody').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="form-group"><label class="form-label">Titel *</label>
        <input id="ntTitel" class="form-input" placeholder="z.B. Heizungsrevision"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group"><label class="form-label">Datum *</label>
          <input id="ntDatum" type="date" class="form-input" value="${today}"></div>
        <div class="form-group"><label class="form-label">Uhrzeit</label>
          <input id="ntZeit" type="time" class="form-input" value="09:00"></div>
      </div>
      <div class="form-group"><label class="form-label">Typ</label>
        <select id="ntTyp" class="form-input">
          <option value="wartung">🔧 Wartung</option>
          <option value="besichtigung">🏠 Besichtigung</option>
          <option value="übergabe">🔑 Übergabe</option>
          <option value="sonstiges">📋 Sonstiges</option>
        </select></div>
      <div class="form-group"><label class="form-label">Liegenschaft</label>
        <select id="ntLieg" class="form-input">${liegsOpts}</select></div>
      <div class="form-group"><label class="form-label">Ort</label>
        <input id="ntOrt" class="form-input" placeholder="z.B. Heizungskeller"></div>
      <div class="form-group"><label class="form-label">Notiz</label>
        <textarea id="ntNotiz" class="form-input" rows="2" placeholder="Details..."></textarea></div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-gold" onclick="saveNeuerTermin()">💾 Termin speichern</button>
        <button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>
      </div>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

async function saveNeuerTermin() {
  const titel = document.getElementById('ntTitel')?.value?.trim();
  const datum = document.getElementById('ntDatum')?.value;
  if (!titel || !datum) { toast('⚠️ Titel und Datum sind Pflicht'); return; }
  const zeit = document.getElementById('ntZeit')?.value || '09:00';
  const liegId = document.getElementById('ntLieg')?.value || null;
  const { error } = await db.from('termine').insert({
    titel,
    termin_datum: datum + 'T' + zeit + ':00',
    termin_typ: document.getElementById('ntTyp')?.value || 'sonstiges',
    liegenschaft_id: liegId ? parseInt(liegId) : null,
    ort: document.getElementById('ntOrt')?.value?.trim() || null,
    notiz: document.getElementById('ntNotiz')?.value?.trim() || null,
  });
  if (error) { toast('❌ ' + error.message); return; }
  closeModal();
  toast('✓ Termin gespeichert');
  switchView('termine');
}

// ═══════════════════════════════════════════════════
// NEUER DIENSTLEISTER
// ═══════════════════════════════════════════════════
async function openNeuerDLModal() {
  const liegs = APP.allLiegs || await getLiegenschaften();
  const liegsOpts = liegs.map(l=>`<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
    <input type="checkbox" value="${l.id}" style="accent-color:var(--gold)"> ${esc(l.name)}</label>`).join('');
  document.getElementById('modalTitle').textContent = '🔧 Neuer Dienstleister';
  document.getElementById('modalBody').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="form-group"><label class="form-label">Firmenname *</label>
        <input id="dlName" class="form-input" placeholder="z.B. Sanitär Müller GmbH"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group"><label class="form-label">Kategorie</label>
          <select id="dlKat" class="form-input">
            <option value="handwerker">🔨 Handwerker</option>
            <option value="versorgung">💧 Versorgung</option>
            <option value="hausmeister">🏠 Hausmeister</option>
            <option value="versicherung">🛡️ Versicherung</option>
            <option value="reinigung">🧹 Reinigung</option>
            <option value="winterdienst">❄️ Winterdienst</option>
            <option value="sicherheit">🔒 Sicherheit</option>
            <option value="sonstige">📋 Sonstige</option>
          </select></div>
        <div class="form-group"><label class="form-label">Kontaktperson</label>
          <input id="dlKontakt" class="form-input" placeholder="Name des Ansprechpartners"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group"><label class="form-label">Telefon</label>
          <input id="dlTel" class="form-input" type="tel" placeholder="+49 89 123-456"></div>
        <div class="form-group"><label class="form-label">Notfallnummer</label>
          <input id="dlNotfall" class="form-input" type="tel" placeholder="+49 89 123-1000"></div>
      </div>
      <div class="form-group"><label class="form-label">E-Mail</label>
        <input id="dlEmail" class="form-input" type="email" placeholder="kontakt@firma.de"></div>
      <div class="form-group"><label class="form-label">Zugeordnete Liegenschaften</label>
        <div style="display:flex;flex-direction:column;gap:6px;padding:10px;background:var(--bg3);border-radius:8px;border:1px solid var(--border)" id="dlLiegChk">
          ${liegsOpts}
        </div></div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-gold" onclick="saveNeuerDL()">💾 Speichern</button>
        <button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>
      </div>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

async function saveNeuerDL() {
  const name = document.getElementById('dlName')?.value?.trim();
  if (!name) { toast('⚠️ Firmenname ist Pflicht'); return; }
  const { data: dl, error } = await db.from('dienstleister').insert({
    name,
    kategorie: document.getElementById('dlKat')?.value || 'sonstige',
    kontaktperson: document.getElementById('dlKontakt')?.value?.trim() || null,
    telefon: document.getElementById('dlTel')?.value?.trim() || null,
    notfall_nr: document.getElementById('dlNotfall')?.value?.trim() || null,
    email: document.getElementById('dlEmail')?.value?.trim() || null,
  }).select('id').single();
  if (error) { toast('❌ ' + error.message); return; }
  // Liegenschafts-Verknüpfungen
  const checks = document.querySelectorAll('#dlLiegChk input[type=checkbox]:checked');
  if (checks.length && dl?.id) {
    await db.from('dienstleister_liegenschaften').insert(
      Array.from(checks).map(c=>({ dienstleister_id: dl.id, liegenschaft_id: parseInt(c.value) }))
    );
  }
  closeModal();
  toast('✓ Dienstleister angelegt');
  switchView('dienstleister');
}

// ═══════════════════════════════════════════════════
// VERTRAG BEARBEITEN / VERLÄNGERN
// ═══════════════════════════════════════════════════
async function openVertragBearbeitenModal(id) {
  let v = (window._allVertraege||[]).find(x=>x.id===id);
  if (!v) {
    const { data } = await db.from('vertraege').select('*').eq('id', id).single();
    v = data;
  }
  if (!v) { toast('Vertrag nicht gefunden'); return; }
  const liegs = APP.allLiegs || await getLiegenschaften();
  const liegsOpts = `<option value="">– liegenschaftsübergreifend –</option>`+liegs.map(l=>`<option value="${l.id}"${v.liegenschaft_id===l.id?' selected':''}>${esc(l.name)}</option>`).join('');
  document.getElementById('modalTitle').textContent = '✏️ Vertrag bearbeiten';
  document.getElementById('modalBody').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="form-group"><label class="form-label">Vertragsname *</label>
        <input id="vbName" class="form-input" value="${esc(v.name||'')}"></div>
      <div class="form-group"><label class="form-label">Anbieter</label>
        <input id="vbAnbieter" class="form-input" value="${esc(v.anbieter||'')}"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group"><label class="form-label">Kosten (€)</label>
          <input id="vbKosten" type="number" step="0.01" class="form-input" value="${v.kosten||''}"></div>
        <div class="form-group"><label class="form-label">Periode</label>
          <select id="vbPeriode" class="form-input">
            ${['monatlich','jährlich','einmalig','quartalsweise'].map(p=>`<option value="${p}"${v.periode===p?' selected':''}>${p}</option>`).join('')}
          </select></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group"><label class="form-label">Beginn</label>
          <input id="vbStart" type="date" class="form-input" value="${v.beginn_datum||''}"></div>
        <div class="form-group"><label class="form-label">Ende</label>
          <input id="vbEnde" type="date" class="form-input" value="${v.ende_datum||''}"></div>
      </div>
      <div class="form-group"><label class="form-label">Liegenschaft</label>
        <select id="vbLieg" class="form-input">${liegsOpts}</select></div>
      <div class="form-group"><label class="form-label">Beschreibung</label>
        <textarea id="vbNotiz" class="form-input" rows="2">${esc(v.notiz||'')}</textarea></div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-gold" onclick="saveVertragBearbeiten(${id})">💾 Speichern</button>
        <button class="btn btn-ghost" onclick="openVertragModal(${id})">Abbrechen</button>
      </div>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

async function saveVertragBearbeiten(id) {
  const name = document.getElementById('vbName')?.value?.trim();
  if (!name) { toast('⚠️ Name ist Pflicht'); return; }
  const ende  = document.getElementById('vbEnde')?.value || null;
  const now   = new Date();
  const status = ende && new Date(ende) < now ? 'alert' : ende && new Date(ende) < new Date(now.getTime()+90*86400000) ? 'warn' : 'ok';
  const liegId = document.getElementById('vbLieg')?.value || null;
  const { error } = await db.from('vertraege').update({
    name,
    anbieter: document.getElementById('vbAnbieter')?.value?.trim() || null,
    kosten: parseFloat(document.getElementById('vbKosten')?.value) || 0,
    periode: document.getElementById('vbPeriode')?.value || 'monatlich',
    beginn_datum: document.getElementById('vbStart')?.value || null,
    ende_datum: ende,
    liegenschaft_id: liegId ? parseInt(liegId) : null,
    notiz: document.getElementById('vbNotiz')?.value?.trim() || null,
    status,
  }).eq('id', id);
  if (error) { toast('❌ ' + error.message); return; }
  closeModal();
  toast('✓ Vertrag aktualisiert');
  switchView('vertraege');
}

async function openVertragVerlaengernModal(id) {
  let v = (window._allVertraege||[]).find(x=>x.id===id);
  if (!v) {
    const { data } = await db.from('vertraege').select('*').eq('id', id).single();
    v = data;
  }
  if (!v) { toast('Vertrag nicht gefunden'); return; }
  const today = new Date().toISOString().split('T')[0];
  const defaultEnde = new Date(); defaultEnde.setFullYear(defaultEnde.getFullYear()+1);
  document.getElementById('modalTitle').textContent = '🔄 Vertrag verlängern';
  document.getElementById('modalBody').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="font-size:13px;color:var(--text2)">Vertrag: <strong>${esc(v.name)}</strong></div>
      <div style="font-size:12px;color:var(--text3)">Aktuelles Ende: <strong>${v.ende_datum?new Date(v.ende_datum).toLocaleDateString('de-DE'):'unbefristet'}</strong></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group"><label class="form-label">Neues Beginndatum</label>
          <input id="vlStart" type="date" class="form-input" value="${v.ende_datum||today}"></div>
        <div class="form-group"><label class="form-label">Neues Enddatum</label>
          <input id="vlEnde" type="date" class="form-input" value="${defaultEnde.toISOString().split('T')[0]}"></div>
      </div>
      <div class="form-group"><label class="form-label">Neue Kosten (€, leer = unverändert)</label>
        <input id="vlKosten" type="number" step="0.01" class="form-input" placeholder="${v.kosten||''}"></div>
      <div class="form-group"><label class="form-label">Notiz zur Verlängerung</label>
        <input id="vlNotiz" class="form-input" placeholder="z.B. automatisch verlängert, Preisanpassung +2%"></div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-gold" onclick="saveVertragVerlaengern(${id})">🔄 Verlängern</button>
        <button class="btn btn-ghost" onclick="openVertragModal(${id})">Abbrechen</button>
      </div>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

async function saveVertragVerlaengern(id) {
  const newEnde  = document.getElementById('vlEnde')?.value;
  const newStart = document.getElementById('vlStart')?.value;
  const newKosten = document.getElementById('vlKosten')?.value;
  const notiz = document.getElementById('vlNotiz')?.value?.trim();
  if (!newEnde) { toast('⚠️ Neues Enddatum ist Pflicht'); return; }
  const now = new Date();
  const status = new Date(newEnde) < now ? 'alert' : new Date(newEnde) < new Date(now.getTime()+90*86400000) ? 'warn' : 'ok';
  const updateData = { ende_datum: newEnde, beginn_datum: newStart||null, status };
  if (newKosten) updateData.kosten = parseFloat(newKosten);
  const { error } = await db.from('vertraege').update(updateData).eq('id', id);
  if (error) { toast('❌ ' + error.message); return; }
  // Archiveintrag
  if (notiz) {
    await db.from('vertrag_archiv').insert({ vertrag_id: id, von: newStart||null, bis: newEnde, beschreibung: notiz });
  }
  closeModal();
  toast('✓ Vertrag verlängert bis ' + new Date(newEnde).toLocaleDateString('de-DE'));
  switchView('vertraege');
}

// ═══════════════════════════════════════════════════
// DOKUMENT HOCHLADEN (URL-basiert, kein Storage nötig)
// ═══════════════════════════════════════════════════
async function openDokumentHochladenModal(prefillLiegId) {
  window._dokReturnPropId = prefillLiegId || null;
  const liegs = APP.allLiegs || await getLiegenschaften();
  const liegsOpts = `<option value="">– allgemein –</option>`
    + liegs.map(l=>`<option value="${l.id}" ${prefillLiegId && l.id==prefillLiegId?'selected':''}>${esc(l.name)}</option>`).join('');
  document.getElementById('modalTitle').textContent = '📎 Dokument hinzufügen';
  document.getElementById('modalBody').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px">

      <!-- Upload-Zone -->
      <div id="dokDropZone"
        onclick="document.getElementById('dokFileInput').click()"
        ondragover="event.preventDefault();this.style.borderColor='var(--gold)'"
        ondragleave="this.style.borderColor='var(--border2)'"
        ondrop="dokHandleDrop(event)"
        style="border:2px dashed var(--border2);border-radius:12px;padding:24px;text-align:center;
               cursor:pointer;transition:border-color .2s;background:var(--bg3)">
        <div id="dokDropIcon" style="font-size:32px;margin-bottom:8px">📂</div>
        <div id="dokDropText" style="font-size:13px;font-weight:600;color:var(--text2)">
          Datei hier ablegen oder klicken zum Auswählen</div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">
          PDF, Word, Excel, Bild — max. 20 MB</div>
        <input id="dokFileInput" type="file" style="display:none"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.zip"
          onchange="dokFileSelected(this.files[0])">
      </div>

      <!-- Oder: URL -->
      <div style="display:flex;align-items:center;gap:8px">
        <div style="flex:1;height:1px;background:var(--border)"></div>
        <div style="font-size:11px;color:var(--text3);padding:0 8px">oder externes Link</div>
        <div style="flex:1;height:1px;background:var(--border)"></div>
      </div>
      <div class="form-group" style="margin:0">
        <input id="dokUrl" class="form-input" type="url" placeholder="https://... (optional, wenn keine Datei)"></div>

      <!-- Felder -->
      <div class="form-group"><label class="form-label">Dokumentname *</label>
        <input id="dokName" class="form-input" placeholder="z.B. Energieausweis 2024"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group"><label class="form-label">Kategorie</label>
          <select id="dokKat" class="form-input">
            <option value="Vertrag">📄 Vertrag</option>
            <option value="Abrechnung">💶 Abrechnung</option>
            <option value="Protokoll">📋 Protokoll</option>
            <option value="Ausweis">🪪 Ausweis</option>
            <option value="Versicherung">🛡️ Versicherung</option>
            <option value="Sonstiges">📁 Sonstiges</option>
          </select></div>
        <div class="form-group"><label class="form-label">Liegenschaft</label>
          <select id="dokLieg" class="form-input">${liegsOpts}</select></div>
      </div>
      <div class="form-group"><label class="form-label">Notiz</label>
        <textarea id="dokNotiz" class="form-input" rows="2" placeholder="Optionale Beschreibung..."></textarea></div>

      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-gold" onclick="saveDokument()">💾 Speichern</button>
        <button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>
      </div>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

// Datei per Drag & Drop
function dokHandleDrop(e) {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  document.getElementById('dokDropZone').style.borderColor = 'var(--border2)';
  if (file) dokFileSelected(file);
}

// Datei ausgewählt → Vorschau + Name-Autofill
function dokFileSelected(file) {
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) { toast('⚠️ Datei zu groß — max. 20 MB'); return; }
  window._dokPendingFile = file;

  const ext = file.name.split('.').pop().toLowerCase();
  const icon = {pdf:'📄',doc:'📝',docx:'📝',xls:'📊',xlsx:'📊',
                png:'🖼',jpg:'🖼',jpeg:'🖼',gif:'🖼',webp:'🖼',
                zip:'🗜',txt:'📃',csv:'📊'}[ext] || '📁';

  document.getElementById('dokDropIcon').textContent = icon;
  document.getElementById('dokDropText').innerHTML =
    `<span style="color:var(--green);font-weight:700">✓ ${esc(file.name)}</span>`
    + `<span style="color:var(--text3);font-size:11px;margin-left:8px">(${(file.size/1024).toFixed(0)} KB)</span>`
    + `<div style="font-size:11px;color:var(--text3);margin-top:4px;cursor:pointer"
         onclick="event.stopPropagation();window._dokPendingFile=null;
                  document.getElementById('dokDropText').innerHTML='Andere Datei auswählen';
                  document.getElementById('dokDropIcon').textContent='📂'">✕ entfernen</div>`;

  // Dateiname als Dokumentname vorschlagen (ohne Extension)
  const nameField = document.getElementById('dokName');
  if (!nameField.value) {
    nameField.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
  }
}

async function saveDokument() {
  const name = document.getElementById('dokName')?.value?.trim();
  if (!name) { toast('⚠️ Name ist Pflicht'); return; }

  const liegId = document.getElementById('dokLieg')?.value || null;
  const katMap = {Vertrag:'📄',Abrechnung:'💶',Protokoll:'📋',Ausweis:'🪪',Versicherung:'🛡️',Sonstiges:'📁'};
  const kat  = document.getElementById('dokKat')?.value || 'Sonstiges';
  let   url  = document.getElementById('dokUrl')?.value?.trim() || null;

  // ── Datei hochladen (Supabase Storage) ──────────────────────
  const file = window._dokPendingFile;
  if (file) {
    const btn = document.querySelector('#modalBody .btn-gold');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Wird hochgeladen…'; }

    const ts       = Date.now();
    const safe     = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const folder   = liegId ? `liegenschaft_${liegId}` : 'allgemein';
    const path     = `${folder}/${ts}_${safe}`;

    const { error: upErr } = await db.storage
      .from('dokumente')
      .upload(path, file, { upsert: false, contentType: file.type });

    if (upErr) {
      toast('❌ Upload fehlgeschlagen: ' + upErr.message);
      if (btn) { btn.disabled = false; btn.textContent = '💾 Speichern'; }
      return;
    }

    const { data: urlData } = db.storage.from('dokumente').getPublicUrl(path);
    url = urlData?.publicUrl || null;
    window._dokPendingFile = null;
  }

  // ── DB-Eintrag ───────────────────────────────────────────────
  const { error } = await db.from('dokumente').insert({
    name,
    kategorie: kat,
    icon: katMap[kat] || '📄',
    liegenschaft_id: liegId ? parseInt(liegId) : null,
    url,
    notiz: document.getElementById('dokNotiz')?.value?.trim() || null,
  });
  if (error) { toast('❌ ' + error.message); return; }

  closeModal();
  toast('✓ Dokument gespeichert');
  const returnId = window._dokReturnPropId;
  window._dokReturnPropId = null;
  if (returnId) {
    openProp(returnId);
    // Kurz warten bis Modal aufgebaut, dann Dokumente-Tab öffnen
    setTimeout(() => setPropTab('dokumente'), 350);
  } else {
    switchView('dokumente');
  }
}

let toastTimer;
function toast(msg){
  const t=document.getElementById('toast');
  t.innerHTML='<span style="color:var(--green2)">✓</span> '+msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),2800);
}

document.addEventListener('click',e=>{
  const d=document.getElementById('notifDrop');
  const b=document.getElementById('notifBtn');
  if(d&&d.classList.contains('open')&&!d.contains(e.target)&&!b.contains(e.target))d.classList.remove('open');
});

// ═══════════════════════════════════════════════════
// ADMIN-PANEL — Benutzerverwaltung
// ═══════════════════════════════════════════════════
const ROLE_LABELS = {
  admin:'Admin', geschaeftsfuehrer:'Geschäftsführer', bueroleiter:'Büroleiter',
  verwalter:'Verwalter', vermieter:'Vermieter', mieter:'Mieter'
};
const ROLE_COLORS = {
  admin:'#9D174D', geschaeftsfuehrer:'#5B21B6', bueroleiter:'#92400E',
  verwalter:'#B45309', vermieter:'#1E40AF', mieter:'#15803D'
};
const ROLE_BG = {
  admin:'#FCE7F3', geschaeftsfuehrer:'#EDE9FE', bueroleiter:'#FEF3C7',
  verwalter:'#FEF3C7', vermieter:'#DBEAFE', mieter:'#DCFCE7'
};

async function tmplAdmin() {
  const { data: users, error } = await db
    .from('profiles')
    .select('id, first_name, last_name, phone, role, created_at')
    .order('role').order('last_name');
  if (error) return `<div class="card"><p style="color:var(--red)">❌ Fehler: ${esc(error.message)}</p></div>`;

  const grouped = {};
  (users||[]).forEach(u => {
    const r = u.role || 'mieter';
    if(!grouped[r]) grouped[r] = [];
    grouped[r].push(u);
  });

  const roleOrder = ['admin','geschaeftsfuehrer','bueroleiter','verwalter','vermieter','mieter'];
  const rows = (users||[]).map(u => {
    const rol = u.role || 'mieter';
    const opts = roleOrder.map(r =>
      `<option value="${r}" ${r===rol?'selected':''}>${ROLE_LABELS[r]||r}</option>`
    ).join('');
    return `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:10px 12px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:32px;height:32px;border-radius:50%;background:${ROLE_BG[rol]};color:${ROLE_COLORS[rol]};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">
            ${esc((u.first_name[0]||'')+(u.last_name[0]||''))}
          </div>
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--text)">${esc(u.first_name)} ${esc(u.last_name)}</div>
            ${u.phone?`<div style="font-size:11px;color:var(--text3)">📞 ${esc(u.phone)}</div>`:''}
          </div>
        </div>
      </td>
      <td style="padding:10px 12px">
        <span class="tag" style="background:${ROLE_BG[rol]};color:${ROLE_COLORS[rol]};border:none;font-size:10px;font-weight:700">
          ${ROLE_LABELS[rol]||rol}
        </span>
      </td>
      <td style="padding:10px 12px;font-size:11px;color:var(--text3)">
        ${u.created_at ? new Date(u.created_at).toLocaleDateString('de-DE') : '–'}
      </td>
      <td style="padding:10px 12px">
        <div style="display:flex;align-items:center;gap:6px">
          <select id="roleSelect_${u.id}" class="form-input" style="margin:0;font-size:11px;padding:4px 8px;width:auto">
            ${opts}
          </select>
          <button class="btn btn-gold btn-sm" style="font-size:11px" onclick="adminSaveRole('${u.id}')">💾 Speichern</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  const statsHtml = roleOrder.filter(r=>grouped[r]?.length).map(r=>`
    <div class="kpi-card" style="cursor:default">
      <div class="kpi-label">${ROLE_LABELS[r]}</div>
      <div class="kpi-value" style="color:${ROLE_COLORS[r]}">${grouped[r].length}</div>
      <div class="kpi-accent-line" style="background:${ROLE_COLORS[r]}"></div>
    </div>`).join('');

  return `
  <div class="welcome-banner"><div class="wb-shimmer"></div>
    <div class="wb-text">
      <div class="wb-greet">Benutzerverwaltung 👥</div>
      <div class="wb-sub">System-Administration · PropManager</div>
    </div>
  </div>
  <div class="kpi-grid" style="margin-bottom:16px">${statsHtml}</div>
  <div class="card">
    <div class="card-title" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      👥 Alle Benutzer
      <span style="font-size:11px;color:var(--text3);font-weight:400">${(users||[]).length} Benutzer gesamt</span>
    </div>
    <div style="background:var(--bg3);border-radius:9px;padding:10px 14px;margin-bottom:14px;font-size:11px;color:var(--text3)">
      ℹ️ Neue Benutzer werden über das Login-Formular registriert. Hier können Rollen zugewiesen werden.
      <strong>Admin</strong> hat nur Zugriff auf diese Benutzerverwaltung, nicht auf Objekte oder Finanzen.
    </div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="border-bottom:2px solid var(--border);text-align:left">
            <th style="padding:8px 12px;color:var(--text3);font-weight:600;font-size:10px;letter-spacing:.5px;text-transform:uppercase">Benutzer</th>
            <th style="padding:8px 12px;color:var(--text3);font-weight:600;font-size:10px;letter-spacing:.5px;text-transform:uppercase">Aktuelle Rolle</th>
            <th style="padding:8px 12px;color:var(--text3);font-weight:600;font-size:10px;letter-spacing:.5px;text-transform:uppercase">Erstellt</th>
            <th style="padding:8px 12px;color:var(--text3);font-weight:600;font-size:10px;letter-spacing:.5px;text-transform:uppercase">Rolle ändern</th>
          </tr>
        </thead>
        <tbody>${rows||`<tr><td colspan="4" style="padding:20px;color:var(--text3);text-align:center">Keine Benutzer gefunden.</td></tr>`}</tbody>
      </table>
    </div>
  </div>`;
}

async function adminSaveRole(userId) {
  const sel = document.getElementById('roleSelect_'+userId);
  if (!sel) return;
  const newRole = sel.value;
  const { error } = await db.from('profiles').update({ role: newRole }).eq('id', userId);
  if (error) { toast('❌ '+error.message); return; }
  toast('✓ Rolle gespeichert: '+ROLE_LABELS[newRole]);
  // Zeile visuell aktualisieren (Badge-Farbe)
  const badge = sel.closest('tr')?.querySelector('.tag');
  if (badge) {
    badge.textContent = ROLE_LABELS[newRole]||newRole;
    badge.style.background = ROLE_BG[newRole]||'';
    badge.style.color = ROLE_COLORS[newRole]||'';
  }
}

// ═══════════════════════════════════════════════════
// BÜROLEITER — Teamverwaltung / Verwalter-Zuweisung
// ═══════════════════════════════════════════════════
async function tmplTeamverwaltung() {
  const [liegsRes, verwRes] = await Promise.all([
    db.from('liegenschaften').select('id, name, strasse, plz, ort, verwalter_id').eq('aktiv', true).order('name'),
    db.from('profiles').select('id, first_name, last_name, role').in('role', ['verwalter','bueroleiter']).order('last_name'),
  ]);
  const liegs = liegsRes.data || [];
  const verwalter = verwRes.data || [];

  const verwOpts = `<option value="">— Kein Verwalter —</option>` +
    verwalter.map(v=>`<option value="${v.id}">${esc(v.first_name)} ${esc(v.last_name)} (${ROLE_LABELS[v.role]||v.role})</option>`).join('');

  const liegRows = liegs.map(l => {
    const opts = verwOpts.replace(`value="${l.verwalter_id}"`, `value="${l.verwalter_id}" selected`);
    const assigned = verwalter.find(v=>v.id===l.verwalter_id);
    return `
    <div style="padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:160px">
          <div style="font-size:13px;font-weight:700;color:var(--text)">${esc(l.name)}</div>
          <div style="font-size:11px;color:var(--text3)">${esc(l.strasse)}, ${esc(l.plz)} ${esc(l.ort)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          ${assigned
            ? `<span style="font-size:11px;background:var(--gold4);color:var(--gold);padding:3px 8px;border-radius:6px">👤 ${esc(assigned.first_name)} ${esc(assigned.last_name)}</span>`
            : `<span style="font-size:11px;background:var(--red3);color:var(--red);padding:3px 8px;border-radius:6px">⚠️ Nicht zugewiesen</span>`}
          <select id="verwSelect_${l.id}" class="form-input" style="margin:0;font-size:11px;padding:4px 8px;width:auto">
            ${opts}
          </select>
          <button class="btn btn-gold btn-sm" style="font-size:11px" onclick="teamSaveZuweisung(${l.id})">💾</button>
        </div>
      </div>
    </div>`;
  }).join('');

  // Verwalter-Übersicht: wer hat wie viele Objekte
  const countMap = {};
  liegs.forEach(l=>{ if(l.verwalter_id) countMap[l.verwalter_id] = (countMap[l.verwalter_id]||0)+1; });
  const teamRows = verwalter.map(v=>`
    <div style="padding:10px 12px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border)">
      <div style="width:30px;height:30px;border-radius:50%;background:${ROLE_BG[v.role]};color:${ROLE_COLORS[v.role]};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">
        ${(v.first_name[0]||'')+(v.last_name[0]||'')}
      </div>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:600;color:var(--text)">${esc(v.first_name)} ${esc(v.last_name)}</div>
        <div style="font-size:10px;color:var(--text3)">${ROLE_LABELS[v.role]||v.role}</div>
      </div>
      <span style="font-size:12px;font-weight:700;color:${countMap[v.id]?'var(--gold)':'var(--text3)'}">
        ${countMap[v.id]||0} Objekt${(countMap[v.id]||0)!==1?'e':''}
      </span>
    </div>`).join('');

  return `
  <div class="welcome-banner"><div class="wb-shimmer"></div>
    <div class="wb-text">
      <div class="wb-greet">Teamverwaltung 🏢</div>
      <div class="wb-sub">Verwalter-Zuweisung zu Liegenschaften</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start">
    <div>
      <div class="card">
        <div class="card-title" style="margin-bottom:14px">🏛 Liegenschaften — Verwalter zuweisen</div>
        ${liegRows||noDaten('Keine Liegenschaften vorhanden.')}
      </div>
    </div>
    <div>
      <div class="card">
        <div class="card-title" style="margin-bottom:12px">👥 Team-Übersicht</div>
        ${teamRows||noDaten('Keine Verwalter im System.')}
      </div>
    </div>
  </div>`;
}

async function teamSaveZuweisung(liegId) {
  const sel = document.getElementById('verwSelect_'+liegId);
  if (!sel) return;
  const verwId = sel.value || null;
  const { error } = await db.from('liegenschaften').update({ verwalter_id: verwId }).eq('id', liegId);
  if (error) { toast('❌ '+error.message); return; }
  toast('✓ Verwalter zugewiesen');
  switchView('teamverwaltung');
}

// ═══════════════════════════════════════════════════
// GESCHÄFTSFÜHRER — Lesezugriff-Banner
// ═══════════════════════════════════════════════════
function readOnlyBanner() {
  if (!isReadOnly()) return '';
  return `<div style="background:#EDE9FE;border:1px solid #C4B5FD;border-radius:10px;padding:10px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px;font-size:12px;color:#5B21B6">
    <span style="font-size:16px">👁</span>
    <span><strong>Nur Lesezugriff</strong> — Als Geschäftsführer haben Sie vollständigen Einblick in alle Daten, können jedoch keine Änderungen vornehmen.</span>
  </div>`;
}

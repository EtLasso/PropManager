// ═══════════════════════════════════════════════════
// MAIN — Entry Point, window-Bindings
// Alle Funktionen die von HTML onclick="" aufgerufen
// werden müssen auf window liegen.
// ═══════════════════════════════════════════════════
'use strict';

import {
  APP, toggleTheme, loadUserProfile, showCover, openLogin, closeLogin,
  selRole, fillDemo, doLogin, showErr, doLogout, showApp,
  buildNav, setActiveNav, buildNotifs, switchView,
  toggleNotif, openDrawer, closeDrawer,
  openEventModal, closeModal,
  buildHeroBuilding, animateHeroStats,
  // liegenschaften
  tmplLiegenschaften, tmplPropDetail, openProp, setLiegsFilter,
  openNeueLiegenschaftModal, saveNeueLiegenschaft,
  openNeueWohneinheitModal, saveNeueWohneinheit,
  // wohneinheiten
  selectApt, buildAptPanel, setAptTab, openAptKontaktForm, saveAptKontakt,
  aptKontaktDel, saveMietvertrag, toggleMVProp, aptNKJahr, aptNKManualAdd,
  aptNKArchivieren, aptArchivDetail, aptNKVorschau,
  // finanzen
  tmplFinanzenNeu,
  // dienstleister
  tmplDienstleister,
  // schaden
  tmplSchaden, openSchadenModal, addTimeline, openModalLoading,
  // vertraege
  tmplVertraege, setVertragFilter, openVertragModal, vtTab,
  vertragArchivAdd, vertragArchivDel, vertragInArchiv,
  saveVertragNotiz, openNeuerVertragModal, saveNeuerVertrag,
  // termine
  tmplTermine, loadEVData, openEvPlanModal, evToggleCheck, renderTOList,
  addTOPItem, removeTOPItem, addTOPTemplate, evAbst, evSetPrinzip,
  evErgebnisFestlegen, evSaveEinladung, evVollmacht, renderProtokollPanel,
  evProtSave, evProtokollVorschau, openNewEVModal, saveNewEV,
  // bewertung
  tmplBewertung, bevTab, bevSelectLieg, renderBewertungDetail, updateVglWert,
  loadMietWE, refreshMietCalc, applyMietsteigerung, applyAlleMietsteigerungen,
  saveBewertungModal, saveBewertungDB, planMassnahme, saveMassnahmeDB, foerderInfo,
} from './core.js';

// ── Alle Funktionen auf window exportieren ──
// (nötig da HTML onclick="..." keinen Modul-Scope hat)
const exports = {
  APP, toggleTheme, loadUserProfile, showCover, openLogin, closeLogin,
  selRole, fillDemo, doLogin, showErr, doLogout, showApp,
  buildNav, setActiveNav, buildNotifs, switchView,
  toggleNotif, openDrawer, closeDrawer,
  openEventModal, closeModal,
  buildHeroBuilding, animateHeroStats,
  openProp, setLiegsFilter,
  openNeueLiegenschaftModal, saveNeueLiegenschaft,
  openNeueWohneinheitModal, saveNeueWohneinheit,
  selectApt, buildAptPanel, setAptTab, openAptKontaktForm, saveAptKontakt,
  aptKontaktDel, saveMietvertrag, toggleMVProp, aptNKJahr, aptNKManualAdd,
  aptNKArchivieren, aptArchivDetail, aptNKVorschau,
  setVertragFilter, openVertragModal, vtTab,
  vertragArchivAdd, vertragArchivDel, vertragInArchiv,
  saveVertragNotiz, openNeuerVertragModal, saveNeuerVertrag,
  loadEVData, openEvPlanModal, evToggleCheck, renderTOList,
  addTOPItem, removeTOPItem, addTOPTemplate, evAbst, evSetPrinzip,
  evErgebnisFestlegen, evSaveEinladung, evVollmacht, renderProtokollPanel,
  evProtSave, evProtokollVorschau, openNewEVModal, saveNewEV,
  bevTab, bevSelectLieg, renderBewertungDetail, updateVglWert,
  loadMietWE, refreshMietCalc, applyMietsteigerung, applyAlleMietsteigerungen,
  saveBewertungModal, saveBewertungDB, planMassnahme, saveMassnahmeDB, foerderInfo,
};

Object.assign(window, exports);

// ── App Init ──
window.addEventListener('load', async () => {
  buildHeroBuilding();
  animateHeroStats();
  const fallback = setTimeout(() => showCover(), 6000);
  try {
    const { data: { session } } = await window.db.auth.getSession();
    clearTimeout(fallback);
    if (session) { await loadUserProfile(session.user); showApp(); }
    else { showCover(); }
  } catch(e) { clearTimeout(fallback); console.error('Init Fehler:', e); showCover(); }

  window.db.auth.onAuthStateChange(async (event, session) => {
    if (event==='SIGNED_IN'&&session) { await loadUserProfile(session.user); showApp(); }
    else if (event==='SIGNED_OUT') { APP.user=null; APP.profile=null; APP.role=''; document.getElementById('page-app').style.display='none'; showCover(); }
  });
});

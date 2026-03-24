// ═══════════════════════════════════════════════════
// STATE — Globaler App-Zustand, Konstanten
// ═══════════════════════════════════════════════════

export let APP = {
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

export const DEMO = {
  verwalter: { e: 'rico@propmanager.de',  p: 'Admin2024!' },
  vermieter: { e: 'meier@propmanager.de', p: 'Meier2024!' },
  mieter:    { e: 'braun@propmanager.de', p: 'Braun2024!' }
};

export let DEMO_ROLE = 'verwalter';
export function setDemoRole(r) { DEMO_ROLE = r; }

export const NOTIFS = {
  verwalter: [
    {i:'⚠️',t:'Vertrag Müllentsorgung abgelaufen',d:'vor 2 Std.'},
    {i:'🏠',t:'Wohnung 202 seit 45 Tagen leer',d:'vor 1 Tag'},
    {i:'📅',t:'Eigentümerversammlung in 9 Tagen',d:'vor 3 Tagen'}
  ],
  vermieter: [
    {i:'💶',t:'Mietzahlung Mai eingegangen',d:'vor 1 Std.'},
    {i:'📋',t:'NK-Abrechnung verfügbar',d:'vor 2 Tagen'}
  ],
  mieter: [
    {i:'📄',t:'NK-Abrechnung 2024 verfügbar',d:'vor 3 Tagen'},
    {i:'🔧',t:'Heizungsrevision 22. Mai',d:'vor 5 Tagen'}
  ],
};

export const NAV = {
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
  vermieter: [
    {v:'dashboard',     i:'⬡',  l:'Übersicht'},
    {v:'meine-objekte', i:'🏛',  l:'Meine Objekte'},
    {v:'mieter',        i:'👥', l:'Mieter'},
    {v:'einnahmen',     i:'◈',  l:'Einnahmen'},
    {v:'dokumente',     i:'📁', l:'Dokumente'}
  ],
  mieter: [
    {v:'dashboard',      i:'⬡',  l:'Übersicht'},
    {v:'meine-wohnung',  i:'🏠', l:'Meine Wohnung'},
    {v:'zahlungen',      i:'💳', l:'Zahlungen'},
    {v:'dokumente',      i:'📁', l:'Dokumente'},
    {v:'kontakt',        i:'📞', l:'Kontakt'}
  ],
};

// ═══════════════════════════════════════════════════
// DB — Supabase Abfragen (einzige Schicht die `db` anfasst)
// ═══════════════════════════════════════════════════
import { APP } from './state.js';

const db = () => window.db; // window.db wird von supabase-config.js gesetzt

export async function getLiegenschaften() {
  const { data, error } = await db()
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

export async function getLiegenschaftDetail(id) {
  const { data: prop, error } = await db()
    .from('liegenschaften').select('*').eq('id', id).single();
  if (error) throw error;
  const { data: we } = await db()
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

export async function getTransaktionen(limit = 50) {
  let q = db().from('transaktionen')
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

export async function getTermine() {
  const { data, error } = await db()
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

export async function getVertraege() {
  const { data, error } = await db()
    .from('vertraege').select('*, liegenschaften(name)').order('name');
  if (error) throw error;
  return (data || []).map(v => ({ ...v, liegenschaft_name: v.liegenschaften?.name || null }));
}

export async function getDokumente() {
  const { data, error } = await db()
    .from('dokumente')
    .select('*, liegenschaften(name)')
    .order('erstellt_am', { ascending: false });
  if (error) throw error;
  return (data || []).map(d => ({ ...d, liegenschaft_name: d.liegenschaften?.name || null }));
}

export async function getMeineWohnungId() {
  const { data } = await db().from('wohneinheiten').select('id').eq('mieter_id', APP.user.id).single();
  return data?.id || null;
}

export async function getMeineWohnung() {
  const { data, error } = await db()
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

export async function getVerwaltungsgebuehren() {
  const { data, error } = await db()
    .from('verwaltungsgebuehren')
    .select('*, liegenschaften(name, ort)')
    .order('liegenschaft_id');
  if (error) throw error;
  return data || [];
}

export async function getDienstleister() {
  const { data, error } = await db()
    .from('dienstleister')
    .select('*, dienstleister_liegenschaften(liegenschaft_id, leistung, liegenschaften(name, ort))')
    .eq('aktiv', true)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function getSchadensmeldungen() {
  const { data, error } = await db()
    .from('schadensmeldungen')
    .select('*, liegenschaften(name,ort), wohneinheiten(nummer), dienstleister(name,telefon,kategorie)')
    .order('erstellt_am', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getDashboardStats() {
  const liegs   = await getLiegenschaften();
  const txs     = await getTransaktionen(20);
  const termine = await getTermine();
  const vg      = await getVerwaltungsgebuehren();
  const schaden = await getSchadensmeldungen();
  const total_we    = liegs.reduce((a, l) => a + (l.stats?.total || 0), 0);
  const belegt      = liegs.reduce((a, l) => a + (l.stats?.occupied || 0), 0);
  const total_miete = liegs.reduce((a, l) => a + (l.stats?.total_miete || 0), 0);
  const total_vg    = vg.reduce((a, v) => a + parseFloat(v.betrag || 0), 0);
  const { data: pendenten } = await db().from('vertraege').select('id').neq('status', 'ok');
  return {
    stats: { liegenschaften: liegs.length, wohnungen: total_we, belegt, leer: total_we - belegt, total_miete, total_vg },
    txRecent: txs,
    termine: termine.slice(0, 4),
    pendenten: pendenten?.length || 0,
    schadenOffen:   schaden.filter(s => s.status !== 'erledigt' && s.status !== 'abgeschlossen').length,
    schadenNotfall: schaden.filter(s => s.prioritaet === 'notfall' && s.status !== 'erledigt').length,
  };
}

// WE-spezifische Abfragen
export async function getAptKontakte(weId) {
  const { data } = await db().from('wohneinheit_kontakte').select('*').eq('wohneinheit_id', weId).order('typ');
  return data || [];
}
export async function getNKPositionen(weId) {
  const { data } = await db().from('nk_positionen').select('*').eq('wohneinheit_id', weId).order('kategorie');
  return data || [];
}
export async function getNKAbrechnungen(weId) {
  const { data } = await db().from('nk_abrechnungen').select('*, nk_positionen(*)').eq('wohneinheit_id', weId).order('jahr', {ascending: false});
  return data || [];
}

// Bewertung
export async function getBewertungen() {
  const { data } = await db().from('bewertungen').select('*').order('bewertungsdatum',{ascending:false});
  return data || [];
}
export async function getMietsteigerungsLog() {
  const { data } = await db().from('mietsteigerungs_log')
    .select('*, wohneinheiten(nummer,etage,liegenschaften(name))').order('datum',{ascending:false}).limit(50);
  return data || [];
}

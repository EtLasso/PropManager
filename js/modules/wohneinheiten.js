// ═══════════════════════════════════════════════════
// WOHNEINHEITEN — selectApt, buildAptPanel, Mietvertrag, NK
// ═══════════════════════════════════════════════════
import { APP } from './state.js';
import { esc, fmtEur, fmtDate, noDaten, toast } from './utils.js';
import { getAptKontakte, getNKPositionen, getNKAbrechnungen, getLiegenschaftDetail } from './db.js';

export async function selectApt(apt) {
  APP.selectedApt = apt;
  const panel = document.getElementById('aptPanel');
  panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:120px;color:var(--text3);font-size:12px">⏳ Lade Wohnungsdaten...</div>`;
  document.querySelectorAll('.bv-apt').forEach(el=>el.classList.toggle('selected', el.querySelector('.an')?.textContent===apt.nummer));

  const db = window.db;
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
}

export function setAptTab(aptId, tab) {
  window._aptTab = tab;
  if (APP.selectedApt) selectApt(APP.selectedApt);
}

export function openAptKontaktForm(aptId, typ) {
  const form = document.getElementById('aptKontaktForm_'+aptId);
  if (form) { form.style.display='block'; const s=document.getElementById('kfTyp_'+aptId); if(s) s.value=typ; }
}

export async function saveAptKontakt(aptId) {
  const db = window.db;
  const name  = document.getElementById('kfName_'+aptId)?.value?.trim();
  const typ   = document.getElementById('kfTyp_'+aptId)?.value;
  const tel   = document.getElementById('kfTel_'+aptId)?.value?.trim();
  const email = document.getElementById('kfEmail_'+aptId)?.value?.trim();
  const notiz = document.getElementById('kfNotiz_'+aptId)?.value?.trim();
  if (!name) { toast('Bitte Name eingeben'); return; }
  const { error } = await db.from('wohneinheit_kontakte').insert({
    wohneinheit_id:aptId, name, typ:typ||'sonstiges',
    telefon:tel||null, email:email||null, notiz:notiz||null
  });
  if (error) { toast('❌ '+error.message); return; }
  toast('✓ Kontakt gespeichert');
  if (APP.selectedApt) selectApt(APP.selectedApt);
}

export async function aptKontaktDel(aptId, kontaktId) {
  await window.db.from('wohneinheit_kontakte').delete().eq('id', kontaktId);
  toast('Kontakt entfernt');
  if (APP.selectedApt) selectApt(APP.selectedApt);
}

export async function saveMietvertrag(aptId) {
  const db = window.db;
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
  if (!beginn) { toast('⚠️ Mietbeginn ist Pflicht'); return; }
  try {
    const apt = window._currentPropDetail?.wohneinheiten?.find(w=>w.id==aptId);
    let mieter_id = apt?.mieter_id_neu;
    if (mieter_id) {
      await db.from('mieter').update({vorname,nachname,email:email||null,telefon:telefon||null,iban:iban||null,notiz:notiz_m||null}).eq('id',mieter_id);
    } else if (vorname && nachname) {
      const {data:nm,error:me} = await db.from('mieter').insert({vorname,nachname,email:email||null,telefon:telefon||null,iban:iban||null,notiz:notiz_m||null}).select('id').single();
      if (me) { toast('❌ Mieter: '+me.message); return; }
      mieter_id = nm.id;
    }
    await db.from('mietvertraege').update({status:'abgelaufen'}).eq('wohneinheit_id',aptId).eq('status','aktiv');
    const {error:mve} = await db.from('mietvertraege').insert({
      wohneinheit_id:aptId, mieter_id, start_datum:beginn, ende_datum:ende||null,
      nettomiete:netto, nk_vorauszahlung:nk, kaution, kuendigungsfrist:kuend,
      notiz:notiz_v||null, status:'aktiv'
    });
    if (mve) { toast('❌ Mietvertrag: '+mve.message); return; }
    await db.from('wohneinheiten').update({
      status:'occupied', nettomiete:netto, nebenkosten:nk, mietbeginn:beginn, mietende:ende||null,
      mieter_vorname:vorname||null, mieter_nachname:nachname||null,
      mieter_email:email||null, mieter_telefon:telefon||null, mieter_iban:iban||null
    }).eq('id',aptId);
    toast('✓ Mietvertrag gespeichert');
    window._currentPropDetail = await getLiegenschaftDetail(window._currentPropDetail?.id||APP.currentProp);
    if (APP.selectedApt) selectApt(APP.selectedApt);
  } catch(e) { toast('❌ Fehler: '+e.message); }
}

export async function toggleMVProp(aptId, prop, val) {
  const db = window.db;
  if (prop==='kaution_bezahlt') {
    const {data:mv} = await db.from('mietvertraege').select('id').eq('wohneinheit_id',aptId).eq('status','aktiv').single();
    if (mv?.id) {
      const upd = {kaution_bezahlt:val};
      if (val) upd.kaution_datum = new Date().toISOString().split('T')[0];
      await db.from('mietvertraege').update(upd).eq('id',mv.id);
    }
  }
  toast('✓');
}

export function aptNKJahr(aptId, delta) {
  if (!window._nkJahr) window._nkJahr = {};
  window._nkJahr[aptId] = (window._nkJahr[aptId]||new Date().getFullYear()) + delta;
  if (APP.selectedApt) selectApt(APP.selectedApt);
}

export async function aptNKManualAdd(aptId) {
  const db = window.db;
  const name   = document.getElementById('nkManName_'+aptId)?.value?.trim();
  const kat    = document.getElementById('nkManKat_'+aptId)?.value;
  const kosten = parseFloat(document.getElementById('nkManKosten_'+aptId)?.value||0);
  const apt    = APP.selectedApt;
  if (!name||!kosten) { toast('Name + Kosten pflicht'); return; }
  const jahr = window._nkJahr?.[aptId]||new Date().getFullYear();
  const { error } = await db.from('nk_positionen').insert({
    wohneinheit_id:aptId, liegenschaft_id:apt?.liegenschaft_id||null,
    jahr, name, kategorie:kat||'sonstiges', kosten, umlagefaehig:true
  });
  if (error) { toast('❌ '+error.message); return; }
  toast('✓ Kostenposition gespeichert');
  if (APP.selectedApt) selectApt(APP.selectedApt);
}

export async function aptNKArchivieren(aptId, jahr) {
  const db = window.db;
  const a = APP.selectedApt; if (!a) return;
  const v = window._allVertraege||[];
  const pV = v.filter(x=>!x.liegenschaft_id||x.liegenschaft_id===a.liegenschaft_id||x.liegenschaft_id===APP.currentProp);
  const allWE = window._currentPropDetail?.wohneinheiten||[];
  const totF = allWE.reduce((s,w)=>s+(parseFloat(w.flaeche_qm)||0),0)||1;
  const ant = (parseFloat(a.flaeche_qm)||0)/totF;
  const istkost = pV.reduce((s,x)=>{const mt=x.periode==='jährlich'?parseFloat(x.kosten||0)/12:parseFloat(x.kosten||0);return s+mt*ant*12;},0);
  const vz = (parseFloat(a.aktiverMV?.nk_vorauszahlung||a.nebenkosten||0))*12;
  const {error:e1} = await db.from('nk_abrechnungen').upsert({
    wohneinheit_id:aptId, liegenschaft_id:a.liegenschaft_id||null,
    jahr:parseInt(jahr)||new Date().getFullYear(),
    mieter_name:a.mieter_name||'', vorauszahlung:vz, istkost, status:'abgeschlossen'
  },{onConflict:'wohneinheit_id,jahr'}).select().single();
  if (e1) { toast('❌ '+e1.message); return; }
  toast('✓ NK-Abrechnung '+jahr+' archiviert');
  if (APP.selectedApt) selectApt(APP.selectedApt);
}

export async function aptArchivDetail(aptId, archivId) {
  const db = window.db;
  const {data:ar} = await db.from('nk_abrechnungen').select('*, nk_positionen(*)').eq('id',archivId).single();
  if (!ar) return;
  const saldo = parseFloat(ar.vorauszahlung||0)-parseFloat(ar.istkost||0);
  document.getElementById('modalTitle').textContent = '📄 NK-Abrechnung '+ar.jahr;
  const posHtml = (ar.nk_positionen||[]).map(p=>`
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
    ${posHtml?`<div style="margin-bottom:12px">${posHtml}</div>`:''}
    <div style="margin-top:14px;display:flex;gap:8px">
      <button class="btn btn-gold" onclick="window.print()">🖨 Drucken</button>
      <button class="btn btn-ghost" onclick="closeModal()">Schließen</button>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

export function aptNKVorschau(aptId) {
  const a = APP.selectedApt; if (!a) return;
  const v = window._allVertraege||[];
  const pV = v.filter(x=>!x.liegenschaft_id||x.liegenschaft_id===a.liegenschaft_id||x.liegenschaft_id===APP.currentProp);
  const allWE = window._currentPropDetail?.wohneinheiten||[];
  const totF = allWE.reduce((s,w)=>s+(parseFloat(w.flaeche_qm)||0),0)||1;
  const ant = (parseFloat(a.flaeche_qm)||0)/totF;
  if (!window._nkJahr) window._nkJahr = {};
  const jahr = window._nkJahr[aptId]||new Date().getFullYear();
  const vz = (parseFloat(a.nebenkosten)||0)*12;
  let istges = 0;
  const posRows = pV.map(vtrag=>{
    const mt = vtrag.periode==='jährlich'?parseFloat(vtrag.kosten||0)/12:parseFloat(vtrag.kosten||0);
    const jahresant = mt*ant*12; istges += jahresant;
    return `<tr><td style="padding:5px 8px;font-size:11px">${esc(vtrag.name)}</td><td style="padding:5px 8px;font-size:11px;color:#6b7280">${esc(vtrag.anbieter||'')}</td><td style="padding:5px 8px;text-align:right;font-size:11px">${fmtEur(mt*12)}</td><td style="padding:5px 8px;text-align:right;font-size:11px;font-weight:600">${fmtEur(jahresant)}</td></tr>`;
  }).join('');
  const saldo = vz - istges;
  document.getElementById('modalTitle').textContent = '📄 NK-Abrechnung Vorschau '+jahr;
  document.getElementById('modalBody').innerHTML=`
    <div style="background:white;border-radius:10px;padding:20px;font-family:serif;color:#1a1a1a;font-size:12px">
      <div style="text-align:center;border-bottom:2px solid #1a1a1a;padding-bottom:10px;margin-bottom:14px">
        <div style="font-size:18px;font-weight:700">NEBENKOSTENABRECHNUNG ${jahr}</div>
        <div>WE ${esc(a.nummer)} · ${a.flaeche_qm} m² · ${Math.round(ant*1000)/10}% Flächenanteil</div>
        ${a.mieter_name?`<div style="color:#6b7280">Mieter: ${esc(a.mieter_name)}</div>`:''}
        <div style="color:#6b7280">01.01.${jahr} – 31.12.${jahr}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
        <thead><tr style="border-bottom:1px solid #e5e7eb">
          <th style="padding:5px 8px;font-size:10px;text-align:left;color:#6b7280">POSITION</th>
          <th style="padding:5px 8px;font-size:10px;text-align:left;color:#6b7280">ANBIETER</th>
          <th style="padding:5px 8px;font-size:10px;text-align:right;color:#6b7280">GESAMT/J.</th>
          <th style="padding:5px 8px;font-size:10px;text-align:right;color:#6b7280">ANTEIL</th>
        </tr></thead>
        <tbody>${posRows||'<tr><td colspan="4" style="padding:10px;color:#6b7280;text-align:center">Keine Positionen</td></tr>'}</tbody>
        <tfoot><tr style="border-top:2px solid #1a1a1a">
          <td colspan="3" style="padding:8px;font-weight:700">ISTKOSTEN GESAMT</td>
          <td style="padding:8px;text-align:right;font-weight:700">${fmtEur(istges)}</td>
        </tr></tfoot>
      </table>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding:12px;background:#f9fafb;border-radius:8px">
        <div style="text-align:center"><div style="font-size:10px;color:#6b7280">VORAUSZAHLUNGEN</div><div style="font-size:16px;font-weight:700;color:#2563eb">${fmtEur(vz)}</div></div>
        <div style="text-align:center"><div style="font-size:10px;color:#6b7280">ISTKOSTEN</div><div style="font-size:16px;font-weight:700;color:#d97706">${fmtEur(istges)}</div></div>
        <div style="text-align:center"><div style="font-size:10px;color:#6b7280">${saldo>=0?'GUTHABEN':'NACHZAHLUNG'}</div><div style="font-size:16px;font-weight:700;color:${saldo>=0?'#16a34a':'#dc2626'}">${fmtEur(Math.abs(saldo))}</div></div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn btn-gold" onclick="aptNKArchivieren('${aptId}','${jahr}');closeModal()">🗄 Archivieren</button>
      <button class="btn btn-ghost" onclick="window.print()">🖨 Drucken</button>
      <button class="btn btn-ghost" onclick="closeModal()">Schließen</button>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

export function buildAptPanel(a, vertraege=[], txs=[], kontakte=[], nkPositionen=[], nkAbrechnungen=[]) {
  const propVertraege = vertraege.filter(v=>!v.liegenschaft_id||v.liegenschaft_id===a.liegenschaft_id||v.liegenschaft_id===APP.currentProp);
  const mv = a.aktiverMV||null;
  const dbKaution = txs.find(t=>t.wohneinheit_id===a.id&&t.kategorie==='Kaution');
  if (!window._nkJahr) window._nkJahr = {};
  const nkaJahr = window._nkJahr[a.id] || new Date().getFullYear();
  const allWE = window._currentPropDetail?.wohneinheiten || [];
  const totalFlaeche = allWE.reduce((s,w)=>s+(parseFloat(w.flaeche_qm)||0),0)||1;
  const aptAnteil = (parseFloat(a.flaeche_qm)||0) / totalFlaeche;

  const kostenKategorien = {
    grundsteuer:{label:'🏛 Grundsteuer',items:[],umlagefaehig:true},
    wasser:{label:'💧 Wasser & Abwasser',items:[],umlagefaehig:true},
    heizung:{label:'🔥 Heizkosten',items:[],umlagefaehig:true},
    aufzug:{label:'🛗 Aufzug',items:[],umlagefaehig:true},
    muell:{label:'♻️ Müllabfuhr',items:[],umlagefaehig:true},
    strassenrein:{label:'🛣 Straßenreinigung',items:[],umlagefaehig:true},
    hausreinigung:{label:'🧹 Hausreinigung',items:[],umlagefaehig:true},
    garten:{label:'🌿 Gartenpflege',items:[],umlagefaehig:true},
    beleuchtung:{label:'💡 Beleuchtung',items:[],umlagefaehig:true},
    hausmeister:{label:'🔧 Hausmeister',items:[],umlagefaehig:true},
    versicherung:{label:'🛡 Versicherung',items:[],umlagefaehig:true},
    antenne:{label:'📡 Kabel/Antenne',items:[],umlagefaehig:true},
    sicherheit:{label:'🔐 Sicherheit',items:[],umlagefaehig:true},
    sonstige:{label:'📦 Sonstige Betriebskosten',items:[],umlagefaehig:true},
    nicht_umlagefaehig:{label:'🚫 Nicht umlagefähig',items:[],umlagefaehig:false},
  };
  const katFallback = {versorgung:'wasser',hausmeister:'hausmeister',reinigung:'hausreinigung',versicherung:'versicherung',winterdienst:'strassenrein',sicherheit:'sicherheit',handwerker:'sonstige',sonstige:'sonstige'};
  propVertraege.forEach(v=>{
    if (v.vertrag_typ==='mietvertrag') return;
    if (v.nk_umlagefaehig===false) { kostenKategorien.nicht_umlagefaehig.items.push({name:v.name,anbieter:v.anbieter,kosten:0,status:v.status}); return; }
    const katKey = v.nk_kategorie&&kostenKategorien[v.nk_kategorie]?v.nk_kategorie:(katFallback[v.kategorie||'sonstige']||'sonstige');
    const monatlich = v.periode==='jährlich'?parseFloat(v.kosten||0)/12:parseFloat(v.kosten||0);
    kostenKategorien[katKey].items.push({name:v.name,anbieter:v.anbieter,kosten:monatlich,status:v.status});
  });
  nkPositionen.forEach(m=>{ const k=kostenKategorien[m.kategorie]||kostenKategorien.sonstige; k.items.push({name:m.name,anbieter:'Manuell',kosten:parseFloat(m.kosten||0),_manual:true,_dbId:m.id}); });

  let gesamtJahrNK = 0;
  const kostenpositionen = Object.entries(kostenKategorien).map(([key,kat])=>{
    const summe = kat.items.reduce((s,i)=>s+i.kosten,0);
    const anteil = kat.umlagefaehig ? summe*aptAnteil*12 : 0;
    if (kat.umlagefaehig) gesamtJahrNK += anteil;
    return {...kat, key, summe, anteil};
  }).filter(k=>k.items.length>0);

  const vorauszahlung = (parseFloat(a.nebenkosten)||0)*12;
  const differenz = gesamtJahrNK - vorauszahlung;
  const tabState = window._aptTab||'bewohner';
  window._aptTab = tabState;

  function renderBewohner() {
    const kts = a.kontakte||[];
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
    const ek=kts.filter(k=>k.typ==='eigentuemer'), mk=kts.filter(k=>k.typ==='mieter'), sk=kts.filter(k=>!['eigentuemer','mieter'].includes(k.typ));
    return `
      <div style="margin-bottom:12px">
        <div style="font-size:10px;font-weight:700;color:var(--gold);letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px">👑 Eigentümer</div>
        ${a.eigentuemer_name?`<div style="padding:10px 12px;background:var(--bg3);border:1px solid var(--border);border-left:3px solid var(--gold2);border-radius:9px;margin-bottom:6px">
          <div style="font-size:13px;font-weight:700;color:var(--text)">${esc(a.eigentuemer_name)}</div>
          ${a.eigentuemer_phone?`<div style="font-size:11px;color:var(--text3);margin-top:3px">📞 ${esc(a.eigentuemer_phone)}</div>`:''}
          <div style="margin-top:8px;display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" style="font-size:10px" onclick="toast('E-Mail...')">✉️ E-Mail</button>
            <button class="btn btn-ghost btn-sm" style="font-size:10px" onclick="toast('Anruf...')">📞 Anrufen</button>
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
          <div style="margin-top:8px;display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" style="font-size:10px" onclick="toast('E-Mail...')">✉️ E-Mail</button>
          </div>
        </div>`:a.status==='vacant'?`<div style="padding:10px 12px;background:var(--red3);border:1px solid #FECACA;border-radius:9px;font-size:12px;color:var(--red)">🔴 Wohnung leer
          <div style="margin-top:6px"><button class="btn btn-gold btn-sm" style="font-size:10px" onclick="setAptTab('${a.id}','vertrag')">🔑 Mieter eintragen</button></div>
        </div>`:noDaten('Kein Mieter hinterlegt.')}
        ${mk.map(k=>kontaktCard(k)).join('')}
      </div>
      ${sk.length?`<div style="margin-bottom:12px"><div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px">👤 Weitere Kontakte</div>${sk.map(k=>kontaktCard(k)).join('')}</div>`:''}
      <div id="aptKontaktForm_${a.id}" style="display:none;background:var(--bg3);border:1px dashed var(--border2);border-radius:9px;padding:12px;margin-top:8px">
        <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:8px">+ Neuer Kontakt</div>
        <select id="kfTyp_${a.id}" class="form-input" style="margin:0 0 6px 0;font-size:11px"><option value="sonstiges">Sonstige</option><option value="notruf">🆘 Notruf</option><option value="handwerker">🔧 Handwerker</option></select>
        <input id="kfName_${a.id}" class="form-input" style="margin:0 0 6px 0;font-size:11px" placeholder="Name *">
        <input id="kfTel_${a.id}" class="form-input" style="margin:0 0 6px 0;font-size:11px" placeholder="Telefon">
        <input id="kfEmail_${a.id}" class="form-input" style="margin:0 0 6px 0;font-size:11px" placeholder="E-Mail">
        <input id="kfNotiz_${a.id}" class="form-input" style="margin:0 0 8px 0;font-size:11px" placeholder="Notiz / Rolle">
        <div style="display:flex;gap:6px">
          <button class="btn btn-gold btn-sm" onclick="saveAptKontakt('${a.id}')">💾 Speichern</button>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('aptKontaktForm_${a.id}').style.display='none'">Abbrechen</button>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" style="margin-top:8px;font-size:11px" onclick="openAptKontaktForm('${a.id}','sonstiges')">+ Kontakt hinzufügen</button>`;
  }

  function renderVertrag() {
    const saved = mv||{};
    if (!saved.kaution&&dbKaution) { saved.kaution=dbKaution.betrag; saved.kaution_bezahlt=dbKaution.bezahlt===true; }
    return `
      <div style="background:var(--bg3);border-radius:10px;padding:12px 14px;margin-bottom:12px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">📄 Mietvertrag</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Vorname Mieter</div><input id="mv_vorname_${a.id}" class="form-input" style="margin:0;font-size:12px" value="${esc(a.mieter_vorname||'')}"></div>
            <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Nachname Mieter</div><input id="mv_nachname_${a.id}" class="form-input" style="margin:0;font-size:12px" value="${esc(a.mieter_nachname||'')}"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Mietbeginn *</div><input id="mv_beginn_${a.id}" type="date" class="form-input" style="margin:0;font-size:12px" value="${saved.start_datum||a.mietbeginn||''}"></div>
            <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Befristet bis</div><input id="mv_ende_${a.id}" type="date" class="form-input" style="margin:0;font-size:12px" value="${saved.ende_datum||''}"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Nettomiete €/Mt.</div><input id="mv_netto_${a.id}" type="number" class="form-input" style="margin:0;font-size:12px" value="${saved.nettomiete||a.nettomiete||''}"></div>
            <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">NK-Vorauszahlung €/Mt.</div><input id="mv_nk_${a.id}" type="number" class="form-input" style="margin:0;font-size:12px" value="${saved.nk_vorauszahlung||a.nebenkosten||''}"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Kaution €</div><input id="mv_kaution_${a.id}" type="number" class="form-input" style="margin:0;font-size:12px" value="${saved.kaution||''}"></div>
            <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Kündigungsfrist (Monate)</div><input id="mv_kuend_${a.id}" type="number" class="form-input" style="margin:0;font-size:12px" value="${saved.kuendigungsfrist||3}"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">📧 E-Mail Mieter</div><input id="mv_mieter_email_${a.id}" type="email" class="form-input" style="margin:0;font-size:12px" value="${esc(saved.mieter_email||a.mieter_email_addr||'')}"></div>
            <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">🏦 IBAN Mieter</div><input id="mv_iban_${a.id}" class="form-input" style="margin:0;font-size:12px;font-family:'JetBrains Mono'" value="${esc(saved.iban||a.mieter_iban_nr||'')}"></div>
          </div>
          <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Besondere Vereinbarungen</div>
            <textarea id="mv_vereinb_${a.id}" class="form-input" rows="2" style="margin:0;font-size:11px;resize:vertical">${esc(saved.notiz||'')}</textarea></div>
        </div>
        <button class="btn btn-gold btn-sm" style="margin-top:10px" onclick="saveMietvertrag('${a.id}')">💾 Speichern</button>
      </div>`;
  }

  function renderNebenkosten() {
    const posHtml = kostenpositionen.map(kat=>{
      const bc = kat.umlagefaehig===false?'var(--red2)':'var(--border)';
      const bg = kat.umlagefaehig===false?'var(--red3)':'var(--bg)';
      return `<div style="background:${bg};border:1px solid ${bc};border-radius:9px;padding:10px 12px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-size:11px;font-weight:700;color:var(--text2)">${kat.label}</div>
          ${kat.umlagefaehig!==false?`<div style="font-size:13px;font-weight:700;color:var(--text);font-family:'JetBrains Mono'">${fmtEur(kat.anteil)}/Jahr</div>`:'<div style="font-size:10px;color:var(--red);font-weight:700">nicht umlegbar</div>'}
        </div>
        ${kat.items.map(item=>`<div style="display:flex;justify-content:space-between;padding:4px 0;border-top:1px solid var(--border);font-size:11px">
          <span style="color:var(--text3)">${esc(item.name)}</span>
          ${kat.umlagefaehig!==false?`<span style="font-family:'JetBrains Mono';color:var(--text2)">${fmtEur(item.kosten*aptAnteil*12)}/J</span>`:'<span style="font-size:10px;color:var(--red)">Vermieterkosten</span>'}
        </div>`).join('')}
        ${kat.umlagefaehig!==false?`<div style="font-size:9px;color:var(--text4);margin-top:4px">Flächenanteil: ${Math.round(aptAnteil*1000)/10}% (${a.flaeche_qm}m² / ${Math.round(totalFlaeche)}m²)</div>`:''}
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
          <div style="background:rgba(255,255,255,.07);border-radius:7px;padding:8px 10px"><div style="font-size:9px;color:rgba(255,255,255,.4)">VORAUSZAHLUNG/J.</div><div style="font-size:14px;font-weight:700;color:#60A5FA;font-family:'JetBrains Mono';margin-top:2px">${fmtEur(vorauszahlung)}</div></div>
          <div style="background:rgba(255,255,255,.07);border-radius:7px;padding:8px 10px"><div style="font-size:9px;color:rgba(255,255,255,.4)">ISTKOSTEN/J.</div><div style="font-size:14px;font-weight:700;color:#FCD34D;font-family:'JetBrains Mono';margin-top:2px">${fmtEur(gesamtJahrNK)}</div></div>
          <div style="background:rgba(255,255,255,.07);border-radius:7px;padding:8px 10px"><div style="font-size:9px;color:rgba(255,255,255,.4)">FLÄCHEN-ANT.</div><div style="font-size:14px;font-weight:700;color:#A78BFA;font-family:'JetBrains Mono';margin-top:2px">${Math.round(aptAnteil*1000)/10}%</div></div>
        </div>
      </div>
      ${posHtml||noDaten('Keine Betriebskosten-Verträge vorhanden.')}
      <div style="background:var(--bg3);border:1px dashed var(--border2);border-radius:9px;padding:12px;margin-bottom:12px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">+ Manuelle Kostenposition</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">
          <input id="nkManName_${a.id}" class="form-input" style="margin:0;font-size:11px" placeholder="Bezeichnung">
          <select id="nkManKat_${a.id}" class="form-input" style="margin:0;font-size:11px">
            <option value="grundsteuer">🏛 Grundsteuer</option><option value="wasser">💧 Wasser</option>
            <option value="heizung">🔥 Heizkosten</option><option value="muell">♻️ Müllabfuhr</option>
            <option value="versicherung">🛡 Versicherung</option><option value="sonstige">📦 Sonstige</option>
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
    return `
      <div style="background:var(--bg3);border-radius:9px;padding:10px 12px;margin-bottom:12px;font-size:11px;color:var(--text3)">
        🗄 Archivierte Nebenkostenabrechnungen.
      </div>
      ${nkAbrechnungen.length ? nkAbrechnungen.map(ar=>{
        const saldo = parseFloat(ar.vorauszahlung||0)-parseFloat(ar.istkost||0);
        return `<div style="padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;margin-bottom:8px;cursor:pointer" onclick="aptArchivDetail('${a.id}',${ar.id})">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div><div style="font-size:13px;font-weight:700;color:var(--text)">NK-Abrechnung ${ar.jahr}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px">${fmtDate(ar.erstellt_am)} · ${esc(ar.mieter_name||'')}</div></div>
            <div style="text-align:right">
              <div style="font-size:11px;font-weight:700;color:${saldo>=0?'var(--green)':'var(--red)'}">${saldo>=0?'Guthaben':'Nachzahlung'}</div>
              <div style="font-size:16px;font-weight:700;font-family:'Playfair Display';color:${saldo>=0?'var(--green)':'var(--red)'}">${fmtEur(Math.abs(saldo))}</div>
            </div>
          </div>
        </div>`;
      }).join('') : noDaten('Noch keine archivierten Abrechnungen.')}`;
  }

  const statusBadge = a.status==='occupied'?`<span class="tag tag-blue">VERMIETET</span>`:a.status==='vacant'?`<span class="tag tag-red">LEER</span>`:`<span class="tag tag-gold">EIGENNUTZ</span>`;

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

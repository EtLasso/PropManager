// ═══════════════════════════════════════════════════
// BEWERTUNG — Ertragswert, VPI-Mietsteigerung, Maßnahmen
// ═══════════════════════════════════════════════════
import { APP } from './state.js';
import { esc, fmtEur, fmtDate, noDaten, toast } from './utils.js';
import { getLiegenschaften } from './db.js';

export async function getBewertungData() {
  const liegs = await getLiegenschaften();
  window._bewLiegsCache = liegs;
  const { data: bewertungen } = await window.db.from('bewertungen').select('*').order('bewertungsdatum',{ascending:false});
  const { data: mietsLog }   = await window.db.from('mietsteigerungs_log')
    .select('*, wohneinheiten(nummer,etage,liegenschaften(name))').order('datum',{ascending:false}).limit(50);
  return { liegs, bewertungen: bewertungen||[], mietsLog: mietsLog||[] };
}

export function calcErtragswert(jahresmiete, lz=0.04, bwkPct=0.20) {
  return Math.round(jahresmiete * (1-bwkPct) / lz);
}

export function getMietsteigerungVPI(alteMiete, vpiAlt, vpiNeu) {
  if(!vpiAlt||!vpiNeu) return { neueMiete: alteMiete, aenderung: 0, pct: 0 };
  const neueMiete = Math.round(alteMiete*(vpiNeu/vpiAlt)*100)/100;
  return { neueMiete, aenderung: neueMiete-alteMiete, pct: ((vpiNeu/vpiAlt)-1)*100 };
}

export async function tmplBewertung() {
  const { liegs, bewertungen, mietsLog } = await getBewertungData();
  const MASSNAHMEN = [
    {titel:'Heizungstausch (Wärmepumpe)',         kat:'energie', kosten:20000, wert_pct:7.0, rend:1.0, prio:1, desc:'Fossiler Ausstieg, Förderungen bis 50%, Zukunftssicherheit' },
    {titel:'Thermische Sanierung (Fassade)',       kat:'energie', kosten:18000, wert_pct:6.0, rend:0.8, prio:1, desc:'Energieausweis +1-2 Klassen, Heizkostensenkung ~30%' },
    {titel:'Dachdämmung / Dachsanierung',          kat:'energie', kosten:22000, wert_pct:5.0, rend:0.5, prio:1, desc:'Pflicht bei >20% Wärmedurchgang, förderfähig' },
    {titel:'Lifteinbau',                           kat:'komfort', kosten:45000, wert_pct:12.0,rend:1.5, prio:2, desc:'Barrierefreiheit, OG-Wohnungen +15-20% wertvoller' },
    {titel:'Photovoltaikanlage',                   kat:'energie', kosten:15000, wert_pct:2.5, rend:1.2, prio:2, desc:'Mieterstrommodell möglich, Gemeinschaftsstrom' },
    {titel:'Fenstererneuerung (3-fach)',           kat:'energie', kosten: 8500, wert_pct:3.0, rend:0.4, prio:2, desc:'Schallschutz, Wärmeschutz, Sicherheit' },
    {titel:'Badezimmersanierung je WE',            kat:'innen',   kosten: 6500, wert_pct:5.0, rend:0.6, prio:3, desc:'Zeitgemäße Ausstattung, höhere Mietpreise erreichbar' },
    {titel:'Photovoltaik + Batteriespeicher',      kat:'energie', kosten:22000, wert_pct:3.5, rend:1.5, prio:2, desc:'Energieautarkie, E-Ladestationen möglich' },
    {titel:'Smart-Home / Videogegensprechanlage',  kat:'komfort', kosten: 3200, wert_pct:1.0, rend:0.3, prio:3, desc:'App-Zugang, Türkamera, Mehrwert für Mieter' },
    {titel:'Allgemeinflächengestaltung',           kat:'außen',   kosten: 4500, wert_pct:1.5, rend:0.2, prio:3, desc:'Eingang, Stiegenhaus, Briefkastenanlage — erster Eindruck' },
    {titel:'Kellerausbau / Abstellräume',          kat:'fläche',  kosten: 9000, wert_pct:2.0, rend:0.4, prio:3, desc:'Zusätzliche Mieteinnahmen, Nachfrage hoch' },
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
      <td style="padding:11px 14px"><div style="font-weight:700">${esc(l.name)}</div><div style="font-size:11px;color:var(--text3)">${esc(l.strasse)}, ${esc(l.plz)} ${esc(l.ort)}</div></td>
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
        <div><div style="font-weight:700;font-size:13px">${esc(m.titel)}</div>
          <span style="font-size:10px;padding:2px 7px;border-radius:10px;background:${kc}22;color:${kc};font-weight:600;text-transform:uppercase">${m.kat}</span></div>
        <div style="padding:3px 9px;border-radius:10px;font-size:10px;font-weight:700;background:${m.prio===1?'var(--red3)':m.prio===2?'var(--gold3)':'var(--green3)'};color:${m.prio===1?'var(--red)':m.prio===2?'var(--gold)':'var(--green)'}">${m.prio===1?'⬆ Hoch':m.prio===2?'↔ Mittel':'↓ Optional'}</div>
      </div>
      <p style="font-size:11px;color:var(--text3);margin:0 0 12px;line-height:1.5">${esc(m.desc)}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;text-align:center;margin-bottom:10px">
        <div style="background:var(--bg2);border-radius:8px;padding:7px"><div style="font-size:10px;color:var(--text3)">Investition</div><div style="font-weight:700;color:var(--red);font-size:12px">${fmtEur(m.kosten)}</div></div>
        <div style="background:var(--bg2);border-radius:8px;padding:7px"><div style="font-size:10px;color:var(--text3)">Wertsteigerung</div><div style="font-weight:700;color:var(--green);font-size:12px">+${m.wert_pct}%</div></div>
        <div style="background:var(--bg2);border-radius:8px;padding:7px"><div style="font-size:10px;color:var(--text3)">Rendite +</div><div style="font-weight:700;color:var(--blue);font-size:12px">+${m.rend}%</div></div>
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
      <h2 style="margin:0;font-size:20px">📊 Immobilienbewertung &amp; Wertentwicklung</h2>
      <p style="margin:4px 0 0;font-size:12px;color:var(--text3)">Ertragswert · Vergleichswert · Mietsteigerungen · Maßnahmen-ROI</p>
    </div>
  </div>
  <div class="kpi-grid" style="margin-bottom:20px">
    <div class="kpi-card" style="border-left:3px solid var(--gold2)"><div class="kpi-label">Portfolio-Gesamtwert</div><div class="kpi-value kv-gold">${fmtEur(totalWert)}</div><div class="kpi-sub">Ertragswert · ${liegs.length} Liegenschaften</div></div>
    <div class="kpi-card" style="border-left:3px solid var(--blue2)"><div class="kpi-label">Jahres-Mietertrag</div><div class="kpi-value kv-blue">${fmtEur(totalJM)}</div><div class="kpi-sub">${fmtEur(totalJM/12)}/Monat</div></div>
    <div class="kpi-card" style="border-left:3px solid var(--green2)"><div class="kpi-label">⌀ Bruttorendite</div><div class="kpi-value kv-green">${avgRend.toFixed(2)}%</div><div class="kpi-sub">Mietrendite Portfolio</div></div>
    <div class="kpi-card" style="border-left:3px solid var(--teal2)"><div class="kpi-label">Wohneinheiten</div><div class="kpi-value kv-teal">${liegs.reduce((a,l)=>a+(l.stats?.total||0),0)}</div><div class="kpi-sub">${liegs.length} Liegenschaften</div></div>
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
          <th style="padding:11px 14px;text-align:left">Liegenschaft</th><th style="padding:11px 14px;text-align:right">WE</th>
          <th style="padding:11px 14px;text-align:right">Jahresmiete</th><th style="padding:11px 14px;text-align:right">Ertragswert</th>
          <th style="padding:11px 14px;text-align:right">Rendite</th><th style="padding:11px 14px;text-align:right">€/m²</th>
          <th style="padding:11px 14px;text-align:center">Bewertet</th><th style="padding:11px 14px;text-align:center">Detail</th>
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
    <p style="font-size:11px;color:var(--text3);margin-top:10px">ⓘ <strong>Ertragswertverfahren</strong> (§16 ImmoWertV): Jahresreinertrag (Miete −20% BWK) ÷ LZ 4,0%. Interne Planungshilfe.</p>
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
            <option value="0.030">3,0% — Toplage</option><option value="0.035">3,5% — Gute Lage</option>
            <option value="0.040" selected>4,0% — Normallage</option><option value="0.045">4,5% — Einfache Lage</option>
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
        <strong>🇦🇹 Österreich MRG §16:</strong> Indexmiete — Anpassung sobald VPI ≥ 5% Schwelle überschritten.<br>
        <strong>🇩🇪 Deutschland §558 BGB:</strong> Max. +20% in 36 Monaten, Mietspiegel als Obergrenze.
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px">
        <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Liegenschaft</label>
          <select id="mietLiegSel" onchange="loadMietWE(this.value)" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text1);font-size:12px">
            <option value="">— wählen —</option>${liegsOpts}</select></div>
        <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">VPI Basis (alt)</label>
          <input id="mietVpiAlt" type="number" value="100" step="0.1" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text1);font-size:12px" oninput="refreshMietCalc()"></div>
        <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">VPI aktuell (neu)</label>
          <input id="mietVpiNeu" type="number" value="111.8" step="0.1" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text1);font-size:12px" oninput="refreshMietCalc()"></div>
        <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Steigerung</label>
          <div id="mietPctBadge" style="padding:8px;border-radius:8px;background:var(--green3);color:var(--green);font-weight:700;font-size:15px;text-align:center">+11,80%</div></div>
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

export function bevTab(id) {
  ['bev-portfolio','bev-detail','bev-miete','bev-massnahmen'].forEach(t=>{
    const el=document.getElementById(t); if(el) el.style.display=t===id?'':'none';
    const btn=document.getElementById('btab-'+t); if(btn) btn.classList.toggle('active',t===id);
  });
}

export function bevSelectLieg(id) {
  bevTab('bev-detail');
  const sel=document.getElementById('bewLiegSel'); if(sel) sel.value=id;
  renderBewertungDetail(id);
}

export async function renderBewertungDetail(liegenschaftId) {
  const el=document.getElementById('bevDetailContent');
  if(!el) return;
  if(!liegenschaftId){ el.innerHTML=noDaten('Liegenschaft wählen.'); return; }
  el.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3)">⏳ Berechnung…</div>';
  const lz=parseFloat(document.getElementById('bewLiegZins')?.value)||0.04;
  const { data:prop }  = await window.db.from('liegenschaften').select('*').eq('id',liegenschaftId).single();
  const { data:wes }   = await window.db.from('wohneinheiten').select('*, mieter:mieter_id(first_name,last_name)').eq('liegenschaft_id',liegenschaftId).order('etage').order('nummer');
  const { data:hist }  = await window.db.from('bewertungen').select('*').eq('liegenschaft_id',liegenschaftId).order('bewertungsdatum',{ascending:false}).limit(12);
  const we=wes||[];
  const jahresmiete=we.reduce((a,w)=>a+(parseFloat(w.nettomiete)||0)*12,0);
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
    <div class="kpi-card" style="border-left:3px solid var(--gold2)"><div class="kpi-label">Ertragswert (LZ ${(lz*100).toFixed(1)}%)</div><div class="kpi-value kv-gold">${fmtEur(ertragswert)}</div><div class="kpi-sub">Reinertrag: ${fmtEur(reinertrag)}/Jahr</div></div>
    <div class="kpi-card" style="border-left:3px solid var(--blue2)"><div class="kpi-label">Wert pro m²</div><div class="kpi-value kv-blue">${fmtEur(m2Wert)}</div><div class="kpi-sub">Fläche: ~${flaeche} m²</div></div>
    <div class="kpi-card" style="border-left:3px solid var(--green2)"><div class="kpi-label">Jahres-Mietertrag</div><div class="kpi-value kv-green">${fmtEur(jahresmiete)}</div><div class="kpi-sub">Rendite: ${rendite.toFixed(2)}% brutto</div></div>
    <div class="kpi-card" style="border-left:3px solid var(--teal2)"><div class="kpi-label">Belegungsgrad</div><div class="kpi-value ${belegung===100?'kv-green':belegung>=80?'kv-gold':'kv-red'}">${belegung}%</div><div class="kpi-sub">${we.filter(w=>w.status==='occupied').length}/${we.length} WE belegt</div></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
    <div class="card">
      <div class="card-title">🏠 WE-Einzelbewertung</div>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
        <tr style="background:var(--bg2)"><th style="padding:8px 12px;text-align:left">WE</th><th style="padding:8px 12px;text-align:left">Mieter</th><th style="padding:8px 12px;text-align:right">Miete</th><th style="padding:8px 12px;text-align:right">Wert</th><th style="padding:8px 12px;text-align:center">Status</th></tr>
        ${weRows}
        <tr style="background:var(--bg3);font-weight:700;border-top:2px solid var(--border)"><td colspan="2" style="padding:9px 12px">Gesamt</td><td style="padding:9px 12px;text-align:right;color:var(--green)">${fmtEur(we.reduce((a,w)=>a+(parseFloat(w.nettomiete)||0),0))}/Mo</td><td style="padding:9px 12px;text-align:right;color:var(--gold)">${fmtEur(ertragswert)}</td><td></td></tr>
      </table></div>
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
          <div style="display:flex;gap:8px;align-items:center"><input id="vglPreisM2" type="number" placeholder="€/m²" value="3200" style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text1);font-size:12px" oninput="updateVglWert(${flaeche})"><span style="font-size:11px;color:var(--text2)">× ${flaeche} m²</span></div>
          <div id="vglWertResult" style="margin-top:6px;font-weight:700;font-size:13px;color:var(--blue)">${fmtEur(3200*flaeche)} (Vergleichswert)</div>
        </div>
      </div>
      <button class="btn btn-primary" style="width:100%;margin-top:12px" onclick="saveBewertungModal(${liegenschaftId},${ertragswert})">💾 Bewertung speichern</button>
    </div>
  </div>
  <div class="card"><div class="card-title">📈 Bewertungshistorie</div>${histHtml}</div>`;
}

export function updateVglWert(flaeche) {
  const p=parseFloat(document.getElementById('vglPreisM2')?.value)||0;
  const el=document.getElementById('vglWertResult');
  if(el) el.textContent=fmtEur(p*flaeche)+' (Vergleichswert)';
}

export async function loadMietWE(liegenschaftId) {
  const el=document.getElementById('mietWETable'); if(!el) return;
  if(!liegenschaftId){ el.innerHTML=noDaten('Liegenschaft wählen.'); return; }
  const { data:wes } = await window.db.from('wohneinheiten')
    .select('*, mieter:mieter_id(first_name,last_name)').eq('liegenschaft_id',liegenschaftId).eq('status','occupied').order('etage').order('nummer');
  window._mietWEs = wes||[];
  refreshMietCalc();
}

export function refreshMietCalc() {
  const vpiAlt=parseFloat(document.getElementById('mietVpiAlt')?.value)||100;
  const vpiNeu=parseFloat(document.getElementById('mietVpiNeu')?.value)||100;
  const pct=((vpiNeu/vpiAlt)-1)*100;
  const badge=document.getElementById('mietPctBadge');
  if(badge){ badge.textContent=(pct>=0?'+':'')+pct.toFixed(2)+'%'; badge.style.background=pct>0?'var(--green3)':'var(--red3)'; badge.style.color=pct>0?'var(--green)':'var(--red)'; }
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
      <td style="padding:9px 12px"><button class="btn btn-sm btn-primary" onclick="applyMietsteigerung(${w.id},${alte},${neueMiete},'VPI ${vpiAlt}→${vpiNeu}')">Anwenden</button></td>
    </tr>`;
  }).join('');
  el.innerHTML=`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
    <tr style="background:var(--bg2)"><th style="padding:8px 12px;text-align:left">WE</th><th style="padding:8px 12px;text-align:left">Mieter</th><th style="padding:8px 12px;text-align:right">Aktuell</th><th style="padding:8px 12px;text-align:right">Nach Anpassung</th><th style="padding:8px 12px;text-align:right">+/−</th><th style="padding:8px 12px">Aktion</th></tr>${rows}
  </table></div>
  <div style="margin-top:12px"><button class="btn btn-primary" onclick="applyAlleMietsteigerungen()">✓ Alle ${wes.length} WE anwenden</button></div>`;
}

export async function applyMietsteigerung(weId, alteMiete, neueMiete, grund) {
  if(!confirm('Mietanpassung:\n'+fmtEur(alteMiete)+' → '+fmtEur(neueMiete)+'/Monat\n\nAnwenden?')) return;
  const { error }=await window.db.from('wohneinheiten').update({nettomiete:neueMiete}).eq('id',weId);
  if(error){ toast('Fehler: '+error.message); return; }
  await window.db.from('mietsteigerungs_log').insert({wohneinheit_id:weId,datum:new Date().toISOString().split('T')[0],alte_miete:alteMiete,neue_miete:neueMiete,grund});
  toast('Mietanpassung gespeichert!');
  loadMietWE(document.getElementById('mietLiegSel')?.value);
}

export async function applyAlleMietsteigerungen() {
  const wes=window._mietWEs||[]; if(!wes.length) return;
  const vpiAlt=parseFloat(document.getElementById('mietVpiAlt').value)||100;
  const vpiNeu=parseFloat(document.getElementById('mietVpiNeu').value)||100;
  if(!confirm('Alle '+wes.length+' Wohneinheiten anpassen?\nVPI: '+vpiAlt+' → '+vpiNeu)) return;
  for(const w of wes){
    const alte=parseFloat(w.nettomiete)||0;
    const { neueMiete }=getMietsteigerungVPI(alte,vpiAlt,vpiNeu);
    await window.db.from('wohneinheiten').update({nettomiete:neueMiete}).eq('id',w.id);
    await window.db.from('mietsteigerungs_log').insert({wohneinheit_id:w.id,datum:new Date().toISOString().split('T')[0],alte_miete:alte,neue_miete:neueMiete,grund:'VPI '+vpiAlt+'→'+vpiNeu});
  }
  toast(wes.length+' Mieten erfolgreich angepasst!');
  loadMietWE(document.getElementById('mietLiegSel')?.value);
}

export function saveBewertungModal(liegenschaftId, ertragswert) {
  document.getElementById('modalTitle').textContent='💾 Bewertung speichern';
  document.getElementById('modalBody').innerHTML=`
    <div class="form-group"><label class="form-label">Bewertungswert (€)</label><input id="sbWert" type="number" value="${ertragswert}" class="form-input"></div>
    <div class="form-group"><label class="form-label">Methode</label>
      <select id="sbMethode" class="form-input"><option value="ertragswert">Ertragswertverfahren</option><option value="vergleichswert">Vergleichswertverfahren</option><option value="sachwert">Sachwertverfahren</option><option value="gutachten">Externes Gutachten</option></select></div>
    <div class="form-group"><label class="form-label">Datum</label><input id="sbDatum" type="date" value="${new Date().toISOString().split('T')[0]}" class="form-input"></div>
    <div class="form-group"><label class="form-label">Notiz</label><textarea id="sbNotiz" rows="2" class="form-input"></textarea></div>
    <button class="btn btn-primary" onclick="saveBewertungDB(${liegenschaftId})">💾 Speichern</button>`;
  document.getElementById('modalOverlay').classList.add('open');
}

export async function saveBewertungDB(liegenschaftId) {
  const wert=parseFloat(document.getElementById('sbWert').value);
  const methode=document.getElementById('sbMethode').value;
  const datum=document.getElementById('sbDatum').value;
  const notiz=document.getElementById('sbNotiz').value;
  const { error }=await window.db.from('bewertungen').insert({liegenschaft_id:liegenschaftId,wert,methode,bewertungsdatum:datum,notiz,erstellt_von:APP.userId});
  if(error){ toast('Fehler: '+error.message); return; }
  toast('Bewertung gespeichert!');
  closeModal();
  renderBewertungDetail(liegenschaftId);
}

export function planMassnahme(titel, kosten, wert_pct) {
  const liegsOpts=(window._bewLiegsCache||[]).map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join('');
  document.getElementById('modalTitle').textContent='🔧 Maßnahme planen';
  document.getElementById('modalBody').innerHTML=`
    <div class="form-group"><label class="form-label">Maßnahme</label><input id="pmTitel" type="text" value="${esc(titel)}" class="form-input"></div>
    <div class="form-group"><label class="form-label">Liegenschaft</label><select id="pmLieg" class="form-input">${liegsOpts}</select></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="form-group"><label class="form-label">Kosten (€)</label><input id="pmKosten" type="number" value="${kosten}" class="form-input"></div>
      <div class="form-group"><label class="form-label">Wertsteigerung (%)</label><input id="pmWert" type="number" value="${wert_pct}" class="form-input"></div>
    </div>
    <div class="form-group"><label class="form-label">Geplant für</label><input id="pmDatum" type="date" value="${new Date(Date.now()+90*864e5).toISOString().split('T')[0]}" class="form-input"></div>
    <div style="display:flex;gap:8px"><button class="btn btn-primary" onclick="saveMassnahmeDB()">📋 In Planung aufnehmen</button><button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button></div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

export async function saveMassnahmeDB() {
  const titel=document.getElementById('pmTitel').value;
  const liegenschaft_id=document.getElementById('pmLieg').value;
  const kosten=parseFloat(document.getElementById('pmKosten').value);
  const wertsteigerung_pct=parseFloat(document.getElementById('pmWert').value);
  const geplant_datum=document.getElementById('pmDatum').value;
  const { error }=await window.db.from('massnahmen').insert({titel,liegenschaft_id,kosten_geschaetzt:kosten,wertsteigerung_pct,status:'geplant',geplant_datum});
  if(error){ toast('Fehler: '+error.message); return; }
  toast('Maßnahme eingeplant!');
  closeModal();
}

export function foerderInfo(kat) {
  const info={
    energie:'🇦🇹 AT: Sanierungsscheck (bis €14.000), Raus-aus-Gas-Förderung, Klimabonus\n🇩🇪 DE: BEG-Förderung BAFA/KfW bis 35% Zuschuss, §35c EStG Steuerabzug',
    komfort:'🇦🇹 AT: Barrierefreiheit-Förderung Länder, WBF\n🇩🇪 DE: KfW 455, Pflegeversicherung §40 SGB XI',
    innen:'🇦🇹 AT: Wohnbauförderung bei Mietgebäuden\n🇩🇪 DE: Modernisierungsumlage §559 BGB (8%/Jahr der Kosten)',
    außen:'Keine spezifische Förderung — steuerlich als Erhaltungsaufwand absetzbar',
    fläche:'🇦🇹 AT: Wohnbauförderung bei Ausbau\n🇩🇪 DE: Steuerliche AfA bei Umbaumaßnahmen',
  };
  alert(info[kat]||'Keine Förderinfo verfügbar.');
}

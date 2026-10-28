// New / edit feasibility — everything on one page.
// Works for a brand-new site (creates the project + feasibility_data rows on
// first save) and for an existing one (?id=). Every field is write-through.
import { boot, appbar, esc, $, $$, href, toast, ICON, qs, num, hydratePhotos } from '../ui/shell.js';
import { statusOptions } from '../logic/status.js';
import { fmtAud } from '../logic/metrics.js';
import { CONFIG } from '../config.js';
import { VIC_LGAS, EXPLORERS_CENTRES, estatesFor, matchLga } from '../data/reference.js';

let adapter, feasId, created = false;

const SECTIONS = [['s1', 'Site'], ['s2', 'Deal'], ['s3', 'Demand data'], ['s4', 'Competitors & potential'], ['s5', 'Schools'], ['s6', 'Housing estates'], ['s7', 'Nearby Explorers'], ['s8', 'Files & notes']];

const field = (id, label, value, { type = 'text', req = false, unit = '', placeholder = '', cls = '', input = 'input', options = null } = {}) => `
  <div class="f"><label for="${id}">${esc(label)}${req ? ' <em>*</em>' : ''}</label>
  ${input === 'select' ? `<select id="${id}" data-field="${id}">${options.map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(value ?? '') ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`
    : input === 'textarea' ? `<textarea id="${id}" data-field="${id}" placeholder="${esc(placeholder)}">${esc(value ?? '')}</textarea>`
    : `<input id="${id}" data-field="${id}" type="${type}" class="${cls}" value="${esc(value ?? '')}" placeholder="${esc(placeholder)}">`}
  ${unit ? `<span class="u">${unit}</span>` : ''}</div>`;

function pc(paths, onAddAttr){
  const thumbs = (paths || []).slice(0, 2).map(pp => `<span data-photo-path="${esc(pp)}" style="background-size:cover;background-position:center"></span>`).join('');
  const more = (paths || []).length > 2 ? `<span class="more">+${paths.length - 2}</span>` : '';
  return `<div class="pc" data-photo-group>${thumbs}${more}<button type="button" ${onAddAttr} aria-label="Add photo">+</button></div>`;
}

const STAGES = ['DA lodged', 'DA approved', 'Permit issued', 'Under construction', 'Fit-out', 'Opening soon', 'Already open'];
const STAGE_DEFAULT_PCT = { 'DA lodged': 40, 'DA approved': 60, 'Permit issued': 60, 'Under construction': 90, 'Fit-out': 95, 'Opening soon': 100, 'Already open': 0 };
function compRow(c, mode, lk){
  const potential = mode === 'potential';
  const stageOpts = lk.stage.map(o => `<option value="${esc(o.value)}" ${c.stage === o.value || c.stage === o.label ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
  const confOpts = lk.conf.map(o => `<option value="${esc(o.value)}" ${String(c.confidence || '').toLowerCase() === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
  return potential ? `<tr data-row="${esc(c.id)}" data-coll="feasibility_competitors">
      <td><input data-f="name" value="${esc(c.name || '')}" placeholder="Site / description"></td>
      <td><select data-f="stage">${stageOpts}</select></td>
      <td><input data-f="places" class="mono" value="${esc(c.places ?? '')}" inputmode="numeric"></td>
      <td><input data-f="distance_km" class="mono" value="${esc(c.distance_km ?? '')}" inputmode="decimal"></td>
      <td><input data-f="project_desc" value="${esc(c.project_desc || '')}" placeholder="Source"></td>
      <td><select data-f="confidence">${confOpts}</select></td>
      <td><input data-f="risk_pct" class="mono" value="${esc(c.risk_pct ?? '')}" inputmode="numeric" title="Risk weighting %"></td>
      <td style="text-align:center"><input type="checkbox" data-f="count_in_chain" ${c.count_in_chain !== false ? 'checked' : ''} style="width:18px;height:18px;margin:0" aria-label="Count in demand chain"></td>
      <td>${pc(c.photo_paths, `data-photo="${esc(c.id)}" data-sub="competitors/${esc(c.id)}"`)}</td>
      <td><button type="button" class="btn s icon" data-del="${esc(c.id)}" aria-label="Remove row">×</button></td></tr>`
  : mode === 'pipeline' ? `<tr data-row="${esc(c.id)}" data-coll="feasibility_competitors">
      <td><input data-f="name" value="${esc(c.name || '')}" placeholder="Site / centre name"></td>
      <td><input data-f="project_desc" value="${esc(c.project_desc || '')}" placeholder="Description / permit ref"></td>
      <td><select data-f="stage">${STAGES.concat(c.stage && !STAGES.some(x => x.toLowerCase() === String(c.stage).toLowerCase()) ? [c.stage] : []).map(st => `<option value="${esc(st)}" ${String(c.stage || '').toLowerCase() === st.toLowerCase() ? 'selected' : ''}>${esc(st)}</option>`).join('')}</select></td>
      <td><input data-f="operator" value="${esc(c.operator || '')}" placeholder="—"></td>
      <td><input data-f="places" class="mono" value="${esc(c.places ?? '')}" inputmode="numeric"></td>
      <td><input data-f="distance_km" class="mono" value="${esc(c.distance_km ?? '')}" inputmode="decimal"></td>
      <td><input data-f="risk_pct" class="mono" value="${esc(c.risk_pct ?? '')}" inputmode="numeric" placeholder="60" title="Likelihood it completes — weights the places in the demand chain"></td>
      <td>${pc(c.photo_paths, `data-photo="${esc(c.id)}" data-sub="competitors/${esc(c.id)}"`)}</td>
      <td><button type="button" class="btn s icon" data-del="${esc(c.id)}" aria-label="Remove row">×</button></td></tr>`
  : `<tr data-row="${esc(c.id)}" data-coll="feasibility_competitors">
      <td><input data-f="name" value="${esc(c.name || '')}" placeholder="Centre"></td>
      <td><input data-f="operator" value="${esc(c.operator || '')}"></td>
      <td><input data-f="places" class="mono" value="${esc(c.places ?? '')}" inputmode="numeric"></td>
      <td><input data-f="distance_km" class="mono" value="${esc(c.distance_km ?? '')}" inputmode="decimal"></td>
      <td><input data-f="fee" class="mono" value="${esc(c.fee ?? '')}" inputmode="numeric" placeholder="—"></td>
      <td><input data-f="ms_current_capacity" class="mono" value="${esc(c.ms_current_capacity ?? '')}" inputmode="numeric" placeholder="—"></td>
      <td><input data-f="nqs_rating" value="${esc(c.nqs_rating || '')}" placeholder="—"></td>
      <td>${pc(c.photo_paths, `data-photo="${esc(c.id)}" data-sub="competitors/${esc(c.id)}"`)}</td>
      <td><button type="button" class="btn s icon" data-del="${esc(c.id)}" aria-label="Remove row">×</button></td></tr>`;
}
const schoolRow = s => `<tr data-row="${esc(s.id)}" data-coll="feasibility_schools">
  <td><input data-f="name" value="${esc(s.name || '')}"></td>
  <td><select data-f="type">${['primary', 'secondary', 'P-12', 'P-9'].map(t => `<option ${s.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
  <td><select data-f="sector">${[['public', 'Government'], ['catholic', 'Catholic'], ['independent', 'Independent']].map(([v, l]) => `<option value="${v}" ${s.sector === v ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
  <td><input data-f="enrolments" class="mono" value="${esc(s.enrolments ?? '')}" inputmode="numeric"></td>
  <td><input data-f="distance_km" class="mono" value="${esc(s.distance_km ?? '')}" inputmode="decimal"></td>
  <td><input data-f="address" value="${esc(s.address || '')}"></td>
  <td>${pc(s.photo_paths, `data-photo="${esc(s.id)}" data-sub="schools/${esc(s.id)}"`)}</td>
  <td><button type="button" class="btn s icon" data-del="${esc(s.id)}" aria-label="Remove row">×</button></td></tr>`;
const estateRow = (e, council) => {
  const opts = estatesFor(council);
  const known = opts.some(o => o.name === e.name);
  const grouped = {}; opts.forEach(o => (grouped[o.lga] = grouped[o.lga] || []).push(o));
  const sel = `<select data-f="name" data-estate-pick><option value="">— pick estate —</option>${Object.entries(grouped).map(([lga, es]) => `<optgroup label="${esc(lga)}">${es.map(o => `<option value="${esc(o.name)}" data-suburb="${esc(o.suburb)}" data-rate="${o.rate}" ${o.name === e.name ? 'selected' : ''}>${esc(o.name)} (${esc(o.suburb)}) · ${o.rate} lots/mo</option>`).join('')}</optgroup>`).join('')}<option value="__other" ${!known && e.name ? 'selected' : ''}>Other…</option></select>`;
  return `<tr data-row="${esc(e.id)}" data-coll="feasibility_estates">
  <td style="min-width:220px">${sel}<input data-f="name" data-estate-other value="${esc(!known ? (e.name || '') : '')}" placeholder="Estate name" style="margin-top:4px;${known || !e.name ? 'display:none' : ''}"></td>
  <td><input data-f="suburb" value="${esc(e.suburb || '')}"></td>
  <td><input data-f="lots" class="mono" value="${esc(e.lots ?? '')}" inputmode="numeric" placeholder="legacy"></td>
  <td><input data-f="pct_in_catch" class="mono" value="${esc(e.pct_in_catch ?? '')}" inputmode="numeric"></td>
  <td><input data-f="monthly_rate" class="mono" value="${esc(e.monthly_rate ?? '')}" inputmode="numeric"></td>
  <td><span class="mono muted">0.42</span></td>
  <td><button type="button" class="btn s icon" data-del="${esc(e.id)}" aria-label="Remove row">×</button></td></tr>`;
};

function render(){
  const b = feasId ? adapter.feasibility(feasId) : null;
  const p = b ? b.project : {}, fd = b ? b.fd : {};
  const feaso = (fd.feasibility_inputs && fd.feasibility_inputs.feaso) || {};
  const lk = { stage: adapter.lookups('competitor_stage'), conf: adapter.lookups('competitor_confidence'), site: adapter.lookups('site_type') };
  const comps = b ? b.competitors.filter(c => (c.status || 'live') === 'live' || c.status === 'closed') : [];
  const pipes = b ? b.competitors.filter(c => c.status === 'pipeline') : [];
  const pots = b ? b.competitors.filter(c => c.status === 'potential') : [];
  // Centres only (type 'centre', seeded by sql/26 from the website). The PM
  // tool's construction projects (type 'project') are NOT centres — they are
  // only shown if this feasibility already links one from the old tool.
  const linked = new Set((b ? b.nearby : []).map(n => n.explorers_project_id));
  const dbCentres = adapter.list('projects').filter(p => p.type === 'centre' || (p.type === 'project' && linked.has(p.id)));
  const seen = new Set(dbCentres.map(c => c.id));
  const centres = [...dbCentres.map(c => ({ ...c, status: c.type === 'project' ? 'project' : c.active === false ? 'opening' : 'open' })), ...EXPLORERS_CENTRES.filter(c => !seen.has(c.id))].sort((a, c) => a.name.localeCompare(c.name));
  const ro = !adapter.canWrite();
  const done = { s1: !!(p.name && fd.site_address && fd.proposed_places), s2: !!(fd.price || feaso.lease_rent), s3: !!fd.gapmaps_5min, s4: comps.length + pipes.length > 0, s5: (b ? b.schools.length : 0) > 0, s6: (b ? b.estates.length : 0) > 0, s7: (b ? b.nearby.length : 0) > 0, s8: !!(fd.site_other_notes || (fd.photo_paths || []).length) };

  $('#app').innerHTML = appbar('Pipeline', { adapter }) + `
  <main class="page">
    <div class="page-head">
      <div><a href="${href('index.html')}" style="font-size:13px;font-weight:600;text-decoration:none">← Pipeline</a>
        <h1 style="margin-top:4px">${feasId ? 'Edit feasibility' : 'New feasibility'}</h1>
        <p class="sub">Everything on one page. Required fields are marked <span style="color:var(--brush-ink);font-weight:600">*</span>; each field saves as you leave it.</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${feasId ? `<a class="btn p" href="${href('site.html', { id: feasId })}">Open workspace →</a>` : `<button class="btn p" id="btn-create" ${ro ? 'disabled' : ''}>Create &amp; open workspace</button>`}
      </div>
    </div>
    <div class="row">
      <aside class="idx card tight" style="flex:0 0 230px;padding:10px;display:flex;flex-direction:column;gap:2px">
        ${SECTIONS.map(([id, l], i) => `<a href="#${id}" class="${done[id] ? 'done' : ''}"><span class="n">${i + 1}</span>${l}</a>`).join('')}
        <div style="margin:10px 4px 4px;padding-top:10px;border-top:1px solid var(--rule);font-size:12px;color:var(--ink-3)">${Object.values(done).filter(Boolean).length} of 8 sections complete. Financials (OpCo / PropCo) are entered in the workspace once the site exists.</div>
      </aside>
      <div class="main-col" id="form" ${ro ? 'style="pointer-events:none;opacity:.7"' : ''}>
        <section class="card sec" id="s1"><h2><span class="n">1</span>Site</h2>
          <div class="grid-3">${field('name', 'Site name', p.name, { req: true })}${field('code', 'Code', p.code, { cls: 'mono', placeholder: 'auto' })}${field('status', 'Status', fd.status || 'reviewing', { req: true, input: 'select', options: statusOptions(adapter) })}</div>
          ${field('site_address', 'Address', fd.site_address, { req: true, placeholder: 'Street, suburb, state, postcode' })}
          <div class="grid-4">${field('site_suburb', 'Suburb', fd.site_suburb)}${field('site_council', 'Council (LGA)', fd.site_council || '', { input: 'select', options: [{ value: '', label: '—' }].concat(fd.site_council && !VIC_LGAS.includes(fd.site_council) ? [{ value: fd.site_council, label: fd.site_council }] : [], VIC_LGAS.map(l => ({ value: l, label: l }))) })}${field('site_state', 'State', fd.site_state || 'VIC', { input: 'select', options: ['VIC', 'NSW', 'QLD', 'SA', 'WA'].map(v => ({ value: v, label: v })) })}${field('site_type', 'Site type', fd.site_type, { input: 'select', options: [{ value: '', label: '—' }].concat(lk.site.map(o => ({ value: o.value, label: o.label }))) })}</div>
          <div class="grid-4">${field('proposed_places', 'Proposed places', fd.proposed_places, { req: true, cls: 'mono' })}${field('land_size_sqm', 'Land size', fd.land_size_sqm, { cls: 'mono', unit: 'm²' })}${field('proposed_use', 'Proposed use', fd.proposed_use)}${field('agent', 'Agent', fd.agent)}</div>
        </section>
        <section class="card sec" id="s2"><h2><span class="n">2</span>Deal</h2><p class="hint">Price and lease terms are hidden from the view-only acquisitions role.</p>
          <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end">
            <div class="f" style="flex:0 0 auto"><label>Deal type</label><div class="seg" id="deal-type">${[['freehold', 'Freehold'], ['leasehold', 'Leasehold'], ['fund_through', 'Fund-through']].map(([v, l]) => `<button type="button" data-deal="${v}" class="${(feaso.deal_type || 'freehold') === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
            <div style="flex:1 1 180px" id="deal-price" ${(feaso.deal_type || 'freehold') === 'leasehold' ? 'hidden' : ''}>${field('price', 'Asking price', fd.price, { cls: 'mono', unit: fd.price && fd.proposed_places ? '$ · ' + fmtAud(Math.round(fd.price / fd.proposed_places)) + ' / place' : '$' })}</div>
            <div style="flex:1 1 180px" id="deal-rent" ${(feaso.deal_type || 'freehold') === 'leasehold' ? '' : 'hidden'}>${field('lease_rent', 'Asking rent', feaso.lease_rent, { cls: 'mono', unit: '$ p.a. net', placeholder: '—' })}</div>
            <div style="flex:1 1 180px">${field('target_settlement', 'Target settlement', feaso.target_settlement, { type: 'date', cls: 'mono' })}</div>
          </div>
        </section>
        <section class="card sec" id="s3"><h2><span class="n">3</span>Demand data</h2><p class="hint">Paste or drop the GapMaps catchment exports; the adjustment chain and scorecard compute from these.</p>
          <div class="grid-2">
            <div class="f"><label>GapMaps · 5-minute catchment</label><div class="drop ${fd.gapmaps_5min ? 'has' : ''}" data-gm="gapmaps_5min">${fd.gapmaps_5min ? `<b>Loaded</b> · ${esc(fd.gapmaps_5min.ldc?.children_05 ?? '?')} children 0–5 · ${esc(fd.gapmaps_5min.ldc?.places ?? '?')} places<br><span style="font-size:12px">Drop a new CSV/JSON export to replace</span>` : 'Drop GapMaps export (CSV or JSON) or <b>paste JSON</b>'}</div></div>
            <div class="f"><label>GapMaps · 10-minute catchment</label><div class="drop ${fd.gapmaps_10min ? 'has' : ''}" data-gm="gapmaps_10min">${fd.gapmaps_10min ? `<b>Loaded</b> · ${esc(fd.gapmaps_10min.ldc?.children_05 ?? '?')} children 0–5 · ${esc(fd.gapmaps_10min.ldc?.places ?? '?')} places` : 'Drop export or <b>paste JSON</b><br><span style="font-size:12px">Optional — used for the three-tier comparison</span>'}</div></div>
          </div>
          <div class="grid-4">
            ${field('target_fee', 'Target fee / day', feaso.target_fee ?? CONFIG.explorersTargetFee, { cls: 'mono', unit: '$' })}
            <div class="f"><label>SEIFA</label><input class="mono" value="${esc(fd.gapmaps_5min?.seifa ?? '—')}" disabled><span class="u">from GapMaps</span></div>
          </div>
        </section>
        <section class="card sec" id="s4"><h2><span class="n">4</span>Competitors</h2><p class="hint">Operating centres in the catchment. Photos: click + on a row — they attach to that row's photo set, not the site's.</p>
          <div style="overflow-x:auto"><table class="edit"><thead><tr><th style="width:24%">Centre</th><th>Operator</th><th>Places</th><th>Dist. km</th><th>Fee / day</th><th>Occ. %</th><th>NQS</th><th>Photos</th><th></th></tr></thead>
            <tbody id="comps">${comps.map(c => compRow(c, 'live', lk)).join('')}</tbody></table></div>
          <button type="button" class="add" data-add="competitor">+ Add competitor</button>
          <div style="border-top:1px solid var(--rule);padding-top:16px;display:flex;flex-direction:column;gap:12px">
            <div><h3>Pipeline centres</h3><p class="hint" style="margin-top:4px">Approved, under-construction or newly opened centres not yet in the competitor list. <strong>Completion %</strong> is the likelihood it completes — its places count at that percentage in step 4 of the demand chain. Choosing a stage sets a default; edit it if you know better. <strong>Already open = 0 %</strong> — its places are already in the GapMaps licensed-places figure, so adding them again would double-count.</p></div>
            <div style="overflow-x:auto"><table class="edit"><thead><tr><th style="width:22%">Site / centre</th><th>Description</th><th>Stage</th><th>Operator</th><th>Places</th><th>Dist. km</th><th title="Likelihood it completes — its places are counted at this percentage in the demand chain">Completion %</th><th>Photos</th><th></th></tr></thead>
              <tbody id="pipes">${pipes.map(c => compRow(c, 'pipeline', lk)).join('')}</tbody></table></div>
            <button type="button" class="add" data-add="pipeline">+ Add pipeline centre</button>
          </div>
          <div style="border-top:1px solid var(--rule);padding-top:16px;display:flex;flex-direction:column;gap:12px">
            <div><h3>Potential competitors</h3><p class="hint" style="margin-top:4px">Sites that could become centres but have no permit yet. Tick <strong>Count</strong> to include the risk-weighted places in the pipeline step of the demand chain; otherwise they show in the report as a watch item only.</p></div>
            <div style="overflow-x:auto"><table class="edit"><thead><tr><th style="width:22%">Site / description</th><th>Stage</th><th>Est. places</th><th>Dist. km</th><th>Source</th><th>Confidence</th><th>Risk %</th><th>Count</th><th>Photos</th><th></th></tr></thead>
              <tbody id="pots">${pots.map(c => compRow(c, 'potential', lk)).join('')}</tbody></table></div>
            <button type="button" class="add" data-add="potential">+ Add potential competitor</button>
          </div>
        </section>
        <section class="card sec" id="s5"><h2><span class="n">5</span>Schools</h2>
          <div style="overflow-x:auto"><table class="edit"><thead><tr><th style="width:26%">School</th><th>Type</th><th>Sector</th><th>Enrolments</th><th>Dist. km</th><th>Address</th><th>Photos</th><th></th></tr></thead><tbody id="schools">${(b ? b.schools : []).map(schoolRow).join('')}</tbody></table></div>
          <button type="button" class="add" data-add="school">+ Add school</button>
        </section>
        <section class="card sec" id="s6"><h2><span class="n">6</span>Housing estates (growth)</h2><p class="hint">Drives the estate-growth step of the demand chain: lots/month × % in catchment, projected 54 months at 0.42 children per lot. The estate list follows the council chosen in section 1 (RPM data); pick <em>Other…</em> to type one.</p>
          <div style="overflow-x:auto"><table class="edit"><thead><tr><th style="width:26%">Estate</th><th>Suburb</th><th>Total lots</th><th>% in catchment</th><th>Lots / month</th><th>Children / lot</th><th></th></tr></thead><tbody id="estates">${(b ? b.estates : []).map(e => estateRow(e, fd.site_council)).join('')}</tbody></table></div>
          <button type="button" class="add" data-add="estate">+ Add estate</button>
        </section>
        <section class="card sec" id="s7"><h2><span class="n">7</span>Nearby Explorers centres</h2><p class="hint">Tick the centres within reach of this site and enter the distance; ticked centres feed the cannibalisation check. List: the 28 centres on explorers.com.au plus any centres in the database.</p>
          <input id="centre-search" placeholder="Filter by suburb or name…" style="max-width:320px;border:1px solid var(--rule-2);border-radius:var(--r);padding:9px 11px;font:inherit;background:#fff">
          <div class="grid-3" id="nearby">${centres.map(c => { const n = b ? b.nearby.find(x => x.explorers_project_id === c.id) : null; const ecd = adapter.get('explorers_centre_data', c.id) || {}; return `<label class="nearby" data-centre="${esc((c.name + ' ' + (c.address || '') + ' ' + (c.suburb || '')).toLowerCase())}" style="${n ? 'border-color:var(--moss);background:var(--sage)' : ''}"><input type="checkbox" data-nearby="${esc(c.id)}" ${n ? 'checked' : ''}><span style="flex:1;min-width:0"><span style="font-weight:600">${esc(c.name)}</span>${c.status === 'opening' ? ' <span class="chip reviewing" style="font-size:10.5px;padding:1px 7px"><i></i>opening</span>' : c.status === 'project' ? ' <span class="chip" style="font-size:10.5px;padding:1px 7px"><i></i>development project</span>' : ''}<br><span style="font-size:12px;color:var(--ink-3)">${esc(c.address || '')}${ecd.current_occupancy_pct != null ? ' · ' + esc(ecd.current_occupancy_pct) + '% occ.' : ''}</span></span>${n ? `<span class="f" style="flex:0 0 76px"><input data-nearby-km="${esc(n.id)}" class="mono" value="${esc(n.distance_km ?? '')}" placeholder="km" inputmode="decimal" style="padding:6px 8px;min-height:32px" aria-label="Distance km"></span>` : ''}</label>`; }).join('')}</div>
        </section>
        <section class="card sec" id="s8"><h2><span class="n">8</span>Files &amp; notes</h2>
          <div class="grid-2">
            <div class="f"><label>Site photos, aerials, agent IM, title</label><div class="drop" style="padding:28px"><label style="cursor:pointer"><b>Choose files</b><input type="file" id="site-files" multiple accept="image/*,.pdf" class="sr"></label><br><span style="font-size:12px">${(fd.photo_paths || []).length} on file · photos taken on the phone sync here automatically</span></div></div>
            ${field('site_other_notes', 'Other notes', fd.site_other_notes, { input: 'textarea' })}
          </div>
        </section>
      </div>
    </div>
  </main>`;
  wire();
  if (feasId) hydratePhotos(adapter, feasId);
}

async function ensureCreated(){
  if (feasId) return feasId;
  const id = adapter.newId();
  const name = $('#name').value.trim() || 'Untitled feasibility';
  const res = await adapter.upsert('projects', { id, type: 'feasibility', name, code: $('#code').value.trim() || null, active: true });
  if (!res.ok){ toast(res.reason, 'err'); return null; }
  const res2 = await adapter.upsert('feasibility_data', { id, status: $('#status').value || 'reviewing', prepared_by: adapter.user.initials, site_state: 'VIC', feasibility_inputs: { feaso: { deal_type: 'freehold', target_fee: CONFIG.explorersTargetFee } }, report_config: {} });
  if (!res2.ok){ toast('Could not create the site record: ' + res2.reason, 'err'); await adapter.remove('projects', id); return null; }
  feasId = id; created = true;
  history.replaceState(null, '', href('new.html', { id }));
  return id;
}

const PROJECT_FIELDS = new Set(['name', 'code']);
const FEASO_FIELDS = new Set(['lease_rent', 'target_settlement', 'target_fee']);
const NUMERIC = new Set(['proposed_places', 'land_size_sqm', 'price', 'lease_rent', 'target_fee', 'places', 'distance_km', 'fee', 'ms_current_capacity', 'risk_pct', 'enrolments', 'lots', 'pct_in_catch', 'monthly_rate']);

async function saveField(input){
  const f = input.dataset.field; let v = input.value;
  if (NUMERIC.has(f)) v = num(v);
  if (!(await ensureCreated())) return;
  input.classList.add('unsaved');
  let res;
  if (PROJECT_FIELDS.has(f)) res = await adapter.patch('projects', feasId, { [f]: v || null });
  else if (FEASO_FIELDS.has(f)){ const fd = adapter.get('feasibility_data', feasId) || {}; const fi = { ...(fd.feasibility_inputs || {}) }; fi.feaso = { ...(fi.feaso || {}), [f]: v || null }; res = await adapter.patch('feasibility_data', feasId, { feasibility_inputs: fi }); }
  else res = await adapter.patch('feasibility_data', feasId, { [f]: v === '' ? null : v });
  if (res.ok){ input.classList.remove('unsaved', 'err'); } else { input.classList.add('err'); toast(res.reason || 'Not saved', 'err'); }
}

async function saveRowField(tr, input){
  const coll = tr.dataset.coll, id = tr.dataset.row, f = input.dataset.f;
  let v = input.type === 'checkbox' ? input.checked : input.value;
  if (NUMERIC.has(f)) v = num(v);
  if (v === '') v = null;
  input.classList.add('unsaved');
  const res = await adapter.patch(coll, id, { [f]: v });
  if (res.ok) input.classList.remove('unsaved', 'err'); else { input.classList.add('err'); toast(res.reason || 'Not saved', 'err'); }
}

async function addRow(kind){
  if (!(await ensureCreated())) return;
  const id = adapter.newId();
  const base = { id, feasibility_id: feasId, sort_order: Date.now() % 100000, photo_paths: [] };
  if (kind === 'competitor') await adapter.upsert('feasibility_competitors', { ...base, status: 'live', name: '' });
  if (kind === 'pipeline') await adapter.upsert('feasibility_competitors', { ...base, status: 'pipeline', name: '', stage: 'Permit issued', risk_pct: 60 });
  if (kind === 'potential') await adapter.upsert('feasibility_competitors', { ...base, status: 'potential', name: '', stage: 'rumoured', confidence: 'medium', risk_pct: 40, count_in_chain: false });
  if (kind === 'school') await adapter.upsert('feasibility_schools', { ...base, name: '', type: 'primary', sector: 'public' });
  if (kind === 'estate') await adapter.upsert('feasibility_estates', { ...base, name: '', pct_in_catch: 100 });
  render();
  const tr = $(`tr[data-row="${id}"]`); if (tr){ tr.scrollIntoView({ block: 'center' }); const first = tr.querySelector('input'); if (first) first.focus(); }
}

function wire(){
  $$('#form [data-field]').forEach(el => el.addEventListener('change', () => saveField(el)));
  $$('#form tr[data-row]').forEach(tr => $$('[data-f]', tr).forEach(inp => { if (inp.hasAttribute('data-estate-pick')) return; inp.addEventListener('change', () => saveRowField(tr, inp)); }));
  $$('[data-add]').forEach(b => b.addEventListener('click', () => addRow(b.dataset.add)));
  $$('[data-del]').forEach(b => b.addEventListener('click', async () => { const tr = b.closest('tr'); const res = await adapter.remove(tr.dataset.coll, tr.dataset.row); if (res.ok){ tr.remove(); toast('Row removed'); } else toast(res.reason, 'err'); }));
  $$('#deal-type [data-deal]').forEach(b => b.addEventListener('click', async () => { if (!(await ensureCreated())) return; const fd = adapter.get('feasibility_data', feasId); if (!fd){ toast('Site record missing — reload the page', 'err'); return; } const fi = { ...(fd.feasibility_inputs || {}) }; fi.feaso = { ...(fi.feaso || {}), deal_type: b.dataset.deal }; const res = await adapter.patch('feasibility_data', feasId, { feasibility_inputs: fi }); if (res.ok){ $$('#deal-type button').forEach(x => x.classList.toggle('on', x === b)); $('#deal-price').hidden = b.dataset.deal === 'leasehold'; $('#deal-rent').hidden = b.dataset.deal !== 'leasehold'; } else toast(res.reason, 'err'); }));
  $$('[data-nearby]').forEach(cb => cb.addEventListener('change', async () => {
    if (!(await ensureCreated())) return;
    const existing = adapter.list('feasibility_nearby_explorers', { feasibility_id: feasId }).find(n => n.explorers_project_id === cb.dataset.nearby);
    if (cb.checked && !existing){
      const c = adapter.get('projects', cb.dataset.nearby) || EXPLORERS_CENTRES.find(x => x.id === cb.dataset.nearby);
      const res = await adapter.upsert('feasibility_nearby_explorers', { id: adapter.newId(), feasibility_id: feasId, explorers_project_id: c.id, name: c.name, counts: true });
      if (!res.ok){ cb.checked = false; toast(/foreign key|violates/i.test(res.reason) ? 'Centre not in the database yet — run sql/26-explorers-centres.sql' : res.reason, 'err'); return; }
    }
    if (!cb.checked && existing) await adapter.remove('feasibility_nearby_explorers', existing.id);
    render(); $('#s7').scrollIntoView({ block: 'center' });
  }));
  $$('[data-nearby-km]').forEach(inp => inp.addEventListener('change', async () => { const res = await adapter.patch('feasibility_nearby_explorers', inp.dataset.nearbyKm, { distance_km: num(inp.value) }); if (!res.ok) toast(res.reason, 'err'); }));
  const cs = $('#centre-search'); if (cs) cs.addEventListener('input', () => { const q = cs.value.toLowerCase().trim(); $$('#nearby [data-centre]').forEach(l => { l.style.display = !q || l.dataset.centre.includes(q) || l.querySelector('input').checked ? '' : 'none'; }); });
  // estate dropdown: picking fills suburb + lots/month; "Other…" reveals free text
  $$('[data-estate-pick]').forEach(sel => sel.addEventListener('change', async () => {
    const tr = sel.closest('tr'), other = tr.querySelector('[data-estate-other]');
    if (sel.value === '__other'){ other.style.display = ''; other.focus(); return; }
    other.style.display = 'none';
    const o = sel.selectedOptions[0]; const fields = { name: sel.value || null };
    if (o && o.dataset.suburb){ fields.suburb = o.dataset.suburb; tr.querySelector('[data-f="suburb"]').value = o.dataset.suburb; }
    if (o && o.dataset.rate){ fields.monthly_rate = Number(o.dataset.rate); tr.querySelector('[data-f="monthly_rate"]').value = o.dataset.rate; }
    const res = await adapter.patch(tr.dataset.coll, tr.dataset.row, fields); if (!res.ok) toast(res.reason, 'err');
  }));
  // pipeline stage → default completion % (Already open = 100)
  $$('#pipes [data-f="stage"]').forEach(sel => sel.addEventListener('change', async () => {
    const pct = STAGE_DEFAULT_PCT[sel.value]; if (pct == null) return;
    const tr = sel.closest('tr'); const inp = tr.querySelector('[data-f="risk_pct"]'); inp.value = pct;
    const res = await adapter.patch(tr.dataset.coll, tr.dataset.row, { risk_pct: pct }); if (!res.ok) toast(res.reason, 'err');
  }));
  // council change re-renders so the estate dropdown follows it
  const council = $('#site_council'); if (council) council.addEventListener('change', () => setTimeout(render, 50));
  // GapMaps drop / paste (JSON in this pass; CSV parser is ported next)
  $$('[data-gm]').forEach(zone => {
    const load = async text => {
      let parsed; try { parsed = JSON.parse(text); } catch(e){ toast('Expected GapMaps JSON (CSV parsing comes in the next pass)', 'err'); return; }
      if (!(await ensureCreated())) return;
      const res = await adapter.patch('feasibility_data', feasId, { [zone.dataset.gm]: parsed });
      if (res.ok){ toast('GapMaps data loaded'); render(); } else toast(res.reason, 'err');
    };
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--pine)'; });
    zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
    zone.addEventListener('drop', async e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) load(await f.text()); });
    zone.addEventListener('click', async () => { const t = prompt('Paste GapMaps JSON'); if (t) load(t); });
  });
  // Photos (row-level and site-level)
  $$('[data-photo]').forEach(b => b.addEventListener('click', () => pickPhotos(b.closest('tr').dataset.coll, b.dataset.photo, b.dataset.sub)));
  const sf = $('#site-files'); if (sf) sf.addEventListener('change', () => uploadFiles('feasibility_data', feasId, 'site', sf.files));
  const create = $('#btn-create'); if (create) create.addEventListener('click', async () => { const req = ['name', 'site_address', 'proposed_places'].filter(id => !$('#' + id).value.trim()); if (req.length){ req.forEach(id => $('#' + id).classList.add('err')); toast('Fill the required fields first', 'err'); return; } await saveField($('#name')); for (const id of ['site_address', 'proposed_places', 'status']) await saveField($('#' + id)); if (feasId) location.href = href('site.html', { id: feasId }); });
}

function pickPhotos(coll, id, sub){
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
  inp.addEventListener('change', () => uploadFiles(coll, id, sub, inp.files)); inp.click();
}
async function uploadFiles(coll, id, sub, files){
  if (!(await ensureCreated())) return;
  const row = adapter.get(coll, id || feasId); if (!row) return;
  const paths = [...(row.photo_paths || [])];
  for (const f of files){ const r = await adapter.uploadPhoto(feasId, f, sub); if (r.ok) paths.push(r.path); else toast(r.reason, 'err'); }
  const res = await adapter.patch(coll, id || feasId, { photo_paths: paths });
  if (res.ok){ toast(`${files.length} photo${files.length === 1 ? '' : 's'} attached`); render(); } else toast(res.reason, 'err');
}

boot(async a => { adapter = a; feasId = qs().get('id') || null; if (feasId && !adapter.get('projects', feasId)) feasId = null; render(); });

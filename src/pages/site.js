import { boot, appbar, esc, $, $$, href, toast, ICON, statusChip, qs, hydratePhotos } from '../ui/shell.js';
import { computeFeasibilityMetrics, fmtRatio, fmtAud, fmtN, fmtPct, ratingCls } from '../logic/metrics.js';
import { canonicalStatus, ACTIVE_STATUSES, STATUS_ORDER, statusOptions, relativeTime, statusLabel } from '../logic/status.js';
import { runPreflight } from '../logic/preflight.js';

let adapter, id, tab = qs().get('tab') || 'market';
const thumbs = (paths, n = 3) => { const ps = (paths || []); return ps.length ? `<div class="pc">${ps.slice(0, n).map(pp => `<a href="#" class="photo-open" data-photo-path="${esc(pp)}" style="width:34px;height:34px;border-radius:5px;background:var(--sage) center/cover no-repeat;display:inline-block;flex:none" aria-label="Open photo"></a>`).join('')}${ps.length > n ? `<span class="more">+${ps.length - n}</span>` : ''}</div>` : '<span class="muted">—</span>'; };

const TABS = [['site', 'Site'], ['market', 'Market'], ['financials', 'Financials'], ['report', 'Report'], ['activity', 'Activity']];

function rail(){
  const rows = adapter.feasibilityProjects().map(p => ({ p, st: canonicalStatus((adapter.get('feasibility_data', p.id) || {}).status || '') }))
    .sort((a, b) => (STATUS_ORDER[a.st] || 9) - (STATUS_ORDER[b.st] || 9) || a.p.name.localeCompare(b.p.name));
  const active = rows.filter(r => ACTIVE_STATUSES.has(r.st) || r.st === 'go'), closed = rows.filter(r => !(ACTIVE_STATUSES.has(r.st) || r.st === 'go'));
  const item = r => `<a href="${href('site.html', { id: r.p.id, tab })}" class="${r.p.id === id ? 'on' : ''}"><span class="dot ${esc(r.st)}"></span>${esc(r.p.name.split(' — ')[0])}</a>`;
  return `<aside class="rail"><a class="back" href="${href('index.html')}">← All sites</a>
    <div class="hdr">Active · ${active.length}</div>${active.map(item).join('')}
    ${closed.length ? `<div class="hdr" style="padding-top:14px">Closed · ${closed.length}</div>${closed.map(item).join('')}` : ''}</aside>`;
}

function hero(b, m, ro){
  const fd = b.fd, feaso = fd.feasibility_inputs?.feaso || {};
  const verdict = m.demandStrength === 'TBD' ? '—' : m.demandStrength[0] + m.demandStrength.slice(1).toLowerCase();
  const ratings = [m.demandRating, m.compRating, m.demoRating, m.pipeRating];
  const goCount = ratings.filter(r => r === 'Go').length;
  const perPlace = fd.price && fd.proposed_places ? fmtAud(Math.round(fd.price / fd.proposed_places / 1000)) + 'k / place' : '';
  return `<div class="grid-5">
    <div class="hero primary"><span class="l">Effective demand</span><span class="v mono">${fmtRatio(m.effectiveRatio)}</span><span class="s">raw ${fmtRatio(m.ratioRaw5)} · VIC avg ${fmtRatio(m.vicRatio)}</span></div>
    <div class="hero"><span class="l">Demand signal</span><span class="v" style="color:${m.demandStrength === 'STRONG' ? 'var(--pine-ink)' : m.demandStrength === 'WEAK' ? 'var(--red-ink)' : 'var(--brush-ink)'}">${esc(verdict)}</span><span class="s">scorecard ${goCount} / 4 Go${m.pipeRating !== 'Go' ? ' · pipeline risk' : ''}</span></div>
    <div class="hero"><span class="l">Proposed places</span><span class="v mono">${esc(fd.proposed_places ?? '—')}</span><span class="s">0–5 cohort ${fmtN(m.currentChildren || null)} in 5-min</span></div>
    <div class="hero"><span class="l">Competitors</span><span class="v mono">${m.liveComps.length} ${m.pipeline.length + m.potentialCounted.length ? `<span style="font-size:14px;color:var(--brush-ink)">+${m.pipeline.length + m.potentialCounted.length} pipeline</span>` : ''}</span><span class="s">${fmtN(m.currentPlaces || null)} licensed places in catchment</span></div>
    <div class="hero"><span class="l">${feaso.deal_type === 'leasehold' ? 'Lease rent' : 'Land price'}</span><span class="v mono">${ro ? '<span class="muted" style="font-size:16px">hidden</span>' : feaso.deal_type === 'leasehold' ? fmtAud(feaso.lease_rent) : (fd.price ? fmtAud(fd.price / 1e6) + 'm' : '—')}</span><span class="s">${ro ? 'view-only role' : feaso.deal_type === 'leasehold' ? 'p.a. net' : [perPlace, fd.land_size_sqm ? fmtN(fd.land_size_sqm) + ' m²' : ''].filter(Boolean).join(' · ')}</span></div>
  </div>`;
}

const arrow = `<div class="arrow">${ICON.arrow}</div>`;
function chain(m){
  const step = (n, l, v, d, cls = '') => `<div class="step ${cls}"><span class="n">${n}</span><span class="v mono">${v}</span><span class="d">${d}</span></div>`;
  const stress = m.stressTestRatio != null ? `Sensitivity: if every permit and counted potential site completes at 100%, the ratio falls to ${fmtRatio(m.stressTestRatio)}.` : '';
  return `<section class="card"><h2>Demand adjustment chain</h2><p class="sub">Children 0–5 ÷ licensed long-day-care places. The effective ratio at the end is the operative figure.</p>
    <div class="chain">
      ${step('1 · Raw', '', fmtRatio(m.ratioRaw5), `${fmtN(m.currentChildren || null)} ÷ ${fmtN(m.currentPlaces || null)} places`)}${arrow}
      ${step('2 · Participation', '', fmtRatio(m.ratioStep2), `×${m.participationFactor.toFixed(2)} · placeholder, unvalidated`, 'weak')}${arrow}
      ${step('3 · CALD', '', fmtRatio(m.ratioStep3), `×${m.caldFactor.toFixed(2)}${m.localOverseasPct != null ? ` · ${fmtPct(m.localOverseasPct)} overseas-born` : ' · no place-of-birth data'}`, 'weak')}${arrow}
      ${step('4 · Forward supply', '', fmtRatio(m.ratioStep4), `+${fmtN(m.newPlacesFromPipeline)} places (incl. ours) · +${fmtN(m.estimatedNewChildren)} children`)}${arrow}
      ${step('Effective', '', fmtRatio(m.effectiveRatio), `${m.demandStrength} · 0.42 ch/lot, 54 mo build-out`, 'final')}
    </div>
    <div class="note" style="margin-top:12px">${ICON.warn} Dashed steps are weak inputs. ${esc(stress)}</div></section>`;
}

function competitors(b, m){
  const row = c => `<tr><td style="font-weight:600">${esc(c.name)}${c.project_desc ? `<div style="font-size:11.5px;color:var(--ink-3);font-weight:400">${esc(c.project_desc)}</div>` : ''}</td><td>${esc(c.operator || (c.stage ? statusLabelStage(c.stage) : '—'))}</td><td><span class="chip ${esc(c.status || 'live')}"><i></i>${c.status === 'pipeline' ? 'Permit' : c.status === 'potential' ? 'Potential' : 'Live'}</span></td><td class="mono">${esc(c.places ?? '—')}</td><td class="mono">${c.distance_km != null ? esc(c.distance_km) + ' km' : '—'}</td><td class="mono">${c.fee ? fmtAud(c.fee) : '—'}</td><td class="mono">${c.ms_current_capacity != null ? esc(c.ms_current_capacity) + '%' : '—'}</td><td>${c.status === 'live' ? threat(c, m) : c.count_in_chain === false && c.status === 'potential' ? '<span class="flag tbd">watch only</span>' : `<span class="flag ${c.risk_pct >= 70 ? 'high' : c.risk_pct >= 40 ? 'medium' : 'low'}">${esc(c.risk_pct ?? '—')}% risk</span>`}</td><td>${thumbs(c.photo_paths)}</td></tr>`;
  const sorted = b.competitors.slice().sort((a, c) => (Number(a.distance_km) || 99) - (Number(c.distance_km) || 99));
  return `<section class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap"><div><h2>Competitors · 5-min catchment</h2><p class="sub">${m.liveComps.length} live, ${m.pipeline.length} permitted, ${m.potential.length} potential (${m.potentialCounted.length} counted) · sorted by distance</p></div><a class="btn s" href="${href('new.html', { id }) + '#s4'}">Edit competitors</a></div>
    <div style="overflow-x:auto"><table><thead><tr><th>Centre</th><th>Operator / stage</th><th>Status</th><th>Places</th><th>Dist.</th><th>Fee / day</th><th>Occupancy</th><th>Threat</th><th>Photos</th></tr></thead><tbody>${sorted.map(row).join('') || '<tr><td colspan="9" class="empty">No competitors entered.</td></tr>'}</tbody></table></div></section>`;
}
const statusLabelStage = s => (adapter.lookups('competitor_stage').find(o => o.value === s) || { label: s }).label;
function threat(c, m){
  const close = Number(c.distance_km) <= 1, big = Number(c.places) >= 110, full = Number(c.ms_current_capacity) >= 88;
  const score = (close ? 1 : 0) + (big ? 1 : 0) + (full ? 1 : 0);
  return `<span class="flag ${score >= 2 ? 'high' : score === 1 ? 'medium' : 'low'}">${score >= 2 ? 'High' : score === 1 ? 'Watch' : 'Low'}</span>`;
}

function growth(m){
  const proj = m.gm5?.age_projection_0_5;
  if (!proj) return `<section class="card"><h2>Housing growth · 0–5 cohort projection</h2><p class="sub">No projection in the GapMaps data.</p></section>`;
  const years = Object.keys(proj).filter(k => /^\d{4}$/.test(k)).sort();
  const vals = years.map(y => Number(proj[y])); const max = Math.max(...vals);
  const trend = vals[vals.length - 1] >= vals[0] ? 'growing' : 'declining';
  return `<section class="card"><h2>Housing growth · 0–5 cohort projection</h2><p class="sub">Historical growth ${proj.historical_growth_pct != null ? proj.historical_growth_pct + '%/yr' : '—'}; forward projection is <strong>${trend}</strong> — the trend tag follows the projection, not history. Estates add ~${fmtN(m.estimatedNewChildren)} children over 54 months (${fmtN(m.newLots)} lots).</p>
    <div class="cols">${vals.map((v, i) => `<div><span class="mono" style="font-size:11px;color:var(--ink-3)">${fmtN(v)}</span><div class="col ${i === 0 ? 'first' : ''}" style="height:${Math.round(v / max * 104)}px"></div></div>`).join('')}</div>
    <div class="axis mono">${years.map(y => `<span>${y}</span>`).join('')}</div></section>`;
}

function scorecard(m){
  const row = (l, r, d) => `<div title="${esc(d)}"><span>${l}</span><span class="flag ${ratingCls(r)}">${esc(r)}</span></div>`;
  return `<section class="card"><h2>Scorecard</h2><p class="sub">Threshold screen — not a recommendation</p><div class="kvs">
    ${row('Effective demand', m.demandRating, m.demandDesc)}${row('Pipeline exposure', m.pipeRating, m.pipeDesc)}${row('Competition', m.compRating, m.compDesc)}${row('Demographics', m.demoRating, m.demoDesc)}
    ${row(`Fee positioning (${fmtAud(m.explorersTargetFee)})`, m.headroomFee == null ? 'TBD' : m.headroomFee >= 0 ? 'Go' : 'Watch', m.avgLiveFee ? `avg live fee ${fmtAud(m.avgLiveFee)}` : '')}
    ${(m.nearby || []).filter(n => n.counts !== false).map(n => row(`Cannibalisation (${esc(n.name)} ${esc(n.distance_km)} km)`, Number(n.distance_km) <= 3 ? 'Watch' : 'Go', '')).join('')}
  </div></section>`;
}

function completeness(b, m){
  const fd = b.fd, feaso = fd.feasibility_inputs?.feaso || {};
  const items = [
    ['GapMaps 5-min', !!fd.gapmaps_5min, relativeTime(fd.updated_at)], ['GapMaps 10-min', !!fd.gapmaps_10min, 'optional'],
    ['Competitor list', b.competitors.length > 0, b.competitors.length + ' rows'],
    ['Competitor occupancy', m.liveComps.length > 0 && m.liveComps.every(c => c.ms_current_capacity != null), `${m.liveComps.filter(c => c.ms_current_capacity == null).length} of ${m.liveComps.length} missing`],
    ['School enrolments', b.schools.length > 0 && b.schools.every(s => s.enrolments != null), b.schools.length ? '' : 'not captured'],
    ['Estate pipeline', b.estates.length > 0, b.estates.length + ' estates'], ['OpCo feaso', !!feaso.op, feaso.op ? '' : 'not saved'],
  ];
  return `<section class="card"><h2>Data completeness</h2><p class="sub">Absent data is not zero</p><div class="dots">${items.map(([l, ok, d]) => `<div><span class="dot ${ok ? 'ok' : 'miss'}"></span>${esc(l)}${d ? ` <span class="muted">· ${esc(d)}</span>` : ''}</div>`).join('')}</div></section>`;
}

function decisionHistory(b, m){
  // Closest past decision: nearest effective ratio among closed sites.
  const closed = adapter.feasibilityProjects().filter(p => p.id !== id).map(p => { const bb = adapter.feasibility(p.id); return { p, bb, mm: computeFeasibilityMetrics(bb) }; }).filter(x => ['rejected', 'go'].includes(canonicalStatus(x.bb.fd.status)) && x.mm.effectiveRatio != null && m.effectiveRatio != null);
  if (!closed.length) return '';
  const best = closed.sort((a, c) => Math.abs(a.mm.effectiveRatio - m.effectiveRatio) - Math.abs(c.mm.effectiveRatio - m.effectiveRatio))[0];
  return `<section class="card dark"><h2>Decision history match</h2><p class="sub">Closest past call</p><div style="font-size:13.5px;line-height:1.5"><span style="font-weight:600;color:#fff">${esc(best.p.name)}</span> — ${fmtRatio(best.mm.effectiveRatio)} effective, ${esc(statusLabel(adapter, best.bb.fd.status))}. ${esc(best.bb.fd.site_other_notes || '')}</div></section>`;
}

function mapCard(b, m){
  return `<section class="card" style="padding:0;overflow:hidden"><div class="map"><div class="grid"></div><span style="position:relative;background:var(--paper);padding:4px 10px;border-radius:6px">Map — needs lat/long (see README)</span></div>
    <div class="legend"><span><i style="background:var(--brush)"></i>Site</span><span><i style="background:var(--pine)"></i>Live (${m.liveComps.length})</span><span><i style="background:var(--brush-l);border:1.5px solid var(--brush-ink);box-sizing:border-box"></i>Permit (${m.pipeline.length})</span><span><i style="background:var(--moss)"></i>Explorers (${b.nearby.length})</span></div></section>`;
}

function siteTab(b){
  const fd = b.fd, feaso = fd.feasibility_inputs?.feaso || {}, ro = !adapter.canWrite();
  const kv = (l, v) => `<div><span class="muted">${l}</span><span style="font-weight:500;text-align:right">${v || '—'}</span></div>`;
  return `<div class="row"><div class="main-col">
    <section class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px"><h2>Site details</h2><a class="btn s" href="${href('new.html', { id })}">Edit</a></div><div class="grid-2" style="margin-top:14px"><div class="kvs">${kv('Address', esc(fd.site_address))}${kv('Suburb', esc(fd.site_suburb))}${kv('Council', esc(fd.site_council))}${kv('State', esc(fd.site_state))}${kv('Site type', esc(fd.site_type))}</div><div class="kvs">${kv('Proposed places', esc(fd.proposed_places))}${kv('Land size', fd.land_size_sqm ? fmtN(fd.land_size_sqm) + ' m²' : '')}${kv('Proposed use', esc(fd.proposed_use))}${kv('Agent', esc(fd.agent))}${kv('Prepared by', esc(fd.prepared_by))}</div></div></section>
    <section class="card"><h2>Deal</h2><div class="kvs" style="margin-top:12px">${kv('Deal type', esc(feaso.deal_type || 'freehold'))}${kv('Asking price', ro ? 'hidden' : fmtAud(fd.price))}${kv('Lease rent', ro ? 'hidden' : feaso.lease_rent ? fmtAud(feaso.lease_rent) + ' p.a.' : '')}${kv('Target settlement', esc(feaso.target_settlement))}</div></section>
    <section class="card"><h2>Notes</h2><p style="margin:10px 0 0;white-space:pre-wrap">${esc(fd.site_other_notes || '—')}</p></section>
    <section class="card"><h2>Schools</h2><div style="overflow-x:auto;margin-top:12px"><table><thead><tr><th>School</th><th>Type</th><th>Sector</th><th>Enrolments</th><th>Dist.</th><th>Photos</th></tr></thead><tbody>${b.schools.map(s => `<tr><td style="font-weight:600">${esc(s.name)}</td><td>${esc(s.type)}</td><td>${esc(s.sector)}</td><td class="mono">${fmtN(s.enrolments)}</td><td class="mono">${esc(s.distance_km)} km</td><td>${thumbs(s.photo_paths)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">None entered.</td></tr>'}</tbody></table></div></section>
  </div><aside class="side-col">${mapCard(b, computeFeasibilityMetrics(b))}
    <section class="card"><h2>Photos</h2><p class="sub">${(fd.photo_paths || []).length} site photos · ${b.competitors.reduce((a, c) => a + (c.photo_paths || []).length, 0)} on competitors · ${b.schools.reduce((a, s) => a + (s.photo_paths || []).length, 0)} on schools</p><div id="site-photos" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px">${[...(fd.photo_paths || []), ...b.competitors.flatMap(c => (c.photo_paths || []).map(pp => pp)), ...b.schools.flatMap(s => (s.photo_paths || []))].slice(0, 9).map(pp => `<a href="#" data-photo-path="${esc(pp)}" style="aspect-ratio:1;border-radius:8px;background:var(--sage) center/cover no-repeat;display:block"></a>`).join('') || '<div class="muted" style="grid-column:1/-1">No photos on file — the Photos tab in the report lists everything in storage.</div>'}</div></section>
  </aside></div>`;
}

function marketTab(b, m){
  return `<div class="row"><div class="main-col">${chain(m)}${competitors(b, m)}${growth(m)}</div><aside class="side-col">${mapCard(b, m)}${scorecard(m)}${completeness(b, m)}${decisionHistory(b, m)}</aside></div>`;
}
function financialsTab(b){
  const feaso = b.fd.feasibility_inputs?.feaso || {}, ro = !adapter.canWrite();
  return `<div class="row"><div class="main-col"><section class="card"><h2>OpCo feaso</h2><p class="sub">Operating business case</p>${feaso.op ? `<div class="kvs"><div><span>Year-3 EBITDA</span><span class="mono">${fmtAud(feaso.op.year3_ebitda)}</span></div></div>` : '<div class="empty">OpCo feaso not saved. The OpCo / PropCo editor (acq-feaso.js) is wired in the next pass.</div>'}</section>
    ${ro ? '<section class="card"><h2>PropCo feaso</h2><div class="empty">Hidden for the view-only role.</div></section>' : '<section class="card"><h2>PropCo feaso</h2><div class="empty">PropCo editor (acq-feaso.js) is wired in the next pass.</div></section>'}</div></div>`;
}
function activityTab(b){
  return `<div class="row"><div class="main-col"><section class="card"><h2>Comments</h2><div style="margin-top:12px">${b.comments.map(c => `<div class="act"><div><span style="font-weight:600">${esc(c.author)}</span>${c.section ? ` <span class="chip">${esc(c.section)}</span>` : ''}<div>${esc(c.comment)}</div><div class="t">${relativeTime(c.created_at)}</div></div></div>`).join('') || '<div class="muted">No comments yet.</div>'}</div>
    ${adapter.canWrite() ? '<div class="f" style="margin-top:14px"><label for="new-comment">Add comment</label><textarea id="new-comment"></textarea><button class="btn p" id="btn-comment" style="align-self:flex-start;margin-top:6px">Post</button></div>' : ''}</section>
    <section class="card"><h2>History</h2><div style="margin-top:12px"><div class="act"><div>Created <span class="t">${relativeTime(b.project.created_at)}</span></div></div><div class="act"><div>Last saved <span class="t">${relativeTime(b.fd.updated_at)}</span></div></div></div></section></div></div>`;
}

function render(){
  const b = adapter.feasibility(id);
  if (!b){ $('#app').innerHTML = appbar('Pipeline', { adapter }) + `<div class="empty">Site not found. <a href="${href('index.html')}">Back to pipeline</a></div>`; return; }
  const m = computeFeasibilityMetrics(b), fd = b.fd, ro = !adapter.canWrite();
  const pf = runPreflight(b);
  $('#app').innerHTML = appbar('Pipeline', { adapter }) + `<div class="split">${rail()}<main>
    <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start">
      <div style="display:flex;flex-direction:column;gap:6px"><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><h1>${esc(b.project.name)}</h1>${statusChip(adapter, fd.status)}</div>
        <div style="color:var(--ink-2);font-size:13.5px">${[fd.site_address, fd.site_council ? fd.site_council + (/city|shire/i.test(fd.site_council) ? '' : ' City') : '', fd.site_type, b.project.code, fd.agent ? 'Agent: ' + fd.agent : ''].filter(Boolean).map(esc).join(' · ')}</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn s" href="${href('new.html', { id })}">Edit inputs</a><a class="btn s" href="${href('report.html', { id })}">Board report${pf.blocking ? ` <span class="flag no-go">${pf.blocking}</span>` : ''}</a>
        ${ro ? '' : `<select class="btn p" id="status-select" aria-label="Change status" style="appearance:auto">${statusOptions(adapter).map(o => `<option value="${esc(o.value)}" ${canonicalStatus(fd.status) === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`}</div>
    </div>
    ${hero(b, m, ro)}
    <nav class="tabs" aria-label="Site sections">${TABS.map(([k, l]) => k === 'report' ? `<a href="${href('report.html', { id })}">${l}</a>` : `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}${k === 'activity' && b.comments.length ? `<span class="count mono">${b.comments.length}</span>` : ''}</button>`).join('')}</nav>
    ${tab === 'site' ? siteTab(b) : tab === 'financials' ? financialsTab(b) : tab === 'activity' ? activityTab(b) : marketTab(b, m)}
  </main></div>`;
  $$('[data-tab]').forEach(btn => btn.addEventListener('click', () => { tab = btn.dataset.tab; history.replaceState(null, '', href('site.html', { id, tab })); render(); }));
  const ss = $('#status-select'); if (ss) ss.addEventListener('change', async () => { const res = await adapter.patch('feasibility_data', id, { status: ss.value }); if (res.ok){ toast('Status updated'); render(); } else toast(res.reason, 'err'); });
  hydratePhotos(adapter, id).then(() => { $$('#site-photos [data-photo-path], .photo-open').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const u = a.style.backgroundImage.slice(5, -2); if (u) window.open(u, '_blank'); })); });
  const bc = $('#btn-comment'); if (bc) bc.addEventListener('click', async () => { const t = $('#new-comment').value.trim(); if (!t) return; const res = await adapter.upsert('feasibility_comments', { id: adapter.newId(), feasibility_id: id, author: adapter.user.initials, comment: t }); if (res.ok) render(); else toast(res.reason, 'err'); });
}

boot(async a => { adapter = a; id = qs().get('id'); render(); adapter.on('change', () => render()); });

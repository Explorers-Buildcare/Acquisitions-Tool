// Report workspace: slide rail · live slide preview + narrative editor · pre-flight.
// Slide prose lives in feasibility_data.report_config (existing jsonb column):
//   { slides: { exec: { recommendation, summary, hidden, include_viewonly } ... }, versions: [...] }
import { boot, appbar, esc, $, $$, href, toast, ICON, statusChip, qs } from '../ui/shell.js';
import { computeFeasibilityMetrics, fmtRatio, fmtAud, fmtN } from '../logic/metrics.js';
import { runPreflight } from '../logic/preflight.js';
import { statusLabel, relativeTime } from '../logic/status.js';

let adapter, id, slide = 'exec';
const SLIDES = [
  ['cover', 'Cover', 'site · hero ratio · verdict'], ['exec', 'Executive summary', 'recommendation first'], ['site', 'Site & location', 'address · zoning · photos'],
  ['demand', 'Demand signal', 'adjustment chain'], ['comp', 'Competitive landscape', 'live + pipeline + map'], ['bench', 'Benchmarks', '5-min · 10-min · VIC · AUS'],
  ['demo', 'Demographics', 'age · CALD · SEIFA'], ['schools', 'Schools & anchors', ''], ['growth', 'Housing growth', 'estate pipeline · projection'],
  ['opco', 'OpCo summary', ''], ['propco', 'PropCo summary', 'hidden for view-only role'], ['risks', 'Risks & conditions', ''],
];
const SLIDE_NO = Object.fromEntries(SLIDES.map(([k], i) => [k, i + 1]));

function defaultSummary(b, m){
  const fd = b.fd;
  const parts = [];
  if (m.effectiveRatio != null) parts.push(`${m.demandStrength === 'STRONG' ? 'Strong' : m.demandStrength === 'MODERATE' ? 'Moderate' : 'Weak'} underlying demand (${fmtRatio(m.effectiveRatio)} effective, VIC ${fmtRatio(m.vicRatio)})${fd.site_type ? ` in a ${fd.site_type.toLowerCase()}` : ''}${b.schools.length ? ` with ${b.schools[0].name} at ${fmtN(Math.round(b.schools[0].distance_km * 1000))} m` : ''}.`);
  else parts.push('Demand data not yet captured.');
  if (m.pipeline.length || m.potentialCounted.length) parts.push(`The decision turns on pipeline: ${m.pipeline.length + m.potentialCounted.length} forward site${m.pipeline.length + m.potentialCounted.length === 1 ? '' : 's'} add ${fmtN(Math.round(m.pipelineEffectivePlaces))} risk-weighted places; if all complete the ratio falls to ${fmtRatio(m.stressTestRatio)}.`);
  if (fd.price && fd.proposed_places) parts.push(`Land at ${fmtAud(Math.round(fd.price / fd.proposed_places / 1000))}k/place.`);
  return parts.join(' ');
}
function cfg(b){ return (b.fd.report_config && b.fd.report_config.slides) || {}; }
function slideCfg(b, k){ return cfg(b)[k] || {}; }
async function saveSlide(b, k, fields){
  const rc = { ...(b.fd.report_config || {}) }; rc.slides = { ...(rc.slides || {}), [k]: { ...(rc.slides?.[k] || {}), ...fields } };
  const res = await adapter.patch('feasibility_data', id, { report_config: rc });
  if (!res.ok) toast(res.reason, 'err');
  return res.ok;
}

function execSlide(b, m, ro){
  const fd = b.fd, sc = slideCfg(b, 'exec'), feaso = fd.feasibility_inputs?.feaso || {};
  const rec = sc.recommendation || statusLabel(adapter, fd.status);
  const summary = sc.summary || defaultSummary(b, m);
  return `<div class="slide"><div class="band"></div><div class="body">
    <div style="display:flex;justify-content:space-between;align-items:baseline"><div class="eyebrow">Executive summary</div><div style="font-size:11px;color:var(--ink-2)">${esc(b.project.name)}</div></div>
    <div style="display:flex;gap:16px;align-items:flex-start"><div class="rec"><span style="font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--moss)">Recommendation</span><span style="font-size:20px;font-weight:600;line-height:1.1">${esc(rec)}</span><span style="font-size:11px;color:var(--gum)">${esc(sc.condition || '')}</span></div>
      <div style="flex:1;min-width:0;font-size:12.5px;line-height:1.5">${esc(summary)}</div></div>
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:auto">
      <div class="kv"><span class="l">Effective demand</span><span class="v mono">${fmtRatio(m.effectiveRatio)}</span><span class="s">raw ${fmtRatio(m.ratioRaw5)} · VIC ${fmtRatio(m.vicRatio)}</span></div>
      <div class="kv"><span class="l">Competitors</span><span class="v mono">${m.liveComps.length} ${m.pipeline.length + m.potentialCounted.length ? `<span style="font-size:12px;color:var(--brush-ink)">+${m.pipeline.length + m.potentialCounted.length}</span>` : ''}</span><span class="s">${fmtN(m.currentPlaces || null)} places in 5-min</span></div>
      <div class="kv"><span class="l">Land</span><span class="v mono">${ro ? '—' : fd.price ? fmtAud(fd.price / 1e6) + 'm' : feaso.lease_rent ? 'lease' : '—'}</span><span class="s">${!ro && fd.price && fd.proposed_places ? fmtAud(Math.round(fd.price / fd.proposed_places / 1000)) + 'k / place' : ''}</span></div>
      <div class="kv"><span class="l">OpCo yr-3 EBITDA</span><span class="v mono">${feaso.op?.year3_ebitda ? fmtAud(feaso.op.year3_ebitda / 1e6).replace(/(\.\d)\d*/, '$1') + 'm' : '[FEASO]'}</span><span class="s">${feaso.op ? 'from OpCo tab' : 'pulls from OpCo tab'}</span></div>
    </div>
    <div class="foot"><span>Sources: GapMaps · ACECQA · ABS${fd.site_council ? ' · ' + esc(fd.site_council) + ' planning register' : ''}</span><span>2 / 12</span></div></div></div>`;
}
function genericSlide(b, m, k){
  const [, title, sub] = SLIDES.find(s => s[0] === k);
  const n = SLIDE_NO[k];
  let body = '';
  if (k === 'cover') body = `<div style="display:flex;gap:24px;flex:1"><div style="flex:0 0 40%;background:var(--pine);color:#fff;border-radius:8px;padding:24px;display:flex;flex-direction:column;justify-content:flex-end;gap:6px"><div style="font-size:11px;color:var(--gum)">Site feasibility</div><div style="font-size:24px;font-weight:600;line-height:1.15">${esc(b.project.name)}</div><div style="font-size:12px;color:var(--gum)">${esc(b.fd.site_address || '')}</div></div><div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:8px"><div class="kv" style="background:var(--sage)"><span class="l">Effective demand signal</span><span class="v mono" style="font-size:40px">${fmtRatio(m.effectiveRatio)}</span><span class="s">raw ${fmtRatio(m.ratioRaw5)} · VIC ${fmtRatio(m.vicRatio)} · <strong>${esc(m.demandStrength)}</strong></span></div></div></div>`;
  else if (k === 'demand') body = `<div style="display:flex;gap:8px;align-items:stretch;flex:1">${[['Raw', m.ratioRaw5], ['Participation', m.ratioStep2], ['CALD', m.ratioStep3], ['Forward supply', m.ratioStep4], ['Effective', m.effectiveRatio]].map(([l, v], i) => `<div class="kv" style="flex:1;${i === 4 ? 'background:var(--pine-2);color:#fff' : ''}"><span class="l" style="${i === 4 ? 'color:var(--moss)' : ''}">${i + 1 > 4 ? '' : i + 1 + ' · '}${l}</span><span class="v mono">${fmtRatio(v)}</span></div>`).join('')}</div>`;
  else if (k === 'comp') body = `<table style="font-size:11px"><thead><tr><th>Centre</th><th>Status</th><th>Places</th><th>Dist.</th><th>Fee</th></tr></thead><tbody>${b.competitors.slice(0, 8).map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.status)}</td><td class="mono">${esc(c.places ?? '—')}</td><td class="mono">${esc(c.distance_km ?? '—')} km</td><td class="mono">${c.fee ? fmtAud(c.fee) : '—'}</td></tr>`).join('')}</tbody></table>`;
  else if (k === 'bench') body = `<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px">${[['Local 5-min', m.ratioRaw5], ['Local 10-min', m.ratioRaw10], ['VIC', m.vicRatio], ['AUS', m.ausRatio]].map(([l, v]) => `<div class="kv"><span class="l">${l}</span><span class="v mono">${fmtRatio(v)}</span></div>`).join('')}</div>`;
  else if (k === 'growth'){ const proj = m.gm5?.age_projection_0_5; const years = proj ? Object.keys(proj).filter(y => /^\d{4}$/.test(y)).sort() : []; body = years.length ? `<div style="display:flex;align-items:flex-end;gap:10px;flex:1;padding-top:10px">${years.map(y => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><span class="mono" style="font-size:9px">${fmtN(proj[y])}</span><div style="width:60%;background:var(--moss);height:${Math.round(proj[y] / Math.max(...years.map(z => proj[z])) * 90)}px;border-radius:3px 3px 0 0"></div><span class="mono" style="font-size:9px">${y}</span></div>`).join('')}</div>` : '<div class="muted">No projection data.</div>'; }
  else if (k === 'schools') body = `<ul style="margin:0;padding-left:18px;font-size:12px">${b.schools.map(s => `<li><strong>${esc(s.name)}</strong> · ${esc(s.type)} · ${fmtN(s.enrolments)} enrolments · ${esc(s.distance_km)} km</li>`).join('') || '<li>None captured.</li>'}</ul>`;
  else if (k === 'risks') body = `<ul style="margin:0;padding-left:18px;font-size:12px;line-height:1.6"><li>Pipeline: ${esc(m.pipeDesc)}</li><li>Competition: ${esc(m.compDesc)}</li><li>Demographics: ${esc(m.demoDesc)}</li>${(b.nearby || []).filter(n => n.counts !== false).map(n => `<li>Cannibalisation: ${esc(n.name)} at ${esc(n.distance_km)} km</li>`).join('')}</ul>`;
  else body = `<div class="muted" style="font-size:12px">${esc(sub || title)} — slide template carried over in the next pass.</div>`;
  return `<div class="slide"><div class="band"></div><div class="body"><div style="display:flex;justify-content:space-between;align-items:baseline"><div class="eyebrow">${esc(title)}</div><div style="font-size:11px;color:var(--ink-2)">${esc(b.project.name)}</div></div>${body}<div class="foot" style="margin-top:auto"><span>Sources: GapMaps · ACECQA · ABS</span><span>${n} / 12</span></div></div></div>`;
}

function render(){
  const b = adapter.feasibility(id);
  if (!b){ $('#app').innerHTML = appbar('Pipeline', { adapter }) + `<div class="empty">Site not found.</div>`; return; }
  const m = computeFeasibilityMetrics(b), fd = b.fd, ro = !adapter.canWrite();
  const pf = runPreflight(b);
  const issuesBySlide = {}; pf.issues.forEach(i => { if (i.slide) issuesBySlide[i.slide] = issuesBySlide[i.slide] === 'block' ? 'block' : i.level; });
  const sc = slideCfg(b, slide);
  const versions = (fd.report_config && fd.report_config.versions) || [];
  const cur = versions.length + 1;
  $('#app').innerHTML = appbar('Pipeline', { adapter }) + `<main class="page" style="max-width:none;padding:20px 28px 40px;gap:16px">
    <div class="page-head" style="align-items:flex-start">
      <div><a href="${href('site.html', { id })}" style="font-size:13px;font-weight:600;text-decoration:none">← ${esc(b.project.name)}</a>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:4px"><h1 style="font-size:24px">Board report</h1>${statusChip(adapter, fd.status)}<span class="muted" style="font-size:13px">Draft v${cur} · ${pf.blocking ? `${pf.blocking} issue${pf.blocking === 1 ? '' : 's'} to clear before export` : 'ready to export'}</span></div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn s" id="btn-brief">Export brief (.md)</button><button class="btn s" id="btn-pdf" ${pf.canExport ? '' : 'disabled title="Blocked until issues are cleared"'}>Export PDF</button>${ro ? '' : `<button class="btn p" id="btn-final" ${pf.canExport ? '' : 'disabled'}>Mark final</button>`}</div>
    </div>
    <nav class="tabs" aria-label="Site sections">${[['site', 'Site'], ['market', 'Market'], ['financials', 'Financials']].map(([k, l]) => `<a href="${href('site.html', { id, tab: k })}">${l}</a>`).join('')}<a class="on" href="#">Report</a><a href="${href('site.html', { id, tab: 'activity' })}">Activity</a></nav>
    <div class="row" style="gap:18px">
      <aside class="card tight" style="flex:0 0 232px;padding:10px;display:flex;flex-direction:column;gap:2px">
        <div style="display:flex;justify-content:space-between;padding:4px 8px 8px"><span style="font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3)">12 slides</span></div>
        ${SLIDES.map(([k, t, s], i) => { const w = issuesBySlide[i + 1]; const hidden = slideCfg(b, k).hidden; return `<button class="sl ${slide === k ? 'on' : ''}" data-slide="${k}" style="${hidden ? 'opacity:.5' : ''}"><span class="th">${k === 'cover' ? '<b></b>' : '<i></i>'}</span><span class="t">${esc(t)}<span class="n">${esc(s)}${hidden ? ' · hidden' : ''}</span></span>${w ? `<span class="w" style="background:${w === 'block' ? 'var(--red)' : 'var(--brush)'}"></span>` : ''}</button>`; }).join('')}
      </aside>
      <div class="main-col" style="flex-basis:560px">
        <div class="card" style="padding:18px;display:flex;flex-direction:column;gap:12px"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><span style="font-size:13px;font-weight:600">Slide ${SLIDE_NO[slide]} · ${esc(SLIDES.find(s => s[0] === slide)[1])}</span><span class="muted" style="font-size:12px">Live preview — numbers pull from the site data; prose is editable</span></div>
          <div id="slide-preview">${slide === 'exec' ? execSlide(b, m, ro) : genericSlide(b, m, slide)}</div></div>
        <div class="grid-2 editor">
          <div class="card tight"><h3 class="label">Narrative</h3>
            ${slide === 'exec' ? `<div class="f"><label for="rec">Recommendation line</label><input id="rec" value="${esc(sc.recommendation || statusLabel(adapter, fd.status))}" ${ro ? 'disabled' : ''}></div>
            <div class="f" style="margin-top:10px"><label for="cond">Condition (shown under the recommendation)</label><input id="cond" value="${esc(sc.condition || '')}" placeholder="e.g. subject to permit outcome" ${ro ? 'disabled' : ''}></div>
            <div class="f" style="margin-top:10px"><label for="sum">Summary paragraph</label><textarea id="sum" style="min-height:120px" ${ro ? 'disabled' : ''}>${esc(sc.summary || defaultSummary(b, m))}</textarea></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn s" disabled title="Edge function wiring — next pass">Rewrite with Claude ▾</button><button class="btn s" id="btn-regen" ${ro ? 'disabled' : ''}>Regenerate from data</button></div>
            <div class="muted" style="font-size:12px;margin-top:8px">Figures typed into prose are checked against the data on save.</div>` : `<div class="muted">This slide is generated from the site data; there is no free prose on it.</div>`}
          </div>
          <div class="card tight"><h3 class="label">Slide settings</h3>
            <label style="display:flex;gap:10px;align-items:center;font-size:13.5px"><input type="checkbox" id="inc-vo" ${sc.include_viewonly !== false ? 'checked' : ''} ${ro ? 'disabled' : ''} style="width:18px;height:18px;margin:0">Include in view-only (acquisitions role) export</label>
            <label style="display:flex;gap:10px;align-items:center;font-size:13.5px;margin-top:8px"><input type="checkbox" id="hide" ${sc.hidden ? 'checked' : ''} ${ro ? 'disabled' : ''} style="width:18px;height:18px;margin:0">Hide this slide from deck</label>
            <div class="muted" style="font-size:12px;border-top:1px solid var(--rule);padding-top:10px;margin-top:12px">Report config last saved ${relativeTime(fd.updated_at)}</div></div>
        </div>
      </div>
      <aside class="side-col" style="flex-basis:280px;gap:14px">
        <div class="card tight"><h3 class="label">Pre-flight · ${pf.blocking} blocking</h3>${pf.issues.map(i => `<div class="iss ${i.level === 'block' ? 'block' : i.level === 'warn' ? 'warn' : 'ok'}">${i.level === 'block' ? ICON.block : i.level === 'warn' ? ICON.warn : ICON.ok}<span>${i.slide ? `<strong>Slide ${i.slide}</strong> · ` : ''}${esc(i.text)}</span></div>`).join('')}</div>
        <div class="card tight"><h3 class="label">Data freshness</h3>${[['GapMaps 5-min', fd.gapmaps_5min ? relativeTime(fd.updated_at) : 'missing'], ['Competitor rows', b.competitors.length ? relativeTime(b.competitors.map(c => c.updated_at).sort().pop()) : 'none'], ['Estate pipeline', b.estates.length ? relativeTime(b.estates.map(c => c.updated_at).sort().pop()) : 'none'], ['OpCo feaso', fd.feasibility_inputs?.feaso?.op ? 'saved' : 'not saved']].map(([l, v]) => `<div class="src"><span ${/missing|not saved|none/.test(v) ? 'style="color:var(--brush-ink);font-weight:600"' : ''}>${l}</span><span class="d mono">${esc(v)}</span></div>`).join('')}</div>
        <div class="card tight"><h3 class="label">Versions</h3><div class="src"><span><strong>v${cur}</strong> draft · current</span><span class="d">${esc(adapter.user.initials)}</span></div>${versions.slice().reverse().map(v => `<div class="src"><span>v${v.version} · ${esc(v.status)}</span><span class="d">${esc(v.by)} · ${relativeTime(v.at)}</span></div>`).join('')}</div>
        <div class="card dark tight"><h3 class="label">Exports</h3><div style="font-size:13px;line-height:1.5">Final PDF (full) · Final PDF (view-only, PropCo stripped) · Analysis brief (.md) for the Claude project · Deck link.</div></div>
      </aside>
    </div></main>`;
  wire(b, m);
}

function wire(b, m){
  $$('[data-slide]').forEach(btn => btn.addEventListener('click', () => { slide = btn.dataset.slide; render(); }));
  const onChange = (sel, field) => { const el = $(sel); if (el) el.addEventListener('change', async () => { if (await saveSlide(b, slide, { [field]: el.type === 'checkbox' ? el.checked : el.value })) render(); }); };
  onChange('#rec', 'recommendation'); onChange('#cond', 'condition'); onChange('#sum', 'summary'); onChange('#inc-vo', 'include_viewonly'); onChange('#hide', 'hidden');
  const sum = $('#sum'); if (sum) sum.addEventListener('blur', () => {
    // Figure check: any "N.NN×" in prose must match a number the data produces.
    const nums = (sum.value.match(/\d+\.\d{2}(?=×)/g) || []);
    const known = [m.effectiveRatio, m.ratioRaw5, m.vicRatio, m.stressTestRatio, m.ratioStep3].filter(v => v != null).map(v => v.toFixed(2));
    const bad = nums.filter(n => !known.includes(n));
    if (bad.length) toast(`Figure ${bad.join(', ')}× in the prose doesn't match the data`, 'err');
  });
  const regen = $('#btn-regen'); if (regen) regen.addEventListener('click', async () => { if (await saveSlide(b, 'exec', { summary: defaultSummary(b, m) })) render(); });
  const brief = $('#btn-brief'); if (brief) brief.addEventListener('click', () => {
    const lines = [`# Site Analysis Brief — ${b.project.name}`, `Generated ${new Date().toISOString().slice(0, 10)} · status ${statusLabel(adapter, b.fd.status)}`, '', '## Demand chain', `| Step | Factor | Ratio |`, `|---|---|---|`, `| 1. Raw | ${fmtN(m.currentChildren)} ÷ ${fmtN(m.currentPlaces)} | ${fmtRatio(m.ratioRaw5)} |`, `| 2. Participation | × ${m.participationFactor.toFixed(2)} (placeholder) | ${fmtRatio(m.ratioStep2)} |`, `| 3. CALD | × ${m.caldFactor.toFixed(3)} | ${fmtRatio(m.ratioStep3)} |`, `| 4. Forward supply | +${fmtN(m.newPlacesFromPipeline)} places, +${fmtN(m.estimatedNewChildren)} children | ${fmtRatio(m.ratioStep4)} |`, '', `**Effective ratio: ${fmtRatio(m.effectiveRatio)} — ${m.demandStrength}.** Stress test ${fmtRatio(m.stressTestRatio)}.`, '', '## Scorecard', `- Demand: ${m.demandRating} — ${m.demandDesc}`, `- Competition: ${m.compRating} — ${m.compDesc}`, `- Demographics: ${m.demoRating} — ${m.demoDesc}`, `- Pipeline: ${m.pipeRating} — ${m.pipeDesc}`, '', '## Competitors', ...b.competitors.map(c => `- ${c.name} · ${c.status} · ${c.places ?? '?'} places · ${c.distance_km ?? '?'} km${c.fee ? ' · $' + c.fee : ''}${c.status === 'potential' ? ` · ${c.stage || ''} · ${c.count_in_chain === false ? 'watch only' : 'counted'}` : ''}`), '', '## Data completeness', ...runPreflight(b).issues.filter(i => i.level !== 'ok').map(i => `- ${i.text}`)];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${(b.project.code || 'site').toLowerCase()}_brief_${new Date().toISOString().slice(0, 10)}.md`; a.click();
  });
  const pdf = $('#btn-pdf'); if (pdf) pdf.addEventListener('click', () => window.print());
  const fin = $('#btn-final'); if (fin) fin.addEventListener('click', async () => { const rc = { ...(b.fd.report_config || {}) }; const versions = [...(rc.versions || [])]; versions.push({ version: versions.length + 1, status: 'final', by: adapter.user.initials, at: new Date().toISOString(), snapshot: { slides: rc.slides || {}, effectiveRatio: m.effectiveRatio } }); rc.versions = versions; const res = await adapter.patch('feasibility_data', id, { report_config: rc }); if (res.ok){ toast(`Marked final as v${versions.length}`); render(); } else toast(res.reason, 'err'); });
}

boot(async a => { adapter = a; id = qs().get('id'); render(); });

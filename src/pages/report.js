// Report workspace: the legacy 14-slide deck (ported verbatim) in the middle,
// slide rail on the left, pre-flight / freshness / versions on the right.
// Slide hides write report_config.hidden_slides — the same key the old tool
// reads — so the two tools agree on what's in the deck.
import { boot, appbar, esc, $, $$, href, toast, ICON, statusChip, qs } from '../ui/shell.js';
import { computeFeasibilityMetrics, fmtRatio, fmtN } from '../logic/metrics.js';
import { runPreflight } from '../logic/preflight.js';
import { statusLabel, relativeTime } from '../logic/status.js';
import { renderLegacyReport } from '../report/legacy-report.js';

let adapter, id, photos = { paths: [], urlFor: () => '' };

// Globals the legacy slide HTML calls from inline onclick handlers.
globalThis._openPhotoLightbox = (url, title) => {
  let lb = $('#lightbox');
  if (!lb){ lb = document.createElement('div'); lb.id = 'lightbox'; lb.style.cssText = 'position:fixed;inset:0;background:rgba(43,36,30,.85);display:flex;align-items:center;justify-content:center;z-index:99;cursor:zoom-out;padding:24px'; lb.addEventListener('click', () => lb.remove()); document.body.appendChild(lb); }
  lb.innerHTML = `<figure style="margin:0;max-width:100%;max-height:100%;display:flex;flex-direction:column;align-items:center;gap:10px"><img src="${esc(url)}" alt="${esc(title)}" style="max-width:100%;max-height:85vh;border-radius:8px;background:#fff"><figcaption style="color:#FBF8EF;font-size:13px">${esc(title)}</figcaption></figure>`;
};
globalThis._onPhotoLinkClick = (ev, el) => {
  if (ev && (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button === 1)) return true;
  if (ev) ev.preventDefault();
  const a = el || (ev && ev.currentTarget);
  if (!a || !a.href || a.href.endsWith('#')) return false;
  globalThis._openPhotoLightbox(a.href, a.title || '');
  return false;
};

function legacyCtx(b){
  const store = {}; photos.paths.forEach(p => { store[p] = { storagePath: p, fromStorage: true }; });
  return {
    data: { projects: adapter.list('projects'), feasibilityCompetitors: b.competitors, feasibilitySchools: b.schools, explorersCentreData: adapter.list('explorers_centre_data') },
    window: { _pathBlobs: { [b.project.id]: store }, _resolveFeasPhotoUrl: (feasId, rel) => photos.urlFor(rel) },
    toolbarHtml: '',
  };
}

function slidesFrom(html){
  const tpl = document.createElement('template'); tpl.innerHTML = html;
  return Array.from(tpl.content.querySelectorAll('.rpt-cover, .rpt-slide')).map((el, i) => ({
    n: i + 1, key: el.getAttribute('data-slide-key') || (i === 0 ? 'cover' : 'slide' + i),
    title: (el.querySelector('.rpt-slide-hdr-title') || {}).textContent || (i === 0 ? 'Cover' : 'Slide ' + (i + 1)),
  }));
}

function exportStandaloneHtml(b, deckHtml){
  const css = Array.from(document.styleSheets).map(s => { try { return Array.from(s.cssRules).map(r => r.cssText).join('\n'); } catch(e){ return ''; } }).join('\n');
  const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(b.project.name)} — Site feasibility</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap"><style>${css}\nbody{background:#fff;padding:24px}</style></head><body><div class="rpt-doc">${deckHtml}</div></body></html>`;
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([doc], { type: 'text/html' })); a.download = `${(b.project.code || 'site').toLowerCase()}_report_${new Date().toISOString().slice(0, 10)}.html`; a.click();
}

function exportBrief(b, m){
  const lines = [`# Site Analysis Brief — ${b.project.name}`, `Generated ${new Date().toISOString().slice(0, 10)} · status ${statusLabel(adapter, b.fd.status)}`, '', '## Demand chain', `| Step | Factor | Ratio |`, `|---|---|---|`, `| 1. Raw | ${fmtN(m.currentChildren)} ÷ ${fmtN(m.currentPlaces)} | ${fmtRatio(m.ratioRaw5)} |`, `| 2. Participation | × ${m.participationFactor.toFixed(2)} (placeholder) | ${fmtRatio(m.ratioStep2)} |`, `| 3. CALD | × ${m.caldFactor.toFixed(3)} | ${fmtRatio(m.ratioStep3)} |`, `| 4. Forward supply | +${fmtN(m.newPlacesFromPipeline)} places, +${fmtN(m.estimatedNewChildren)} children | ${fmtRatio(m.ratioStep4)} |`, '', `**Effective ratio: ${fmtRatio(m.effectiveRatio)} — ${m.demandStrength}.** Stress test ${fmtRatio(m.stressTestRatio)}.`, '', '## Scorecard', `- Demand: ${m.demandRating} — ${m.demandDesc}`, `- Competition: ${m.compRating} — ${m.compDesc}`, `- Demographics: ${m.demoRating} — ${m.demoDesc}`, `- Pipeline: ${m.pipeRating} — ${m.pipeDesc}`, '', '## Competitors', ...b.competitors.map(c => `- ${c.name} · ${c.status} · ${c.places ?? '?'} places · ${c.distance_km ?? '?'} km${c.fee ? ' · $' + c.fee : ''}${c.status === 'potential' ? ` · ${c.stage || ''} · ${c.count_in_chain === false ? 'watch only' : 'counted'}` : ''}`), '', '## Data completeness', ...runPreflight(b).issues.filter(i => i.level !== 'ok').map(i => `- ${i.text}`)];
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/markdown' })); a.download = `${(b.project.code || 'site').toLowerCase()}_brief_${new Date().toISOString().slice(0, 10)}.md`; a.click();
}

function render(){
  const b = adapter.feasibility(id);
  if (!b){ $('#app').innerHTML = appbar('Pipeline', { adapter }) + `<div class="empty">Site not found.</div>`; return; }
  const m = computeFeasibilityMetrics(b), fd = b.fd, ro = !adapter.canWrite();
  const pf = runPreflight(b);
  const rc = fd.report_config || {};
  const hidden = Array.isArray(rc.hidden_slides) ? rc.hidden_slides : [];
  // Full deck (ignoring hides) for the rail; applied deck for display.
  const ctx = legacyCtx(b);
  const fullHtml = renderLegacyReport({ ...b, fd: { ...fd, report_config: { ...rc, hidden_slides: [] } } }, ctx);
  const deckHtml = renderLegacyReport(b, ctx);
  const slides = slidesFrom(fullHtml);
  const issuesBySlide = {}; pf.issues.forEach(i => { if (i.slide) issuesBySlide[i.slide] = issuesBySlide[i.slide] === 'block' ? 'block' : i.level; });
  const versions = rc.versions || [];
  const cur = versions.length + 1;

  $('#app').innerHTML = appbar('Pipeline', { adapter }) + `<main class="page" style="max-width:none;padding:20px 28px 40px;gap:16px">
    <div class="page-head" style="align-items:flex-start">
      <div><a href="${href('site.html', { id })}" style="font-size:13px;font-weight:600;text-decoration:none">← ${esc(b.project.name)}</a>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:4px"><h1 style="font-size:24px">Board report</h1>${statusChip(adapter, fd.status)}<span class="muted" style="font-size:13px">Draft v${cur} · ${slides.length - hidden.length} of ${slides.length} slides · ${pf.blocking ? `${pf.blocking} issue${pf.blocking === 1 ? '' : 's'} to clear before export` : 'ready to export'} · ${photos.paths.length} photos</span></div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn s" id="btn-brief">Export brief (.md)</button><button class="btn s" id="btn-html">Export HTML</button><button class="btn s" id="btn-pdf" ${pf.canExport ? '' : 'disabled title="Blocked until issues are cleared"'}>Print / PDF</button>${ro ? '' : `<button class="btn p" id="btn-final" ${pf.canExport ? '' : 'disabled'}>Mark final</button>`}</div>
    </div>
    <nav class="tabs" aria-label="Site sections">${[['site', 'Site'], ['market', 'Market'], ['financials', 'Financials']].map(([k, l]) => `<a href="${href('site.html', { id, tab: k })}">${l}</a>`).join('')}<a class="on" href="#">Report</a><a href="${href('site.html', { id, tab: 'activity' })}">Activity</a></nav>
    <div class="row" style="gap:18px;align-items:flex-start">
      <aside class="card tight" style="flex:0 0 240px;padding:10px;display:flex;flex-direction:column;gap:2px;position:sticky;top:12px;max-height:calc(100vh - 24px);overflow:auto">
        <div style="display:flex;justify-content:space-between;padding:4px 8px 8px"><span style="font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3)">${slides.length} slides</span><span class="muted" style="font-size:11px">tick = in deck</span></div>
        ${slides.map(s => { const w = issuesBySlide[s.n]; const off = hidden.includes(s.key); return `<label class="sl" style="display:flex;gap:10px;align-items:center;padding:7px 8px;border-radius:8px;${off ? 'opacity:.5' : ''}"><input type="checkbox" data-hide="${esc(s.key)}" ${off ? '' : 'checked'} ${ro || s.n === 1 ? 'disabled' : ''} style="width:16px;height:16px;margin:0"><a href="#slide-${s.n}" style="text-decoration:none;color:var(--ink);font-size:12.5px;font-weight:500;flex:1;min-width:0"><span class="mono muted" style="font-size:11px;margin-right:6px">${s.n}</span>${esc(s.title)}</a>${w ? `<span style="width:8px;height:8px;border-radius:50%;flex:none;background:${w === 'block' ? 'var(--red)' : 'var(--brush)'}"></span>` : ''}</label>`; }).join('')}
      </aside>
      <div class="main-col" style="flex-basis:640px;min-width:0" id="deck">${deckHtml}</div>
      <aside class="side-col" style="flex-basis:280px;gap:14px">
        <div class="card tight"><h3 class="label">Pre-flight · ${pf.blocking} blocking</h3>${pf.issues.map(i => `<div class="iss ${i.level === 'block' ? 'block' : i.level === 'warn' ? 'warn' : 'ok'}">${i.level === 'block' ? ICON.block : i.level === 'warn' ? ICON.warn : ICON.ok}<span>${i.slide ? `<strong>Slide ${i.slide}</strong> · ` : ''}${esc(i.text)}</span></div>`).join('')}</div>
        <div class="card tight"><h3 class="label">Data freshness</h3>${[['GapMaps 5-min', fd.gapmaps_5min ? relativeTime(fd.updated_at) : 'missing'], ['Competitor rows', b.competitors.length ? relativeTime(b.competitors.map(c => c.updated_at).sort().pop()) : 'none'], ['Estate pipeline', b.estates.length ? relativeTime(b.estates.map(c => c.updated_at).sort().pop()) : 'none'], ['Photos in storage', photos.paths.length ? photos.paths.length + ' files' : 'none'], ['OpCo feaso', fd.feasibility_inputs?.feaso?.op ? 'saved' : 'not saved']].map(([l, v]) => `<div class="src"><span ${/missing|not saved|none/.test(v) ? 'style="color:var(--brush-ink);font-weight:600"' : ''}>${l}</span><span class="d mono">${esc(v)}</span></div>`).join('')}</div>
        <div class="card tight"><h3 class="label">Versions</h3><div class="src"><span><strong>v${cur}</strong> draft · current</span><span class="d">${esc(adapter.user.initials)}</span></div>${versions.slice().reverse().map(v => `<div class="src"><span>v${v.version} · ${esc(v.status)}</span><span class="d">${esc(v.by)} · ${relativeTime(v.at)}</span></div>`).join('')}</div>
        <div class="card dark tight"><h3 class="label">Customise</h3><div style="font-size:13px;line-height:1.5">Slide variants and custom slides from the old tool's Customise tab are honoured here (report_config). Editing them in v2 comes in the next pass.</div></div>
      </aside>
    </div></main>`;
  // Anchor ids on slides for the rail links
  $$('#deck .rpt-cover, #deck .rpt-slide').forEach((el, i) => { el.id = 'slide-' + (i + 1); });
  wire(b, m, deckHtml);
}

function wire(b, m, deckHtml){
  $$('[data-hide]').forEach(cb => cb.addEventListener('change', async () => {
    const rc = { ...(b.fd.report_config || {}) }; const set = new Set(Array.isArray(rc.hidden_slides) ? rc.hidden_slides : []);
    cb.checked ? set.delete(cb.dataset.hide) : set.add(cb.dataset.hide); rc.hidden_slides = [...set];
    const res = await adapter.patch('feasibility_data', id, { report_config: rc }); if (res.ok) render(); else toast(res.reason, 'err');
  }));
  const on = (sel, fn) => { const el = $(sel); if (el) el.addEventListener('click', fn); };
  on('#btn-brief', () => exportBrief(b, m));
  on('#btn-html', () => exportStandaloneHtml(b, deckHtml));
  on('#btn-pdf', () => window.print());
  on('#btn-final', async () => { const rc = { ...(b.fd.report_config || {}) }; const versions = [...(rc.versions || [])]; versions.push({ version: versions.length + 1, status: 'final', by: adapter.user.initials, at: new Date().toISOString(), snapshot: { hidden_slides: rc.hidden_slides || [], effectiveRatio: m.effectiveRatio } }); rc.versions = versions; const res = await adapter.patch('feasibility_data', id, { report_config: rc }); if (res.ok){ toast(`Marked final as v${versions.length}`); render(); } else toast(res.reason, 'err'); });
}

boot(async a => {
  adapter = a; id = qs().get('id');
  render(); // first paint without photos
  try { photos = await adapter.photoIndex(id); } catch(e){ console.warn('photo index failed', e); }
  if (photos.paths.length) render();
});

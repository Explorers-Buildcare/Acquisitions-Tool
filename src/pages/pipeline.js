import { boot, appbar, esc, $, $$, href, toast, ICON, statusChip, qs } from '../ui/shell.js';
import { computeFeasibilityMetrics, fmtRatio, fmtAud } from '../logic/metrics.js';
import { canonicalStatus, ACTIVE_STATUSES, STATUS_ORDER, statusOptions, relativeTime, daysSince } from '../logic/status.js';
import { CONFIG } from '../config.js';

const state = { filter: 'active', search: '', view: qs().get('view') || 'table' };

function rowsFor(adapter){
  return adapter.feasibilityProjects().map(p => {
    const b = adapter.feasibility(p.id);
    const m = computeFeasibilityMetrics(b);
    const status = canonicalStatus(b.fd.status || '');
    const stale = daysSince(b.fd.updated_at || b.fd.last_saved_at);
    const attention = [];
    if (m.effectiveRatio == null) attention.push('GapMaps pending');
    if (stale != null && stale > 30 && ACTIVE_STATUSES.has(status)) attention.push(`stale ${stale} d`);
    if (!(b.fd.feasibility_inputs && b.fd.feasibility_inputs.feaso && b.fd.feasibility_inputs.feaso.op) && ACTIVE_STATUSES.has(status)) attention.push('no OpCo feaso');
    return { p, b, m, status, stale, attention };
  });
}

function filtered(rows){
  const s = state.search.toLowerCase().trim();
  return rows.filter(r => {
    if (state.filter === 'active' && !ACTIVE_STATUSES.has(r.status)) return false;
    if (state.filter && state.filter !== 'active' && state.filter !== 'all' && r.status !== state.filter) return false;
    if (!s) return true;
    const hay = [r.p.name, r.p.code, r.b.fd.site_suburb, r.b.fd.site_council, r.b.fd.site_address, r.b.fd.agent].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(s);
  }).sort((a, c) => (STATUS_ORDER[a.status] || 9) - (STATUS_ORDER[c.status] || 9) || (a.p.name || '').localeCompare(c.p.name || ''));
}

function kpis(rows){
  const count = st => rows.filter(r => r.status === st).length;
  const attention = rows.filter(r => r.attention.length && ACTIVE_STATUSES.has(r.status)).length;
  return `<div class="grid-4">
    <div class="kpi"><span class="l">Reviewing</span><span class="v">${count('reviewing')}</span><span class="s">${rows.filter(r => r.status === 'reviewing' && r.m.effectiveRatio == null).length} awaiting data</span></div>
    <div class="kpi"><span class="l">Conditional go</span><span class="v">${count('conditional_go')}</span><span class="s">awaiting conditions</span></div>
    <div class="kpi"><span class="l">Go</span><span class="v">${count('go')}</span><span class="s">proceeding</span></div>
    <div class="kpi ${attention ? 'warn' : ''}"><span class="l">Needs attention</span><span class="v">${attention}</span><span class="s">stale &gt; 30 days, missing data or feaso</span></div>
  </div>`;
}

function ratioCell(m){
  if (m.effectiveRatio == null) return `<span class="mono">—</span> <span style="font-size:12px;color:var(--brush-ink);font-weight:600">GapMaps pending</span>`;
  const pct = Math.min(100, Math.round(m.effectiveRatio / 5 * 100));
  const cls = m.effectiveRatio < 1.5 ? 'bad' : m.effectiveRatio < 2.5 ? 'weak' : '';
  return `<span class="mono" style="font-weight:500">${fmtRatio(m.effectiveRatio)}</span> <span class="bar ${cls}"><b style="width:${pct}%"></b></span>`;
}

function table(adapter, rows, all){
  const ro = adapter.role === 'acquisitions';
  const body = rows.length ? rows.map(r => `<tr class="clickable" data-id="${esc(r.p.id)}">
      <td><a href="${href('site.html', { id: r.p.id })}" style="font-weight:600;text-decoration:none;color:var(--ink)">${esc(r.p.name)}</a><div style="font-size:12px;color:var(--ink-3)">${esc(r.p.code || '')}${r.b.fd.site_type ? ' · ' + esc(r.b.fd.site_type.toLowerCase()) : ''}</div></td>
      <td>${esc(r.b.fd.site_council || '')}</td>
      <td>${statusChip(adapter, r.b.fd.status)}</td>
      <td>${ratioCell(r.m)}</td>
      <td><span class="mono">${r.m.liveComps.length}</span>${r.m.pipeline.length || r.m.potentialCounted.length ? ` <span style="color:var(--ink-3);font-size:12px">+${r.m.pipeline.length + r.m.potentialCounted.length} pipeline</span>` : ''}</td>
      <td class="mono">${ro ? '<span class="muted">hidden</span>' : (r.b.fd.price ? fmtAud(r.b.fd.price / 1e6).replace(/^\$/, '$') + 'm' : (r.b.fd.feasibility_inputs?.feaso?.deal_type === 'leasehold' ? '<span class="muted">lease</span>' : '—'))}</td>
      <td>${esc(r.b.fd.prepared_by || '—')}</td>
      <td style="color:var(--ink-3)">${relativeTime(r.b.fd.updated_at || r.b.fd.last_saved_at)}${r.attention.length ? `<div style="font-size:11.5px;color:var(--brush-ink);font-weight:600">${esc(r.attention.join(' · '))}</div>` : ''}</td>
    </tr>`).join('') : `<tr><td colspan="8"><div class="empty">${all.length ? 'No feasibilities match the current filter.' : 'No feasibilities yet.'}</div></td></tr>`;
  return `<div class="tbl"><table>
    <thead><tr><th>Site</th><th>Council</th><th>Status</th><th>Effective demand</th><th>Competitors</th><th>Land price</th><th>Owner</th><th>Updated</th></tr></thead>
    <tbody>${body}</tbody></table>
    <div class="foot"><span>Showing ${rows.length} of ${all.length}${ro ? ' · Land price hidden for view-only (acquisitions) role' : ''}</span><span>Effective demand = children 0–5 ÷ licensed places, after adjustment chain</span></div>
  </div>`;
}

function board(adapter, rows){
  const cols = ['reviewing', 'conditional_go', 'go', 'rejected'];
  return `<div class="grid-4" style="align-items:flex-start">${cols.map(st => {
    const items = rows.filter(r => r.status === st);
    return `<div style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;justify-content:space-between;align-items:center;padding:4px 2px">${statusChip(adapter, st)}<span class="mono muted" style="font-size:12px">${items.length}</span></div>
      ${items.map(r => `<a href="${href('site.html', { id: r.p.id })}" class="card tight" style="text-decoration:none;color:var(--ink);display:flex;flex-direction:column;gap:6px"><div style="font-weight:600">${esc(r.p.name)}</div><div style="font-size:12.5px;color:var(--ink-3)">${esc(r.b.fd.site_council || '')} · ${esc(r.b.fd.site_type || '')}</div><div style="display:flex;justify-content:space-between;align-items:center"><span>${ratioCell(r.m)}</span><span class="muted" style="font-size:12px">${relativeTime(r.b.fd.updated_at)}</span></div>${r.attention.length ? `<div style="font-size:11.5px;color:var(--brush-ink);font-weight:600">${esc(r.attention.join(' · '))}</div>` : ''}</a>`).join('') || '<div class="empty" style="padding:24px">—</div>'}
    </div>`;
  }).join('')}</div>`;
}

function side(adapter, rows){
  const awaiting = rows.filter(r => r.status === 'conditional_go' || (r.status === 'reviewing' && r.m.effectiveRatio != null)).slice(0, 4);
  const recent = rows.slice().sort((a, b) => new Date(b.b.fd.updated_at || 0) - new Date(a.b.fd.updated_at || 0)).slice(0, 5);
  const nearbyCount = rows.filter(r => ACTIVE_STATUSES.has(r.status) && r.b.nearby.some(n => Number(n.distance_km) <= 3)).length;
  const active = rows.filter(r => ACTIVE_STATUSES.has(r.status)).length;
  return `<aside class="side-col">
    <div class="card tight"><h3 class="label">Awaiting decision</h3>${awaiting.map(r => `<div class="act"><div><div style="font-weight:600">${esc(r.p.name)}</div><div class="t">${esc(r.m.demandRating)} on demand · ${esc(r.m.pipeRating)} on pipeline</div></div></div>`).join('') || '<div class="muted">Nothing waiting.</div>'}</div>
    <div class="card tight"><h3 class="label">Recent activity</h3>${recent.map(r => `<div class="act"><div><span style="font-weight:600">${esc(r.b.fd.prepared_by || '—')}</span> updated <span style="font-weight:600">${esc(r.b.fd.site_suburb || r.p.name)}</span><div class="t">${relativeTime(r.b.fd.updated_at)}</div></div></div>`).join('')}</div>
    <div class="card dark tight"><h3 class="label">Portfolio watch</h3><div style="font-size:13.5px;line-height:1.5">${nearbyCount} of ${active} active sites sit inside 3 km of an existing Explorers centre. Cannibalisation check runs on save.</div></div>
  </aside>`;
}

function render(adapter){
  const all = rowsFor(adapter);
  const rows = filtered(all);
  const opts = statusOptions(adapter);
  const views = [['table', 'Table'], ['board', 'Board'], ['map', 'Map']];
  $('#app').innerHTML = appbar('Pipeline', { search: true, adapter }) + `
  <main class="page">
    <div class="page-head">
      <div><h1>Pipeline</h1><p class="sub">${all.length} feasibilit${all.length === 1 ? 'y' : 'ies'} · ${all.filter(r => ACTIVE_STATUSES.has(r.status)).length} active${CONFIG.mode === 'local' ? ' · <strong>dummy data</strong>' : ''}</p></div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <div class="seg" role="group" aria-label="View">${views.map(([v, l]) => `<button data-view="${v}" class="${state.view === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        ${CONFIG.mode === 'local' ? '<button class="btn s" id="btn-reset">Reset dummy data</button>' : ''}
        ${adapter.canWrite() ? `<a class="btn p lg" href="${href('new.html')}">${ICON.plus} New feasibility</a>` : ''}
      </div>
    </div>
    ${kpis(all)}
    <div class="filters">
      <button class="pill ${state.filter === 'active' ? 'on' : ''}" data-filter="active">Active</button>
      ${opts.map(o => `<button class="pill ${state.filter === o.value ? 'on' : ''}" data-filter="${esc(o.value)}">${esc(o.label)}</button>`).join('')}
      <button class="pill ${state.filter === 'all' ? 'on' : ''}" data-filter="all">All</button>
      <span style="margin-left:auto;font-size:13px;color:var(--ink-3)">Sorted by status, then name</span>
    </div>
    ${state.view === 'map' ? `<div class="card"><div class="empty">Map view — needs lat/long on sites and competitors (see README → geocoding). Not in this pass.</div></div>`
      : `<div class="row">${state.view === 'board' ? `<div class="main-col">${board(adapter, rows)}</div>` : `<div class="main-col">${table(adapter, rows, all)}</div>`}${side(adapter, all)}</div>`}
  </main>`;

  $$('[data-filter]').forEach(b => b.addEventListener('click', () => { state.filter = b.dataset.filter; render(adapter); }));
  $$('[data-view]').forEach(b => b.addEventListener('click', () => { state.view = b.dataset.view; render(adapter); }));
  $$('tr.clickable').forEach(tr => tr.addEventListener('click', e => { if (e.target.tagName !== 'A') location.href = href('site.html', { id: tr.dataset.id }); }));
  const search = $('#global-search');
  if (search){ search.value = state.search; search.addEventListener('input', () => { state.search = search.value; const main = $('.main-col'); if (main) main.innerHTML = state.view === 'board' ? board(adapter, filtered(rowsFor(adapter))) : table(adapter, filtered(rowsFor(adapter)), rowsFor(adapter)); }); }
  const reset = $('#btn-reset');
  if (reset) reset.addEventListener('click', async () => { await adapter.reset(); render(adapter); toast('Dummy data reset'); });
}

boot(async adapter => { render(adapter); adapter.on('change', () => render(adapter)); });

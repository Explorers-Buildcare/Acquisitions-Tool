// Phone: photos (untagged or tagged to a competitor/school) + timestamped notes.
// Notes are stored as feasibility_comments with section 'site_visit'.
import { boot, esc, $, $$, toast, ICON, qs, statusChip } from '../ui/shell.js';
import { computeFeasibilityMetrics, fmtRatio } from '../logic/metrics.js';
import { relativeTime } from '../logic/status.js';
import { CONFIG } from '../config.js';

let adapter, id, tag = { coll: 'feasibility_data', id: null, label: 'Site', sub: 'site' };
const mhref = (p = {}) => { const q = new URLSearchParams(p); if (qs().get('mode')) q.set('mode', CONFIG.mode); const s = q.toString(); return 'index.html' + (s ? '?' + s : ''); };

function list(){
  const rows = adapter.feasibilityProjects();
  $('#app').innerHTML = `<div class="m"><header><a href="../index.html">${ICON.back}Desktop</a><div style="font-size:20px;font-weight:600">Site visit</div><div style="font-size:13px;color:var(--gum)">Pick a site</div></header>
    <main class="sites">${rows.map(p => { const fd = adapter.get('feasibility_data', p.id) || {}; return `<a href="${mhref({ id: p.id })}"><div style="font-weight:600">${esc(p.name)}</div><div style="font-size:12.5px;color:var(--ink-3);margin-top:3px">${esc(fd.site_suburb || '')} · ${statusChip(adapter, fd.status)}</div></a>`; }).join('')}</main></div>`;
}

function render(){
  const b = adapter.feasibility(id); if (!b) return list();
  const m = computeFeasibilityMetrics(b), fd = b.fd;
  const photos = [{ label: null, paths: fd.photo_paths || [] }, ...b.competitors.map(c => ({ label: c.name, paths: c.photo_paths || [] })), ...b.schools.map(s => ({ label: s.name, paths: s.photo_paths || [] }))].flatMap(g => g.paths.map(p => ({ p, label: g.label })));
  const notes = b.comments.filter(c => c.section === 'site_visit').sort((a, c) => new Date(c.created_at) - new Date(a.created_at));
  const tags = [{ coll: 'feasibility_data', id: null, label: 'Site', sub: 'site' }, ...b.competitors.map(c => ({ coll: 'feasibility_competitors', id: c.id, label: c.name.split(' — ')[0], sub: `competitors/${c.id}` })), ...b.schools.map(s => ({ coll: 'feasibility_schools', id: s.id, label: s.name.replace(/ (Primary|Secondary) School$/, ' $1'), sub: `schools/${s.id}` }))];
  $('#app').innerHTML = `<div class="m">
    <header><div style="display:flex;justify-content:space-between;align-items:center"><a href="${mhref()}">${ICON.back}Sites</a><span class="mono" style="font-size:11px;color:var(--gum)">${CONFIG.mode === 'local' ? 'dummy data' : 'online'}</span></div>
      <div><div style="font-size:20px;font-weight:600;line-height:1.2">${esc(b.project.name)}</div><div style="font-size:13px;color:var(--gum);margin-top:3px">${esc(fd.site_council || '')} · ${statusChip(adapter, fd.status)}</div></div></header>
    <main>
      <div class="stats"><div class="card"><div class="l">Demand</div><div class="v mono">${fmtRatio(m.effectiveRatio)}</div></div><div class="card"><div class="l">Places</div><div class="v mono">${esc(fd.proposed_places ?? '—')}</div></div><div class="card"><div class="l">Comps</div><div class="v mono">${m.liveComps.length}<span style="font-size:13px;color:var(--brush-ink)">${m.pipeline.length + m.potentialCounted.length ? '+' + (m.pipeline.length + m.potentialCounted.length) : ''}</span></div></div></div>
      <label class="shoot" for="cam">${ICON.camera} Take photo<input id="cam" type="file" accept="image/*" capture="environment" multiple class="sr"></label>
      <div class="tags" role="group" aria-label="Tag photo to">${tags.map((t, i) => `<button data-tag="${i}" class="${(t.id || null) === tag.id && t.coll === tag.coll ? 'on' : ''}">${esc(t.label)}</button>`).join('')}</div>
      <section class="card tight"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><h2 style="font-size:14px">Photos · ${photos.length}</h2></div>
        <div class="grid">${photos.slice(0, 12).map(x => `<div class="ph">${x.label ? `<span>${esc(x.label.split(' ')[0])}</span>` : ''}</div>`).join('') || '<div class="muted" style="grid-column:1/-1">No photos yet.</div>'}</div>
        <div class="muted" style="margin-top:10px;font-size:12.5px">Untagged photos go to the site's Files; tagged ones attach to that competitor or school.</div></section>
      <section class="card tight"><h2 style="font-size:14px;margin-bottom:10px">Notes</h2>
        ${notes.map(n => `<div class="note"><span class="t mono">${relativeTime(n.created_at)}</span><br>${esc(n.comment)}</div>`).join('')}
        <textarea id="note" placeholder="Type a note…" style="width:100%;min-height:72px;border:1px solid var(--rule-2);border-radius:8px;padding:10px;font:inherit;font-size:14px;background:#fff;resize:none"></textarea>
        <div style="display:flex;gap:8px;margin-top:10px"><button class="btn s" style="flex:1;justify-content:center" disabled title="Dictation — next pass">Voice</button><button class="btn p" id="save-note" style="flex:1;justify-content:center">Save note</button></div></section>
    </main>
    <nav class="bottom" aria-label="Site sections"><a class="on" href="#">Site</a><a href="../site.html?id=${esc(id)}&tab=market${qs().get('mode') ? '&mode=' + CONFIG.mode : ''}">Market</a><a href="../site.html?id=${esc(id)}&tab=financials${qs().get('mode') ? '&mode=' + CONFIG.mode : ''}">Financials</a><a href="../site.html?id=${esc(id)}&tab=activity${qs().get('mode') ? '&mode=' + CONFIG.mode : ''}">Activity</a></nav></div>`;
  $$('[data-tag]').forEach(btn => btn.addEventListener('click', () => { tag = tags[Number(btn.dataset.tag)]; $$('[data-tag]').forEach(x => x.classList.toggle('on', x === btn)); }));
  $('#cam').addEventListener('change', async e => {
    const files = Array.from(e.target.files); if (!files.length) return;
    const rowId = tag.id || id; const row = adapter.get(tag.coll, rowId); const paths = [...(row.photo_paths || [])];
    for (const f of files){ const r = await adapter.uploadPhoto(id, f, tag.sub); if (r.ok) paths.push(r.path); else toast(r.reason, 'err'); }
    const res = await adapter.patch(tag.coll, rowId, { photo_paths: paths });
    if (res.ok){ toast(`${files.length} photo${files.length === 1 ? '' : 's'} → ${tag.label}`); render(); } else toast(res.reason, 'err');
  });
  $('#save-note').addEventListener('click', async () => { const t = $('#note').value.trim(); if (!t) return; const res = await adapter.upsert('feasibility_comments', { id: adapter.newId(), feasibility_id: id, author: adapter.user.initials, section: 'site_visit', comment: t }); if (res.ok){ toast('Note saved'); render(); } else toast(res.reason, 'err'); });
}

boot(async a => { adapter = a; id = qs().get('id'); if (id) render(); else list(); }, { seedUrl: '../data/seed.json' });

// Shared UI: app bar, html helpers, toast, boot.
import { CONFIG } from '../config.js';
import { createAdapter } from '../data/adapter.js';
import { statusLabel, canonicalStatus } from '../logic/status.js';

export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const qs = () => new URLSearchParams(location.search);
export const href = (page, params = {}) => {
  const p = new URLSearchParams(params);
  if (qs().get('mode')) p.set('mode', CONFIG.mode); // carry an explicit mode through every link
  const s = p.toString();
  return page + (s ? '?' + s : '');
};

export const ICON = {
  mark: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0B4C31" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg>',
  search: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  arrow: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  warn: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 9v4M12 17h.01M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
  block: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
  ok: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>',
  camera: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  back: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
};

export function statusChip(adapter, value){
  const c = canonicalStatus(value) || 'unset';
  return `<span class="chip ${esc(c)}"><i></i>${esc(value ? statusLabel(adapter, value) : '—')}</span>`;
}

export function appbar(active, { search = false, adapter } = {}){
  const nav = [['Pipeline', 'index.html'], ['Map', 'index.html?view=map'], ['Reports', 'index.html?view=reports'], ['Settings', 'index.html?view=settings']];
  const user = adapter ? adapter.user : { initials: '—', email: '' };
  return `<header class="appbar">
    <a class="brand" href="${href('index.html')}"><span class="mark">${ICON.mark}</span>Explorers <span>Acquisitions</span></a>
    <nav>${nav.map(([l, h]) => `<a href="${esc(h)}" class="${l === active ? 'on' : ''}">${l}</a>`).join('')}</nav>
    <div class="right">
      ${search ? `<label class="search">${ICON.search}<span class="sr">Search sites</span><input id="global-search" placeholder="Search site, suburb, council…"></label>` : ''}
      <span class="sync mono" id="sync-indicator">…</span>
      <button class="avatar" id="btn-signout" title="${esc(user.email)} — sign out" aria-label="Sign out ${esc(user.email)}" style="border:0;cursor:pointer">${esc(user.initials)}</button>
    </div>
  </header>`;
}

export function toast(msg, kind = ''){
  let el = $('#toast');
  if (!el){ el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.className = 'toast show ' + kind;
  clearTimeout(el._t); el._t = setTimeout(() => { el.className = 'toast'; }, 2600);
}

export function bindSync(adapter){
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#btn-signout') && CONFIG.mode !== 'local' && confirm('Sign out?')) signOut(adapter); });
  adapter.on('sync', s => {
    const el = $('#sync-indicator'); if (!el) return;
    el.className = 'sync mono' + (s.state === 'err' ? ' err' : '');
    el.textContent = s.state === 'err' ? 'sync error · ' + (s.label || '') : (s.label || 'synced') + (s.at ? ' · just now' : '');
  });
}

// Sign-in card (Supabase mode). Same Supabase auth as the current tool, so
// existing users/passwords work. Session persists in the browser.
function renderSignIn(root, err){
  root.innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px">
    <form id="signin" class="card" style="width:100%;max-width:380px;display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;align-items:center;gap:10px;font-weight:700;font-size:16px"><span style="width:28px;height:28px;border-radius:7px;background:var(--gum);display:inline-flex;align-items:center;justify-content:center">${ICON.mark}</span>Explorers <span style="font-weight:400;color:var(--ink-3)">Acquisitions</span></div>
      <div class="f"><label for="si-email">Email</label><input id="si-email" type="email" autocomplete="username" required></div>
      <div class="f"><label for="si-pass">Password</label><input id="si-pass" type="password" autocomplete="current-password" required></div>
      <div id="si-err" style="font-size:13px;color:var(--red-ink);min-height:18px">${esc(err || '')}</div>
      <button class="btn p lg" type="submit" style="justify-content:center">Sign in</button>
      <div class="muted" style="font-size:12px">Same sign-in as the current BuildCare tool. <a href="?mode=local">Use dummy data instead</a></div>
    </form></div>`;
  $('#signin').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('#signin button'); btn.disabled = true; btn.textContent = 'Signing in…';
    const { SupabaseAdapter } = await import('../data/adapter.js');
    const a = new SupabaseAdapter();
    const { error } = await a.signIn($('#si-email').value.trim(), $('#si-pass').value);
    if (error){ $('#si-err').textContent = error.message; btn.disabled = false; btn.textContent = 'Sign in'; return; }
    location.reload();
  });
}

// Boot a page: adapter + error surface. Renders a loading panel until ready.
export async function boot(renderFn, opts = {}){
  const root = $('#app');
  root.innerHTML = '<div class="loading"><div style="font-weight:600;color:var(--ink)">Loading…</div><div style="font-size:12.5px">' + (CONFIG.mode === 'local' ? 'Dummy data' : 'Pulling from Supabase') + '</div></div>';
  try {
    const adapter = await createAdapter(opts);
    window.__adapter = adapter; // QA + console convenience
    await renderFn(adapter);
    bindSync(adapter);
    adapter._emit('sync', { state: 'ok', label: CONFIG.mode === 'local' ? 'dummy data' : `synced · ${adapter.role}` });
    return adapter;
  } catch(e){
    if (e.code === 'auth'){ renderSignIn(root); return null; }
    console.error(e);
    root.innerHTML = `<div class="empty"><div style="font-weight:600;color:var(--ink)">Couldn't load</div><div style="margin-top:6px">${esc(e.message || e)}</div><div style="margin-top:12px"><a href="?mode=local">Open with dummy data</a></div></div>`;
    throw e;
  }
}

export async function signOut(adapter){
  if (adapter && adapter.signOut) await adapter.signOut();
  location.reload();
}

// Write-through field binding: on change → adapter.patch → mark saved/unsaved.
export function bindField(input, adapter, collection, id, field, { parse = v => v, after } = {}){
  const save = async () => {
    const value = parse(input.value);
    input.classList.add('unsaved');
    const res = await adapter.patch(collection, id, { [field]: value });
    if (res.ok){ input.classList.remove('unsaved', 'err'); if (after) after(res.row); }
    else { input.classList.add('err'); toast(res.reason || 'Not saved', 'err'); }
  };
  input.addEventListener('change', save);
  return save;
}
export const num = v => (v === '' || v == null) ? null : Number(String(v).replace(/[,$\s]/g, ''));

// Fill every [data-photo-path] element on the page with its signed URL once
// the feasibility's photo index is available. Elements render as placeholders
// first, so the page never waits on Storage.
export async function hydratePhotos(adapter, feasId){
  const els = $$('[data-photo-path]'); if (!els.length || !feasId) return;
  let idx; try { idx = await adapter.photoIndex(feasId); } catch(e){ return; }
  els.forEach(el => {
    const url = idx.urlFor(el.dataset.photoPath);
    if (!url) return;
    if (el.tagName === 'IMG') el.src = url; else el.style.backgroundImage = `url("${url}")`;
    el.title = el.dataset.photoPath;
  });
}

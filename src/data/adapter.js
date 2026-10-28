// Data adapter — the ONLY way pages read or write feasibility data.
//
// Design rules (these are what fix the failed-push class of bug):
//   • No local source of truth. In 'supabase' mode every write goes to the
//     server first; in-memory state updates only after the server confirms.
//   • Row-level writes with a single updated_at concurrency check — never
//     per-field conditional UPDATEs, never jsonb equality in a WHERE.
//   • A failed write is returned to the caller as {ok:false, reason, code}
//     so the UI can mark the field unsaved. Nothing is queued for later.
//   • Role is known up front; the UI never attempts a write the role can't make.
//
// Collections (names match the Supabase tables):
//   projects, feasibility_data, feasibility_competitors, feasibility_schools,
//   feasibility_estates, feasibility_nearby_explorers, explorers_centre_data,
//   feasibility_comments, lookups
//
// Both adapters expose the same API:
//   await adapter.init()
//   adapter.role                              -> 'admin' | 'intake' | 'acquisitions'
//   adapter.user                              -> { email, initials }
//   adapter.list(collection, filter?)         -> rows (soft-deleted excluded)
//   adapter.get(collection, id)               -> row | null
//   await adapter.upsert(collection, row)     -> { ok, row?, reason?, code? }
//   await adapter.patch(collection, id, fields)
//   await adapter.remove(collection, id)      -> soft delete (deleted_at)
//   adapter.on(event, fn)                     -> 'change' | 'sync'
//   adapter.feasibility(id)                   -> bundle for one site
//   adapter.newId()

import { CONFIG } from '../config.js';

const COLLECTIONS = [
  'projects', 'feasibility_data', 'feasibility_competitors', 'feasibility_schools',
  'feasibility_estates', 'feasibility_nearby_explorers', 'explorers_centre_data',
  'feasibility_comments', 'lookups',
];
const CHILD_TABLES = ['feasibility_competitors', 'feasibility_schools', 'feasibility_estates', 'feasibility_nearby_explorers', 'feasibility_comments'];

// Columns the v2 app is allowed to WRITE per table (from sql/03, 06, 17, 25).
// Anything else is stripped before it reaches Supabase, so a UI field can never
// break a write with "column does not exist".
const WRITABLE = {
  projects: ['id', 'type', 'name', 'code', 'active', 'address', 'places', 'notes'],
  feasibility_data: ['id', 'status', 'prepared_by', 'last_saved_at', 'sections_complete', 'reviewer_notes', 'site_suburb', 'site_address', 'site_council', 'site_state', 'site_type', 'land_size_sqm', 'price', 'agent', 'proposed_use', 'site_other_notes', 'proposed_places', 'gapmaps_5min', 'gapmaps_10min', 'feasibility_inputs', 'report_config', 'photo_paths', 'housing_growth', 'nearby_explorers', 'deleted_at'],
  feasibility_competitors: ['id', 'feasibility_id', 'status', 'name', 'address', 'places', 'operator', 'sort_order', 'fee', 'hours', 'nqs_rating', 'nqs_count', 'nqs_date', 'dev_type', 'project_desc', 'stage', 'risk_pct', 'ms_called_date', 'ms_called_by', 'ms_waitlist', 'ms_current_capacity', 'ms_fee_quoted', 'ms_notes', 'ms_followup', 'photo_paths', 'map_path', 'distance_km', 'confidence', 'count_in_chain', 'deleted_at'],
  feasibility_schools: ['id', 'feasibility_id', 'name', 'address', 'sector', 'type', 'enrolments', 'distance_km', 'photo_paths', 'sort_order', 'deleted_at'],
  feasibility_estates: ['id', 'feasibility_id', 'name', 'suburb', 'lots', 'started', 'completion', 'monthly_rate', 'pct_in_catch', 'sort_order', 'deleted_at'],
  feasibility_nearby_explorers: ['id', 'feasibility_id', 'explorers_project_id', 'distance_km', 'drive_time_min', 'counts', 'deleted_at'],
  feasibility_comments: ['id', 'feasibility_id', 'author', 'comment', 'section', 'deleted_at'],
  explorers_centre_data: ['id', 'current_fee', 'current_ratio', 'current_occupancy_pct', 'current_nqs_rating', 'last_audit_date', 'notes', 'deleted_at'],
  lookups: ['id', 'category', 'value', 'label', 'order', 'active'],
};
function pickWritable(table, row){
  const allow = WRITABLE[table]; if (!allow) return row;
  const out = {}; for (const k of allow) if (k in row) out[k] = row[k];
  out.updated_at = row.updated_at;
  return out;
}

export function newId(){
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
export const nowISO = () => new Date().toISOString();

class BaseAdapter {
  constructor(){ this._store = {}; this._handlers = { change: [], sync: [] }; this.role = 'admin'; this.user = { email: 'dev@local', initials: 'DV' }; }
  on(ev, fn){ (this._handlers[ev] || (this._handlers[ev] = [])).push(fn); return () => { this._handlers[ev] = this._handlers[ev].filter(f => f !== fn); }; }
  _emit(ev, payload){ (this._handlers[ev] || []).forEach(fn => { try { fn(payload); } catch(e){ console.error(e); } }); }
  _rows(c){ return this._store[c] || (this._store[c] = []); }
  list(c, filter){
    let rows = this._rows(c).filter(r => !r.deleted_at);
    if (filter) rows = rows.filter(r => Object.entries(filter).every(([k, v]) => r[k] === v));
    return rows;
  }
  get(c, id){ return this._rows(c).find(r => r.id === id && !r.deleted_at) || null; }
  newId(){ return newId(); }
  canWrite(){ return this.role !== 'acquisitions'; }
  lookups(category){ return this.list('lookups', { category }).filter(l => l.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0)); }

  // Everything one site needs, in one object.
  feasibility(id){
    const project = this.get('projects', id);
    if (!project) return null;
    const fd = this.get('feasibility_data', id) || { id };
    const byFeas = c => this.list(c, { feasibility_id: id }).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    // Nearby Explorers: name/occupancy come from projects + explorers_centre_data, not the link row.
    const nearby = byFeas('feasibility_nearby_explorers').map(n => {
      const centre = this.get('projects', n.explorers_project_id) || {};
      const ecd = this.get('explorers_centre_data', n.explorers_project_id) || {};
      return { ...n, name: n.name || centre.name || '(centre)', occupancy_pct: n.occupancy_pct ?? ecd.current_occupancy_pct ?? null, places: n.places ?? centre.places ?? null };
    });
    return {
      project, fd,
      competitors: byFeas('feasibility_competitors'),
      schools: byFeas('feasibility_schools'),
      estates: byFeas('feasibility_estates'),
      nearby,
      comments: byFeas('feasibility_comments'),
      benchVic: (this.get('feasibility_data', CONFIG.benchmarks.VIC) || {}).gapmaps_5min || null,
      benchAus: (this.get('feasibility_data', CONFIG.benchmarks.AUS) || {}).gapmaps_5min || null,
    };
  }
  feasibilityProjects(){
    return this.list('projects', { type: 'feasibility' });
  }
  _applyLocal(c, row){
    const rows = this._rows(c);
    const i = rows.findIndex(r => r.id === row.id);
    if (i >= 0) rows[i] = row; else rows.push(row);
    this._emit('change', { collection: c, id: row.id });
    return row;
  }
}

/* ── Local (dummy data) ─────────────────────────────────────────────── */
export class LocalAdapter extends BaseAdapter {
  constructor(opts = {}){ super(); this.seedUrl = opts.seedUrl || 'data/seed.json'; this.persist = opts.persist !== false; this.role = opts.role || 'admin'; this.user = { email: 'james.kelly@dev.local', initials: 'JK' }; }
  async init(){
    let data = null;
    if (this.persist){
      try { const raw = localStorage.getItem(CONFIG.devKey); if (raw) data = JSON.parse(raw); } catch(e){ /* ignore */ }
    }
    if (!data){
      const res = await fetch(this.seedUrl);
      if (!res.ok) throw new Error('Could not load seed data: ' + res.status);
      data = await res.json();
    }
    COLLECTIONS.forEach(c => { this._store[c] = Array.isArray(data[c]) ? data[c] : []; });
    this._emit('sync', { state: 'ok', at: nowISO(), label: 'dummy data' });
  }
  _save(){
    if (!this.persist) return;
    try { localStorage.setItem(CONFIG.devKey, JSON.stringify(this._store)); } catch(e){ /* ignore */ }
  }
  async reset(){ try { localStorage.removeItem(CONFIG.devKey); } catch(e){} this.persist && (this._store = {}); await this.init(); }
  async upsert(c, row){
    if (!this.canWrite()) return { ok: false, code: 'forbidden', reason: 'Read-only role' };
    const existing = this.get(c, row.id);
    const merged = { ...(existing || {}), ...row, updated_at: nowISO() };
    if (!existing) merged.created_at = merged.created_at || nowISO();
    this._applyLocal(c, merged); this._save();
    return { ok: true, row: merged };
  }
  async patch(c, id, fields){
    const existing = this.get(c, id);
    if (!existing) return { ok: false, code: 'missing', reason: 'Row not found' };
    return this.upsert(c, { ...existing, ...fields, id });
  }
  async remove(c, id){
    const existing = this.get(c, id);
    if (!existing) return { ok: true };
    return this.upsert(c, { ...existing, deleted_at: nowISO() });
  }
  async uploadPhoto(feasId, file, subpath){
    // Dummy mode: object URL only, never persisted. Paths are RELATIVE to the
    // feasibility folder, matching the Supabase convention.
    const path = `${subpath || 'photos'}/${Date.now()}-${file.name}`;
    this._localPhotos = this._localPhotos || {}; (this._localPhotos[feasId] = this._localPhotos[feasId] || {})[path] = URL.createObjectURL(file);
    return { ok: true, path, url: this._localPhotos[feasId][path] };
  }
  // Photo index for one feasibility: { paths: [relPath…], urlFor(relPath) → url|'' }
  async photoIndex(feasId){
    const map = (this._localPhotos && this._localPhotos[feasId]) || {};
    return { paths: Object.keys(map), urlFor: p => map[p] || '' };
  }
}

/* ── supabase-js loader: vendored UMD first (self-contained), CDN fallback ── */
const SUPABASE_JS_LOCAL = new URL('../../vendor/supabase-js-2.45.4.umd.js', import.meta.url).href;
const SUPABASE_JS_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
let _sbLoad = null;
function loadSupabaseJs(){
  if (globalThis.supabase && globalThis.supabase.createClient) return Promise.resolve(globalThis.supabase.createClient);
  if (_sbLoad) return _sbLoad;
  const inject = src => new Promise((resolve, reject) => {
    const s = document.createElement('script'); s.src = src; s.async = true;
    s.onload = () => globalThis.supabase?.createClient ? resolve(globalThis.supabase.createClient) : reject(new Error('supabase-js loaded but createClient missing'));
    s.onerror = () => reject(new Error('Could not load ' + src));
    document.head.appendChild(s);
  });
  _sbLoad = inject(SUPABASE_JS_LOCAL).catch(() => inject(SUPABASE_JS_CDN));
  return _sbLoad;
}

/* ── Supabase (write-through) ───────────────────────────────────────── */
export class SupabaseAdapter extends BaseAdapter {
  constructor(opts = {}){ super(); this.opts = opts; this.sb = null; this._channel = null; this.user = { email: '', initials: '—' }; }
  async client(){
    if (this.sb) return this.sb;
    const createClient = await loadSupabaseJs();
    const key = CONFIG.supabase.anonKey;
    if (!key) throw new Error('Supabase anon key not configured (src/config.js)');
    this.sb = createClient(CONFIG.supabase.url, key);
    return this.sb;
  }
  async init(){
    await this.client();
    const { data: { session } } = await this.sb.auth.getSession();
    if (!session) throw Object.assign(new Error('Not signed in'), { code: 'auth' });
    const meta = session.user.app_metadata || {};
    this.role = meta.role || 'admin';
    const email = session.user.email || '';
    this.user = { email, initials: email.split('@')[0].split(/[._-]/).map(s => s[0] || '').join('').slice(0, 2).toUpperCase() };
    // The view-only role reads the restricted view instead of the table.
    this._fdSource = this.role === 'acquisitions' ? 'feasibility_data_restricted' : 'feasibility_data';
    await this.pull();
    this._subscribe();
  }
  async pull(){
    this._emit('sync', { state: 'busy', label: 'loading' });
    const q = (table, source) => this.sb.from(source || table).select('*').is('deleted_at', null);
    const results = await Promise.all(COLLECTIONS.map(c => q(c, c === 'feasibility_data' ? this._fdSource : c)));
    const err = results.find(r => r.error);
    if (err){ this._emit('sync', { state: 'err', label: err.error.message }); throw err.error; }
    COLLECTIONS.forEach((c, i) => { this._store[c] = results[i].data || []; });
    this._emit('sync', { state: 'ok', at: nowISO(), label: 'synced' });
    this._emit('change', { collection: '*' });
  }
  _subscribe(){
    try {
      this._channel = this.sb.channel('acq-v2');
      COLLECTIONS.forEach(c => {
        this._channel.on('postgres_changes', { event: '*', schema: 'public', table: c }, payload => {
          const row = payload.new && payload.new.id ? payload.new : null;
          if (row) this._applyLocal(c, row);
        });
      });
      this._channel.subscribe();
    } catch(e){ console.warn('realtime unavailable', e); }
  }
  async upsert(c, row){
    if (!this.canWrite()) return { ok: false, code: 'forbidden', reason: 'Read-only role' };
    const existing = this.get(c, row.id);
    const payload = pickWritable(c, { ...row, updated_at: nowISO() });
    delete payload.deleted_at;
    if (existing && existing.updated_at){
      // Single-column optimistic check: the row must still be the version we last saw.
      const { data, error } = await this.sb.from(c).update(payload).eq('id', row.id).eq('updated_at', existing.updated_at).select();
      if (error) return this._fail(error);
      if (!data || !data.length) return { ok: false, code: 'conflict', reason: 'Changed elsewhere — reload to see the latest' };
      this._applyLocal(c, data[0]);
      return { ok: true, row: data[0] };
    }
    const { data, error } = await this.sb.from(c).upsert(payload).select();
    if (error) return this._fail(error);
    this._applyLocal(c, data[0]);
    return { ok: true, row: data[0] };
  }
  async patch(c, id, fields){
    const existing = this.get(c, id);
    if (!existing) return { ok: false, code: 'missing', reason: 'Row not found' };
    return this.upsert(c, { ...existing, ...fields, id });
  }
  async remove(c, id){
    if (!this.canWrite()) return { ok: false, code: 'forbidden', reason: 'Read-only role' };
    const { data, error } = await this.sb.from(c).update({ deleted_at: nowISO() }).eq('id', id).select();
    if (error) return this._fail(error);
    if (data && data[0]) this._applyLocal(c, data[0]);
    return { ok: true };
  }
  _fail(error){
    const msg = error.message || String(error);
    const denied = /permission|policy|row-level|violates row/i.test(msg);
    const schema = /column .* does not exist|schema cache|check constraint/i.test(msg);
    this._emit('sync', { state: 'err', label: msg });
    return { ok: false, code: denied ? 'forbidden' : schema ? 'schema' : 'error', reason: schema ? `${msg} — run sql/25-acquisitions-v2.sql` : msg };
  }
  // Storage convention (same as the current tool): bucket 'feasibility-photos',
  // object key = `${feasId}/${relPath}`; rows store relPath only.
  async uploadPhoto(feasId, file, subpath){
    const rel = `${subpath || 'photos'}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await this.sb.storage.from(CONFIG.supabase.photoBucket).upload(`${feasId}/${rel}`, file, { upsert: false });
    if (error) return this._fail(error);
    this._photoCache = this._photoCache || {}; delete this._photoCache[feasId]; // invalidate index
    return { ok: true, path: rel, url: await this.photoUrl(feasId, rel) };
  }
  async photoUrl(feasId, rel){
    const { data } = await this.sb.storage.from(CONFIG.supabase.photoBucket).createSignedUrl(`${feasId}/${rel}`, 3600);
    return data ? data.signedUrl : '';
  }
  // Walk the known sub-folders (the Storage list API is one level deep) and
  // sign everything in one batch. Cached per feasibility for ~50 minutes.
  async photoIndex(feasId){
    this._photoCache = this._photoCache || {};
    const hit = this._photoCache[feasId];
    if (hit && hit.expires > Date.now()) return hit.index;
    const bucket = this.sb.storage.from(CONFIG.supabase.photoBucket);
    const folders = ['', 'photos/', 'competitors/', 'schools/', 'nearmaps/', 'gapmaps/', 'pipeline/', 'site/'];
    const rels = [];
    const walk = async (prefix, depth) => {
      const { data, error } = await bucket.list(`${feasId}/${prefix}`, { limit: 500, sortBy: { column: 'name', order: 'asc' } });
      if (error || !data) return;
      for (const o of data){
        if (!o.name) continue;
        const isFolder = o.id == null && !o.metadata;
        if (isFolder){ if (depth < 2) await walk(prefix + o.name + '/', depth + 1); continue; }
        if (/\.(png|jpe?g|gif|webp|pdf)$/i.test(o.name)) rels.push(prefix + o.name);
      }
    };
    for (const f of folders) await walk(f, f === '' ? 0 : 1);
    const uniq = [...new Set(rels)];
    const map = {};
    if (uniq.length){
      const { data } = await bucket.createSignedUrls(uniq.map(r => `${feasId}/${r}`), 3600);
      (data || []).forEach((d, i) => { if (d && d.signedUrl) map[uniq[i]] = d.signedUrl; });
    }
    const index = { paths: uniq, urlFor: p => map[p] || '' };
    this._photoCache[feasId] = { index, expires: Date.now() + 50 * 60 * 1000 };
    return index;
  }
  async signIn(email, password){ await this.client(); return this.sb.auth.signInWithPassword({ email, password }); }
  async signOut(){ await this.client(); return this.sb.auth.signOut(); }
}

export async function createAdapter(opts = {}){
  const mode = opts.mode || CONFIG.mode;
  const adapter = mode === 'supabase' ? new SupabaseAdapter(opts) : new LocalAdapter(opts);
  await adapter.init();
  return adapter;
}

export { COLLECTIONS, CHILD_TABLES };

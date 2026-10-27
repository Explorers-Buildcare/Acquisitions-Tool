// Feasibility status helpers — same canonicalisation as the old tool.
export function canonicalStatus(s){
  if (s === 'no_go') return 'rejected';
  return s || '';
}
export const ACTIVE_STATUSES = new Set(['reviewing', 'conditional_go']);
export const STATUS_ORDER = { reviewing: 1, conditional_go: 2, go: 3, rejected: 4, no_go: 4, deleted: 5, '': 6 };

const FALLBACK = { reviewing: 'Reviewing', conditional_go: 'Conditional go', go: 'Go', rejected: 'No-go', no_go: 'No-go' };
export function statusLabel(adapter, value){
  if (!value) return 'Reviewing';
  const lk = adapter ? adapter.list('lookups').find(l => l.category === 'feasibility_status' && l.value === value) : null;
  return lk ? lk.label : (FALLBACK[value] || value);
}
export function statusOptions(adapter){
  const opts = adapter ? adapter.lookups('feasibility_status') : [];
  return opts.length ? opts : Object.entries(FALLBACK).filter(([v]) => v !== 'no_go').map(([value, label], i) => ({ value, label, order: i }));
}
export function relativeTime(iso){
  if (!iso) return '—';
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return Math.round(d / 60) + ' min ago';
  if (d < 86400) return Math.round(d / 3600) + ' h ago';
  const days = Math.round(d / 86400);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return days + ' d ago';
}
export const daysSince = iso => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null;

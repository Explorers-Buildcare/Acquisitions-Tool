// Runtime configuration.
//
// MODE
//   'local'    — dummy data from data/seed.json, edits held in memory
//                (and mirrored to localStorage under DEV_KEY for convenience
//                while developing; "Reset dummy data" clears it).
//   'supabase' — write-through to Supabase. No local source of truth.
//
// Override at runtime with ?mode=local|supabase on any page URL.

const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');

// Publishable (anon) key — public and RLS-gated, the same one the current tool ships.
const PUBLISHABLE_KEY = 'sb_publishable_LiBO-62V3peGgt7II-lzeQ_RabmtXc2';

export const CONFIG = {
  // Default is Supabase when a key is configured; ?mode=local forces dummy data.
  mode: params.get('mode') || (PUBLISHABLE_KEY ? 'supabase' : 'local'),
  devKey: 'acq-v2-dev-data',
  supabase: {
    url: 'https://kljzuyuqewvkkblfhxpq.supabase.co',
    anonKey: (typeof window !== 'undefined' && window.SUPABASE_ANON_KEY) || PUBLISHABLE_KEY,
    photoBucket: 'feasibility-photos',
  },
  benchmarks: {
    VIC: '00000000-0000-0000-0000-0000000000bc',
    AUS: '00000000-0000-0000-0000-0000000000ba',
  },
  explorersTargetFee: 188,
  version: '2.0.0-dev',
};

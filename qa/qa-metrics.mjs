// Pure-node checks on the ported metrics engine + pre-flight. No browser.
// Run: node qa/qa-metrics.mjs
import { readFileSync } from 'node:fs';
import { computeFeasibilityMetrics } from '../src/logic/metrics.js';
import { runPreflight } from '../src/logic/preflight.js';
import { LocalAdapter } from '../src/data/adapter.js';

const report = { passed: 0, failed: 0, errors: [] };
const ok = (cond, msg) => { if (cond) report.passed++; else { report.failed++; report.errors.push(msg); } };
const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// Load seed through the adapter (fetch shim)
const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url)));
globalThis.fetch = async () => ({ ok: true, json: async () => seed });
const adapter = new LocalAdapter({ persist: false });
await adapter.init();

const byName = n => adapter.feasibilityProjects().find(p => p.name.startsWith(n));

// ── Mickleham: hand-computed chain ───────────────────────────────────
{
  const b = adapter.feasibility(byName('Mickleham').id);
  const m = computeFeasibilityMetrics(b);
  ok(close(m.ratioRaw5, 2608 / 392), 'raw ratio = children/places');
  ok(m.participationFactor === 1.0, 'participation placeholder 1.0');
  // overseas 34% → 1 - (34-30)*0.005 = 0.98
  ok(close(m.caldFactor, 0.98), `CALD factor 0.98 (got ${m.caldFactor})`);
  ok(close(m.ratioStep3, (2608 / 392) * 0.98), 'step 3 = raw × CALD');
  // pipeline: Lot 412 150 @70% = 105; potential counted: Kalkallo 158 @60% = 94.8; not counted: others
  ok(close(m.pipelineEffectivePlaces, 105 + 94.8), `pipeline effective places 199.8 (got ${m.pipelineEffectivePlaces})`);
  ok(m.newPlacesFromPipeline === Math.round(199.8 + 120), 'new places includes our 120');
  // estates: 38×0.7 + 22×1.0 = 48.6 lots/mo → ×54×0.42 = 1102.248 → 1102
  ok(m.rpmChildren === 1102, `estate children 1102 (got ${m.rpmChildren})`);
  const expected4 = (2608 + 1102) / (392 + 320);
  ok(close(m.ratioStep4, expected4), `step 4 = ${expected4.toFixed(4)} (got ${m.ratioStep4})`);
  ok(m.effectiveRatio === m.ratioStep4, 'effective = step 4 when available');
  ok(m.demandStrength === 'STRONG', 'strength STRONG at ≥2.5');
  ok(m.potential.length === 3 && m.potentialCounted.length === 1, 'potential split: 3 total, 1 counted');
  ok(m.liveComps.length === 3, 'live competitors 3');
  ok(m.compRating === 'Watch', 'competition rating Watch (3–5 live)');
  ok(m.pipeRating === 'No-Go', 'pipeline rating No-Go (>150 risk-weighted)');
  ok(m.demoRating === 'Go', 'demographics Go (SEIFA 6, income 104k)');
  ok(m.stressTestRatio != null && m.stressTestRatio < m.ratioRaw5, 'stress test below raw');
}

// ── count_in_chain toggle changes step 4 ─────────────────────────────
{
  const b = adapter.feasibility(byName('Mickleham').id);
  const before = computeFeasibilityMetrics(b).ratioStep4;
  const b2 = { ...b, competitors: b.competitors.map(c => c.status === 'potential' ? { ...c, count_in_chain: true } : c) };
  const after = computeFeasibilityMetrics(b2).ratioStep4;
  ok(after < before, 'counting all potential sites lowers the effective ratio');
  const b3 = { ...b, competitors: b.competitors.map(c => c.status === 'potential' ? { ...c, count_in_chain: false } : c) };
  const none = computeFeasibilityMetrics(b3);
  ok(close(none.pipelineEffectivePlaces, 105), 'with no potential counted, only the permit remains');
}

// ── No GapMaps → TBD paths, no crash ─────────────────────────────────
{
  const b = adapter.feasibility(byName('Cobblebank').id);
  const m = computeFeasibilityMetrics(b);
  ok(m.effectiveRatio == null && m.demandStrength === 'TBD' && m.demandRating === 'TBD', 'missing GapMaps → TBD');
  const pf = runPreflight(b);
  ok(pf.issues.some(i => i.level === 'block' && /No GapMaps/.test(i.text)), 'preflight blocks on missing demand data');
}

// ── Pre-flight rules on Mickleham ────────────────────────────────────
{
  const b = adapter.feasibility(byName('Mickleham').id);
  const pf = runPreflight(b);
  ok(pf.issues.some(i => /Trend tag/.test(i.text) && i.level === 'block'), 'declining projection tagged "Growing" is blocked');
  ok(!pf.issues.some(i => /CALD flag/.test(i.text)), 'NE Asia 0.4% vs VIC 3.64% flagged Low → no CALD issue');
  ok(pf.issues.some(i => /occupancy missing/.test(i.text)), 'missing occupancy warned');
  // Inject a wrong-direction CALD flag and a draft note
  const b2 = JSON.parse(JSON.stringify(b));
  b2.fd.gapmaps_5min.place_of_birth[1].flag = 'Watch';
  b2.fd.site_other_notes += ' ⚠ UNVERIFIED DATA';
  const pf2 = runPreflight(b2);
  ok(pf2.issues.some(i => /CALD flag "Watch"/.test(i.text) && i.level === 'block'), 'wrong-direction CALD flag is blocked');
  ok(pf2.issues.some(i => /UNVERIFIED/.test(i.text) && i.level === 'block'), 'UNVERIFIED note is blocked');
  ok(pf2.canExport === false, 'export blocked');
}

// ── Adapter write-through semantics ──────────────────────────────────
{
  const id = byName('Wollert').id;
  const r1 = await adapter.patch('feasibility_data', id, { proposed_places: 100 });
  ok(r1.ok && adapter.get('feasibility_data', id).proposed_places === 100, 'patch updates in-memory after ok');
  const ro = new LocalAdapter({ persist: false, role: 'acquisitions' }); await ro.init();
  const r2 = await ro.patch('feasibility_data', id, { proposed_places: 1 });
  ok(r2.ok === false && r2.code === 'forbidden', 'read-only role cannot write');
  const r3 = await adapter.remove('feasibility_competitors', adapter.list('feasibility_competitors', { feasibility_id: id })[0].id);
  ok(r3.ok && adapter.list('feasibility_competitors', { feasibility_id: id }).length === 6, 'soft delete hides row');
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.failed ? 1 : 0);

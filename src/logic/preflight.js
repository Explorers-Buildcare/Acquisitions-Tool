// Report pre-flight — the checks from the May 2026 report-format review,
// run over the site data before a deck can be exported.
//
// Each rule returns null (pass) or { level: 'block'|'warn', slide, text }.
// 'block' disables Export PDF; 'warn' is shown but doesn't block.

import { computeFeasibilityMetrics, fmtN } from './metrics.js';

const VIC_NE_ASIA_PCT = 3.64; // benchmark used by the old report; superseded when benchVic carries place_of_birth

export function runPreflight(bundle){
  const m = computeFeasibilityMetrics(bundle);
  const { fd = {}, competitors = [], estates = [] } = bundle;
  const issues = [];

  // (f) CALD flag must be directional — only flag when local EXCEEDS benchmark
  const pob = (m.gm5 && m.gm5.place_of_birth) || [];
  const benchPob = (m.benchVic && m.benchVic.place_of_birth) || [];
  pob.forEach(row => {
    if (row.country === 'Australia' || row.pct == null) return;
    const bench = benchPob.find(b => b.country === row.country);
    const benchPct = bench ? Number(bench.pct) : (row.country === 'North East Asia' ? VIC_NE_ASIA_PCT : null);
    if (benchPct == null) return;
    if (row.flag && row.flag !== 'Low' && Number(row.pct) < benchPct){
      issues.push({ level: 'block', slide: 7, text: `CALD flag "${row.flag}" on ${row.country} ${Number(row.pct).toFixed(1)}% vs VIC ${benchPct.toFixed(1)}% — local is below benchmark, should be Low.` });
    }
  });

  // (c) Trend tag must agree with the forward projection, not the historical rate
  const proj = (m.gm5 && m.gm5.age_projection_0_5) || null;
  if (proj){
    const years = Object.keys(proj).filter(k => /^\d{4}$/.test(k)).sort();
    if (years.length >= 2){
      const first = Number(proj[years[0]]), last = Number(proj[years[years.length - 1]]);
      const tag = proj.trend_tag || (fd.report_config && fd.report_config.growth_trend_tag);
      if (tag && /grow/i.test(tag) && last < first){
        issues.push({ level: 'block', slide: 9, text: `Trend tag "${tag}" contradicts projection chart (${fmtN(first)} → ${fmtN(last)}). Tag follows the projection, not the historical rate.` });
      }
    }
  }

  // Exec summary tiles need the feaso
  const feaso = fd.feasibility_inputs && fd.feasibility_inputs.feaso;
  if (!feaso || !feaso.op) issues.push({ level: 'warn', slide: 2, text: 'OpCo EBITDA tile empty — OpCo feaso not saved.' });

  // Demand data present at all
  if (m.effectiveRatio == null) issues.push({ level: 'block', slide: 4, text: 'No GapMaps 5-minute data — demand chain cannot be computed.' });

  // Missing competitor occupancy / fee are shown as "—" — note it
  const live = m.liveComps;
  const noFee = live.filter(c => c.fee == null || c.fee === '').length;
  if (live.length && noFee) issues.push({ level: 'warn', slide: 5, text: `Fee missing for ${noFee} of ${live.length} live competitors — shown as "—" on slide 5.` });
  const noOcc = live.filter(c => c.ms_current_capacity == null).length;
  if (live.length && noOcc) issues.push({ level: 'warn', slide: 5, text: `Competitor occupancy missing for ${noOcc} of ${live.length} — shown as "—", noted on slide 5.` });

  // (e) Draft notes must not ship
  const text = JSON.stringify(fd.report_config || {}) + JSON.stringify(competitors.map(c => c.project_desc || '')) + (fd.site_other_notes || '');
  if (/UNVERIFIED/i.test(text)) issues.push({ level: 'block', slide: null, text: '"UNVERIFIED" draft note still present in report content.' });
  else issues.push({ level: 'ok', slide: null, text: 'No "UNVERIFIED" draft notes remain in the deck.' });

  // Estates with no rate at all
  if (estates.some(e => !Number(e.monthly_rate) && !Number(e.lots))) issues.push({ level: 'warn', slide: 9, text: 'An estate row has neither lots/month nor total lots — it contributes nothing to growth.' });

  const blocking = issues.filter(i => i.level === 'block').length;
  return { issues, blocking, canExport: blocking === 0, metrics: m };
}

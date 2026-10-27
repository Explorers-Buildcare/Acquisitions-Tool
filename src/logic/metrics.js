// computeFeasibilityMetrics — ported verbatim from acquisitions-tool.html
// (line ~13535) and made pure: it takes the feasibility bundle from the
// adapter instead of reading global `data`. Numbers must match the old tool.
//
// One deliberate addition (v2): competitors with status 'potential' are
// included in Step 4 (forward supply) ONLY when count_in_chain is true, and
// are risk-weighted the same way pipeline permits are. Everything else is
// unchanged.

import { CONFIG } from '../config.js';

export const fmtAud   = v => (v != null && v !== '') ? '$' + Number(v).toLocaleString('en-AU') : '—';
export const fmtN     = v => (v != null && v !== '') ? Number(v).toLocaleString('en-AU') : '—';
export const fmtRatio = v => (v != null && v !== '') ? Number(v).toFixed(2) + '×' : '—';
export const fmtPct   = v => (v != null && v !== '') ? Number(v).toFixed(1) + '%' : '—';

export function computeFeasibilityMetrics(bundle){
  const { project: p, fd = {}, competitors = [], estates = [], schools = [], nearby = [], benchVic = null, benchAus = null } = bundle;

  const gm5  = fd.gapmaps_5min  || null;
  const gm10 = fd.gapmaps_10min || null;

  const _r = (gm) => (gm && gm.ldc && gm.ldc.places && gm.ldc.children_05) ? (gm.ldc.children_05 / gm.ldc.places) : null;
  const ratioRaw5  = _r(gm5);
  const ratioRaw10 = _r(gm10);
  const vicRatio   = _r(benchVic);
  const ausRatio   = _r(benchAus);

  // Step 2: participation (placeholder 1.0 until per-LGA workforce data captured)
  const participationFactor = 1.0;
  // Step 3: CALD — overseas-born % vs Melbourne baseline ~30%, capped 0.7–1.0
  let localOverseasPct = null;
  if (gm5 && Array.isArray(gm5.place_of_birth)){
    const aussie = gm5.place_of_birth.find(c => c.country === 'Australia');
    if (aussie && aussie.pct != null) localOverseasPct = 100 - Number(aussie.pct);
  }
  const melbBaselinePct = 30;
  const caldFactor = localOverseasPct == null ? 1.0
    : Math.min(1.0, Math.max(0.7, 1 - ((localOverseasPct - melbBaselinePct) * 0.005)));
  const ratioStep2 = ratioRaw5 != null ? ratioRaw5 * participationFactor : null;
  const ratioStep3 = ratioStep2 != null ? ratioStep2 * caldFactor : null;

  // Step 4: pipeline + estates
  const allComps  = competitors.filter(c => c.feasibility_id === p.id);
  const liveComps = allComps.filter(c => (c.status || 'live') === 'live');
  const pipeline  = allComps.filter(c => c.status === 'pipeline');
  const potential = allComps.filter(c => c.status === 'potential');
  const potentialCounted = potential.filter(c => c.count_in_chain !== false);
  const riskPlaces = x => (Number(x.places) || 0) * (Number(x.risk_pct) || 0) / 100;
  const pipelineEffectivePlaces = pipeline.reduce((a, x) => a + riskPlaces(x), 0)
                                + potentialCounted.reduce((a, x) => a + riskPlaces(x), 0);
  const proposedPlaces = Number(fd.proposed_places) || 0;
  const newPlacesFromPipeline = Math.round(pipelineEffectivePlaces + proposedPlaces);

  const rpmMonthly = estates.reduce((a, e) => {
    const rate = Number(e.monthly_rate) || 0;
    if (!rate) return a;
    const pct = (e.pct_in_catch === '' || e.pct_in_catch == null) ? 100 : (Number(e.pct_in_catch) || 0);
    return a + rate * pct / 100;
  }, 0);
  const rpmChildren = Math.round(rpmMonthly * 54 * 0.42);
  const legacyLots = estates.reduce((a, e) => a + ((Number(e.monthly_rate) || 0) ? 0 : (Number(e.lots) || 0)), 0);
  const estimatedNewChildren = rpmChildren + Math.round(legacyLots * 0.075);
  const newLots = Math.round(rpmMonthly * 54) + legacyLots;
  const currentChildren = Number(gm5?.ldc?.children_05) || 0;
  const currentPlaces   = Number(gm5?.ldc?.places) || 0;
  const totalPlaces4 = currentPlaces + newPlacesFromPipeline;
  const totalChildren4 = currentChildren + estimatedNewChildren;
  const ratioStep4 = (totalPlaces4 > 0 && currentChildren > 0) ? (totalChildren4 / totalPlaces4) : null;

  const effectiveRatio = (ratioStep4 != null) ? ratioStep4 : (ratioStep3 != null) ? ratioStep3 : ratioRaw5;
  const demandStrength = effectiveRatio == null ? 'TBD' : effectiveRatio >= 2.5 ? 'STRONG' : effectiveRatio >= 1.5 ? 'MODERATE' : 'WEAK';
  const demandStrengthCls = demandStrength.toLowerCase();

  const totalLivePlaces = liveComps.reduce((a, c) => a + (Number(c.places) || 0), 0);
  const liveFees = liveComps.filter(c => c.fee).map(c => Number(c.fee));
  const avgLiveFee = liveFees.length ? Math.round(liveFees.reduce((a, b) => a + b) / liveFees.length) : null;
  const explorersTargetFee = CONFIG.explorersTargetFee;
  const headroomFee = avgLiveFee != null ? (explorersTargetFee - avgLiveFee) : null;

  function rating(label){
    if (label === 'demand'){
      if (effectiveRatio == null) return ['TBD', 'GapMaps CSV not yet uploaded.'];
      const r = effectiveRatio;
      if (r >= 2.5) return ['Go',    `Effective ratio ${fmtRatio(r)} — well above VIC ${fmtRatio(vicRatio)}.`];
      if (r >= 1.5) return ['Watch', `Effective ratio ${fmtRatio(r)} — moderate vs VIC ${fmtRatio(vicRatio)}.`];
      return ['No-Go', `Effective ratio ${fmtRatio(r)} — below VIC benchmark ${fmtRatio(vicRatio)}.`];
    }
    if (label === 'competition'){
      if (!liveComps.length) return ['TBD', 'No competitor data entered.'];
      const headroom = avgLiveFee ? (explorersTargetFee - avgLiveFee) : null;
      const desc = `${liveComps.length} competitor${liveComps.length === 1 ? '' : 's'}${avgLiveFee ? `, avg fee ${fmtAud(avgLiveFee)}` : ''}${headroom != null ? ` · ${headroom >= 0 ? '+' : ''}${fmtAud(headroom)} headroom to target` : ''}.`;
      if (liveComps.length <= 2) return ['Go', desc];
      if (liveComps.length <= 5) return ['Watch', desc];
      return ['No-Go', desc];
    }
    if (label === 'demographics'){
      const seifa = gm5?.seifa;
      const income = gm5?.income_affluence?.avg_per_household;
      if (seifa == null && income == null) return ['TBD', 'No demographic data captured.'];
      const seifaOk  = seifa  == null ? null : seifa  >= 5;
      const incomeOk = income == null ? null : income >= 95000;
      const both = (seifaOk == null ? incomeOk : seifaOk) && (incomeOk == null ? true : incomeOk);
      const desc = `${seifa != null ? `SEIFA ${Number(seifa).toFixed(2)}` : ''}${seifa != null && income != null ? ' · ' : ''}${income != null ? `Avg HH income ${fmtAud(Math.round(income))}` : ''}.`;
      return [both ? 'Go' : 'Watch', desc];
    }
    if (label === 'pipeline'){
      if (!pipeline.length && !potentialCounted.length && !estates.length) return ['Go', 'No pipeline supply identified.'];
      const wt = Math.round(pipelineEffectivePlaces);
      const desc = `${pipeline.length} pipeline permit${pipeline.length === 1 ? '' : 's'}${potentialCounted.length ? ` + ${potentialCounted.length} potential` : ''} (${fmtN(wt)} risk-weighted places)${estates.length ? `, ${estates.length} estate${estates.length === 1 ? '' : 's'} adding ~${fmtN(estimatedNewChildren)} children 0–5 (RPM 54-mo build-out)` : ''}.`;
      if (wt <= 60) return ['Go', desc];
      if (wt <= 150) return ['Watch', desc];
      return ['No-Go', desc];
    }
    return ['TBD', ''];
  }
  const [demandRating, demandDesc] = rating('demand');
  const [compRating,   compDesc]   = rating('competition');
  const [demoRating,   demoDesc]   = rating('demographics');
  const [pipeRating,   pipeDesc]   = rating('pipeline');

  // Stress test: every pipeline permit (and counted potential) completes at 100%.
  const stressPlaces = currentPlaces + pipeline.concat(potentialCounted).reduce((a, x) => a + (Number(x.places) || 0), 0);
  const stressTestRatio = (stressPlaces > 0 && currentChildren > 0) ? currentChildren / stressPlaces : null;

  return {
    gm5, gm10, benchVic, benchAus,
    ratioRaw5, ratioRaw10, vicRatio, ausRatio,
    participationFactor, localOverseasPct, melbBaselinePct, caldFactor,
    ratioStep2, ratioStep3, ratioStep4,
    allComps, liveComps, pipeline, potential, potentialCounted,
    pipelineEffectivePlaces, proposedPlaces, newPlacesFromPipeline,
    estates, rpmMonthly, rpmChildren, legacyLots, estimatedNewChildren, newLots,
    currentChildren, currentPlaces, totalPlaces4, totalChildren4,
    effectiveRatio, demandStrength, demandStrengthCls,
    schools, nearby,
    totalLivePlaces, liveFees, avgLiveFee, explorersTargetFee, headroomFee,
    demandRating, demandDesc, compRating, compDesc, demoRating, demoDesc, pipeRating, pipeDesc,
    stressTestRatio,
  };
}

// Convenience: flag class for a rating string
export const ratingCls = r => ({ 'Go': 'go', 'Watch': 'watch', 'No-Go': 'no-go', 'TBD': 'tbd' })[r] || 'tbd';

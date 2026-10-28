// Legacy report renderer — ported VERBATIM from acquisitions-tool.html
// (renderFeasibilityReport, lines 14171–15035, Oct 2026) so the 14-slide deck
// matches what the current tool produces. Only the function signature, the
// toolbar and the data/photo lookups were adapted; slide logic is untouched.
//
//   renderLegacyReport(bundle, ctx) → HTML string
//     bundle: adapter.feasibility(id)
//     ctx.data: { projects, feasibilityCompetitors, feasibilitySchools, explorersCentreData }
//     ctx.window: { _pathBlobs: { [feasId]: { relPath: {} } }, _resolveFeasPhotoUrl(feasId, relPath) → url|'' }
//     ctx.toolbarHtml: optional HTML placed above the deck
//
// Photo links call the globals _onPhotoLinkClick / _openPhotoLightbox, which
// the report page defines.
import { esc } from '../ui/shell.js';
import { computeFeasibilityMetrics as computeMetrics } from '../logic/metrics.js';

export function renderLegacyReport(bundle, ctx){
  const p = bundle.project; let fd = bundle.fd;
  const data = ctx.data;                 // { projects, feasibilityCompetitors, feasibilitySchools, explorersCentreData }
  const window = ctx.window;             // { _pathBlobs: {[p.id]: {relPath: {}}}, _resolveFeasPhotoUrl(feasId, relPath) }
  const computeFeasibilityMetrics = (pp, ff) => computeMetrics({ ...bundle, project: pp, fd: ff });
  if (!fd) fd = { id: p.id };
  const H   = s => esc(s||'');
  const fmtAud = v => (v != null && v !== '') ? '$' + Number(v).toLocaleString('en-AU') : '—';
  const fmtN   = v => (v != null && v !== '') ? Number(v).toLocaleString('en-AU') : '—';
  const fmtPct = v => (v != null && v !== '') ? Number(v).toFixed(1) + '%' : '—';
  const fmtRatio = v => (v != null && v !== '') ? Number(v).toFixed(2) + 'x' : '—';
  const dash   = v => (v != null && v !== '' && v !== 0) ? v : '—';

  /* ── Photo helpers (for cover hero strip + competitor / school thumbnails) ──
     Photos live in window._pathBlobs[p.id][path] as { blob, url }. The user
     asked for photos to be surfaced on the report; we use _resolveFeasPhotoUrl
     for path → URL resolution (defined globally so the same logic is shared
     with the Competitors / Schools sub-tabs). */
  function photoUrlsForRow(row){
    if (!row) return [];
    const paths = [
      ...(Array.isArray(row.photo_paths) ? row.photo_paths : []),
      row.photo_path, row.photo2_path, row.photo3_path,
      row.map_path, row.streetview_path,
    ].filter(Boolean);
    const seen = new Set(); const out = [];
    for (const pth of paths){
      if (seen.has(pth)) continue; seen.add(pth);
      const u = (typeof window._resolveFeasPhotoUrl === 'function')
        ? window._resolveFeasPhotoUrl(p.id, pth) : '';
      if (u) out.push({ path: pth, url: u });
    }
    return out;
  }
  function firstPhotoUrl(row){
    const list = photoUrlsForRow(row);
    return list.length ? list[0].url : '';
  }
  /* Cover hero strip — tells the "this is the site" story up front.
     Order of precedence, filling the 6 thumbnail slots from left to right:
       1. Site Context (Nearmaps Street View → Street → Suburb → Regional)
       2. GapMaps Layers (Suburb Ratio → SA2 Ratio → LGA Ratio → Income → Overseas %)
       3. Competitor / school photos (legacy fallback for feasibilities
          uploaded before the Site Context + GapMaps layers were captured).
     If Site Context fills all 6 slots, GapMaps and the fallback never get
     consulted. If Site Context returns 2 photos, the next 4 slots top up
     from GapMaps in order. Everything is deduped by URL so a path that
     somehow matched both buckets won't appear twice.
     Note: getNearmapsLayers / getGapMapsLayers are defined further down
     in this same closure — works because both are function declarations
     (hoisted). */
  function coverHeroPhotos(maxCount){
    const cap = maxCount || 6;
    const seen = new Set();
    const out = [];
    const push = entry => {
      if (!entry || !entry.url || seen.has(entry.url)) return;
      if (out.length >= cap) return;
      seen.add(entry.url);
      out.push(entry);
    };

    // 1. Site Context shots — the site itself
    getNearmapsLayers().forEach(push);

    // 2. GapMaps layer screenshots — geographic / demographic context
    if (out.length < cap) getGapMapsLayers().forEach(push);

    // 3. Last-resort fallback — competitor / school photos for legacy
    //    feasibilities that pre-date Site Context + GapMaps Layers.
    if (out.length < cap){
      const competitors = (data.feasibilityCompetitors||[]).filter(c => c.feasibility_id === p.id);
      const schoolsAll  = (data.feasibilitySchools||[]).filter(s => s.feasibility_id === p.id);
      competitors.forEach(c => {
        const list = photoUrlsForRow(c);
        list.filter(x => /ext|exterior|street/i.test(x.path||'')).forEach(push);
      });
      competitors.forEach(c => photoUrlsForRow(c).forEach(push));
      schoolsAll.forEach(s => photoUrlsForRow(s).forEach(push));
    }

    return out;
  }

  /* Layer screenshot detection — the legacy research tool exports geographic
     context shots under `nearmaps/` (Street level / Suburb / Regional / Street
     View) and demand layers under `gapmaps/` (Suburb / SA2 / LGA ratios, Income,
     Overseas %). After import they live in window._pathBlobs[p.id][path] alongside
     competitor / school photos. We pull them out here so the report can show them
     on dedicated slides. Labels come from filename keyword matching since the
     legacy tool doesn't preserve the original `state.files` key in the ZIP. */
  function _allPathsForFeas(){
    const store = (window._pathBlobs && window._pathBlobs[p.id]) || {};
    return Object.keys(store);
  }
  function _labelFromName(path, buckets, fallback){
    const lower = (path||'').toLowerCase();
    for (const [pattern, label] of buckets){
      if (pattern.test(lower)) return label;
    }
    return fallback;
  }
  // Returns an ordered, labelled list of Nearmaps / Street View layer images.
  // Order: Street View → Street → Suburb / Neighbourhood → Regional → other.
  function getNearmapsLayers(){
    const NEARMAPS_BUCKETS = [
      [/(?:street[_\s-]?view|streetview|^sv[_-]|\bsv[_-]|_sv\b|google[_-]?st)/i, 'Street View'],
      [/regional|broad|wide/i, 'Regional'],
      [/neighbour|neighborhood|suburb|surrounding/i, 'Suburb / Neighbourhood'],
      [/street|aerial|site/i, 'Street level'],
    ];
    const ORDER = ['Street View', 'Street level', 'Suburb / Neighbourhood', 'Regional', 'Other'];
    const list = [];
    _allPathsForFeas().forEach(pth => {
      if (!/^nearmaps\//i.test(pth)) return;
      const ext = (pth.split('.').pop()||'').toLowerCase();
      if (!['png','jpg','jpeg','gif','webp'].includes(ext)) return;
      const url = window._resolveFeasPhotoUrl(p.id, pth);
      if (!url) return;
      const label = _labelFromName(pth, NEARMAPS_BUCKETS, 'Other');
      list.push({ path: pth, url, label });
    });
    list.sort((a,b) => ORDER.indexOf(a.label) - ORDER.indexOf(b.label));
    return list;
  }
  // Returns an ordered, labelled list of GapMaps layer screenshots (NOT CSVs).
  function getGapMapsLayers(){
    const GAPMAPS_BUCKETS = [
      [/sa2/i,        'SA2 Ratio'],
      [/lga/i,        'LGA Ratio'],
      [/suburb|ratio/i, 'Suburb Ratio'],
      [/income/i,     'Income'],
      [/overseas|cald|birth/i, 'Overseas %'],
    ];
    const ORDER = ['Suburb Ratio', 'SA2 Ratio', 'LGA Ratio', 'Income', 'Overseas %', 'Other'];
    const list = [];
    _allPathsForFeas().forEach(pth => {
      if (!/^gapmaps\//i.test(pth)) return;
      const ext = (pth.split('.').pop()||'').toLowerCase();
      if (!['png','jpg','jpeg','gif','webp'].includes(ext)) return; // exclude CSVs
      const url = window._resolveFeasPhotoUrl(p.id, pth);
      if (!url) return;
      const label = _labelFromName(pth, GAPMAPS_BUCKETS, 'Other');
      list.push({ path: pth, url, label });
    });
    list.sort((a,b) => ORDER.indexOf(a.label) - ORDER.indexOf(b.label));
    return list;
  }

  // ── Derived metrics ─────────────────────────────────────────────────
  // All analysis maths now lives in computeFeasibilityMetrics() so this
  // report and the exported analysis brief cannot drift apart. The
  // identifiers below are exactly the ones that used to be declared inline
  // here, so every slide body further down is unchanged.
  //
  // Deliberately NOT destructured: `headroomFee` and `stressTestRatio`.
  // Both are declared in nested block scopes further down (slides 8 and 9)
  // and are left there so those blocks keep owning them. The brief reads
  // them off the metrics object instead.
  const {
    gm5, gm10, benchVic, benchAus,
    ratioRaw5, ratioRaw10, vicRatio, ausRatio,
    participationFactor, localOverseasPct, melbBaselinePct, caldFactor,
    ratioStep2, ratioStep3, ratioStep4,
    allComps, liveComps, pipeline,
    pipelineEffectivePlaces, proposedPlaces, newPlacesFromPipeline,
    estates, rpmMonthly, rpmChildren, legacyLots, estimatedNewChildren, newLots,
    currentChildren, currentPlaces, totalPlaces4, totalChildren4,
    effectiveRatio, demandStrength, demandStrengthCls,
    schools, nearby,
    totalLivePlaces, liveFees, avgLiveFee, explorersTargetFee,
    demandRating, demandDesc, compRating, compDesc,
    demoRating, demoDesc, pipeRating, pipeDesc,
  } = computeFeasibilityMetrics(p, fd);

  // Presentational only — styling, not analysis, so it stays in the report.
  const ratioCls = (r) => r == null ? 'muted' : r >= 2 ? 'green' : r >= 1.5 ? 'amber' : 'terra';

  const today = new Date().toLocaleDateString('en-AU', { day:'numeric', month:'long', year:'numeric' });
  const totalSlides = 14;

  // Stable slide keys used by the Customise sub-tab + report_config
  // post-processor. The slide() helper derives the key from the title
  // so we don't have to touch every call site.
  const SLIDE_KEY_BY_TITLE = {
    'Executive Summary':                  'exec_summary',
    'Site Details':                       'site_details',
    'Site Context':                       'site_context',
    'Demand — The Numbers':               'demand_numbers',
    'Demand Adjustment Walkthrough':      'demand_adjustment',
    'GapMaps Layers':                     'gapmaps_layers',
    'Competitive Landscape':              'competitive_landscape',
    'Pipeline — Supply Risk':             'pipeline_supply_risk',
    'Nearby Explorers Centres':           'nearby_explorers',
    'Demographics — Demand Suppression':  'demographics',
    'Population & Growth':                'population_growth',
    'Nearby Anchors':                     'nearby_anchors',
    'Action Plan & Recommendation':       'action_plan',
  };
  const slide = (idx, title, rightText, bodyHtml) => {
    const slideKey = SLIDE_KEY_BY_TITLE[title] || '';
    return `
    <div class="rpt-slide" data-slide="${idx}" data-slide-key="${slideKey}">
      <div class="rpt-slide-hdr">
        <span class="rpt-slide-hdr-title">${H(title)}</span>
        <span class="rpt-slide-hdr-right">${rightText ? H(rightText)+' · ' : ''}${idx} / ${totalSlides}</span>
      </div>
      <div class="rpt-slide-progress"><div class="rpt-slide-progress-fill" style="width:${(idx/totalSlides*100).toFixed(0)}%"></div></div>
      <div class="rpt-slide-body">${bodyHtml}</div>
    </div>`;
  };

  const kpi = (lbl, val, sub, colour) => `
    <div class="rpt-kpi ${colour||'muted'}">
      <div class="rpt-kpi-lbl">${H(lbl)}</div>
      <div class="rpt-kpi-val">${val}</div>
      ${sub ? `<div class="rpt-kpi-sub">${H(sub)}</div>` : ''}
    </div>`;

  // ─────────────────────────────────────────────────────────────────────
  // SLIDE 1 — COVER
  // ─────────────────────────────────────────────────────────────────────
  const chips = [fd.site_type, fd.proposed_places ? fd.proposed_places + ' proposed places' : null, fd.site_council].filter(Boolean);
  const heroKpi = effectiveRatio != null
    ? `<div class="rpt-strength-chip ${demandStrengthCls}">${demandStrength} DEMAND</div>
       <div class="rpt-cover-kpi-lbl">Children per Licensed Place (effective)</div>
       <div class="rpt-cover-kpi-val">${fmtRatio(effectiveRatio)}</div>
       <div class="rpt-cover-kpi-sub">Raw ${fmtRatio(ratioRaw5)} · VIC ${fmtRatio(vicRatio)} · AUS ${fmtRatio(ausRatio)}</div>
       <div class="rpt-cover-kpi-extras">
         <div><span>Raw ratio</span><strong>${fmtRatio(ratioRaw5)}</strong></div>
         <div><span>vs VIC</span><strong>${fmtRatio(vicRatio)}</strong></div>
         <div><span>${fmtN(currentPlaces) || '—'}</span><strong>licensed places</strong></div>
       </div>`
    : `<div class="rpt-strength-chip tbd">DATA INCOMPLETE</div>
       <div class="rpt-cover-kpi-lbl">Site Research Pack</div>
       <div class="rpt-cover-kpi-val">—</div>
       <div class="rpt-cover-kpi-sub">Upload GapMaps CSVs to populate demand metrics</div>`;
  const coverPhotos = coverHeroPhotos(6);
  const coverPhotoStrip = coverPhotos.length
    ? `<div class="rpt-cover-photo-strip">${coverPhotos.map(ph =>
        `<a href="${esc(ph.url)}" class="rpt-photo-link" onclick="return _onPhotoLinkClick(event, this)" title="${esc(ph.path)}">
          <div class="rpt-cover-photo" style="background-image:url('${esc(ph.url)}')"></div>
        </a>`
      ).join('')}</div>`
    : '';
  let html = `<div class="rpt-cover ${coverPhotos.length?'with-photos':''}" data-slide="1" data-slide-key="cover">
    <div class="rpt-cover-inner">
      <div class="rpt-cover-left">
        <div class="rpt-cover-eyebrow">Site Feasibility Analysis</div>
        <div class="rpt-cover-name">${H(p.name || fd.site_suburb || 'Site')}</div>
        <div class="rpt-cover-addr">${H(fd.site_address || '')}</div>
        ${chips.length ? `<div class="rpt-cover-chips">${chips.map(c=>`<span class="rpt-cover-chip">${H(c)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="rpt-cover-right">
        ${heroKpi}
        <div style="font-size:10.5px;color:rgba(255,255,255,0.6);margin-top:16px">Prepared ${today}</div>
      </div>
    </div>
    ${coverPhotoStrip}
  </div>`;

  // Scorecard ratings (demand/competition/demographics/pipeline) are
  // computed in computeFeasibilityMetrics and destructured above.

  const ratingChip = r => {
    const cls = r==='Go'?'rpt-score-go':r==='Watch'?'rpt-score-watch':r==='No-Go'?'rpt-score-nogo':'rpt-score-tbd';
    return `<span class="rpt-score-chip ${cls}">${r}</span>`;
  };
  const scoreRow = (label, r, desc) => `
    <div class="rpt-score-row">
      <div class="rpt-score-label">${H(label)}</div>
      <div class="rpt-score-desc">${H(desc)}</div>
      ${ratingChip(r)}
    </div>`;

  // ─────────────────────────────────────────────────────────────────────
  // SLIDE 2 — EXECUTIVE SUMMARY (the bottom line, up front)
  // ─────────────────────────────────────────────────────────────────────
  const recParagraph = (fd.feasibility_inputs && fd.feasibility_inputs.recommendation)
    ? H(fd.feasibility_inputs.recommendation)
    : `${H(p.name||'This site')} sits at an effective demand ratio of ${fmtRatio(effectiveRatio)}${vicRatio?` vs VIC ${fmtRatio(vicRatio)}`:''}. ${liveComps.length ? `${liveComps.length} live competitor${liveComps.length===1?'':'s'}${avgLiveFee?`, average daily fee ${fmtAud(avgLiveFee)}`:''}.` : 'Competitor data not yet captured.'} ${pipeline.length||estates.length ? `Forward supply: ${pipeline.length} pipeline permit${pipeline.length===1?'':'s'}, ${estates.length} estate${estates.length===1?'':'s'}.` : 'No forward supply risks identified.'}`;

  // Demand table — current vs 54-month forecast per catchment, pure
  // arithmetic with the formulas footnoted (analytical audience).
  const c10ldc = (gm10 && gm10.ldc) ? (Number(gm10.ldc.children_05) || 0) : 0;
  const p10ldc = (gm10 && gm10.ldc) ? (Number(gm10.ldc.places) || 0) : 0;
  const fcastDenom5  = currentPlaces + newPlacesFromPipeline;
  const fcastDenom10 = p10ldc + newPlacesFromPipeline;
  const fc5  = (fcastDenom5  > 0 && currentChildren) ? currentChildren / fcastDenom5 : null;
  const fc10 = (fcastDenom10 > 0 && c10ldc) ? c10ldc / fcastDenom10 : null;
  const fc5g = (fcastDenom5  > 0 && (currentChildren || estimatedNewChildren))
    ? (currentChildren + estimatedNewChildren) / fcastDenom5 : null;
  const _dCell = v => {
    if (v == null) return '<td style="text-align:right;color:var(--t3);padding:5px 0">—</td>';
    const col = (vicRatio != null && v >= vicRatio) ? 'var(--green)' : (v < 1.5 ? 'var(--red)' : '#B07B10');
    return `<td style="text-align:right;font-weight:700;color:${col};padding:5px 0">${fmtRatio(v)}</td>`;
  };
  const _fnParts = [
    `Forecast supply = current places${Math.round(pipelineEffectivePlaces) ? ` + ${fmtN(Math.round(pipelineEffectivePlaces))} risk-weighted pipeline` : ''}${proposedPlaces ? ` + ${fmtN(proposedPlaces)} proposed Explorers places` : ''}.`,
    estimatedNewChildren ? `Growth = +${fmtN(estimatedNewChildren)} children 0–5 (RPM lots/mo × % in catchment × 54 mo × 0.42).` : null,
    `VIC benchmark ${fmtRatio(vicRatio)}. 10-min forecast reuses the 5-min pipeline as a supply floor.`,
  ].filter(Boolean).join(' ');
  const demandTable = `
    <table style="border-collapse:collapse;font-size:12.5px;margin:2px 0 7px">
      <thead><tr style="color:var(--t3);font-size:10px;text-transform:uppercase;letter-spacing:.05em">
        <th style="text-align:left;font-weight:600;padding:2px 18px 5px 0;min-width:190px">Ratio (0–5s / place)</th>
        <th style="text-align:right;font-weight:600;padding:2px 0 5px;width:78px">5-min</th>
        <th style="text-align:right;font-weight:600;padding:2px 0 5px;width:78px">10-min</th>
        <th style="text-align:right;font-weight:600;padding:2px 0 5px;width:110px">5-min + growth</th>
      </tr></thead>
      <tbody>
        <tr style="border-top:1px solid var(--border)">
          <td style="padding:5px 18px 5px 0;color:var(--t2)">Current</td>
          ${_dCell(ratioRaw5)}${_dCell(ratioRaw10)}
          <td style="text-align:right;color:var(--t3);padding:5px 0">—</td>
        </tr>
        <tr style="border-top:1px solid var(--border)">
          <td style="padding:5px 18px 5px 0;color:var(--t2)">Forecast <span style="color:var(--t3);font-size:11px">(54 mo, all supply)</span></td>
          ${_dCell(fc5)}${_dCell(fc10)}${_dCell(fc5g)}
        </tr>
      </tbody>
    </table>
    <div style="font-size:10.5px;color:var(--t3);line-height:1.5;max-width:640px">${_fnParts}</div>`;

  // Competition — count, then the top 3 by size with their fees.
  const topComps = liveComps.slice()
    .sort((a,b) => (Number(b.places)||0) - (Number(a.places)||0))
    .slice(0, 3);
  const compHtml = liveComps.length ? `
    <div style="font-size:12.5px;margin-bottom:5px"><strong>${liveComps.length}</strong> competitor${liveComps.length===1?'':'s'} in catchment${avgLiveFee ? ` · avg fee <strong>${fmtAud(avgLiveFee)}</strong>/day` : ''}</div>
    <table style="border-collapse:collapse;font-size:11.5px">
      ${topComps.map(c => `<tr style="border-top:1px solid var(--border)">
        <td style="padding:4px 18px 4px 0;min-width:190px;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${H(c.name)}</td>
        <td style="text-align:right;padding:4px 0;color:var(--t2);width:78px;white-space:nowrap">${c.places ? fmtN(c.places) + ' pl' : '—'}</td>
        <td style="text-align:right;padding:4px 0;font-weight:600;width:88px;white-space:nowrap">${(c.fee != null && c.fee !== '') ? fmtAud(c.fee) + '/day' : 'fee TBC'}</td>
      </tr>`).join('')}
    </table>` : '<span style="color:var(--t3)">No competitor data captured.</span>';

  const scoreRowHtml = (label, r, innerHtml) => `
    <div class="rpt-score-row">
      <div class="rpt-score-label">${H(label)}</div>
      <div class="rpt-score-desc">${innerHtml}</div>
      ${ratingChip(r)}
    </div>`;

  html += slide(2, 'Executive Summary', '',  `
    <div class="rpt-scorecard">
      ${scoreRowHtml('Market Demand', demandRating, demandTable)}
      ${scoreRowHtml('Competition', compRating, compHtml)}
      ${scoreRow('Demographics', demoRating, demoDesc)}
      ${scoreRow('Pipeline Supply', pipeRating, pipeDesc)}
    </div>
    <div class="rpt-exec-rec" style="margin-top:14px">
      <h4>Analyst recommendation</h4>
      <p>${recParagraph}</p>
    </div>
  `);

  // ─────────────────────────────────────────────────────────────────────
  // SLIDE 3 — SITE DETAILS
  // ─────────────────────────────────────────────────────────────────────
  const siteRows = [
    ['Site Address',     H(fd.site_address)],
    ['Council',          H(fd.site_council)],
    ['State',            H(fd.site_state)],
    ['Site Type',        H(fd.site_type)],
    ['Proposed Places',  dash(fd.proposed_places)],
    ['Land Size',        fd.land_size_sqm ? fmtN(fd.land_size_sqm) + ' sqm' : '—'],
    ['Asking Price',     fmtAud(fd.price)],
    ['Agent',            H(fd.agent)],
    ['Proposed Use',     H(fd.proposed_use)],
  ].filter(r => r[1] && r[1] !== '—');
  // Top 3 observations — use what we know from the data, not free-form
  const obs = [
    effectiveRatio != null ? `${demandStrength} demand signal: effective ratio ${fmtRatio(effectiveRatio)} vs VIC ${fmtRatio(vicRatio)}.` : null,
    gm5?.ldc ? `${gm5.ldc.facilities||'—'} LDC centres serve ${fmtN(gm5.ldc.children_05)} children 0–5 in 5-min catchment.` : null,
    estates.length ? `Housing growth pipeline: ${estates.length} estate${estates.length===1?'':'s'} adding ~${fmtN(newLots)} lots.` : null,
    avgLiveFee ? `Local fee avg ${fmtAud(avgLiveFee)} vs Explorers target ${fmtAud(explorersTargetFee)} — ${avgLiveFee < explorersTargetFee ? `${fmtAud(explorersTargetFee-avgLiveFee)} headroom available` : 'priced above target'}.` : null,
  ].filter(Boolean).slice(0, 3);
  const tblRows = siteRows.map(r => `<tr><td class="rpt-dt-lbl">${r[0]}</td><td class="rpt-dt-val">${r[1]}</td></tr>`).join('');
  html += slide(3, 'Site Details', H(fd.site_address || ''), `
    <div class="rpt-site-grid">
      <div class="rpt-site-tbl">
        <table class="rpt-detail-tbl"><tbody>${tblRows || '<tr><td style="color:var(--t3)">No site details captured yet.</td></tr>'}</tbody></table>
      </div>
      <div class="rpt-site-obs">
        <h4>Key observations</h4>
        ${obs.length ? `<ul class="rpt-obs-list">${obs.map(x => `<li>${H(x)}</li>`).join('')}</ul>` : '<p style="color:var(--t3);font-size:12px">More observations once GapMaps and competitor data are loaded.</p>'}
      </div>
    </div>
  `);

  // ─────────────────────────────────────────────────────────────────────
  // SLIDE 4 — SITE CONTEXT (Nearmaps + Street View aerial / street level
  // / suburb / regional screenshots — pulled from imported _pathBlobs)
  // ─────────────────────────────────────────────────────────────────────
  const nearmapsLayers = getNearmapsLayers();
  if (nearmapsLayers.length){
    const tiles = nearmapsLayers.map(l => `
      <figure class="rpt-layer-tile">
        <a href="${esc(l.url)}" class="rpt-photo-link" onclick="return _onPhotoLinkClick(event, this)" title="${esc(l.label)} — ${esc(l.path)}">
          <div class="rpt-layer-img" style="background-image:url('${esc(l.url)}')"></div>
        </a>
        <figcaption>
          <span class="rpt-layer-lbl">${H(l.label)}</span>
          <span class="rpt-layer-path">${H((l.path.split('/').pop()||l.path).slice(0, 36))}</span>
        </figcaption>
      </figure>`).join('');
    const colsCls = nearmapsLayers.length === 1 ? 'cols-1'
                  : nearmapsLayers.length === 2 ? 'cols-2'
                  : nearmapsLayers.length === 3 ? 'cols-3' : 'cols-4';
    html += slide(4, 'Site Context', `Aerial · suburb · regional · street view (${nearmapsLayers.length})`,
      `<p class="rpt-callout-info">Geographic context: aerial framing of the site and its surrounding catchment. Use these to verify zoning, frontage, and proximity to anchor traffic.</p>
       <div class="rpt-layer-grid ${colsCls}">${tiles}</div>`);
  } else {
    html += slide(4, 'Site Context', '',
      `<p style="font-size:13px;color:var(--t2);background:var(--bg);border-radius:6px;padding:12px 14px;margin:0">
        No Nearmaps or Street View screenshots imported for this site. Photos uploaded under <span class="mono">nearmaps/*.png</span> in a feasibility ZIP will appear here automatically.
      </p>`);
  }

  // ─────────────────────────────────────────────────────────────────────
  // SLIDE 5 — DEMAND: THE NUMBERS
  // ─────────────────────────────────────────────────────────────────────
  if (gm5){
    const demandBody = `
      <div class="rpt-kpi-row">
        ${kpi('Children 0–5 (5-min)', fmtN(gm5.ldc?.children_05), 'in catchment', 'blue')}
        ${kpi('Licensed Places (5-min)', fmtN(gm5.ldc?.places), 'LDC capacity', 'blue')}
        ${kpi('Demand Ratio (5-min)', fmtRatio(ratioRaw5), 'children per place', ratioCls(ratioRaw5))}
        ${kpi('LDC Centres (5-min)', fmtN(gm5.ldc?.facilities), 'operating in catchment', 'muted')}
      </div>
      <table class="rpt-tbl" style="margin-top:8px">
        <thead><tr>
          <th>Metric</th><th>5-min</th><th>10-min</th><th>VIC</th><th>AUS</th>
        </tr></thead>
        <tbody>
          <tr><td>Children 0–4</td><td>${fmtN(gm5.ldc?.children_04)}</td><td>${fmtN(gm10?.ldc?.children_04)}</td><td>${fmtN(benchVic?.ldc?.children_04)}</td><td>${fmtN(benchAus?.ldc?.children_04)}</td></tr>
          <tr><td>Children 0–5</td><td>${fmtN(gm5.ldc?.children_05)}</td><td>${fmtN(gm10?.ldc?.children_05)}</td><td>${fmtN(benchVic?.ldc?.children_05)}</td><td>${fmtN(benchAus?.ldc?.children_05)}</td></tr>
          <tr><td>Licensed Places</td><td>${fmtN(gm5.ldc?.places)}</td><td>${fmtN(gm10?.ldc?.places)}</td><td>${fmtN(benchVic?.ldc?.places)}</td><td>${fmtN(benchAus?.ldc?.places)}</td></tr>
          <tr><td>LDC Facilities</td><td>${fmtN(gm5.ldc?.facilities)}</td><td>${fmtN(gm10?.ldc?.facilities)}</td><td>${fmtN(benchVic?.ldc?.facilities)}</td><td>${fmtN(benchAus?.ldc?.facilities)}</td></tr>
          <tr style="background:var(--bg)"><td><strong>Demand ratio</strong></td><td><strong>${fmtRatio(ratioRaw5)}</strong></td><td><strong>${fmtRatio(ratioRaw10)}</strong></td><td>${fmtRatio(vicRatio)}</td><td>${fmtRatio(ausRatio)}</td></tr>
        </tbody>
      </table>
      <div class="rpt-callout">
        Raw ${fmtRatio(ratioRaw5)} → adjusted ${fmtRatio(effectiveRatio)} once participation, CALD, and forward supply are factored in. ${vicRatio != null && effectiveRatio != null ? (effectiveRatio > vicRatio ? `Above VIC benchmark ${fmtRatio(vicRatio)}.` : `Below VIC benchmark ${fmtRatio(vicRatio)}.`) : ''}
      </div>`;
    html += slide(5, 'Demand — The Numbers', 'Source: GapMaps catchment report', demandBody);
  } else {
    html += slide(5, 'Demand — The Numbers', '', `<p style="font-size:13px;color:var(--t2);background:var(--bg);border-radius:6px;padding:12px 14px;margin:0">Upload the 5-min and 10-min GapMaps catchment CSVs in the Demand tab to populate this section.</p>`);
  }

  // ─────────────────────────────────────────────────────────────────────
  // SLIDE 5 — DEMAND ADJUSTMENT WALKTHROUGH (4 steps, no redundant 6th)
  // ─────────────────────────────────────────────────────────────────────
  if (gm5){
    const stepCard = (n, label, val, sub, cls) => `
      <div class="rpt-step ${cls||''}">
        <div class="rpt-step-n">Step ${n}</div>
        <div class="rpt-step-lbl">${H(label)}</div>
        <div class="rpt-step-val">${val}</div>
        ${sub ? `<div class="rpt-step-sub">${H(sub)}</div>` : ''}
      </div>`;
    const adjBody = `
      <p class="rpt-callout-info">A raw place-to-child ratio overstates demand. This walkthrough applies three evidence-based adjustments — workforce participation, CALD suppression, and forward supply (pipeline + housing growth) — to produce a forward effective demand estimate. The proposed Explorers centre is included in Step 4.</p>
      <div class="rpt-step-row">
        ${stepCard(1, 'Raw ratio', fmtRatio(ratioRaw5), `${fmtN(currentChildren)} children 0–5 ÷ ${fmtN(currentPlaces)} places`)}
        ${stepCard(2, 'Participation', fmtRatio(ratioStep2), `Factor ${participationFactor.toFixed(3)} (Greater Melb baseline)`)}
        ${stepCard(3, 'CALD adjustment', fmtRatio(ratioStep3), `Factor ${caldFactor.toFixed(3)}${localOverseasPct!=null?` · ${fmtPct(localOverseasPct)} overseas-born`:''}`)}
        ${stepCard(4, 'After forward supply', fmtRatio(ratioStep4 || ratioStep3), `+${fmtN(newPlacesFromPipeline)} pipeline places · +${fmtN(estimatedNewChildren)} children`, 'rpt-step-final')}
      </div>
      <div class="rpt-callout" style="margin-top:14px">
        <strong>Effective demand: ${fmtRatio(effectiveRatio)}</strong> ${vicRatio != null ? ` (VIC ${fmtRatio(vicRatio)} benchmark)` : ''} — used on the cover and the executive summary.
      </div>
      <p class="rpt-footnote">CALD factor formula: <code>1 - ((local_overseas% - ${melbBaselinePct}%) × 0.005)</code>, capped 0.7–1.0. Participation factor defaults to 1.0 until per-LGA workforce data is captured.</p>
    `;
    html += slide(6, 'Demand Adjustment Walkthrough', '', adjBody);
  } else {
    html += slide(6, 'Demand Adjustment Walkthrough', '', `<p style="font-size:13px;color:var(--t2);background:var(--bg);border-radius:6px;padding:12px 14px;margin:0">Adjustment chain renders once GapMaps CSVs are uploaded — see the Demand sub-tab.</p>`);
  }

  // ─────────────────────────────────────────────────────────────────────
  // SLIDE 7 — GAPMAPS LAYERS (Suburb / SA2 / LGA ratio, Income, Overseas %
  // — pulled from imported _pathBlobs paths under `gapmaps/`)
  // ─────────────────────────────────────────────────────────────────────
  const gmLayers = getGapMapsLayers();
  if (gmLayers.length){
    const tiles = gmLayers.map(l => `
      <figure class="rpt-layer-tile">
        <a href="${esc(l.url)}" class="rpt-photo-link" onclick="return _onPhotoLinkClick(event, this)" title="${esc(l.label)} — ${esc(l.path)}">
          <div class="rpt-layer-img" style="background-image:url('${esc(l.url)}')"></div>
        </a>
        <figcaption>
          <span class="rpt-layer-lbl">${H(l.label)}</span>
          <span class="rpt-layer-path">${H((l.path.split('/').pop()||l.path).slice(0, 36))}</span>
        </figcaption>
      </figure>`).join('');
    const colsCls = gmLayers.length === 1 ? 'cols-1'
                  : gmLayers.length === 2 ? 'cols-2'
                  : gmLayers.length === 3 ? 'cols-3' : 'cols-4';
    html += slide(7, 'GapMaps Layers', `Geographic ratio + demographic context (${gmLayers.length})`,
      `<p class="rpt-callout-info">Visual demand context: places-per-child ratios at Suburb / SA2 / LGA boundaries, plus the income and overseas-born layers used in the CALD adjustment. Hot spots vs the proposed site help locate undersupply.</p>
       <div class="rpt-layer-grid ${colsCls}">${tiles}</div>`);
  } else {
    html += slide(7, 'GapMaps Layers', '',
      `<p style="font-size:13px;color:var(--t2);background:var(--bg);border-radius:6px;padding:12px 14px;margin:0">
        No GapMaps layer screenshots imported. Layer images uploaded under <span class="mono">gapmaps/*.png</span> in a feasibility ZIP — typically Suburb Ratio, SA2 Ratio, LGA, Income, Overseas % — will appear here automatically.
      </p>`);
  }

  // ─────────────────────────────────────────────────────────────────────
  // SLIDE 8 — COMPETITIVE LANDSCAPE (5-min + 10-min combined)
  // ─────────────────────────────────────────────────────────────────────
  if (liveComps.length){
    const headroomFee = avgLiveFee ? (explorersTargetFee - avgLiveFee) : null;
    const compCards = liveComps.slice(0, 6).map(c => {
      const photoUrl = firstPhotoUrl(c);
      const photoHtml = photoUrl
        ? `<a href="${esc(photoUrl)}" class="rpt-photo-link" onclick="return _onPhotoLinkClick(event, this)" title="${esc(c.name||'Competitor')}">
            <div class="rpt-comp-card-photo" style="background-image:url('${esc(photoUrl)}')"></div>
          </a>`
        : '';
      return `
      <div class="rpt-comp-card ${photoUrl?'has-photo':''}">
        ${photoHtml}
        <div class="rpt-comp-card-body">
          <div class="rpt-comp-card-hdr">
            <div>
              <div class="rpt-comp-card-name">${H(c.name||'Unnamed')}</div>
              <div class="rpt-comp-card-addr">${H(c.address||'')}</div>
            </div>
            ${c.nqs_rating ? `<span class="nqs-badge">${H(c.nqs_rating)}</span>` : ''}
          </div>
          <div class="rpt-comp-card-stats">
            <div><div class="rpt-comp-stat-lbl">Places</div><div class="rpt-comp-stat-val">${dash(c.places)}</div></div>
            <div><div class="rpt-comp-stat-lbl">Daily Fee</div><div class="rpt-comp-stat-val">${c.fee ? '$'+c.fee : '—'}</div></div>
            <div><div class="rpt-comp-stat-lbl">Operator</div><div class="rpt-comp-stat-val">${H(c.operator||'—')}</div></div>
          </div>
          ${c.ms_waitlist != null && c.ms_waitlist !== '' ? `<div class="rpt-comp-card-notes">Waitlist ${c.ms_waitlist}${c.ms_fee_quoted?` · MS fee $${c.ms_fee_quoted}`:''}${c.ms_notes?` · ${H(String(c.ms_notes).slice(0,80))}`:''}</div>` : ''}
        </div>
      </div>`;
    }).join('');
    const compBody = `
      <div class="rpt-kpi-row">
        ${kpi('Live Centres', liveComps.length, '5-min catchment', 'blue')}
        ${kpi('Total Places', fmtN(totalLivePlaces), 'licensed capacity', 'blue')}
        ${kpi('Avg Daily Fee', avgLiveFee ? fmtAud(avgLiveFee) : '—', 'across competitors', avgLiveFee ? 'green' : 'muted')}
        ${kpi('Fee Headroom', headroomFee != null ? (headroomFee >= 0 ? '+'+fmtAud(headroomFee) : fmtAud(headroomFee)) : '—', `vs ${fmtAud(explorersTargetFee)} target`, headroomFee != null && headroomFee >= 10 ? 'green' : 'amber')}
      </div>
      <div class="rpt-comp-grid" style="margin-top:14px">${compCards}</div>
      ${liveComps.length > 6 ? `<p style="color:var(--t3);font-size:12px;margin-top:6px">+${liveComps.length-6} further centre${liveComps.length-6===1?'':'s'} not shown</p>` : ''}
    `;
    html += slide(8, 'Competitive Landscape', `${liveComps.length} centre${liveComps.length===1?'':'s'} · 5-min`, compBody);
  } else {
    html += slide(8, 'Competitive Landscape', '', `<p style="font-size:13px;color:var(--t2);background:var(--bg);border-radius:6px;padding:12px 14px;margin:0">No competitors captured yet. Add live competitors via the Competitors sub-tab.</p>`);
  }

  // ─────────────────────────────────────────────────────────────────────
  // SLIDE 7 — PIPELINE & SUPPLY RISK
  // ─────────────────────────────────────────────────────────────────────
  if (pipeline.length){
    const totalApprovedPlaces = pipeline.reduce((a,x)=>a+(Number(x.places)||0),0);
    const stressTestRatio = (currentChildren > 0 && (currentPlaces + totalApprovedPlaces) > 0)
      ? (currentChildren / (currentPlaces + totalApprovedPlaces)) : null;
    const pipeCards = pipeline.map(c => {
      const risk = Number(c.risk_pct)||0;
      const riskCls = risk >= 70 ? 'red' : risk >= 40 ? 'amb' : 'grn';
      const photoUrl = firstPhotoUrl(c);
      const photoHtml = photoUrl
        ? `<a href="${esc(photoUrl)}" class="rpt-photo-link" onclick="return _onPhotoLinkClick(event, this)" title="${esc(c.name||c.project_desc||'Pipeline')}">
            <div class="rpt-pipe-card-photo" style="background-image:url('${esc(photoUrl)}')"></div>
          </a>`
        : '';
      return `<div class="rpt-pipe-card ${photoUrl?'has-photo':''}">
        ${photoHtml}
        <div class="rpt-pipe-card-body">
          <div class="rpt-pipe-name">${H(c.name||c.project_desc||'Unnamed')}</div>
          <div class="rpt-pipe-addr">${H(c.address||'')}</div>
          <div class="rpt-pipe-chips">
            ${c.places ? `<span class="rpt-chip">${c.places} places</span>` : ''}
            ${c.stage ? `<span class="rpt-chip">${H(c.stage)}</span>` : ''}
            ${c.operator ? `<span class="rpt-chip">${H(c.operator)}</span>` : ''}
            ${c.risk_pct ? `<span class="rpt-chip ${riskCls}">${c.risk_pct}% risk</span>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
    const pipeBody = `
      <div class="rpt-kpi-row">
        ${kpi('Pipeline Permits', pipeline.length, '', 'blue')}
        ${kpi('Total Approved Places', fmtN(totalApprovedPlaces), 'if all complete', 'blue')}
        ${kpi('Risk-Weighted Places', fmtN(Math.round(pipelineEffectivePlaces)), 'expected supply', 'amber')}
        ${kpi('Stress-Test Ratio', fmtRatio(stressTestRatio), '100% pipeline complete', stressTestRatio != null ? ratioCls(stressTestRatio) : 'muted')}
      </div>
      <div class="rpt-pipeline-grid" style="margin-top:14px">${pipeCards}</div>
      ${stressTestRatio != null ? `<div class="rpt-callout" style="margin-top:14px">Even at full pipeline build-out, demand ratio remains <strong>${fmtRatio(stressTestRatio)}</strong>${vicRatio!=null?` (VIC ${fmtRatio(vicRatio)})`:''}.</div>` : ''}
    `;
    html += slide(9, 'Pipeline — Supply Risk', `${pipeline.length} permit${pipeline.length===1?'':'s'}`, pipeBody);
  } else {
    html += slide(9, 'Pipeline — Supply Risk', '', `
      <div class="rpt-kpi-row">
        ${kpi('Pipeline Permits', '0', 'in catchment', 'green')}
        ${kpi('Forward Supply Risk', 'LOW', 'no permits identified', 'green')}
      </div>
      <p style="font-size:13px;color:var(--t2);margin-top:14px">No pipeline childcare permits captured. Verify against GapMaps proposed-permits export and StartingBlocks before locking the report.</p>`);
  }

  // ─────────────────────────────────────────────────────────────────────
  // SLIDE 8 — NEARBY EXPLORERS CENTRES
  // ─────────────────────────────────────────────────────────────────────
  if (nearby.length){
    nearby.sort((a,b) => (Number(a.drive_time_min)||999) - (Number(b.drive_time_min)||999));
    const cards = nearby.slice(0,3).map((n,i) => {
      const proj = (data.projects||[]).find(x => x.id === n.explorers_project_id);
      const ops  = (data.explorersCentreData||[]).find(x => x.id === n.explorers_project_id);
      const cls = i === 0 ? 'closest' : '';
      return `<div class="rpt-explorer-card ${cls}">
        <div class="rpt-explorer-hdr">${i===0?'CLOSEST · ':''}${H((proj && proj.name) || 'Explorers Centre')}</div>
        <div class="rpt-explorer-rows">
          <div><span>Address</span><span>${H((proj && proj.location) || (proj && proj.address) || '—')}</span></div>
          <div><span>Places</span><span>${dash(proj && proj.places)}</span></div>
          <div><span>Fee</span><span>${ops && ops.current_fee ? '$'+ops.current_fee+'/day' : '—'}</span></div>
          <div><span>Occupancy</span><span>${ops && ops.current_occupancy_pct != null ? ops.current_occupancy_pct+'%' : '—'}</span></div>
          <div><span>NQS</span><span>${H((ops && ops.current_nqs_rating) || '—')}</span></div>
        </div>
        <div class="rpt-explorer-drive">${n.drive_time_min ? n.drive_time_min+' min' : '—'}${n.distance_km ? ' · '+n.distance_km+' km' : ''}</div>
      </div>`;
    }).join('');
    html += slide(10, 'Nearby Explorers Centres', `${nearby.length} centre${nearby.length===1?'':'s'}`,
      `<p class="rpt-callout-info">Drive times to Explorers' existing network. High occupancy at the closest centre signals local appetite for our offering.</p>
       <div class="rpt-explorer-grid">${cards}</div>`);
  } else {
    html += slide(10, 'Nearby Explorers Centres', '', `<p style="font-size:13px;color:var(--t2);background:var(--bg);border-radius:6px;padding:12px 14px;margin:0">No nearby Explorers centres linked. Use the Files tab or schema to capture proximity to existing network.</p>`);
  }

  // ─────────────────────────────────────────────────────────────────────
  // SLIDE 9 — DEMOGRAPHICS & DEMAND SUPPRESSION (combined)
  // ─────────────────────────────────────────────────────────────────────
  if (gm5){
    const owner_pct = (Number(gm5.housing?.owned_pct)||0) + (Number(gm5.housing?.mortgage_pct)||0);
    const populationLatest = gm5.population_projection ? gm5.population_projection['2025'] || gm5.population_projection['2024'] : null;
    const aussiePct = gm5.place_of_birth?.find(c => c.country === 'Australia')?.pct;

    // Group place_of_birth into regions for the CALD breakdown table.
    // Only flag local > VIC (directional) — the original PDFs flagged
    // both directions which produced false positives.
    const REGION_GROUPS = {
      'South & Central Asia': ['India','Pakistan','Bangladesh','Sri Lanka','Nepal','Afghanistan'],
      'South East Asia': ['Vietnam','Philippines','Indonesia','Thailand','Malaysia','Cambodia','Myanmar','Singapore'],
      'North East Asia': ['China excl SARs and Taiwan','Hong Kong SAR of China Persons','Japan','Korea','Taiwan'],
      'UK / Ireland': ['England','Scotland','Wales','Ireland','UK'],
      'Africa & Middle East': ['Egypt','Iraq','Iran','Lebanon','Turkey','South Africa','Zimbabwe','Mauritius'],
    };
    const sumGroup = (rows, names) => {
      const total = (rows||[]).filter(c => names.some(n => c.country === n)).reduce((a,c) => a + (Number(c.pct)||0), 0);
      return total > 0 ? total : null;
    };
    const buildBirthRows = () => Object.entries(REGION_GROUPS).map(([region, names]) => {
      const localPct = sumGroup(gm5.place_of_birth, names);
      const vicPct   = sumGroup(benchVic?.place_of_birth, names);
      const ausPct   = sumGroup(benchAus?.place_of_birth, names);
      // Only flag HIGH if local exceeds VIC; otherwise Low. (Fix from original PDFs.)
      let risk = 'Low';
      if (localPct != null && vicPct != null){
        const diff = localPct - vicPct;
        if (diff > 8) risk = 'HIGH';
        else if (diff > 3) risk = 'Watch';
        else risk = 'Low';
      } else if (localPct == null) risk = '—';
      const riskCls = risk === 'HIGH' ? 'rpt-risk-high' : risk === 'Watch' ? 'rpt-risk-watch' : 'rpt-risk-low';
      return `<tr>
        <td>${H(region)}</td>
        <td>${localPct != null ? fmtPct(localPct) : '—'}</td>
        <td>${vicPct != null ? fmtPct(vicPct) : '—'}</td>
        <td class="${riskCls}">${risk}</td>
      </tr>`;
    }).join('');

    const incomeRows = `
      <tr><td>Avg Income / Capita</td><td>${gm5.income_affluence?.avg_per_capita ? fmtAud(Math.round(gm5.income_affluence.avg_per_capita)) : '—'}</td><td>${benchVic?.income_affluence?.avg_per_capita ? fmtAud(Math.round(benchVic.income_affluence.avg_per_capita)) : '—'}</td></tr>
      <tr><td>Avg Income / HH</td><td>${gm5.income_affluence?.avg_per_household ? fmtAud(Math.round(gm5.income_affluence.avg_per_household)) : '—'}</td><td>${benchVic?.income_affluence?.avg_per_household ? fmtAud(Math.round(benchVic.income_affluence.avg_per_household)) : '—'}</td></tr>
      <tr><td>Owner-occupied %</td><td>${owner_pct ? fmtPct(owner_pct) : '—'}</td><td>${benchVic?.housing ? fmtPct((benchVic.housing.owned_pct||0)+(benchVic.housing.mortgage_pct||0)) : '—'}</td></tr>
      <tr><td>Renting %</td><td>${gm5.housing?.renting_pct ? fmtPct(gm5.housing.renting_pct) : '—'}</td><td>${benchVic?.housing?.renting_pct ? fmtPct(benchVic.housing.renting_pct) : '—'}</td></tr>
      <tr><td>Avg Monthly Mortgage</td><td>${gm5.housing?.avg_monthly_mortgage ? fmtAud(Math.round(gm5.housing.avg_monthly_mortgage)) : '—'}</td><td>${benchVic?.housing?.avg_monthly_mortgage ? fmtAud(Math.round(benchVic.housing.avg_monthly_mortgage)) : '—'}</td></tr>
      <tr><td>Avg Weekly Rent</td><td>${gm5.housing?.avg_weekly_rent ? fmtAud(Math.round(gm5.housing.avg_weekly_rent)) : '—'}</td><td>${benchVic?.housing?.avg_weekly_rent ? fmtAud(Math.round(benchVic.housing.avg_weekly_rent)) : '—'}</td></tr>`;

    const demoBody = `
      <div class="rpt-kpi-row">
        ${kpi('Population (5-min)', fmtN(populationLatest), 'latest year captured', 'blue')}
        ${kpi('Avg Household Income', gm5.income_affluence?.avg_per_household ? fmtAud(Math.round(gm5.income_affluence.avg_per_household)) : '—', 'p.a., 5-min', gm5.income_affluence?.avg_per_household > 100000 ? 'green' : 'muted')}
        ${kpi('SEIFA Score', gm5.seifa != null ? Number(gm5.seifa).toFixed(2) : '—', '5-min catchment', gm5.seifa >= 5 ? 'green' : 'amber')}
        ${kpi('Australian-born', aussiePct != null ? fmtPct(aussiePct) : '—', 'born in Australia', 'amber')}
      </div>
      <div class="rpt-demo-grid">
        <div>
          <h4>Demand suppression — birthplace breakdown</h4>
          <table class="rpt-tbl">
            <thead><tr><th>Region</th><th>5-min</th><th>VIC</th><th>Risk vs VIC</th></tr></thead>
            <tbody>${buildBirthRows()}</tbody>
          </table>
          <p class="rpt-footnote" style="margin-top:6px">Only flagged when local exceeds VIC by &gt;3pp. CALD adjustment applied in Slide 5.</p>
        </div>
        <div>
          <h4>Income & housing profile</h4>
          <table class="rpt-tbl">
            <thead><tr><th>Metric</th><th>5-min</th><th>VIC</th></tr></thead>
            <tbody>${incomeRows}</tbody>
          </table>
        </div>
      </div>`;
    html += slide(11, 'Demographics — Demand Suppression', 'Source: GapMaps / ABS 2021', demoBody);
  } else {
    html += slide(11, 'Demographics — Demand Suppression', '', `<p style="font-size:13px;color:var(--t2);background:var(--bg);border-radius:6px;padding:12px 14px;margin:0">Upload GapMaps CSV to populate demographic profile.</p>`);
  }

  // ─────────────────────────────────────────────────────────────────────
  // SLIDE 10 — POPULATION & GROWTH
  // ─────────────────────────────────────────────────────────────────────
  if (gm5 && gm5.population_projection){
    const pp = gm5.population_projection;
    const years = Object.keys(pp).sort();
    const popLatest = pp[years[years.length-1]];
    const popEarliest = pp[years[0]];
    const histGrowth = (popEarliest && popLatest && years.length > 1)
      ? (((popLatest / popEarliest) ** (1 / (years.length - 1)) - 1) * 100).toFixed(2)
      : null;
    // Forward trend: are projection years going up?
    const projYears = years.filter(y => Number(y) >= 2025);
    const projTrend = projYears.length >= 2
      ? (pp[projYears[projYears.length-1]] > pp[projYears[0]] ? 'up' : pp[projYears[projYears.length-1]] < pp[projYears[0]] ? 'down' : 'flat')
      : 'flat';
    const projTrendLabel = projTrend === 'up' ? 'Growing' : projTrend === 'down' ? 'Declining' : 'Flat';
    const projTrendCls = projTrend === 'up' ? 'green' : projTrend === 'down' ? 'amber' : 'muted';

    // Build SVG line chart (no library dependency — prints clean)
    const chartW = 760, chartH = 220, padL = 50, padR = 20, padT = 20, padB = 30;
    const xVals = years.map(Number);
    const yVals = years.map(y => Number(pp[y]));
    const yMin = Math.min(...yVals) * 0.95;
    const yMax = Math.max(...yVals) * 1.05;
    const xRange = Math.max(...xVals) - Math.min(...xVals) || 1;
    const yRange = yMax - yMin || 1;
    const sx = x => padL + ((x - Math.min(...xVals)) / xRange) * (chartW - padL - padR);
    const sy = y => padT + (chartH - padT - padB) * (1 - (y - yMin) / yRange);
    const pathD = years.map((y,i) => `${i===0?'M':'L'} ${sx(Number(y)).toFixed(1)} ${sy(yVals[i]).toFixed(1)}`).join(' ');
    const dots = years.map((y,i) => `<circle cx="${sx(Number(y)).toFixed(1)}" cy="${sy(yVals[i]).toFixed(1)}" r="3" fill="#00643B"/><text x="${sx(Number(y)).toFixed(1)}" y="${(sy(yVals[i])-8).toFixed(1)}" font-size="10" text-anchor="middle" fill="#3A413B">${fmtN(yVals[i])}</text>`).join('');
    const xTicks = years.map(y => `<text x="${sx(Number(y)).toFixed(1)}" y="${chartH-8}" font-size="10" text-anchor="middle" fill="#7A8A7B">${y}</text>`).join('');
    const yTicks = `<text x="${padL-6}" y="${(padT+10).toFixed(1)}" font-size="10" text-anchor="end" fill="#7A8A7B">${fmtN(Math.round(yMax))}</text><text x="${padL-6}" y="${(chartH-padB+5).toFixed(1)}" font-size="10" text-anchor="end" fill="#7A8A7B">${fmtN(Math.round(yMin))}</text>`;
    const chartSvg = `<svg viewBox="0 0 ${chartW} ${chartH}" style="width:100%;height:auto;display:block">
      <path d="${pathD}" fill="none" stroke="#00643B" stroke-width="2"/>
      ${dots}
      <line x1="${padL}" y1="${chartH-padB}" x2="${chartW-padR}" y2="${chartH-padB}" stroke="#D6D8D2" stroke-width="1"/>
      ${xTicks}
      ${yTicks}
    </svg>`;

    const trendBody = `
      <h4 style="margin:0 0 10px">0–5 yr cohort projection — 5-min catchment</h4>
      <div class="rpt-chart-wrap">${chartSvg}</div>
      <div class="rpt-trend-row">
        <div class="rpt-trend-tag ${projTrendCls}">
          <strong>${projTrendLabel}</strong> · forward trend ${projYears.length >= 2 ? `${pp[projYears[0]]} → ${pp[projYears[projYears.length-1]]}` : ''}
        </div>
        ${histGrowth ? `<div class="rpt-trend-tag muted"><strong>Historical CAGR</strong> · ${histGrowth}%/yr ${years[0]}–${years[years.length-1]}</div>` : ''}
        ${estates.length ? `<div class="rpt-trend-tag amber"><strong>Housing pipeline</strong> · ${estates.length} estate${estates.length===1?'':'s'} · +${fmtN(newLots)} lots · est. +${fmtN(estimatedNewChildren)} children</div>` : ''}
      </div>`;
    html += slide(12, 'Population & Growth', '5-min catchment', trendBody);
  } else {
    html += slide(12, 'Population & Growth', '', `<p style="font-size:13px;color:var(--t2);background:var(--bg);border-radius:6px;padding:12px 14px;margin:0">Population projections require a GapMaps CSV upload.</p>`);
  }

  // ─────────────────────────────────────────────────────────────────────
  // SLIDE 11 — NEARBY ANCHORS (schools + retail)
  // ─────────────────────────────────────────────────────────────────────
  const sortedSchools = schools.sort((a,b)=>(Number(a.distance_km)||999)-(Number(b.distance_km)||999));
  if (sortedSchools.length){
    const rows = sortedSchools.map(sc => {
      const d = Number(sc.distance_km);
      const distCls = (!isFinite(d) || d > 2) ? 'rpt-dist-far' : (d <= 1 ? 'rpt-dist-near' : 'rpt-dist-med');
      const photoUrl = firstPhotoUrl(sc);
      const thumbCell = photoUrl
        ? `<td class="rpt-school-photo-cell"><a href="${esc(photoUrl)}" class="rpt-photo-link" onclick="return _onPhotoLinkClick(event, this)" title="${esc(sc.name||'School')}"><div class="rpt-school-photo" style="background-image:url('${esc(photoUrl)}')"></div></a></td>`
        : `<td class="rpt-school-photo-cell"><div class="rpt-school-photo placeholder">—</div></td>`;
      return `<tr>
        ${thumbCell}
        <td>${H(sc.name||'')}</td>
        <td>${H(sc.sector||'')}${sc.type ? ' · '+H(sc.type) : ''}</td>
        <td>${sc.enrolments ? fmtN(sc.enrolments) : '—'}</td>
        <td class="${distCls}">${sc.distance_km ? sc.distance_km + ' km' : '—'}</td>
      </tr>`;
    }).join('');
    html += slide(13, 'Nearby Anchors', `${sortedSchools.length} school${sortedSchools.length===1?'':'s'}`, `
      <p class="rpt-callout-info">Schools and retail anchors generate daily commuter traffic past the site — strategic for catchment exposure.</p>
      <div class="rpt-anchors-grid">
        <div>
          <h4>Schools</h4>
          <table class="rpt-tbl rpt-tbl-schools">
            <thead><tr><th style="width:64px">Photo</th><th>School</th><th>Sector / Type</th><th>Enrolments</th><th>Distance</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div>
          <h4>Retail centres</h4>
          <p style="font-size:12.5px;color:var(--t3);background:var(--bg);border-radius:6px;padding:10px 14px">Retail centre data not yet captured in the schema. Future enhancement.</p>
        </div>
      </div>
    `);
  } else {
    html += slide(13, 'Nearby Anchors', '', `<p style="font-size:13px;color:var(--t2);background:var(--bg);border-radius:6px;padding:12px 14px;margin:0">No nearby schools captured. Add via the Schools sub-tab.</p>`);
  }

  // ─────────────────────────────────────────────────────────────────────
  // SLIDE 12 — ACTION PLAN
  // ─────────────────────────────────────────────────────────────────────
  const fullRec = (fd.feasibility_inputs && fd.feasibility_inputs.recommendation)
    ? `<p>${H(fd.feasibility_inputs.recommendation)}</p>`
    : `<p>${recParagraph}</p>`;
  const allNextSteps = [
    !gm5 ? 'Upload 5-min and 10-min GapMaps catchment CSVs.' : null,
    !liveComps.length ? 'Identify and capture operational competitor centres in 5-min catchment.' : null,
    !nearby.length ? 'Link nearby Explorers centres for occupancy benchmarking.' : null,
    !schools.length ? 'Add nearby schools (primary anchors for daily traffic).' : null,
    !estates.length ? 'Capture housing growth pipeline (estate developments in LGA).' : null,
    'Commission town planning report — confirm CC zoning.',
    `Engage ${fd.site_council || 'council'} for pre-application planning meeting.`,
    'Verify competitor details via StartingBlocks and mystery shop.',
    `Commission financial model at ${fd.proposed_places || 'proposed'} places / ${fmtAud(explorersTargetFee)} target fee.`,
    estates.length ? 'Confirm estate lot release timing with developers.' : null,
    fd.status === 'go' ? 'Present to Explorers Board for final approval.' : 'Take recommendation to Explorers Board.',
  ].filter(Boolean);
  const dealNotes = (fd.feasibility_inputs && fd.feasibility_inputs.deal_notes)
    ? `<div class="rpt-deal-notes"><h4>Deal notes</h4><p>${H(fd.feasibility_inputs.deal_notes)}</p></div>` : '';

  html += slide(14, 'Action Plan & Recommendation', today, `
    <div class="rpt-action-grid">
      <div class="rpt-action-rec">
        <h4>Analyst recommendation</h4>
        ${fullRec}
        ${dealNotes}
      </div>
      <div class="rpt-action-next">
        <h4>Next steps</h4>
        <ol class="rpt-action-list">${allNextSteps.map(s => `<li>${H(s)}</li>`).join('')}</ol>
      </div>
    </div>
  `);

  // Apply per-feasibility customisations from feasibility_data.report_config:
  // hide selected slides, swap in alternate variant body HTML, insert custom
  // slides. Returns the rewritten HTML string with slide counters renumbered.
  html = _applyReportConfig(html, fd && fd.report_config);
  const finalSlideCount = (html.match(/<div class="rpt-(cover|slide)/g) || []).length;

  // ─────────────────────────────────────────────────────────────────────
  // Toolbar with print + PDF download
  // ─────────────────────────────────────────────────────────────────────
  return `
    ${ctx.toolbarHtml || ''}
    <div class="rpt-doc" id="rpt-doc">${html}</div>
  `;
}


// Applies feasibility_data.report_config (hidden_slides / slide_variants / custom_slides) — verbatim.
export function _applyReportConfig(html, config){
  if (!config || typeof config !== 'object') return html;
  const hidden = Array.isArray(config.hidden_slides) ? config.hidden_slides : [];
  const variants = (config.slide_variants && typeof config.slide_variants === 'object') ? config.slide_variants : {};
  const customs = Array.isArray(config.custom_slides) ? config.custom_slides : [];

  if (!hidden.length && !Object.keys(variants).length && !customs.length) return html;

  // Parse into a DOM-ish container so we can manipulate cleanly. Using a
  // detached <template> means injected HTML isn't executed.
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const root = tpl.content;

  // 1. Apply hides + variant swaps in one pass
  const slides = Array.from(root.querySelectorAll('.rpt-cover, .rpt-slide'));
  slides.forEach(el => {
    const key = el.getAttribute('data-slide-key') || '';
    if (!key) return;
    if (hidden.includes(key)){
      el.remove();
      return;
    }
    const vSet = variants[key];
    if (vSet && vSet.active_id && Array.isArray(vSet.variants)){
      const active = vSet.variants.find(v => v && v.id === vSet.active_id);
      if (active && active.body_html){
        // Replace the .rpt-slide-body / .rpt-cover-inner inner content
        const body = el.querySelector('.rpt-slide-body, .rpt-cover-inner');
        if (body){
          body.innerHTML = active.body_html;
        } else {
          // Fallback: replace the whole inside
          el.innerHTML = active.body_html;
        }
      }
    }
  });

  // 2. Insert custom slides at their positions
  // Sort by position ascending so multiple inserts compose predictably.
  // Custom slides with `hidden: true` are dropped from the final report —
  // same semantics as the standard-slide "Hide this slide" checkbox, but
  // stored per-custom-slide rather than in the hidden_slides array.
  const sortedCustoms = [...customs]
    .filter(c => c && typeof c.position === 'number' && c.body_html && !c.hidden)
    .sort((a,b) => a.position - b.position);
  sortedCustoms.forEach(cs => {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="rpt-slide" data-slide-key="${(cs.id || 'custom').replace(/"/g,'')}" data-custom="1">
        <div class="rpt-slide-hdr">
          <span class="rpt-slide-hdr-title">${(cs.title || 'Custom slide').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m])}</span>
          <span class="rpt-slide-hdr-right">Custom</span>
        </div>
        <div class="rpt-slide-body">${cs.body_html}</div>
      </div>`;
    const newSlide = wrap.firstElementChild;
    const remainingSlides = Array.from(root.querySelectorAll('.rpt-cover, .rpt-slide'));
    const targetIdx = Math.max(0, Math.min(remainingSlides.length, cs.position - 1));
    const targetEl = remainingSlides[targetIdx];
    if (targetEl){
      targetEl.parentNode.insertBefore(newSlide, targetEl);
    } else {
      root.appendChild(newSlide);
    }
  });

  // 3. Renumber the "X / N" counters across the final slide set
  const finalSlides = Array.from(root.querySelectorAll('.rpt-cover, .rpt-slide'));
  const total = finalSlides.length;
  finalSlides.forEach((el, i) => {
    const idx = i + 1;
    el.setAttribute('data-slide', String(idx));
    // Counter chip on the .rpt-slide variant
    const right = el.querySelector('.rpt-slide-hdr-right');
    if (right){
      const txt = right.textContent || '';
      // Pattern: "<optional prefix> · N / M" or "N / M"
      const dotIdx = txt.lastIndexOf(' · ');
      const prefix = dotIdx >= 0 ? txt.slice(0, dotIdx) + ' · ' : '';
      right.textContent = prefix + idx + ' / ' + total;
    }
    // Progress fill on .rpt-slide
    const fill = el.querySelector('.rpt-slide-progress-fill');
    if (fill){
      fill.style.width = ((idx / total) * 100).toFixed(0) + '%';
    }
  });

  // Serialise back to a string for the renderer
  const wrapper = document.createElement('div');
  wrapper.appendChild(root);
  return wrapper.innerHTML;
}

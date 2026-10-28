#!/usr/bin/env node
// Generates data/seed.json — dummy data for local mode.
// Row shapes match the Supabase tables (sql/03 + later migrations + sql/25).
// Run: node data/make-seed.js
const fs = require('fs');
const path = require('path');

const VIC = '00000000-0000-0000-0000-0000000000bc';
const AUS = '00000000-0000-0000-0000-0000000000ba';
const daysAgo = n => new Date(Date.now() - n * 86400000).toISOString();
let seq = 0;
const id = (p) => `${p}-${String(++seq).padStart(4, '0')}-0000-0000-000000000000`.replace(/^(\w+)-/, (m, a) => a.padEnd(8, '0').slice(0, 8) + '-');

const projects = [], feasibility_data = [], competitors = [], schools = [], estates = [], nearby = [], comments = [];

function gm(children05, places, overseasPct, seifa, income, proj, neAsia){
  const years = {}; proj.forEach((v, i) => years[String(2026 + i)] = v);
  return {
    ldc: { children_05: children05, places },
    seifa, income_affluence: { avg_per_household: income },
    place_of_birth: [
      { country: 'Australia', pct: 100 - overseasPct },
      { country: 'North East Asia', pct: neAsia, flag: neAsia > 3.64 ? 'Watch' : 'Low' },
      { country: 'Southern Asia', pct: Math.round(overseasPct * 0.3 * 10) / 10 },
    ],
    // trend_tag reproduces the old tool's behaviour (tag from the HISTORICAL rate) so pre-flight has something to catch on declining projections
    age_projection_0_5: { ...years, trend_tag: 'Growing', historical_growth_pct: 32.4 },
    population_projection: Object.fromEntries(proj.map((v, i) => [String(2021 + i), Math.round(v * 11 * (1 + i * 0.02))])),
  };
}

function site(o){
  const pid = id('feas');
  projects.push({ id: pid, type: 'feasibility', name: o.name, code: o.code, active: true, created_at: daysAgo(o.age), updated_at: daysAgo(o.updated) });
  feasibility_data.push({
    id: pid, status: o.status, prepared_by: o.owner,
    site_address: o.address, site_suburb: o.suburb, site_council: o.council, site_state: 'VIC', site_type: o.type,
    proposed_places: o.places, land_size_sqm: o.land, price: o.price, agent: o.agent, proposed_use: `Long day care, ${o.places} places`,
    site_other_notes: o.notes || '',
    gapmaps_5min: o.gm5 || null, gapmaps_10min: o.gm10 || null,
    feasibility_inputs: { feaso: { deal_type: o.deal || 'freehold', lease_rent: o.rent || null, target_settlement: o.settle || null, target_fee: 188, op: o.op || null } },
    report_config: {}, sections_complete: {}, photo_paths: o.photos || [],
    last_saved_at: daysAgo(o.updated), created_at: daysAgo(o.age), updated_at: daysAgo(o.updated),
  });
  (o.comps || []).forEach((c, i) => competitors.push({ id: id('comp'), feasibility_id: pid, sort_order: i, status: c.status || 'live', name: c.name, operator: c.operator || null, address: c.address || null,
    places: c.places, distance_km: c.km, fee: c.fee ?? null, nqs_rating: c.nqs || null, ms_current_capacity: c.occ ?? null,
    dev_type: c.dev || null, project_desc: c.source || null, stage: c.stage || null, risk_pct: c.risk ?? (c.status === 'live' ? null : 60),
    confidence: c.conf || null, count_in_chain: c.count !== false, photo_paths: c.photos || [], created_at: daysAgo(o.age), updated_at: daysAgo(o.updated) }));
  (o.schools || []).forEach((s, i) => schools.push({ id: id('schl'), feasibility_id: pid, sort_order: i, name: s.name, type: s.type, sector: s.sector, enrolments: s.enrol, distance_km: s.km, address: s.address || null, photo_paths: s.photos || [], created_at: daysAgo(o.age), updated_at: daysAgo(o.updated) }));
  (o.estates || []).forEach((e, i) => estates.push({ id: id('estt'), feasibility_id: pid, sort_order: i, name: e.name, suburb: e.suburb, lots: e.lots || null, monthly_rate: e.rate, pct_in_catch: e.pct, children_per_lot: 0.42, created_at: daysAgo(o.age), updated_at: daysAgo(o.updated) }));
  (o.nearby || []).forEach((n, i) => nearby.push({ id: id('near'), feasibility_id: pid, explorers_project_id: n.id, name: n.name, distance_km: n.km, places: n.places, occupancy_pct: n.occ, counts: n.counts !== false, created_at: daysAgo(o.age), updated_at: daysAgo(o.updated) }));
  (o.comments || []).forEach((c, i) => comments.push({ id: id('cmnt'), feasibility_id: pid, author: c.by, comment: c.text, section: c.section || null, created_at: daysAgo(c.age), updated_at: daysAgo(c.age) }));
  return pid;
}

// Existing Explorers centres (type 'project' in the real DB)
const craigieburn = id('proj'), kalkallo = id('proj'), tarneitW = id('proj');
projects.push({ id: craigieburn, type: 'project', name: 'Explorers Craigieburn', code: 'EXP-CRB', active: true },
              { id: kalkallo,    type: 'project', name: 'Explorers Kalkallo',    code: 'EXP-KAL', active: true },
              { id: tarneitW,    type: 'project', name: 'Explorers Tarneit West', code: 'EXP-TRW', active: true });

// Benchmarks
projects.push({ id: VIC, type: 'benchmark', name: 'Victoria (Benchmark)', code: 'BENCH-VIC', active: false },
              { id: AUS, type: 'benchmark', name: 'Australia (Benchmark)', code: 'BENCH-AUS', active: false });
feasibility_data.push({ id: VIC, status: null, gapmaps_5min: { ldc: { children_05: 420000, places: 200000 }, seifa: 5.5, income_affluence: { avg_per_household: 102000 }, place_of_birth: [{ country: 'Australia', pct: 65 }, { country: 'North East Asia', pct: 3.64 }, { country: 'Southern Asia', pct: 4.1 }] } });
feasibility_data.push({ id: AUS, status: null, gapmaps_5min: { ldc: { children_05: 1500000, places: 780000 }, seifa: 5.5, income_affluence: { avg_per_household: 98000 }, place_of_birth: [{ country: 'Australia', pct: 67 }, { country: 'North East Asia', pct: 3.1 }, { country: 'Southern Asia', pct: 3.6 }] } });

site({
  name: 'Mickleham — Donnybrook Rd', code: 'ACQ-0412', status: 'conditional_go', owner: 'JK', age: 48, updated: 2,
  address: '1285 Donnybrook Rd, Mickleham VIC 3064', suburb: 'Mickleham', council: 'Hume', type: 'Greenfield estate',
  places: 120, land: 4120, price: 4200000, agent: 'Colliers — A. Ruan', settle: '2027-03-31',
  notes: 'Dual frontage to Donnybrook Rd and estate collector. Agent indicates adjoining Lot 413 may come to market Q1.',
  gm5: gm(2608, 392, 34, 6, 104000, [2608, 2540, 2470, 2390, 2300, 2217], 0.4),
  gm10: gm(6120, 2210, 33, 6, 101000, [6120, 6050, 5980, 5900, 5810, 5700], 0.5),
  op: { year3_ebitda: 1240000 },
  comps: [
    { name: 'Goodstart Mickleham', operator: 'Goodstart', places: 124, km: 0.6, fee: 178, occ: 91, nqs: 'Meeting' },
    { name: 'Nido Early School Merrifield', operator: 'Nido', places: 112, km: 1.1, fee: 192, occ: 84, nqs: 'Exceeding' },
    { name: 'Merrifield Village ELC', operator: 'Independent', places: 86, km: 1.4, fee: 165 },
    { name: 'Lot 412 Annadale Blvd', status: 'pipeline', places: 150, km: 0.9, stage: 'Permit issued', risk: 70, dev: 'Childcare', source: 'Hume planning register' },
    { name: 'Kalkallo Town Centre — Lot 7', status: 'potential', places: 158, km: 2.3, stage: 'DA lodged', conf: 'High', risk: 60, source: 'Hume planning register', count: true },
    { name: 'Donnybrook Rd — corner site, 3,900 m²', status: 'potential', places: 120, km: 1.6, stage: 'For sale (childcare use)', conf: 'Medium', risk: 40, source: 'Colliers listing, 12 Oct', count: false },
    { name: 'Merrifield Stage 4 community hub', status: 'potential', places: null, km: 1.9, stage: 'Rumoured', conf: 'Low', risk: 20, source: 'Developer conversation', count: false },
  ],
  schools: [
    { name: 'Merrifield Primary School', type: 'primary', sector: 'public', enrol: 640, km: 0.8, address: 'Merrifield Bvd, Mickleham' },
    { name: 'Hume Anglican Grammar', type: 'P-12', sector: 'independent', enrol: 1850, km: 2.4, address: 'Mt Ridley Rd, Mickleham' },
  ],
  estates: [{ name: 'Merrifield', suburb: 'Mickleham', rate: 38, pct: 70 }, { name: 'Annadale', suburb: 'Mickleham', rate: 22, pct: 100 }],
  nearby: [{ id: craigieburn, name: 'Explorers Craigieburn', km: 2.8, places: 112, occ: 88 }, { id: kalkallo, name: 'Explorers Kalkallo', km: 4.6, places: 96, occ: 79, counts: false }],
  comments: [{ by: 'JK', text: 'Step 3 CALD factor looks generous for this catchment — revisit once place-of-birth refreshed.', section: 'demand', age: 8 }],
});

site({
  name: 'Wollert — Epping Rd', code: 'ACQ-0409', status: 'reviewing', owner: 'JK', age: 30, updated: 0,
  address: '640 Epping Rd, Wollert VIC 3750', suburb: 'Wollert', council: 'Whittlesea', type: 'Infill',
  places: 96, land: 3300, price: 3600000, agent: 'CBRE — T. Nguyen',
  gm5: gm(1840, 765, 41, 5, 96000, [1840, 1900, 1950, 2010, 2060, 2100], 5.2),
  comps: [
    { name: 'Wollert Early Learning', operator: 'Independent', places: 98, km: 0.4, fee: 170, occ: 76 },
    { name: 'Guardian Childcare Wollert', operator: 'Guardian', places: 120, km: 0.9, fee: 185, occ: 89 },
    { name: 'Little Learners Epping North', operator: 'Independent', places: 75, km: 1.2, fee: 160 },
    { name: 'Aurora Village ELC', operator: 'G8', places: 110, km: 1.5, fee: 182, occ: 81 },
    { name: 'Busy Bees Wollert', operator: 'Busy Bees', places: 112, km: 1.8, fee: 190, occ: 93 },
    { name: 'Harvest Home Rd Kinder', operator: 'Council', places: 66, km: 2.0, fee: 120 },
    { name: 'Epping Rd — Lot 22', status: 'pipeline', places: 140, km: 1.1, stage: 'Permit issued', risk: 80, source: 'Whittlesea permit register' },
  ],
  schools: [{ name: 'Wollert Primary School', type: 'primary', sector: 'public', enrol: 910, km: 0.6 }, { name: 'Edgars Creek Secondary', type: 'secondary', sector: 'public', enrol: 1200, km: 1.9 }],
  estates: [{ name: 'Aurora', suburb: 'Wollert', rate: 14, pct: 60 }],
  nearby: [],
  comments: [{ by: 'SM', text: 'Added 2 competitors from ACECQA refresh.', age: 0 }],
});

site({
  name: 'Cobblebank — Ferris Rd', code: 'ACQ-0415', status: 'reviewing', owner: 'SM', age: 40, updated: 38,
  address: '210 Ferris Rd, Cobblebank VIC 3338', suburb: 'Cobblebank', council: 'Melton', type: 'Greenfield estate',
  places: 132, land: 5100, price: 5100000, agent: 'Savills — M. Lee',
  gm5: null, // GapMaps pending — exercises the "no demand data" paths
  comps: [{ name: 'Cobblebank Village ELC', operator: 'Independent', places: 90, km: 0.7, fee: 168 }, { name: 'Thornhill Park Kids', operator: 'Independent', places: 104, km: 1.9, fee: 172, occ: 70 }],
  schools: [{ name: 'Cobblebank Primary', type: 'primary', sector: 'public', enrol: 560, km: 0.5 }],
  estates: [{ name: 'Thornhill Park', suburb: 'Cobblebank', rate: 30, pct: 80 }, { name: 'Bridge Road Estate', suburb: 'Cobblebank', rate: 18, pct: 50 }],
});

site({
  name: 'Caroline Springs — Caroline Springs Bvd', code: 'ACQ-0398', status: 'go', owner: 'JK', age: 120, updated: 6,
  address: '18 Caroline Springs Bvd, Caroline Springs VIC 3023', suburb: 'Caroline Springs', council: 'Melton', type: 'Town centre',
  places: 120, land: 3800, price: null, deal: 'leasehold', rent: 420000, agent: 'Direct — landlord', settle: '2026-12-15',
  gm5: gm(2310, 784, 44, 6, 108000, [2310, 2330, 2350, 2360, 2380, 2400], 2.1),
  op: { year3_ebitda: 1410000 },
  comps: [
    { name: 'Caroline Springs Early Learning', operator: 'Independent', places: 110, km: 0.3, fee: 175, occ: 94 },
    { name: 'Goodstart Caroline Springs', operator: 'Goodstart', places: 130, km: 0.8, fee: 180, occ: 90 },
    { name: 'Kids Club Burnside', operator: 'Independent', places: 92, km: 1.6, fee: 166, occ: 72 },
    { name: 'Lakeside Community Kinder', operator: 'Council', places: 66, km: 1.0, fee: 115 },
  ],
  schools: [{ name: 'Caroline Springs College', type: 'P-12', sector: 'public', enrol: 2400, km: 0.9 }, { name: 'Christ the Priest Primary', type: 'primary', sector: 'catholic', enrol: 480, km: 1.2 }],
  estates: [],
  nearby: [{ id: tarneitW, name: 'Explorers Tarneit West', km: 4.9, places: 104, occ: 86, counts: false }],
});

site({
  name: 'Clyde North — Pattersons Rd', code: 'ACQ-0392', status: 'rejected', owner: 'JK', age: 200, updated: 21,
  address: '95 Pattersons Rd, Clyde North VIC 3978', suburb: 'Clyde North', council: 'Casey', type: 'Greenfield estate',
  places: 110, land: 4000, price: 3300000, agent: 'JLL — P. Rossi',
  notes: 'No-Go: two pipeline permits within 800 m; a competitor opened in 2026 and the site would have been marginal.',
  gm5: gm(3100, 1680, 38, 5, 97000, [3100, 3150, 3190, 3220, 3240, 3250], 6.0),
  comps: [
    { name: 'Clyde North ELC', operator: 'Independent', places: 120, km: 0.5, fee: 172, occ: 80 },
    { name: 'Goodstart Clyde North', operator: 'Goodstart', places: 130, km: 1.0, fee: 184, occ: 88 },
    { name: 'Selandra Rise Kids', operator: 'G8', places: 102, km: 1.3, fee: 178, occ: 77 },
    { name: 'Pattersons Rd — Lot 3', status: 'pipeline', places: 150, km: 0.6, stage: 'Under construction', risk: 95 },
    { name: 'Berwick Waters Hub', status: 'pipeline', places: 130, km: 0.8, stage: 'Permit issued', risk: 75 },
  ],
  schools: [{ name: 'Clyde North Primary', type: 'primary', sector: 'public', enrol: 700, km: 0.7 }],
  estates: [{ name: 'Berwick Waters', suburb: 'Clyde North', rate: 26, pct: 90 }],
});

const lookups = [
  ...[['reviewing', 'Reviewing', 10], ['conditional_go', 'Conditional go', 20], ['go', 'Go', 30], ['rejected', 'No-go', 40]].map(([value, label, order]) => ({ id: id('look'), category: 'feasibility_status', value, label, order, active: true })),
  ...[['rumoured', 'Rumoured', 10], ['land_zoned', 'Land zoned', 20], ['da_lodged', 'DA lodged', 30], ['for_sale', 'For sale (childcare use)', 40], ['under_construction', 'Under construction', 50]].map(([value, label, order]) => ({ id: id('look'), category: 'competitor_stage', value, label, order, active: true })),
  ...[['high', 'High', 10], ['medium', 'Medium', 20], ['low', 'Low', 30]].map(([value, label, order]) => ({ id: id('look'), category: 'competitor_confidence', value, label, order, active: true })),
  ...[['Greenfield estate', 'Greenfield estate', 10], ['Infill', 'Infill', 20], ['Brownfield', 'Brownfield', 30], ['Town centre', 'Town centre', 40]].map(([value, label, order]) => ({ id: id('look'), category: 'site_type', value, label, order, active: true })),
];

const seed = { generated_at: new Date().toISOString(), projects, feasibility_data, feasibility_competitors: competitors, feasibility_schools: schools, feasibility_estates: estates, feasibility_nearby_explorers: nearby, explorers_centre_data: [
  { id: craigieburn, current_fee: 186, current_ratio: 2.9, current_occupancy_pct: 88, current_nqs_rating: 'Exceeding' },
  { id: kalkallo, current_fee: 182, current_ratio: 2.4, current_occupancy_pct: 79, current_nqs_rating: 'Meeting' },
  { id: tarneitW, current_fee: 184, current_ratio: 2.6, current_occupancy_pct: 86, current_nqs_rating: 'Meeting' },
], feasibility_comments: comments, lookups };

fs.writeFileSync(path.join(__dirname, 'seed.json'), JSON.stringify(seed, null, 1));
console.log(`seed.json: ${projects.length} projects, ${feasibility_data.length} feasibility_data, ${competitors.length} competitors, ${schools.length} schools, ${estates.length} estates, ${lookups.length} lookups`);

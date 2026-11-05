// GapMaps catchment-report CSV parser — ported VERBATIM from
// acquisitions-tool.html (parseGapMapsCsv + helpers, lines ~10994–11172).
// Returns { local, vic, aus }: local goes to the feasibility's gapmaps_5min /
// gapmaps_10min; vic and aus are mirrored into the benchmark rows.

// Years the old tool curates from the report (unchanged)
const _GM_KEEP_POP_YEARS = ['2011','2017','2021','2022','2023','2024','2025','2026','2027'];
const _GM_KEEP_AGE_PROJ_YEARS = ['2025','2026','2027'];

export function _gmParseRows(csvText){
  const rows = [];
  for (const line of String(csvText).split(/\r?\n/)){
    if (!line.trim()) continue;
    const cells = [];
    let inQ = false, cur = '';
    for (const ch of line + ','){
      if (ch === '"'){ inQ = !inQ; }
      else if (ch === ',' && !inQ){ cells.push(cur.trim().replace(/^"|"$/g,'')); cur = ''; }
      else cur += ch;
    }
    if (cells.some(c => c)) rows.push(cells);
  }
  return rows;
}

export function _gmNum(cell){
  if (cell === null || cell === undefined) return null;
  const v = parseFloat(String(cell).replace(/[,$%\s]/g,''));
  return isNaN(v) ? null : v;
}

export function _gmCountMetrics(parsed){
  let n = 0;
  if (parsed.seifa != null) n++;
  ['population_projection','age_projection_0_5','households','income_affluence','housing','ldc']
    .forEach(k => { Object.values(parsed[k]||{}).forEach(v => { if (v != null) n++; }); });
  ['age_profile','occupation','place_of_birth']
    .forEach(k => { (parsed[k]||[]).forEach(r => { if (r.count != null || r.pct != null) n++; }); });
  return n;
}

export function parseGapMapsCsv(csvText){
  const rows = _gmParseRows(csvText);
  // Three parallel parse buckets — one per region. Local goes to the
  // feasibility; Vic and Aus to their benchmark rows.
  const mkEmpty = () => ({
    population_projection: {},
    age_projection_0_5:    {},
    households:            {},
    income_affluence:      {},
    seifa:                 null,
    housing:               {},
    ldc:                   {},
    age_profile:           [],
    occupation:            [],
    place_of_birth:        [],
  });
  const local = mkEmpty(), vic = mkEmpty(), aus = mkEmpty();

  let section = '';
  for (const row of rows){
    const label = (row[0] || '').trim();
    const lower = label.toLowerCase();

    // Section detection — header rows have "Location" / "Victoria" / "Australia"
    // in col 1, or are single-cell text (sub-section headers)
    const isSection =
      (row[1] || '').match(/^(location|victoria|australia)$/i) ||
      (row.length === 1 && isNaN(parseFloat(label)));
    if (isSection){ section = lower; continue; }

    // Helper: write a numeric cell to all three regions for a given key path
    const writeAll = (region, path, val) => {
      if (val === null || val === undefined) return;
      let target;
      if (path.length === 2){
        if (!region[path[0]]) region[path[0]] = {};
        region[path[0]][path[1]] = val;
      } else if (path.length === 1){
        region[path[0]] = val;
      }
    };
    const writeAllFromRow = (path) => {
      writeAll(local, path, _gmNum(row[1]));
      writeAll(vic,   path, _gmNum(row[2]));
      writeAll(aus,   path, _gmNum(row[3]));
    };

    // ── Population Projections — keep only the years we curated ──────
    if (section.includes('population projections')){
      const yearMatch = label.match(/^(\d{4})/);
      if (yearMatch && _GM_KEEP_POP_YEARS.includes(yearMatch[1])){
        writeAllFromRow(['population_projection', yearMatch[1]]);
      }
    }
    // ── Age Projection 0–5 — keep 2025–2027 only ──────────────────────
    else if (section.includes('age projection: 0 to 5')){
      const yearMatch = label.match(/^(\d{4})/);
      if (yearMatch && _GM_KEEP_AGE_PROJ_YEARS.includes(yearMatch[1])){
        writeAllFromRow(['age_projection_0_5', yearMatch[1]]);
      }
    }
    // ── Households 2021 ───────────────────────────────────────────────
    else if (section.includes('households 2021')){
      if (lower.includes('private dwellings') && !lower.includes('occupied')){
        writeAllFromRow(['households','private_dwellings']);
      } else if (lower.includes('occupied private dwellings')){
        writeAllFromRow(['households','occupied']);
      } else if (lower.includes('average household size')){
        writeAllFromRow(['households','avg_size']);
      }
    }
    // ── Income & Affluence 2021 ───────────────────────────────────────
    else if (section.includes('income') || section.includes('affluence')){
      if (lower.includes('per capita')){
        writeAllFromRow(['income_affluence','avg_per_capita']);
      } else if (lower.includes('per household')){
        writeAllFromRow(['income_affluence','avg_per_household']);
      }
    }
    // ── 2021 SEIFA — single scalar ────────────────────────────────────
    else if (section.includes('2021 seifa')){
      if (lower.startsWith('seifa score')){
        local.seifa = _gmNum(row[1]);
        vic.seifa   = _gmNum(row[2]);
        aus.seifa   = _gmNum(row[3]);
      }
    }
    // ── Housing 2021 ──────────────────────────────────────────────────
    else if (section.includes('housing 2021')){
      if (lower === 'owned')                         writeAllFromRow(['housing','owned_pct']);
      else if (lower === 'mortgage')                 writeAllFromRow(['housing','mortgage_pct']);
      else if (lower === 'renting')                  writeAllFromRow(['housing','renting_pct']);
      else if (lower.includes('monthly mortgage'))   writeAllFromRow(['housing','avg_monthly_mortgage']);
      else if (lower.includes('weekly rental'))      writeAllFromRow(['housing','avg_weekly_rent']);
    }
    // ── Long Day Care Supply & Demand — drop ratio + workers/places ──
    else if (section.includes('child care supply') || section === 'supply and demand'){
      // Skip the calculated rows: "Ratio: 0-5 year olds / Places" and "Workers / Places"
      // (both contain "0-5 year" or "places" substrings that would otherwise match below)
      const isCalc = lower.startsWith('ratio') || lower.startsWith('workers');
      if (isCalc) continue;
      if (lower.includes('long day care - facilities') || lower.match(/long day care.*facilit/)){
        writeAllFromRow(['ldc','facilities']);
      } else if (lower.includes('long day care - places') || lower.match(/long day care.*place/)){
        writeAllFromRow(['ldc','places']);
      } else if (lower.match(/0-?4\s*year/)){
        writeAllFromRow(['ldc','children_04']);
      } else if (lower.match(/0-?5\s*year/)){
        writeAllFromRow(['ldc','children_05']);
      }
    }
    // ── 2021 Age Profile (5-year bands) ───────────────────────────────
    else if (section.includes('2021 age profile')){
      // Rows look like "0 to 4,1026,5.86,376053,5.79,1463922,5.77"
      // Format: label, locCount, locPct, vicCount, vicPct, ausCount, ausPct
      if (label.match(/^\d+\s*(to|-)\s*\d+/i) || /^\d+\s*yr/i.test(label) || /\d+\s*yr/i.test(lower)){
        local.age_profile.push({ band:label, count:_gmNum(row[1]), pct:_gmNum(row[2]) });
        vic.age_profile.push({   band:label, count:_gmNum(row[3]), pct:_gmNum(row[4]) });
        aus.age_profile.push({   band:label, count:_gmNum(row[5]), pct:_gmNum(row[6]) });
      }
    }
    // ── 2021 Occupation (employed residents 15+) — different cohort
    //     from "2021 Workers". We want this one. ─────────────────────────
    else if (section.includes('2021 occupation')){
      // Skip the section's own header repetitions
      if (label && !lower.startsWith('2021') && !label.match(/^location$/i)){
        local.occupation.push({ name:label, count:_gmNum(row[1]), pct:_gmNum(row[2]) });
        vic.occupation.push({   name:label, count:_gmNum(row[3]), pct:_gmNum(row[4]) });
        aus.occupation.push({   name:label, count:_gmNum(row[5]), pct:_gmNum(row[6]) });
      }
    }
    // ── 2021 Place of Birth — country-level detail ────────────────────
    else if (section.includes('2021 place of birth')){
      if (label && !lower.startsWith('2021') && !label.match(/^location$/i)){
        local.place_of_birth.push({ country:label, count:_gmNum(row[1]), pct:_gmNum(row[2]) });
        vic.place_of_birth.push({   country:label, count:_gmNum(row[3]), pct:_gmNum(row[4]) });
        aus.place_of_birth.push({   country:label, count:_gmNum(row[5]), pct:_gmNum(row[6]) });
      }
    }
  }

  return { local, vic, aus };
}


// True when the text looks like a GapMaps CSV rather than JSON.
export function looksLikeGapMapsCsv(text){
  const t = String(text || '').trimStart();
  return t && t[0] !== '{' && t[0] !== '[' && /,/.test(t.split(/\r?\n/, 3).join('\n'));
}

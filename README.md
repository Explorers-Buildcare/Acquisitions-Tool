# Explorers Acquisitions — v2

Rebuild of the Acquisitions tool as a small multi-page app: vanilla JS ES modules, no build step, Supabase backend (same tables as today), dummy-data mode for development.

## Run it

**Do not open index.html from disk** — a `file:///` URL blocks ES modules and the seed-data fetch, so the page stays blank. Serve it over HTTP:

```
cd acquisitions-v2
node serve.js                      # or double-click "Start Acquisitions.bat" on Windows
```
then open http://localhost:8080/ — it boots in **local mode** with the dummy data in `data/seed.json`. Edits are held in memory and mirrored to `localStorage` for convenience; **Reset dummy data** on the pipeline page clears them.

| Page | URL | What it is |
|---|---|---|
| Pipeline | `index.html` (`?mode=local` for dummy data) | KPI strip, filters, table / board (map is a stub) |
| New / edit feasibility | `new.html` · `new.html?id=…` | Every input on one page, saves field-by-field |
| Site workspace | `site.html?id=…&tab=market` | Hero stats, Site · Market · Financials · Report · Activity |
| Report workspace | `report.html?id=…` | 12-slide rail, live exec-summary slide, narrative editor, pre-flight, brief export |
| Phone | `m/index.html?id=…` | Take photo (tag to site / competitor / school), notes |

Add `?mode=supabase` to any URL to run against Supabase (see below).

## Layout

```
css/tokens.css        design tokens (lifted from the Claude Design mockups)
css/app.css           shared components
src/config.js         mode, Supabase URL/key, benchmark IDs
src/data/adapter.js   LocalAdapter (seed.json) + SupabaseAdapter (write-through)
src/logic/metrics.js  computeFeasibilityMetrics — ported verbatim from the old tool
src/logic/preflight.js report checks (May 2026 review rules)
src/logic/status.js   status canonicalisation, labels, relative time
src/ui/shell.js       app bar, helpers, toast, boot
src/pages/*.js        one module per page
data/make-seed.js     regenerates data/seed.json (node data/make-seed.js)
sql/25-acquisitions-v2.sql   additive migration (potential competitors)
qa/                   harnesses
```

## Data layer — how this avoids the failed-push bug

The old tool kept localStorage as the source of truth and pushed per-field conditional UPDATEs (`WHERE field = previous value`); jsonb canonicalisation, stale tabs and RLS denials all surfaced as "push failed" with changes stuck in a pending log.

v2 has **no local source of truth and no queue**. Every edit is a write-through: `adapter.patch(table, id, {field: value})` → one row `UPDATE … WHERE id = ? AND updated_at = <version we last saw>` → in-memory state updates only after the server confirms. A failed write returns `{ok:false, code, reason}` and the field is painted unsaved with the reason in a toast; nothing is retried silently. Realtime subscriptions keep other tabs current. The view-only `acquisitions` role never attempts a write (fields are disabled) and reads `feasibility_data_restricted`.

Both adapters share one API so pages don't know which they're on: `list / get / upsert / patch / remove / feasibility(id) / uploadPhoto / on('change')`.

## Supabase mode (the default)

With the publishable key in `src/config.js`, the app boots in Supabase mode and shows a sign-in card (same users/passwords as the current tool). `?mode=local` on any URL switches to dummy data. supabase-js is vendored in `vendor/` so no CDN is needed.

1. Run `sql/25-acquisitions-v2.sql` first (additive; safe on production, but try it on a clone first). Until it's run, reads work but writes that touch the new columns (`count_in_chain`, `confidence`, `section`, `counts`, status `'potential'`) are rejected with a toast that names the migration.
2. Re-run `sql/23-acquisitions-role.sql` so the view-only role's restricted view picks up the schema.
3. Roles come from `app_metadata.role`: none → admin, `intake`, `acquisitions` (view-only — reads `feasibility_data_restricted`, all inputs disabled).
4. **Before cut-over**: remove the `feasibility*` and `explorersCentreData` collections from `TRACKED_COLLECTIONS` in the PM tool's `index.html`, and retire `acquisitions-tool.html`. Otherwise an open old-tool tab can push a stale localStorage snapshot over v2's writes.

## QA

```
node qa/qa-metrics.mjs     # pure node — metrics engine + pre-flight + adapter semantics
cd qa && npm install && npx playwright install chromium && cd ..
node qa/qa-pages.mjs       # Chromium — drives all five pages
```
Both print `{passed, failed, errors}` and exit non-zero on failure. `qa-metrics` hand-computes the Mickleham demand chain, so if the ported engine ever drifts from the old tool it fails loudly.

## Not in this pass (next)

- OpCo / PropCo editor — port `acq-feaso.js` into the Financials tab
- GapMaps **CSV** parser (JSON drop/paste works) — port `parseGapMapsCsv`
- The 9 generated slides beyond cover / exec / demand / comp / bench / growth / schools / risks are placeholders; PDF export is `window.print()` for now (server-side render later)
- Sign-in screen + Microsoft SSO
- Map view — needs `lat`/`lng` (commented in the migration) and a geocoding step
- "Rewrite with Claude" — wire to the existing `claude-rewrite-slide` edge function
- ACECQA import, voice notes, offline queue on the phone

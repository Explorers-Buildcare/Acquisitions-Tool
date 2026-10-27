-- ─────────────────────────────────────────────────────────────────────────
-- 25-acquisitions-v2.sql
--
-- Additive schema changes for the Acquisitions v2 front end. Nothing is
-- dropped, renamed or re-keyed; the current tool keeps working with these
-- applied. IDEMPOTENT — safe to re-run.
--
--   1. feasibility_competitors.status gains 'potential'
--   2. feasibility_competitors.count_in_chain (boolean, default true)
--   3. feasibility_competitors.confidence (text) — 'high' | 'medium' | 'low'
--   4. lookups: competitor_stage, competitor_confidence, site_type values
--   5. (optional, commented) lat/lng columns for the map view
--
-- After running, re-run sql/23-acquisitions-role.sql so the
-- feasibility_data_restricted view picks up any new feasibility_data columns
-- (none added here, but it is the habit to keep).
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Widen the status check
alter table public.feasibility_competitors
  drop constraint if exists feasibility_competitors_status_check;
alter table public.feasibility_competitors
  add constraint feasibility_competitors_status_check
  check (status in ('live', 'pipeline', 'potential', 'closed'));

-- 2 + 3. New columns
alter table public.feasibility_competitors
  add column if not exists count_in_chain boolean not null default true,
  add column if not exists confidence     text;
comment on column public.feasibility_competitors.count_in_chain is
  'Potential competitors only: include risk-weighted places in step 4 of the demand chain. Pipeline permits always count.';
comment on column public.feasibility_competitors.confidence is
  'Potential competitors only: high | medium | low';

-- Existing rows: pipeline permits always count (default true already covers this)

-- 4. Lookup values (lookups: id uuid, category, value, label, "order", active)
insert into public.lookups (id, category, value, label, "order", active)
select gen_random_uuid(), 'competitor_stage', v.value, v.label, v.ord, true
from (values
  ('rumoured',           'Rumoured',                 10),
  ('land_zoned',         'Land zoned',               20),
  ('da_lodged',          'DA lodged',                30),
  ('for_sale',           'For sale (childcare use)', 40),
  ('under_construction', 'Under construction',       50)
) as v(value, label, ord)
where not exists (select 1 from public.lookups l where l.category = 'competitor_stage' and l.value = v.value);

insert into public.lookups (id, category, value, label, "order", active)
select gen_random_uuid(), 'competitor_confidence', v.value, v.label, v.ord, true
from (values ('high', 'High', 10), ('medium', 'Medium', 20), ('low', 'Low', 30)) as v(value, label, ord)
where not exists (select 1 from public.lookups l where l.category = 'competitor_confidence' and l.value = v.value);

insert into public.lookups (id, category, value, label, "order", active)
select gen_random_uuid(), 'site_type', v.value, v.label, v.ord, true
from (values ('Greenfield estate', 'Greenfield estate', 10), ('Infill', 'Infill', 20), ('Brownfield', 'Brownfield', 30), ('Town centre', 'Town centre', 40)) as v(value, label, ord)
where not exists (select 1 from public.lookups l where l.category = 'site_type' and l.value = v.value);

-- 4b. Small additive columns the v2 pages write
alter table public.feasibility_comments
  add column if not exists section text;                    -- e.g. 'demand', 'site_visit'
alter table public.feasibility_nearby_explorers
  add column if not exists counts boolean not null default true;  -- include in cannibalisation check
comment on column public.feasibility_comments.section is 'Which part of the feasibility the comment is about (null = general)';
comment on column public.feasibility_nearby_explorers.counts is 'Whether this centre counts for the cannibalisation check';

-- 5. OPTIONAL — only if the map view is wanted. Needs a geocoding step to fill.
-- alter table public.feasibility_data        add column if not exists lat numeric, add column if not exists lng numeric;
-- alter table public.feasibility_competitors add column if not exists lat numeric, add column if not exists lng numeric;

-- Verify:
--   select status, count(*) from feasibility_competitors where deleted_at is null group by 1;
--   select category, count(*) from lookups where category in ('competitor_stage','competitor_confidence','site_type') group by 1;

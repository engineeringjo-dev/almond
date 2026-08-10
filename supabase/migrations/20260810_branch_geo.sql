-- Branch coordinates for the Jordan sales map.
--
-- The map has to place every shop on the country, but `branches` had no
-- geometry at all — the app carried approximate pins in seed data instead, so
-- the dashboard and the app could drift apart. Coordinates belong next to the
-- branch, in the same row every other consumer already reads.
--
-- ADDITIVE ONLY. Two nullable columns and a seeding UPDATE. No policy, grant,
-- trigger or function is touched, so nothing that works today can change
-- behaviour: RLS on `branches` keeps applying to the new columns unchanged.
--
-- Safe to run more than once: the columns use IF NOT EXISTS and the UPDATE
-- only fills rows that are still NULL, so a coordinate corrected by hand is
-- never overwritten by a re-run.

begin;

alter table public.branches
  add column if not exists lat double precision,
  add column if not exists lng double precision;

comment on column public.branches.lat is
  'WGS84 latitude of the shop. Used by the branch sales map. NULL = not placed yet.';
comment on column public.branches.lng is
  'WGS84 longitude of the shop. Used by the branch sales map. NULL = not placed yet.';

-- Reject anything outside Jordan's bounding box, so a swapped lat/lng pair
-- (a classic slip — 35.86 as a latitude is Turkey) fails loudly on write
-- instead of silently dropping a pin into the sea.
alter table public.branches drop constraint if exists branches_geo_in_jordan;
alter table public.branches add constraint branches_geo_in_jordan check (
  (lat is null and lng is null)
  or (lat between 29.1 and 33.4 and lng between 34.9 and 39.4)
) not valid;
alter table public.branches validate constraint branches_geo_in_jordan;

-- Approximate area pins for the 8 POS branches, carried over from
-- packages/shared/src/menu/seed.ts. They are accurate to the neighbourhood,
-- not the doorstep — replace any of them with the exact Google Maps pin:
--   update public.branches set lat = <lat>, lng = <lng> where code = 'RABIA';
update public.branches as b set lat = v.lat, lng = v.lng
from (values
  ('RABIA',    31.9719, 35.8665),  -- الرابية
  ('THAMEN',   31.9419, 35.8389),  -- الدوار الثامن
  ('MAKKAH',   31.9846, 35.8631),  -- شارع مكة
  ('JAMIAA',   32.0136, 35.8714),  -- شارع الجامعة
  ('KHALDA',   31.9897, 35.8412),  -- خلدا
  ('CITYMALL', 31.9837, 35.8276),  -- ستي مول
  ('SHAFA',    32.0556, 35.9039),  -- شفا بدران
  ('MADINA',   31.9775, 35.8695)   -- شارع المدينة المنورة
) as v(code, lat, lng)
where b.code = v.code
  and b.lat is null
  and b.lng is null;

commit;

-- PostgREST caches the table shape; without this the new columns stay
-- invisible to the REST API (and to the map) until the next restart.
notify pgrst, 'reload schema';

-- Verify — every POS branch should come back with a pin:
--   select code, name_ar, lat, lng from public.branches
--   where kind = 'branch' order by code;

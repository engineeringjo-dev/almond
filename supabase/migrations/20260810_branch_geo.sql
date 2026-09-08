-- Branch coordinates and opening order for the Jordan sales map.
--
-- The map has to place every shop on the country, but `branches` had no
-- geometry at all — the app carried approximate pins in seed data instead, so
-- the dashboard and the app could drift apart. Coordinates belong next to the
-- branch, in the same row every other consumer already reads.
--
-- `branch_no` is how the business actually refers to a shop — "فرع مكة (١)" is
-- the first branch opened, and the number is spoken and written that way. It
-- cannot be derived from `opening_date`: those dates are when the row was keyed
-- in (six branches share 2026-05-14), not when the shop opened.
--
-- ADDITIVE ONLY. Three nullable columns and seeding UPDATEs. No policy, grant,
-- trigger or function is touched, so nothing that works today can change
-- behaviour: RLS on `branches` keeps applying to the new columns unchanged.
--
-- Safe to run more than once: the columns use IF NOT EXISTS and the UPDATEs
-- only fill rows that are still NULL, so a coordinate corrected by hand is
-- never overwritten by a re-run.

begin;

alter table public.branches
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists branch_no smallint;

comment on column public.branches.lat is
  'WGS84 latitude of the shop. Used by the branch sales map. NULL = not placed yet.';
comment on column public.branches.lng is
  'WGS84 longitude of the shop. Used by the branch sales map. NULL = not placed yet.';
comment on column public.branches.branch_no is
  'Opening order, 1 = the first branch (Makkah St). How staff name a shop: فرع مكة (١).';

-- Two shops cannot share a number — that is what makes it usable as a name.
create unique index if not exists branches_branch_no_key
  on public.branches (branch_no) where branch_no is not null;

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

-- Opening order, as the business counts it.
update public.branches as b set branch_no = v.no
from (values
  ('MAKKAH',   1),  -- شارع مكة — الفرع الأول
  ('RABIA',    2),  -- الرابية
  ('KHALDA',   3),  -- خلدا
  ('THAMEN',   4),  -- الدوار الثامن
  ('CITYMALL', 5),  -- ستي مول
  ('JAMIAA',   6),  -- الجامعة الأردنية
  ('SHAFA',    7),  -- شفا بدران
  ('MADINA',   8)   -- شارع المدينة المنورة
) as v(code, no)
where b.code = v.code
  and b.branch_no is null;

commit;

-- PostgREST caches the table shape; without this the new columns stay
-- invisible to the REST API (and to the map) until the next restart.
notify pgrst, 'reload schema';

-- Verify — all 8 POS branches, numbered 1..8, each with a pin:
--   select branch_no, code, name_ar, lat, lng from public.branches
--   where kind = 'branch' order by branch_no;

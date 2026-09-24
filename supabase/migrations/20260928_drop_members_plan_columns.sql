-- Drop the three member columns of the retired 18 JOD monthly drinks plan.
--
-- 🔴 WHY: owner, 2026-09-24 — «الغي اشتراك الموند ١٨ دينار تماما», cancel it
-- completely. Not a flag: the dial, the routes, the Backend methods and the app
-- card were deleted in the same change, and these columns were their only
-- storage:
--
--   sub_renews_at   bigint  the plan's renewal instant (epoch ms; 0 = none)
--   sub_day         text    the Amman day of the last free drink
--   sub_day_count   int     free drinks taken on that day
--
-- The plan never launched (it sat behind `enabled: false` from 2026-09-03), so
-- every row holds the defaults 0 / '' / 0 and nothing of value is dropped. The
-- BFF stopped reading and writing them in the same change; applying this
-- migration BEFORE deploying that BFF would break its INSERT, so deploy the
-- code first (it no longer names the columns) and then apply this — or apply
-- both together, as a fresh environment does.
--
-- 20260909_loyalty_backend.sql still CREATEs them (a published migration is
-- never edited — HANDOVER §10), so a database built from scratch has them for
-- the instant between the two files. That is harmless: nothing reads them.
--
-- Re-runnable: DROP COLUMN IF EXISTS is a no-op on a second run.

alter table members drop column if exists sub_renews_at;
alter table members drop column if exists sub_day;
alter table members drop column if exists sub_day_count;

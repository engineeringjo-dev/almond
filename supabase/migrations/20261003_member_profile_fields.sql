-- The profile's GENDER — the fourth fact the completion bonus needs.
--
-- 🔴 WHY: owner, 2026-09-24 — the one-time profile bonus
-- (config.PROFILE_COMPLETION_BONUS, 50 points) now needs NAME + BIRTH DATE +
-- GENDER + PHONE, not a name alone (loyalty/profile.ts isProfileComplete).
-- members already has name, birthday and phone (20260909); gender is new.
--
-- Stored as an id ('male' | 'female', the shared GENDERS list), never display
-- text, so the Arabic and English screens cannot store two spellings of one
-- fact. NULL until the member tells us. A member already paid the bonus under
-- the name-only rule keeps it: nothing here touches profile_bonus_at.
--
-- Re-runnable: the column is IF NOT EXISTS and the check is dropped and
-- re-added under the same name. (RLS is already on for members — 20260923.)

alter table members add column if not exists gender text;
alter table members drop constraint if exists members_gender_known;
alter table members add constraint members_gender_known
  check (gender is null or gender in ('male', 'female'));

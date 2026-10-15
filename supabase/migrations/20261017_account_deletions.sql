-- Account deletion: the member's request, its grace period, and when it was
-- carried out.
--
-- 🔴 WHY: owner, 2026-10-15 — «اضف حذف الحساب», «مهلة تراجع قبل الحذف نعم»,
-- and «عند الحذف يبقى الرصيد مربوط بالمعلومات ورقم الهاتف» / «النقاط لا تسقط
-- الا بالموعدها». The rule is packages/shared/src/loyalty/accountDeletion.ts:
-- after the grace period the PROFILE is erased (members.name, birthday,
-- gender) and rating comments are cleared; the phone, the points and wallet
-- lots, the history, orders and invoices are KEPT, so the balance stays tied
-- to the number and expires only on its own dates.
--
--   requested_at  when the member asked.
--   erase_after   requested_at + the grace period, STORED at request time:
--                 changing config.ACCOUNT_DELETION_GRACE_DAYS never moves a
--                 date already promised.
--   erased_at     set by the sweep (POST /v1/admin/deletions/sweep) once the
--                 profile is erased. NULL = still pending, and signing in
--                 again deletes the row (the request is cancelled).
--
-- One row per member (the key): a member who returns after an erasure and
-- asks again reuses it. FK RESTRICT, as every member-owned table (20260925).
-- Closed to Supabase's public API roles (guarded REVOKE). Re-runnable.

create table if not exists account_deletions (
  member_id     text primary key references members(id) on delete restrict,
  requested_at  timestamptz not null,
  erase_after   timestamptz not null,
  erased_at     timestamptz,
  constraint account_deletions_grace check (erase_after > requested_at),
  constraint account_deletions_not_early check (erased_at is null or erased_at >= erase_after)
);

create index if not exists account_deletions_due_idx on account_deletions (erase_after) where erased_at is null;

alter table account_deletions enable row level security;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on table account_deletions from %I', r);
    end if;
  end loop;
end
$$;

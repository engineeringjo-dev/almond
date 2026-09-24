-- Transfers to a friend: points or wallet balance, member to member.
--
-- 🔴 WHY: owner, 2026-09-24 — a member may send POINTS or WALLET BALANCE to
-- another REGISTERED member (found by phone, never created by the send), with
-- a DAILY CAP per sender (config.TRANSFER_POINTS_DAILY_MAX /
-- TRANSFER_WALLET_DAILY_MAX_JOD, per Amman business day).
--
-- One row per transfer, written in the SAME transaction that locks both
-- members (in id order) and moves the lots:
--   * kind 'points' → amount is whole POINTS; kind 'wallet' → whole FILS.
--   * slices (jsonb): the lot slices that moved, WITH the grant and expiry days
--     they carried — the recipient's new lots are exactly these, never a fresh
--     twelve months (loyalty/lots.ts restoreSlices).
--   * amman_day ('YYYY-MM-DD', Asia/Amman): the business day the cap counts it
--     against — decided by the writer (ammanDayKey), never re-derived from a
--     server clock. The (sender_id, kind, amman_day) index is what the cap is
--     summed from, under the sender's lock.
--   * The two members' ledger lines (point_history) are written beside it.
--   * A transfer is never qualifying spend: nothing here touches members.spend.
--
-- The retry guard is the Idempotency-Key (idempotency_keys, 20260924); this
-- table needs no key of its own. FKs RESTRICT (20260925). Closed to Supabase's
-- public API roles like every loyalty table (guarded REVOKE). Re-runnable.

create table if not exists member_transfers (
  id            text primary key check (char_length(id) between 1 and 64),
  sender_id     text not null references members(id) on delete restrict,
  recipient_id  text not null references members(id) on delete restrict,
  kind          text not null check (kind in ('points', 'wallet')),
  amount        int  not null check (amount > 0),
  slices        jsonb not null default '[]'::jsonb,
  amman_day     text not null check (amman_day ~ '^\d{4}-\d{2}-\d{2}$'),
  created_at    timestamptz not null default now(),
  constraint member_transfers_not_self check (sender_id <> recipient_id)
);

create index if not exists member_transfers_sender_day_idx on member_transfers (sender_id, kind, amman_day);
create index if not exists member_transfers_recipient_idx on member_transfers (recipient_id, created_at desc);

alter table member_transfers enable row level security;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on table member_transfers from %I', r);
    end if;
  end loop;
end
$$;

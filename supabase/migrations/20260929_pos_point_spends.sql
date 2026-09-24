-- Points spent as a TENDER at the till: one row per POS order that took a
-- member's points off the bill.
--
-- 🔴 WHY: owner, 2026-09-24 — «كسب وصرف النقاط بدي يكون باركود مباشر نفسه …
-- اذا دفعت بتقدر تدفع بالمحل من نقاطك بالباركود … لازم ما يصير خلط بين النقاط
-- المكتسبة وطريقة الدفع». ONE member code, scanned ONCE per visit: the scan
-- (/v1/pos/scan) hands the till an earn ticket AND a short-lived spend ticket;
-- if the member says "use my points", POST /v1/pos/points/spend takes them off
-- the bill as a tender (this table), and the MONEY part earns through
-- /v1/pos/earn (pos_sales) under the same posOrderRef. Two rows, two tables:
-- a spend and a grant are different movements and each is reversed on its own.
--
--   * pos_order_ref (PK) is the POS order's own reference (Odoo pos.order
--     `name`) — the idempotency key: a retrying till gets the stored answer.
--   * spend_ticket_jti (UNIQUE): one spend ticket pays for ONE sale.
--   * points / value_jod: what was taken, and what it took off the bill
--     (jodFromPoints, stored once like redemptions.value_jod).
--   * slices (jsonb): which lots the points came out of, WITH THEIR ORIGINAL
--     granted/expiry days, so a void puts them back on the clock they were
--     issued under — never a fresh twelve months (lots.ts restoreSlices).
--   * A reversal (the till voided the sale) sets status 'reversed' and records
--     what came back and what had expired meanwhile; together they account for
--     every point spent.
--
-- member_id → members is ON DELETE RESTRICT, like every table that records
-- money (20260925): deleting a member must never delete what they spent.
-- Closed to Supabase's public API roles like every loyalty table: RLS with no
-- policy; the REVOKE is guarded by pg_roles so the file applies to a plain
-- Postgres too. Re-runnable: every statement is IF NOT EXISTS or a no-op.

create table if not exists pos_point_spends (
  pos_order_ref         text primary key check (char_length(pos_order_ref) between 1 and 64),
  member_id             text not null references members(id) on delete restrict,
  spend_ticket_jti      text not null unique,
  points                int  not null check (points > 0),
  value_jod             numeric(12,3) not null check (value_jod >= 0),
  slices                jsonb not null,
  points_balance_after  int  not null check (points_balance_after >= 0),
  status                text not null default 'spent' check (status in ('spent', 'reversed')),
  returned_points       int  check (returned_points >= 0),
  expired_points        int  check (expired_points >= 0),
  reverse_balance_after int  check (reverse_balance_after >= 0),
  reverse_reason        text,
  reversed_at           timestamptz,
  created_at            timestamptz not null default now(),
  -- A reversal is all of its fields or none of them, and it accounts for every
  -- point the spend took: returned, or expired before the void.
  constraint pos_point_spends_reversal_complete check (
    (status = 'reversed') = (reversed_at is not null)
    and (status = 'reversed') = (returned_points is not null)
    and (status = 'reversed') = (expired_points is not null)
    and (status <> 'reversed' or returned_points + expired_points = points)
  )
);

create index if not exists pos_point_spends_member_idx on pos_point_spends (member_id, created_at desc);

alter table pos_point_spends enable row level security;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on table pos_point_spends from %I', r);
    end if;
  end loop;
end
$$;

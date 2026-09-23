-- The till's earn: one row per POS order a till reported as PAID for a member.
--
-- 🔴 WHY: the owner's decision of 2026-09-23 — «اوافق النقاط بعد تاكيد الدفع»,
-- points ONLY after the payment is confirmed. An in-store member could be
-- identified (/v1/pos/scan) and could settle a redemption, but nothing let the
-- till say "I took the money for this sale", so an in-store member could never
-- earn. POST /v1/pos/earn is that report; this table is its durable memory.
--
--   * pos_order_ref (PK) is the POS order's own reference (Odoo pos.order
--     `name`). It IS the idempotency key: a retrying till sends the same one,
--     and the second report is a replay, never a second grant — across
--     restarts and across instances, because it is a row.
--   * earn_ticket_jti (UNIQUE) is the id of the server-signed earn ticket the
--     scan handed the till. One ticket pays for one sale: a till holding the
--     shared POS key cannot reuse a member's ticket on another order.
--   * paid_total is what the till collected in MONEY (tax-inclusive JOD), the
--     part paid with an Almond redemption excluded. points_earned is what
--     computeEarn granted on it (0 for a corporate member).
--   * spend_day is the Amman day the window spend was recorded on — kept so a
--     reversal can take that spend back out.
--   * A reversal (refund/void) sets status 'reversed' and records what was taken
--     back and what the member had already spent (shortfall). It never drives
--     a balance negative; the row is the back-office's record of the gap.
--
-- member_id → members is ON DELETE RESTRICT, like every other table that
-- records money (20260925_restrict_financial_history.sql): deleting a member
-- must never delete the evidence of what they were granted.
--
-- Closed to Supabase's public API roles like every loyalty table: RLS with no
-- policy denies every non-owner role; the BFF connects as the owner. The
-- REVOKE is guarded by pg_roles so the same file applies to a plain Postgres.
--
-- Re-runnable: every statement is IF NOT EXISTS or a no-op on a second run.

create table if not exists pos_sales (
  pos_order_ref         text primary key check (char_length(pos_order_ref) between 1 and 64),
  member_id             text not null references members(id) on delete restrict,
  branch_id             text not null check (char_length(branch_id) between 1 and 64),
  earn_ticket_jti       text not null unique,
  paid_total            numeric(12,3) not null check (paid_total >= 0),
  paid_at               timestamptz not null,
  spend_day             text,
  points_earned         int  not null check (points_earned >= 0),
  points_balance_after  int  not null check (points_balance_after >= 0),
  earn_breakdown        jsonb,
  status                text not null default 'earned' check (status in ('earned', 'reversed')),
  reversed_points       int  check (reversed_points >= 0),
  shortfall             int  check (shortfall >= 0),
  reverse_balance_after int  check (reverse_balance_after >= 0),
  reverse_reason        text,
  reversed_at           timestamptz,
  created_at            timestamptz not null default now(),
  -- A reversal is all of its fields or none of them, and it accounts for every
  -- point the sale granted: taken back, or already spent.
  constraint pos_sales_reversal_complete check (
    (status = 'reversed') = (reversed_at is not null)
    and (status = 'reversed') = (reversed_points is not null)
    and (status = 'reversed') = (shortfall is not null)
    and (status <> 'reversed' or reversed_points + shortfall = points_earned)
  )
);

create index if not exists pos_sales_member_idx on pos_sales (member_id, created_at desc);

alter table pos_sales enable row level security;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on table pos_sales from %I', r);
    end if;
  end loop;
end
$$;

-- Refunds of a till sale — in PART or in full — one row each.
--
-- 🔴 WHY: owner, 2026-09-24 — «المرتجع يلغي نقاط الجزء المرتجع»: a refund
-- cancels the points of the part refunded, not the whole sale's. Until now
-- POST /v1/pos/earn/reverse could only reverse ALL of a sale (pos_sales.status
-- → 'reversed'), so returning one pastry from a 20 JOD basket took every point
-- the basket had earned.
--
-- POST /v1/pos/earn/reverse now takes an optional {refundRef, refundedTotal}:
--   * refund_ref is the REFUND's own POS reference (the Odoo refund order's
--     `name`) and the idempotency key of that refund: UNIQUE, so a retrying
--     till gets the stored row back and nothing is taken twice.
--   * The full reversal (no amount) is also a row, with refund_ref NULL — at
--     most ONE per sale (the partial unique index below).
--   * target_points is the refund's share of the sale's points —
--     round(earned × refunded / paid), cumulative (loyalty/tillRefund.ts);
--     reversed_points is what was actually taken back, and shortfall what the
--     member had already spent. They always add up.
--   * pos_sales.refunded_total (added below) is the running sum of money
--     refunded by PARTIAL refunds; it can never exceed what was paid.
--
-- FKs RESTRICT (20260925): deleting a member, or a sale, never deletes the
-- record of what was taken back. Closed to Supabase's public API roles like
-- every loyalty table (RLS, guarded REVOKE). Re-runnable: every statement is
-- IF NOT EXISTS, or a DROP IF EXISTS followed by the same ADD.

alter table pos_sales add column if not exists refunded_total numeric(12,3) not null default 0;
alter table pos_sales drop constraint if exists pos_sales_refunded_within_paid;
alter table pos_sales add constraint pos_sales_refunded_within_paid
  check (refunded_total >= 0 and refunded_total <= paid_total);

create table if not exists pos_sale_refunds (
  id               bigint generated always as identity primary key,
  refund_ref       text unique check (refund_ref is null or char_length(refund_ref) between 1 and 64),
  pos_order_ref    text not null references pos_sales(pos_order_ref) on delete restrict,
  member_id        text not null references members(id) on delete restrict,
  refunded_total   numeric(12,3) not null check (refunded_total >= 0),
  target_points    int  not null check (target_points >= 0),
  reversed_points  int  not null check (reversed_points >= 0),
  shortfall        int  not null check (shortfall >= 0),
  balance_after    int  not null check (balance_after >= 0),
  reason           text not null check (char_length(reason) between 1 and 200),
  created_at       timestamptz not null default now(),
  constraint pos_sale_refunds_accounted check (reversed_points + shortfall = target_points)
);

-- One FULL reversal per sale; partial refunds are one row per refund_ref.
create unique index if not exists pos_sale_refunds_one_full
  on pos_sale_refunds (pos_order_ref) where refund_ref is null;
create index if not exists pos_sale_refunds_sale_idx on pos_sale_refunds (pos_order_ref, id);

alter table pos_sale_refunds enable row level security;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on table pos_sale_refunds from %I', r);
      execute format('revoke all on sequence pos_sale_refunds_id_seq from %I', r);
    end if;
  end loop;
end
$$;

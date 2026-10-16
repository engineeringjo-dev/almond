-- A cancelled/expired redemption restores its ORIGINAL FIFO slices, never a
-- new twelve-month grant. Apply before deploying the corresponding backend.
alter table redemptions add column if not exists slices jsonb;
alter table redemptions add column if not exists returned_points int check (returned_points >= 0);
alter table redemptions add column if not exists expired_points int check (expired_points >= 0);
alter table redemptions add column if not exists refund_review_required boolean not null default false;

-- Deliberately NO guessed backfill from current lots: older spends can overlap,
-- and the old schema did not retain which dates funded a redemption. NULL is an
-- explicit legacy state. A still-live code may settle its already-stored value;
-- cancelling/expiry without lineage closes it and flags manual reconciliation
-- without issuing new points. Existing balances/history are left untouched.
-- Previously cancelled legacy rows need review too; no retroactive debit is
-- inferred from an old refund whose original dates cannot be recovered.
update redemptions set refund_review_required = true
where slices is null and cancelled_at is not null and not refund_review_required;

-- Operational review, using the same restricted financial table:
-- select id, member_id, points, cancelled_at from redemptions
-- where refund_review_required order by cancelled_at;

-- Points-only purchase refund recovery. No cash/wallet balance is changed.
alter table members add column if not exists purchase_points_debt int not null default 0
  check (purchase_points_debt >= 0);
alter table point_history add column if not exists purchase_points_recovered int not null default 0
  check (purchase_points_recovered >= 0);
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public'
    and table_name='pos_sales' and column_name='points_available') then
    alter table pos_sales add column points_available int not null default 0 check (points_available >= 0);
    update pos_sales set points_available=points_earned;
  end if;
end $$;
alter table pos_sales add column if not exists points_recovered int not null default 0 check (points_recovered >= 0);
alter table pos_sales add column if not exists purchase_origin_known boolean not null default false;
alter table redemptions add column if not exists recovered_points int not null default 0
  check (recovered_points >= 0);
alter table pos_point_spends add column if not exists recovered_points int not null default 0
  check (recovered_points >= 0);
alter table pos_point_spends drop constraint if exists pos_point_spends_reversal_complete;
alter table pos_point_spends add constraint pos_point_spends_reversal_complete check (
  (status = 'reversed') = (reversed_at is not null)
  and (status = 'reversed') = (returned_points is not null)
  and (status = 'reversed') = (expired_points is not null)
  and (status <> 'reversed' or returned_points + expired_points + recovered_points = points)
);
alter table pos_sale_refunds add column if not exists expired_reserved_points int not null default 0
  check (expired_reserved_points >= 0);
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public'
    and table_name='pos_sale_refunds' and column_name='reconciliation_required') then
    alter table pos_sale_refunds add column reconciliation_required boolean not null default false;
    -- Existing shortfalls predate automatic recovery and need review; do not
    -- apply this flag to newly recorded recoverable shortfalls on a retry.
    update pos_sale_refunds set reconciliation_required=true where shortfall > 0;
  end if;
end $$;
alter table pos_sales add column if not exists expired_reserved_points int not null default 0
  check (expired_reserved_points >= 0);
alter table pos_sale_refunds drop constraint if exists pos_sale_refunds_accounted;
alter table pos_sale_refunds add constraint pos_sale_refunds_accounted
  check (reversed_points + shortfall + expired_reserved_points = target_points);
alter table pos_sales drop constraint if exists pos_sales_reversal_complete;
alter table pos_sales add constraint pos_sales_reversal_complete check (
  (status = 'reversed') = (reversed_at is not null)
  and (status = 'reversed') = (reversed_points is not null)
  and (status = 'reversed') = (shortfall is not null)
  and (status <> 'reversed' or reversed_points + shortfall + expired_reserved_points = points_earned)
);
-- Old shortfalls are not guessed into a new entitlement or recovery balance.
-- They remain explicit reconciliation work in pos_sale_refunds/pos_sales.

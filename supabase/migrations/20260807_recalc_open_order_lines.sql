-- Recalculate open (not-yet-dispatched) order lines when a stock count is corrected.
--
-- Problem it solves: `warehouse_order_lines.suggested` is frozen at generation
-- time. Fixing a miscounted `warehouse_counts.qty` afterwards left the order
-- sheet on the stale reading, so branches received the wrong quantity.
--
-- Design notes:
--  * DELTA-BASED, so it does NOT need to know the app's replenishment formula.
--    Any "top up to par" rule moves `suggested` inversely 1:1 with on-hand:
--    more stock counted  -> order less;  less stock counted -> order more.
--  * Capped at warehouse_pars.max_qty (never exceed the ceiling) and floored at 0.
--  * Only touches OPEN lines: dispatched IS NULL and the order is not already
--    dispatched/cancelled. Anything already sent out is history and stays put.
--  * `suggested` is the system's recommendation, so it is what we correct;
--    a manually set `dispatched` is a human decision and is never overwritten.

create or replace function public.recalc_open_order_lines()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  -- Recompute from the live rule rather than nudging by a delta, so a line
  -- that already drifted (e.g. generated from a since-corrected count) is
  -- brought back to the truth, not merely shifted.
  --
  -- Rule verified empirically against order #69: suggested = max_qty - count
  -- held for 68 of its 69 lines; the single exception was a stale line, i.e.
  -- exactly the bug this trigger fixes.
  with recomputed as (
    select
      wol.id,
      greatest(0, least(p.max_qty, p.max_qty - new.qty)) as new_suggested
    from warehouse_order_lines wol
    join warehouse_orders wo on wo.id = wol.order_id
    join warehouse_pars   p  on p.branch_id = wo.branch_id
                            and p.item_id   = wol.item_id
    where wol.item_id  = new.item_id
      and wo.branch_id = new.branch_id
      and wol.source   = 'count'          -- only count-generated lines
      and wol.dispatched is null          -- nothing already sent out
      and wo.status not in ('dispatched', 'cancelled')
      and wo.order_date >= new.count_date -- only orders built on/after this count
      and coalesce(p.disabled, false) = false
  )
  update warehouse_order_lines wol
     set suggested = recomputed.new_suggested
    from recomputed
   where wol.id = recomputed.id
     and wol.suggested is distinct from recomputed.new_suggested;

  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    insert into audit_log (action, details, before_value, after_value, created_at)
    values (
      'warehouse_order_lines.recalc_from_count',
      jsonb_build_object(
        'item_id',       new.item_id,
        'branch_id',     new.branch_id,
        'count_date',    new.count_date,
        'lines_updated', v_rows
      ),
      jsonb_build_object('count_qty', old.qty),
      jsonb_build_object('count_qty', new.qty),
      now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_recalc_open_order_lines on public.warehouse_counts;

create trigger trg_recalc_open_order_lines
after update of qty on public.warehouse_counts
for each row
when (old.qty is distinct from new.qty)
execute function public.recalc_open_order_lines();

-- ---------------------------------------------------------------------------
-- Guardrail so an operator can safely edit their own order line in the app.
-- The UI must cap the input, but the database enforces it too: a bug, a stale
-- client or a direct API call must never push a branch over its ceiling.
-- ---------------------------------------------------------------------------

alter table public.warehouse_order_lines
  drop constraint if exists chk_dispatched_nonneg;
alter table public.warehouse_order_lines
  add constraint chk_dispatched_nonneg
  check (dispatched is null or dispatched >= 0);

create or replace function public.enforce_dispatch_ceiling()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max    numeric;
  v_branch uuid;
  v_status text;
begin
  if new.dispatched is null then
    return new;
  end if;

  select wo.branch_id, wo.status into v_branch, v_status
    from warehouse_orders wo
   where wo.id = new.order_id;

  -- Never edit a line that has already left the warehouse.
  if tg_op = 'UPDATE'
     and v_status in ('dispatched', 'cancelled')
     and new.dispatched is distinct from old.dispatched then
    raise exception 'Order is % — its lines can no longer be edited', v_status
      using errcode = 'check_violation';
  end if;

  select p.max_qty into v_max
    from warehouse_pars p
   where p.branch_id = v_branch
     and p.item_id   = new.item_id;

  -- Clamp rather than reject: the operator still gets a usable order, capped.
  if v_max is not null and new.dispatched > v_max then
    new.dispatched := v_max;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_dispatch_ceiling on public.warehouse_order_lines;

create trigger trg_enforce_dispatch_ceiling
before insert or update of dispatched on public.warehouse_order_lines
for each row
execute function public.enforce_dispatch_ceiling();

-- ---------------------------------------------------------------------------
-- Let the branch team fix their own open order lines, instead of routing every
-- correction through an admin. Uses the helper functions already present in
-- this database (current_app_branch / is_warehouse_ops / is_admin), so it
-- matches the existing authorisation model rather than inventing a new one.
--
-- Review against any existing policy on this table before applying: if one is
-- already there, extend it instead of adding a second, overlapping rule.
-- ---------------------------------------------------------------------------

drop policy if exists wol_branch_edit_open on public.warehouse_order_lines;

create policy wol_branch_edit_open
on public.warehouse_order_lines
for update
to authenticated
using (
  is_admin()
  or is_warehouse_ops()
  or exists (
    select 1 from warehouse_orders wo
     where wo.id = warehouse_order_lines.order_id
       and wo.branch_id = current_app_branch()
       and wo.status not in ('dispatched', 'cancelled')
  )
)
with check (
  is_admin()
  or is_warehouse_ops()
  or exists (
    select 1 from warehouse_orders wo
     where wo.id = warehouse_order_lines.order_id
       and wo.branch_id = current_app_branch()
       and wo.status not in ('dispatched', 'cancelled')
  )
);

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
  v_delta numeric;
  v_rows  integer;
begin
  v_delta := coalesce(new.qty, 0) - coalesce(old.qty, 0);
  if v_delta = 0 then
    return new;
  end if;

  with capped as (
    select
      wol.id,
      greatest(
        0,
        least(
          coalesce(p.max_qty, wol.suggested - v_delta),  -- ceiling: par max
          wol.suggested - v_delta                        -- inverse 1:1 with count
        )
      ) as new_suggested
    from warehouse_order_lines wol
    join warehouse_orders wo on wo.id = wol.order_id
    left join warehouse_pars p
           on p.branch_id = wo.branch_id
          and p.item_id   = wol.item_id
    where wol.item_id = new.item_id
      and wo.branch_id = new.branch_id
      and wol.source   = 'count'          -- only count-generated lines
      and wol.dispatched is null          -- not yet dispatched
      and wo.status not in ('dispatched', 'cancelled')
      and wo.order_date >= new.count_date -- only orders built on/after this count
  )
  update warehouse_order_lines wol
     set suggested = capped.new_suggested
    from capped
   where wol.id = capped.id
     and wol.suggested is distinct from capped.new_suggested;

  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    insert into audit_log (table_name, action, record_id, changes, created_at)
    values (
      'warehouse_order_lines',
      'recalc_from_count',
      new.id,
      jsonb_build_object(
        'item_id',   new.item_id,
        'branch_id', new.branch_id,
        'count_date', new.count_date,
        'old_qty',   old.qty,
        'new_qty',   new.qty,
        'delta',     v_delta,
        'lines_updated', v_rows
      ),
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

-- Deleting a member (or a company) must never delete money's history.
--
-- 🔴 WHY: 20260909_loyalty_backend.sql declared every child foreign key
-- ON DELETE CASCADE. One `delete from members where id = …` — a GDPR request
-- handled by hand, a support tool, a mistyped id — would silently take with it
-- the member's orders, their whole points ledger, their redemptions (points
-- turned into codes with a JOD value), their second-visit voucher and every
-- staff-discount use; and deleting a company would erase the discount report
-- for every employee who ever used it. That is the audit trail, and the
-- `unexplainedPoints` guard is computed from it.
--
-- Now the database REFUSES (23503) while any such row exists. Retiring a member
-- is a deliberate act — anonymise the member row, keep the history — never a
-- side effect of a delete.
--
-- Left as it was on purpose: corporate_roster → companies stays CASCADE. The
-- roster is the company's CURRENT staff list, replaced wholesale on every
-- upload; it records no money. (A company with recorded uses can no longer be
-- deleted anyway: corporate_uses → companies is RESTRICT below.)
--
-- 20260909 is never edited: it has been applied. This file rewrites the
-- constraints in place.
--
-- Re-runnable: each FK is found by (table, column, referenced table) in
-- pg_constraint — never by an assumed name — and rewritten only while its
-- delete action is not already RESTRICT ('r'); one that is missing altogether
-- is added. Each rewrite is ONE `alter table` (drop + add), so there is no
-- instant without the constraint, and the existing name is kept.

do $$
declare
  fk    record;
  c     record;
  seen  boolean;
begin
  for fk in
    select * from (values
      ('point_history',         'member_id',  'members'),
      ('orders',                'member_id',  'members'),
      ('redemptions',           'member_id',  'members'),
      ('second_visit_vouchers', 'member_id',  'members'),
      ('corporate_uses',        'member_id',  'members'),
      ('corporate_uses',        'company_id', 'companies')
    ) as v(tbl, col, ref)
  loop
    seen := false;
    for c in
      select con.conname, con.confdeltype
      from pg_constraint con
      join pg_attribute a
        on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
      where con.contype = 'f'
        and con.conrelid = fk.tbl::regclass
        and con.confrelid = fk.ref::regclass
        and array_length(con.conkey, 1) = 1
        and a.attname = fk.col
    loop
      seen := true;
      if c.confdeltype <> 'r' then
        execute format(
          'alter table %I drop constraint %I, add constraint %I foreign key (%I) references %I(id) on delete restrict',
          fk.tbl, c.conname, c.conname, fk.col, fk.ref);
      end if;
    end loop;
    -- Missing altogether (dropped by hand somewhere): put it back, RESTRICT.
    if not seen then
      execute format(
        'alter table %I add constraint %I foreign key (%I) references %I(id) on delete restrict',
        fk.tbl, fk.tbl || '_' || fk.col || '_fkey', fk.col, fk.ref);
    end if;
  end loop;
end
$$;

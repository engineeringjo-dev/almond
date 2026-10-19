-- The points a member owes from refunded purchases, line by line.
--
-- Review 2026-10-19, item 9: «الدين من المرتجع لا يظهر للعضو، والخصم اللاحق
-- يأتي كسطر غامض». members.purchase_points_debt (20261016160234) holds HOW
-- MUCH is owed; nothing said which refund it came from, and the later
-- deduction was tied to whatever credit paid it. This column says it on the
-- ledger itself:
--   - plus on a refund line, the points that refund could not take back
--     because the points balance did not cover them;
--   - minus on each line that pays it back. That line's source_ref names the
--     refunded purchase it pays ('pos:<ref>'), oldest refund first
--     (bff/src/backend/pointsCredit.ts attributeOwedLine);
--   - 0 on every other line.
-- A member's lines add up to members.purchase_points_debt.
--
-- Old lines read 0: no refund has been recorded against the 20261016160234
-- columns on any database, and a line written before this column is not
-- guessed into a debt. Re-runnable.
alter table point_history add column if not exists points_owed_change int not null default 0;

alter table point_history drop constraint if exists point_history_points_owed_change;
alter table point_history add constraint point_history_points_owed_change check (
  points_owed_change = 0
  -- `is not null` first: a NULL kind would make the check NULL, which passes.
  or (kind is not null and kind = 'refund'
      and (points_owed_change > 0 or delta_points = points_owed_change))
);

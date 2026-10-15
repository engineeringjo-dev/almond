-- The points history learns WHAT each line is, WHERE it happened and WHEN its
-- points run out.
--
-- 🔴 WHY: owner, 2026-10-15, after Al Ameed's app — «نعمل سجل نقاط مثلهم».
-- Their history puts three counters on top (points redeemed, visits, points
-- expired) and gives each earn line its branch, its date and the day those
-- points expire. The counters are computed from `kind` by ONE shared function
-- (packages/shared/src/loyalty/history.ts pointsSummary).
--
--   kind        what the line records — written by the operation that wrote
--               the line (bff/src/backend/*), never guessed from its text.
--   branch_id   the branch of a purchase (app order or till); null otherwise.
--               Text, like orders.branch_id and pos_sales.branch_id: the
--               branch list is Odoo's, not a table here.
--   expires_on  the granted lot's OWN stored expiry (lots.ts PointLot
--               .expiresOn), copied when the line is written. Inclusive.
--               Null when the line granted nothing or never expires. An Amman
--               day KEY in text ('YYYY-MM-DD'), like pos_sales.spend_day and
--               members.expiry_settled_through: a `date` comes back from the
--               driver as a JS Date at local midnight, which is exactly the
--               day-shift lib/format.ts formatDayKey exists to avoid.
--
-- EXISTING ROWS. `kind` is backfilled from the exact English reason each
-- writer has used (they are fixed strings in the code; the ones with an amount
-- in them are matched on their fixed prefix). A row that matches none stays
-- NULL and counts toward nothing — better a missing count than a wrong one.
-- branch_id and expires_on stay NULL on old rows: the branch was never stored
-- with the line, and an expiry RE-DERIVED from today's config is exactly what
-- lots.ts forbids (a lot's date is the promise made when it was granted).
--
-- Re-runnable: columns are IF NOT EXISTS, the check is dropped and re-added
-- under the same name, and the backfill only touches rows still NULL.

alter table point_history add column if not exists kind text;
alter table point_history add column if not exists branch_id text;
alter table point_history add column if not exists expires_on text;

alter table point_history drop constraint if exists point_history_expires_on_day;
alter table point_history add constraint point_history_expires_on_day
  check (expires_on is null or expires_on ~ '^\d{4}-\d{2}-\d{2}$');

alter table point_history drop constraint if exists point_history_kind_known;
alter table point_history add constraint point_history_kind_known
  check (kind is null or kind in (
    'purchase', 'redeem', 'return', 'refund', 'expire', 'bonus', 'transfer', 'wallet'
  ));

update point_history set kind = case
    when reason_en in ('Order points', 'In-store purchase points')            then 'purchase'
    when reason_en in ('Points redeemed', 'Paid with points in store')        then 'redeem'
    when reason_en in ('Redemption expired', 'Redemption cancelled',
                       'Points returned: in-store payment voided')            then 'return'
    when reason_en in ('Refunded purchase points',
                       'Partially refunded purchase points')                  then 'refund'
    when reason_en = 'Points expired'                                         then 'expire'
    when reason_en in ('Profile completed', 'Referral reward',
                       'Wallet reload bonus')                                 then 'bonus'
    when reason_en in ('Points sent to a friend', 'Points from a friend')     then 'transfer'
    when reason_en like 'Wallet balance expired (%'
      or reason_en like 'Balance sent to a friend (%'
      or reason_en like 'Balance from a friend (%'                            then 'wallet'
  end
where kind is null;

-- The wallet gets a statement: every wallet line carries the money it moved.
--
-- 🔴 WHY: expert panel, 2026-10-15 — the wallet screen had a balance and
-- nothing under it, «بلا كشف حركات». The wallet is a lot ledger
-- (members.wallet_lots): it knows what is LEFT of each top-up, not what moved.
-- Its lines in point_history carried the amount inside the sentence
-- («تحويل رصيد إلى صديق (-2.500 د.أ)») at 0 points, and a top-up or a payment
-- from the balance wrote no line at all.
--
-- From now on every wallet movement writes a `kind = 'wallet'` line with the
-- money in `delta_fils`, signed (bff/src/memberMoves.ts walletLine):
--   - a top-up, a gift card, a refund, a balance received (+);
--   - a payment from the balance, a balance sent, an expiry (-).
-- The statement is a filter of the one ledger, not a second ledger
-- (packages/shared/src/loyalty/history.ts walletStatement).
--
--   delta_fils  signed fils, a whole number. Set on wallet lines only, never
--               0 (checked below). Points stay in delta_points, which a
--               wallet line holds at 0: fils there would corrupt the sums the
--               points ledger is checked by.
--
-- EXISTING ROWS. The three wallet lines written before this column carried
-- the amount in their English reason, in fixed words, always to the fils:
--   'Wallet balance expired (1.500 JOD)'     →  -1500
--   'Balance sent to a friend (-2.000 JOD)'  →  -2000
--   'Balance from a friend (+2.000 JOD)'     →  +2000
-- Those are read back into delta_fils. A wallet line that matches none stays
-- NULL and is left out of the statement: better a missing line than a wrong
-- amount.
--
-- Re-runnable: the column is IF NOT EXISTS, the check is dropped and re-added
-- under the same name, and the backfill only touches rows still NULL.

alter table point_history add column if not exists delta_fils integer;

update point_history set delta_fils = case
    when reason_en ~ '^Wallet balance expired \(\d+\.\d{3} JOD\)$'
      then -round(substring(reason_en from '\((\d+\.\d{3}) JOD\)')::numeric * 1000)
    when reason_en ~ '^Balance sent to a friend \(-\d+\.\d{3} JOD\)$'
      then -round(substring(reason_en from '\(-(\d+\.\d{3}) JOD\)')::numeric * 1000)
    when reason_en ~ '^Balance from a friend \(\+\d+\.\d{3} JOD\)$'
      then round(substring(reason_en from '\(\+(\d+\.\d{3}) JOD\)')::numeric * 1000)
  end
where kind = 'wallet' and delta_fils is null;

alter table point_history drop constraint if exists point_history_delta_fils_wallet_only;
alter table point_history add constraint point_history_delta_fils_wallet_only
  check (delta_fils is null or (kind = 'wallet' and delta_fils <> 0 and delta_points = 0));

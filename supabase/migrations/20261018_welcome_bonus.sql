-- The welcome gift's once-only stamp.
--
-- 🔴 WHY: owner, 2026-10-15 — «امنح ٢٠٠ نقطة تفعل بعد اول عملية شراء وتنزيل
-- نقاط عالتطبيق»: 200 points (config.WELCOME_BONUS_POINTS) that become the
-- member's on their first PAID purchase — an app order that is paid, or a till
-- sale that collected money and was scanned with their code. The rule is
-- packages/shared/src/loyalty/welcome.ts; the grant is the backend's
-- settleWelcome, in the purchase's own transaction.
--
-- welcome_bonus_at is NULL while the gift is still on offer, and is stamped —
-- with or without points (a corporate member, or a purchase made while the
-- dial is 0, is paid 0) — the moment it is settled, so it is paid once per
-- member, ever. Account deletion does not touch it.
--
-- WHO IS ALREADY SETTLED. A member who had paid before this column existed
-- (first_paid_at is set) has had their first purchase; the gift is for the
-- first purchase, so they are stamped at that moment and not paid
-- retroactively. A member who has never paid — including every Wafii member
-- imported with no first_paid_at — stays NULL and is offered the gift; whether
-- the Wafii import should stamp them instead is the migration's decision (see
-- config.WELCOME_BONUS_POINTS for the cost of each answer).
--
-- Re-runnable: the column is IF NOT EXISTS and the backfill only fills NULLs
-- of members who have paid. (RLS is already on for members — 20260923.)

alter table members add column if not exists welcome_bonus_at timestamptz;

update members set welcome_bonus_at = first_paid_at
 where welcome_bonus_at is null and first_paid_at is not null;

-- OTP ownership proof for referral eligibility. Owner, 2026-10-16: both
-- parties need verified Jordanian mobiles; an inviter has a 500-point
-- LIFETIME referral budget. The cap uses durable referrals.reward_points
-- under the inviter's member row lock, never remaining point lots.
--
-- No backfill: knowing a canonical phone (imports, POS lookup, old sessions)
-- is not proof of OTP verification. Existing members establish this stamp at
-- their next successful OTP sign-in. Auth writes it before issuing a JWT.
-- Account deletion keeps the member/phone and referral rows; therefore it
-- cannot reset either once-per-friend qualification or the lifetime budget.
alter table members add column if not exists phone_verified_at timestamptz;

-- Re-runnable, and no production records are altered by this migration.
-- Application writes remain server-only under the existing members RLS.

-- The referral rail: a stable code per member, one referral per REFERRED
-- account, and the durable "first paid order" stamp the reward is paid on.
--
-- 🔴 WHY: owner, 2026-09-24 — reward the REFERRER only,
-- config.REFERRAL_REWARD_POINTS (50), ONCE PER REFERRED ACCOUNT, triggered by
-- the friend's FIRST PAID order (a funded checkout, or a till sale that
-- collected money) — not at signup. Nothing on the server did this before:
-- the app's referral screen was a device-side mock.
--
--   * members.first_paid_at — when the member's first PAID order was
--     confirmed; NULL until then. A code may be attached only while it is
--     NULL, and the referrer is paid inside the transaction that sets it.
--     BACKFILLED below from what already proves payment: an order with an
--     earn breakdown (only a funded checkout records one) or a till sale that
--     took money — so an existing customer cannot attach a code afterwards.
--   * referral_codes — one code per member (PK member_id) and one member per
--     code (UNIQUE code). Minted on first read, never rotated: a code already
--     shared must keep paying its owner.
--   * referrals — PRIMARY KEY referred_id: one referral per referred account,
--     by construction. rewarded_at + reward_points are the once-only stamp,
--     written together (a CHECK) in the order's transaction; reward_points is
--     0 for a corporate referrer (they earn nothing, loyalty/referral.ts), so a
--     later change of employer never pays retroactively.
--
-- FKs RESTRICT (20260925): deleting a member never deletes a record of what
-- was paid. Closed to Supabase's public API roles like every loyalty table
-- (RLS with no policy; the REVOKE is guarded by pg_roles so the file applies to
-- a plain Postgres too). Re-runnable: every statement is IF NOT EXISTS, a DROP
-- IF EXISTS followed by the same ADD, or an UPDATE that only fills NULLs.

alter table members add column if not exists first_paid_at timestamptz;

update members set first_paid_at = paid.first_at
from (
  select member_id, min(at) as first_at from (
    select member_id, created_at as at from orders where earn_breakdown is not null
    union all
    select member_id, paid_at as at from pos_sales where paid_total > 0
  ) p
  group by member_id
) paid
where members.id = paid.member_id and members.first_paid_at is null;

create table if not exists referral_codes (
  member_id   text primary key references members(id) on delete restrict,
  code        text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  created_at  timestamptz not null default now()
);

create table if not exists referrals (
  referred_id    text primary key references members(id) on delete restrict,
  referrer_id    text not null references members(id) on delete restrict,
  code           text not null references referral_codes(code) on delete restrict,
  attached_at    timestamptz not null default now(),
  rewarded_at    timestamptz,
  reward_points  int check (reward_points >= 0),
  constraint referrals_not_self check (referrer_id <> referred_id),
  constraint referrals_reward_complete check ((rewarded_at is null) = (reward_points is null))
);

create index if not exists referrals_referrer_idx on referrals (referrer_id);

alter table referral_codes enable row level security;
alter table referrals enable row level security;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on table referral_codes from %I', r);
      execute format('revoke all on table referrals from %I', r);
    end if;
  end loop;
end
$$;

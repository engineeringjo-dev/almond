-- The loyalty BFF's durable store.
--
-- 🔴 WHY THE LEDGERS ARE jsonb AND NOT TABLES, WHICH IS THE ONE DECISION HERE
-- WORTH ARGUING WITH.
--
-- A member's points live in `lots`: one row per grant, each with its own
-- twelve-month clock, spent oldest-first, never renewed by a later purchase.
-- All of that arithmetic already exists, is pure, and is covered by tests —
-- @almond/shared/loyalty/lots.ts (grantLot, consumeFifo, liveBalance) and the
-- rolling window in loyalty/window.ts.
--
-- Normalising lots into their own table would mean expressing FIFO consumption
-- and expiry a SECOND time, in SQL, against the same rules. This repository has
-- paid for that mistake more than once: an app that computed points beside the
-- server, a mock that invented a voucher rail the server did not have, an
-- `isDrink` flag that disagreed with the classifier. Two implementations of one
-- rule diverge; the only question is when.
--
-- So the rule stays in TypeScript and Postgres stores the RESULT. Mutations
-- read the member `FOR UPDATE`, run the shared function, and write the array
-- back inside the transaction — so the read-modify-write is atomic even though
-- the arithmetic is not SQL.
--
-- What IS normalised is everything with its own identity and its own queries:
-- history lines, orders, redemptions, the corporate register. Those are read
-- across members, and a dashboard should not have to unpack a member document
-- to count yesterday's redemptions.

create table if not exists members (
  id                            text primary key,
  phone                         text not null unique,
  name                          text not null default '',
  birthday                      text,
  -- The once-only stamp that stops the profile bonus being a mint. NOT derived
  -- from "does this member have a name": the Wafii import carries a name for
  -- all 47,720 members and must be able to mark them settled without paying
  -- 0.500 JOD each — see shared/loyalty/profile.ts migratedProfileBonusAt.
  profile_bonus_at              timestamptz,
  lots                          jsonb not null default '[]'::jsonb,
  expiry_settled_through        text  not null default '',
  wallet_lots                   jsonb not null default '[]'::jsonb,
  wallet_expiry_settled_through text  not null default '',
  spend                         jsonb not null default '[]'::jsonb,
  held_tier_id                  text  not null,
  evaluated_through             text  not null default '',
  sub_renews_at                 bigint not null default 0,
  sub_day                       text  not null default '',
  sub_day_count                 int   not null default 0,
  created_at                    timestamptz not null default now()
);

-- The points ledger as the member reads it. `unexplainedPoints` is
-- liveBalance − Σ(delta), so a missing line here is a silent discrepancy.
create table if not exists point_history (
  id          bigserial primary key,
  member_id   text not null references members(id) on delete cascade,
  delta_points int not null,
  reason_ar   text not null,
  reason_en   text not null,
  created_at  timestamptz not null default now()
);
create index if not exists point_history_member_idx
  on point_history (member_id, created_at desc);

create table if not exists orders (
  id              text primary key,
  member_id       text not null references members(id) on delete cascade,
  branch_id       text not null,
  order_type      text not null,
  payment_method  text not null,
  total           numeric(12,3) not null,
  -- The whole earn breakdown, so a grant can be re-derived after the fact
  -- rather than trusted. Null until recordEarnBreakdown runs.
  earn_breakdown  jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists orders_member_idx on orders (member_id, created_at desc);
create index if not exists orders_created_idx on orders (created_at desc);

-- One row per member: the storage model is singular, and the route is
-- /v1/me/voucher for exactly that reason.
create table if not exists second_visit_vouchers (
  member_id    text primary key references members(id) on delete cascade,
  outcome      text not null,
  arm          text not null,
  issued_at    timestamptz,
  expires_at   timestamptz,
  redeemed_at  timestamptz,
  evaluated_at timestamptz not null default now()
);

create table if not exists redemptions (
  id           text primary key,
  member_id    text not null references members(id) on delete cascade,
  -- Unique because a collision would hand one member another's code. The
  -- generator already retries on collision; this is the guarantee behind it.
  code         text not null unique,
  points       int not null check (points > 0),
  value_jod    numeric(12,3) not null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  settled_at   timestamptz,
  settled_via  text,
  cancelled_at timestamptz
);
-- The sweep asks "which of this member's codes died unused" on every read, so
-- it must not scan the table.
create index if not exists redemptions_open_idx
  on redemptions (member_id, expires_at)
  where settled_at is null and cancelled_at is null;

-- ---- The corporate register --------------------------------------------
-- Odoo cannot hold this: measured on the live instance, 0 of 1,630 partners is
-- linked to any discount pricelist and only 57 carry a phone number at all.

create table if not exists companies (
  id          text primary key,
  name_ar     text not null default '',
  name_en     text not null default '',
  -- A percentage, 1-100. The database refuses what the code refuses: a
  -- discount over 100% would owe the customer money.
  percent_off numeric(5,2) not null check (percent_off > 0 and percent_off <= 100),
  active      boolean not null default true
);

-- Keyed by PHONE, not by member: a company's roster is uploaded before those
-- people have ever opened the app, and the discount must work on their first
-- visit. The phone is canonical +9627XXXXXXXX — one normaliser, shared with
-- sign-in, so the roster and the login cannot disagree by a leading zero.
create table if not exists corporate_roster (
  phone      text primary key,
  company_id text not null references companies(id) on delete cascade,
  name       text
);
create index if not exists corporate_roster_company_idx on corporate_roster (company_id);

create table if not exists corporate_uses (
  id           text primary key,
  member_id    text not null references members(id) on delete cascade,
  company_id   text not null references companies(id) on delete cascade,
  phone        text not null,
  used_at      timestamptz not null default now(),
  order_id     text,
  items        jsonb not null default '[]'::jsonb,
  -- The rate that ACTUALLY applied, stored rather than joined: a company's
  -- percentage changes, and re-reading today's against last month's uses would
  -- rewrite history.
  percent_off  numeric(5,2) not null,
  discount_jod numeric(12,3) not null
);
create index if not exists corporate_uses_company_idx on corporate_uses (company_id, used_at desc);
create index if not exists corporate_uses_member_idx on corporate_uses (member_id, used_at desc);

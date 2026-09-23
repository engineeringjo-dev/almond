-- Card payments: one row per payment a member started through the gateway.
--
-- 🔴 WHY: a card order used to be written with nothing behind it — no route
-- captured a card — and plugins/funding.ts therefore could not pay points on
-- it. The owner's rule (2026-09-23, «اوافق النقاط بعد تاكيد الدفع») is that a
-- card order earns once the payment is CONFIRMED. This table is what confirms
-- it: POST /v1/payments/intent writes the row, the gateway captures, and
-- /v1/checkout places the card order ONLY against a row that
--
--   * belongs to the member placing the order            (member_id),
--   * is for exactly the server's re-priced total        (amount_fils),
--   * is for exactly this basket                         (cart_hash),
--   * the provider confirms captured                     (asked at checkout),
--   * and has not paid for another order    (orders.payment_intent_id UNIQUE,
--                                             payment_intents.order_id UNIQUE).
--
-- The last one is the database's job, not the code's: both are written inside
-- Backend.checkout's single transaction, and the two UNIQUEs mean one captured
-- payment funds one order and one order is funded by one payment, whatever two
-- concurrent requests try.
--
-- amount_fils is an integer number of fils (1 JOD = 1000) — never a float.
-- (provider, provider_ref) is unique: a gateway's id names one payment.
--
-- member_id → members and order_id → orders are ON DELETE RESTRICT, like every
-- table that records money (20260925_restrict_financial_history.sql).
--
-- Closed to Supabase's public API roles (RLS, no policy; guarded REVOKE), like
-- every loyalty table. Re-runnable.

create table if not exists payment_intents (
  id           text primary key check (char_length(id) between 1 and 64),
  member_id    text not null references members(id) on delete restrict,
  amount_fils  bigint not null check (amount_fils > 0),
  currency     text not null check (currency = 'JOD'),
  cart_hash    text not null,
  provider     text not null,
  provider_ref text not null,
  status       text not null default 'pending' check (status in ('pending', 'captured', 'failed')),
  capture_ref  text,
  order_id     text unique references orders(id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint payment_intents_provider_ref_key unique (provider, provider_ref),
  -- A payment that paid for an order was captured.
  constraint payment_intents_spent_is_captured check (order_id is null or status = 'captured')
);

create index if not exists payment_intents_member_idx on payment_intents (member_id, created_at desc);

-- 🔴 ONE PAYMENT, ONE ORDER — BY THE DATABASE, FROM THE ORDER'S SIDE TOO.
-- payment_intents.order_id UNIQUE stops two payments claiming one order; it
-- cannot stop one payment being re-pointed at a second order. This can: every
-- card order names the payment it spent, and no two orders may name the same
-- one. The code checks under a row lock first; this is the guarantee beneath
-- it, whatever a future code path forgets. (20260909 is never edited — this is
-- an additive, nullable column: every existing order keeps NULL.)
alter table orders add column if not exists payment_intent_id text;
create unique index if not exists orders_payment_intent_uidx on orders (payment_intent_id);
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'orders'::regclass and conname = 'orders_payment_intent_id_fkey'
  ) then
    alter table orders add constraint orders_payment_intent_id_fkey
      foreign key (payment_intent_id) references payment_intents(id) on delete restrict;
  end if;
end
$$;

alter table payment_intents enable row level security;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on table payment_intents from %I', r);
    end if;
  end loop;
end
$$;

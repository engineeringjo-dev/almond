-- Durable Idempotency-Keys for the loyalty BFF's financial POSTs.
--
-- 🔴 WHY: the keys lived in a per-process Map (bff/src/plugins/idempotency.ts).
-- The money was durable and the memory of which request had already moved it
-- was not. A member redeems with key K, the process dies before the phone reads
-- the 201 (a deploy, an OOM), the phone retries with K — exactly what the key is
-- for — and the new process, holding an empty Map, spends the points AGAIN and
-- mints a second code. Two instances behind a load balancer did the same with
-- no restart at all (bff/test/resilience-restart.test.ts R2.6).
--
-- One row per (member, key):
--   * request_hash binds the key to ONE request (method, route, canonical
--     body). The same key with a different body is refused, not replayed.
--   * status 'pending' is written BEFORE the request runs and is never re-run:
--     a pending row whose process died may already have moved money, so it
--     answers 409 request_in_progress until it expires.
--   * response_code/response_body are the exact bytes of the first answer,
--     replayed verbatim. TEXT, not jsonb, on purpose: jsonb reorders object
--     keys, so a replay would differ byte-for-byte from the original — and
--     from what the in-memory backend replays. The body is only ever replayed,
--     never queried.
--   * created_at drives the 24-hour expiry. It is enforced when a key is READ
--     (an expired row is re-claimed as new) and old rows are swept for space.
--
-- member_id has NO foreign key on purpose: the key is claimed before the route
-- has looked the member up, and an FK would turn a 404 for an unknown member
-- into a 500. Nothing reads these rows but the BFF, keyed by member.
--
-- Re-runnable: every statement is IF NOT EXISTS or a no-op on a second run.

create table if not exists idempotency_keys (
  member_id     text not null,
  idem_key      text not null check (char_length(idem_key) between 1 and 128),
  request_hash  text not null,
  status        text not null check (status in ('pending', 'done')),
  response_code int,
  response_body text,
  created_at    timestamptz not null default now(),
  primary key (member_id, idem_key),
  -- A finished key always carries the answer it replays; a pending one never
  -- does. A 'done' row with no body would replay an empty 200.
  check ((status = 'done') = (response_code is not null and response_body is not null))
);

-- The sweep deletes by age.
create index if not exists idempotency_keys_created_idx on idempotency_keys (created_at);

-- Closed to Supabase's public API roles, exactly like 20260923_loyalty_rls.sql:
-- a stored response body carries balances and redemption codes. RLS with no
-- policy denies every non-owner role; the BFF connects as the owner.
alter table idempotency_keys enable row level security;

-- The REVOKE is guarded so the same file also applies to a plain Postgres (the
-- test harnesses, a self-hosted instance) where Supabase's roles do not exist.
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on table idempotency_keys from %I', r);
    end if;
  end loop;
end
$$;

-- Close the loyalty tables to Supabase's public API roles.
--
-- 🔴 WHY: Supabase serves every table in `public` at /rest/v1/<table>, and its
-- default privileges grant ALL on new tables to `anon` and `authenticated`. The
-- anon key ships inside the public app bundle. 20260909_loyalty_backend.sql
-- enabled Row Level Security on none of its eight tables, so as deployed anyone
-- holding that key could read every member's phone and balance and PATCH
-- `members.lots` — i.e. print points (bff/test/migration.test.ts R3.6).
--
-- The BFF is the only client of these tables. It connects as the database
-- owner through DATABASE_URL, which RLS does not restrict, so it needs neither
-- grant. Nothing legitimate reads them over PostgREST: enabling RLS with NO
-- policies means "deny all" to every non-owner role, and the REVOKE removes the
-- grants as well, so the tables disappear from the REST API's reach twice over.
--
-- If a future screen needs to read one of these tables directly from a client,
-- the answer is a narrow policy written for that screen — never re-granting the
-- table.
--
-- Re-runnable: ENABLE on an already-enabled table and REVOKE of an absent grant
-- are both no-ops.

alter table members               enable row level security;
alter table point_history         enable row level security;
alter table orders                enable row level security;
alter table second_visit_vouchers enable row level security;
alter table redemptions           enable row level security;
alter table companies             enable row level security;
alter table corporate_roster      enable row level security;
alter table corporate_uses        enable row level security;

-- Guarded by pg_roles: `anon` and `authenticated` exist only on Supabase. A
-- bare `REVOKE … FROM anon` aborts this whole migration on any other Postgres
-- (found by applying it to a plain PG16 for the load test) — and on such a
-- server there is no PostgREST role to revoke from, so skipping is correct.
-- point_history.id is a bigserial: its sequence was default-granted too.
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format(
        'revoke all on table members, point_history, orders, second_visit_vouchers,
           redemptions, companies, corporate_roster, corporate_uses from %I', r);
      execute format('revoke all on sequence point_history_id_seq from %I', r);
    end if;
  end loop;
end
$$;

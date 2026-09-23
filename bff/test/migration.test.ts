import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import { createPostgresBackend } from '../src/backend/postgres';
import { fromPglite } from '../src/backend/db';

/**
 * R3 — THE MIGRATION supabase/migrations/20260909_loyalty_backend.sql.
 *
 * What a deploy needs from it: (a) it applies to an empty database; (b) running
 * it again — a retried deploy, a second environment bootstrapped from the same
 * folder — does not break; (c) every table and column postgres.ts touches
 * exists, DERIVED FROM postgres.ts's own SQL so a new column cannot be added to
 * the code and forgotten here; (d) the constraints the money rests on exist
 * and actually refuse.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = readFileSync(
  join(HERE, '..', '..', 'supabase', 'migrations', '20260909_loyalty_backend.sql'), 'utf8',
);
const RLS_MIGRATION = readFileSync(
  join(HERE, '..', '..', 'supabase', 'migrations', '20260923_loyalty_rls.sql'), 'utf8',
);
const POSTGRES_TS = readFileSync(join(HERE, '..', 'src', 'backend', 'postgres.ts'), 'utf8');
const PG_URL = process.env.ALMOND_TEST_PG_URL;

const TABLES = [
  'members', 'point_history', 'orders', 'second_visit_vouchers', 'redemptions',
  'companies', 'corporate_roster', 'corporate_uses',
];

async function fresh(): Promise<PGlite> {
  const pg = new PGlite();
  await pg.waitReady;
  return pg;
}
const rows = async <T>(pg: PGlite, sql: string, p: unknown[] = []) => (await pg.query<T>(sql, p)).rows;

/** The migration's statements, comments removed. */
function statements(sql: string): string[] {
  return sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/**
 * table → columns, read out of postgres.ts's SQL. Every statement there names
 * exactly one table (there are no joins), so each identifier in a statement is
 * attributed to that statement's table.
 */
function columnsUsedByPostgresTs(): Map<string, Set<string>> {
  const KEYWORDS = new Set([
    'select', 'from', 'where', 'and', 'or', 'for', 'update', 'insert', 'into', 'values', 'set',
    'returning', 'order', 'by', 'desc', 'asc', 'limit', 'is', 'null', 'not', 'on', 'conflict', 'do',
    'nothing', 'excluded', 'coalesce', 'count', 'sum', 'text', 'delete', 'as', 'n',
  ]);
  const used = new Map<string, Set<string>>();
  const add = (t: string, c: string) => { if (!used.has(t)) used.set(t, new Set()); used.get(t)!.add(c); };
  const literals = POSTGRES_TS.match(/`[^`]*`|'[^'\n]*'/g) ?? [];
  for (const lit of literals) {
    // Interpolations are code, not SQL — including one the nested-backtick
    // split leaves unclosed (listCorporateUses' `${where.length ? `…`}`).
    const sql = lit.slice(1, -1).replace(/\$\{[^}]*\}/g, ' ').replace(/\$\{[^}]*$/, ' ').toLowerCase();
    if (!/^\s*(select|insert|update|delete)\b/.test(sql)) continue;
    const table = /(?:\bfrom|\binto|^\s*update)\s+([a-z_]+)/.exec(sql)?.[1];
    if (!table) throw new Error(`could not find the table in: ${sql}`);
    add(table, '*');
    for (const id of sql.match(/[a-z_][a-z0-9_]*/g) ?? []) {
      if (!KEYWORDS.has(id) && id !== table) add(table, id);
    }
  }
  // listCorporateUses builds its WHERE from fragments: add('company_id = ?', …).
  for (const m of POSTGRES_TS.matchAll(/add\('([a-z_]+) [<>=]+ \?'/g)) add('corporate_uses', m[1]);
  return used;
}

describe('R3 migration 20260909_loyalty_backend.sql', () => {
  it('R3.1 applies cleanly to an empty database and creates all eight tables', async () => {
    const pg = await fresh();
    await pg.exec(MIGRATION);
    const got = await rows<{ table_name: string }>(pg,
      `select table_name from information_schema.tables where table_schema = 'public' order by 1`);
    expect(got.map((r) => r.table_name).sort()).toEqual([...TABLES].sort());
  });

  it('R3.2 re-applying is IDEMPOTENT: every CREATE is IF NOT EXISTS, and a second run changes nothing', async () => {
    const creates = statements(MIGRATION).filter((s) => /^create /i.test(s));
    expect(creates.length).toBe(15);                          // 8 tables + 7 indexes
    for (const s of creates) expect(s, s.slice(0, 60)).toMatch(/^create (table|index) if not exists /i);
    expect(statements(MIGRATION).every((s) => /^create /i.test(s)), 'only CREATEs — no ALTER/DROP/INSERT').toBe(true);

    const pg = await fresh();
    await pg.exec(MIGRATION);
    const b = createPostgresBackend(fromPglite(pg));
    const m = await b.findOrCreateByPhone('+962791234567', 'حمزة');
    await b.addPoints(m.id, 250, 'منحة', 'Grant');
    const schemaBefore = await rows(pg, `select table_name, column_name, data_type, is_nullable, column_default
      from information_schema.columns where table_schema = 'public' order by 1, 2`);

    await pg.exec(MIGRATION);                                 // the retried deploy
    await pg.exec(MIGRATION);                                 // …and once more for luck

    expect(await rows(pg, `select table_name, column_name, data_type, is_nullable, column_default
      from information_schema.columns where table_schema = 'public' order by 1, 2`)).toEqual(schemaBefore);
    expect((await b.getMember(m.id)).name).toBe('حمزة');       // data untouched
    expect((await b.getHistory(m.id))[0].deltaPoints).toBe(250);
  });

  it('R3.3 every table and column postgres.ts uses exists (derived from its SQL)', async () => {
    const pg = await fresh();
    await pg.exec(MIGRATION);
    const cols = await rows<{ table_name: string; column_name: string }>(pg,
      `select table_name, column_name from information_schema.columns where table_schema = 'public'`);
    const have = new Map<string, Set<string>>();
    for (const c of cols) {
      if (!have.has(c.table_name)) have.set(c.table_name, new Set());
      have.get(c.table_name)!.add(c.column_name);
    }
    const used = columnsUsedByPostgresTs();
    // The derivation must SEE the code, or this test passes on nothing.
    expect([...used.keys()].sort()).toEqual([...TABLES].sort());
    expect([...used.values()].reduce((n, s) => n + s.size, 0)).toBeGreaterThan(60);

    const missing: string[] = [];
    for (const [t, cs] of used) {
      if (!have.has(t)) { missing.push(`${t} (table)`); continue; }
      for (const c of cs) if (c !== '*' && !have.get(t)!.has(c)) missing.push(`${t}.${c}`);
    }
    expect(missing).toEqual([]);

    // The row readers (`r.column`, MemberRow's fields) read columns too.
    const read = new Set<string>();
    for (const m of POSTGRES_TS.matchAll(/\br\.([a-z_]+)/g)) read.add(m[1]);
    const iface = /interface MemberRow \{([\s\S]*?)\n\}/.exec(POSTGRES_TS)![1];
    for (const m of iface.matchAll(/([a-z_]+)\s*:/g)) {
      read.add(m[1]);
      expect(have.get('members')!.has(m[1]), `members.${m[1]} (MemberRow)`).toBe(true);
    }
    const everywhere = new Set(cols.map((c) => c.column_name));
    expect([...read].filter((c) => !everywhere.has(c))).toEqual([]);
  });

  it('R3.4 the constraints the money rests on exist', async () => {
    const pg = await fresh();
    await pg.exec(MIGRATION);
    const cons = await rows<{ tbl: string; type: string; def: string }>(pg, `
      select c.conrelid::regclass::text as tbl, c.contype as type, pg_get_constraintdef(c.oid) as def
      from pg_constraint c join pg_namespace n on n.oid = c.connamespace
      where n.nspname = 'public' order by 1, 2, 3`);
    const has = (tbl: string, type: string, def: RegExp) =>
      cons.some((c) => c.tbl === tbl && c.type === type && def.test(c.def));

    for (const t of TABLES) expect(has(t, 'p', /^PRIMARY KEY/), `${t} primary key`).toBe(true);
    expect(has('members', 'p', /\(id\)/)).toBe(true);
    expect(has('members', 'u', /^UNIQUE \(phone\)$/), 'members.phone unique').toBe(true);
    expect(has('redemptions', 'u', /^UNIQUE \(code\)$/), 'redemptions.code unique').toBe(true);
    expect(has('second_visit_vouchers', 'p', /\(member_id\)/), 'one voucher row per member').toBe(true);
    expect(has('corporate_roster', 'p', /\(phone\)/), 'one company per phone').toBe(true);
    for (const t of ['point_history', 'orders', 'second_visit_vouchers', 'redemptions', 'corporate_uses']) {
      expect(has(t, 'f', /^FOREIGN KEY \(member_id\) REFERENCES members\(id\)/), `${t}.member_id → members`).toBe(true);
    }
    for (const t of ['corporate_roster', 'corporate_uses']) {
      expect(has(t, 'f', /^FOREIGN KEY \(company_id\) REFERENCES companies\(id\)/), `${t}.company_id → companies`).toBe(true);
    }
    expect(has('redemptions', 'c', /points > 0/), 'redemption points positive').toBe(true);
    expect(has('companies', 'c', /percent_off > .*percent_off <= /), 'discount within (0, 100]').toBe(true);
  });

  it('R3.5 …and they actually refuse', async () => {
    const pg = await fresh();
    await pg.exec(MIGRATION);
    const code = async (sql: string, p: unknown[] = []) => {
      try { await pg.query(sql, p); return 'ok'; } catch (e) { return (e as { code?: string }).code; }
    };
    const member = (id: string, phone: string) => code(
      `insert into members (id, phone, held_tier_id) values ($1, $2, 'base')`, [id, phone]);
    expect(await member('m1', '+962791111111')).toBe('ok');
    expect(await member('m2', '+962791111111')).toBe('23505');                 // one phone, one member
    expect(await member('m1', '+962792222222')).toBe('23505');                 // one id, one member
    expect(await code(`insert into point_history (member_id, delta_points, reason_ar, reason_en)
      values ('ghost', 10, 'x', 'x')`)).toBe('23503');                        // no orphan ledger lines
    const redemption = (id: string, codeV: string, pts: number) => code(
      `insert into redemptions (id, member_id, code, points, value_jod, expires_at)
       values ($1, 'm1', $2, $3, 1, now())`, [id, codeV, pts]);
    expect(await redemption('r1', 'ABCD2345', 100)).toBe('ok');
    expect(await redemption('r2', 'ABCD2345', 100)).toBe('23505');             // codes never shared
    expect(await redemption('r3', 'WXYZ2345', 0)).toBe('23514');               // no zero-point code
    expect(await code(`insert into companies (id, percent_off) values ('c', 150)`)).toBe('23514');
    expect(await code(`insert into corporate_roster (phone, company_id) values ('+962793333333', 'nope')`)).toBe('23503');
  });

  /**
   * 🔴 KNOWN GAP, PINNED — this test asserts the CURRENT, UNSAFE state so that
   * it cannot pass for the wrong reason, and goes RED the day the migration is
   * patched (the patch is proposed in the hand-over report; supabase/ is owned
   * elsewhere). When it goes red: replace the expectation with `[]`.
   *
   * On Supabase, every table created in `public` is granted to the `anon` and
   * `authenticated` roles by the project's default privileges, and PostgREST
   * serves it at /rest/v1/<table> with the anon key that ships inside the app
   * bundle. This migration enables Row Level Security on NONE of its eight
   * tables, so as deployed anyone holding the public anon key could read every
   * member's phone and balance and PATCH `members.lots` — i.e. print points.
   * The BFF connects as the database owner and needs neither grant.
   *
   * Reproduced here by recreating Supabase's default privileges on PGlite.
   * The proposed patch (ENABLE ROW LEVEL SECURITY + REVOKE from anon,
   * authenticated on all eight) was verified to bring this list to empty, and
   * to be re-runnable.
   */
  async function withSupabaseDefaults(): Promise<PGlite> {
    const pg = await fresh();
    await pg.exec(`
      create role anon nologin; create role authenticated nologin;
      alter default privileges in schema public grant all on tables to anon, authenticated;
      alter default privileges in schema public grant all on sequences to anon, authenticated;`);
    return pg;
  }
  /** Tables an API role can reach at all: any privilege, or RLS off. */
  const reachable = (pg: PGlite, role: string) => rows<{ t: string }>(pg, `
      select c.relname as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and (not c.relrowsecurity
             or has_table_privilege('${role}', c.oid, 'select')
             or has_table_privilege('${role}', c.oid, 'insert')
             or has_table_privilege('${role}', c.oid, 'update')
             or has_table_privilege('${role}', c.oid, 'delete'))
      order by 1`);

  it('R3.6 the base migration ALONE leaves all eight tables open to `anon` (why 20260923 exists)', async () => {
    const pg = await withSupabaseDefaults();
    await pg.exec(MIGRATION);
    expect((await reachable(pg, 'anon')).map((r) => r.t)).toEqual([...TABLES].sort());
  });

  it('R3.6b with 20260923_loyalty_rls.sql applied, `anon` and `authenticated` reach NO loyalty table', async () => {
    const pg = await withSupabaseDefaults();
    await pg.exec(MIGRATION);
    await pg.exec(RLS_MIGRATION);
    expect(await reachable(pg, 'anon')).toEqual([]);
    expect(await reachable(pg, 'authenticated')).toEqual([]);
    const seq = await rows<{ ok: boolean }>(pg,
      `select has_sequence_privilege('anon', 'point_history_id_seq', 'usage') as ok`);
    expect(seq[0].ok).toBe(false);
  });

  it('R3.6c the RLS migration is re-runnable and does not touch the owner', async () => {
    const pg = await withSupabaseDefaults();
    await pg.exec(MIGRATION);
    await pg.exec(RLS_MIGRATION);
    await pg.exec(RLS_MIGRATION);
    // The owner (the BFF's DATABASE_URL role) still reads and writes.
    await pg.query(`insert into companies (id, name_ar, name_en, percent_off) values ('c1', 'أ', 'A', 10)`);
    expect((await rows<{ n: number }>(pg, `select count(*)::int as n from companies`))[0].n).toBe(1);
  });

  it.skipIf(!PG_URL)('R3.7 real Postgres: applies to an empty database, and re-applies idempotently', async () => {
    const admin = new Pool({ connectionString: PG_URL, max: 1 });
    const name = `mig_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    await admin.query(`create database ${name}`);
    const url = new URL(PG_URL!);
    url.pathname = `/${name}`;
    const pool = new Pool({ connectionString: url.toString(), max: 1 });
    try {
      await pool.query(MIGRATION);
      await pool.query(MIGRATION);
      const { rows: t } = await pool.query(
        `select count(*)::int as n from information_schema.tables where table_schema = 'public'`);
      expect(t[0].n).toBe(8);
    } finally {
      await pool.end();
      await admin.query(`drop database if exists ${name}`);
      await admin.end();
    }
  });
});

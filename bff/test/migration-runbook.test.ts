import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOYALTY_MIGRATIONS, MIGRATIONS_DIR } from './lib/schema';

/**
 * THE MIGRATION RUNBOOK MATCHES THE MIGRATIONS THE TESTS APPLY.
 *
 * A deploy follows the written list, not the test fixture. On b12f730f the
 * runbook in docs/HANDOVER.md §4.2 and the DATABASE_URL comment in
 * bff/.env.example stopped at 20261019 and never named the three 20261016160…
 * files, so following them to the letter created the member and then failed
 * every sign-in on `members.phone_verified_at` (review 2026-10-19, item 3:
 * «دليل الترحيلات لا يذكر الترحيلات الثلاث، واتّباعه يكسر كل تسجيل دخول»).
 *
 * Both written lists are read here and held to LOYALTY_MIGRATIONS, the list
 * every PGlite/Postgres suite builds its schema from, so a migration added to
 * one and not the others fails the bff suite.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const HANDOVER = readFileSync(join(REPO, 'docs', 'HANDOVER.md'), 'utf8');
const ENV_EXAMPLE = readFileSync(join(REPO, 'bff', '.env.example'), 'utf8');

/** Supabase-only, so LOYALTY_MIGRATIONS leaves it out (lib/schema.ts); a real
 *  deploy applies it right after the base schema whose tables it closes. */
const RLS = '20260923_loyalty_rls.sql';
/** In supabase/migrations but for the branch-management database, never the
 *  loyalty one (HANDOVER §4.2 «تنبيه»). */
const BRANCH_SYSTEM = [
  '20260807_recalc_open_order_lines.sql',
  '20260808_lock_down_rpc.sql',
  '20260810_branch_geo.sql',
];
/** The three files PR #103 added. The server writes their columns, so they go
 *  in before it is deployed, and there is no way back from them. */
const SERVER_REQUIRED = [
  '20261016160147_referral_security.sql',
  '20261016160212_redemption_slices.sql',
  '20261016160234_purchase_points_recovery.sql',
];
/** One-way: once applied, the BFF is never rolled back to a build older than
 *  them. PR #103's three (the reversal check refuses an older build), and the
 *  points-owed column: an older build writes every paying line with 0, so the
 *  lines no longer add up to members.purchase_points_debt and the next
 *  deduction names a refund already paid (reviewers, 2026-10-20). */
const ONE_WAY = [...SERVER_REQUIRED, '20261019200000_points_owed_lines.sql'];

const DEPLOY_ORDER = [LOYALTY_MIGRATIONS[0], RLS, ...LOYALTY_MIGRATIONS.slice(1)];
const stem = (file: string) => file.slice(0, file.indexOf('_'));
/** HANDOVER §4.2: «الاثنتا عشرة الأخيرة (من 20261001 إلى 20261019200000)
 *  تُطبَّق قبل نشر الخادم الذي يكتبها». Every file from 20261001 on, so a
 *  file added later is held to it too. */
const BEFORE_SERVER = DEPLOY_ORDER.filter((file) => stem(file) >= '20261001');

/** HANDOVER §4.2, from its heading to the next one. */
function runbookSection(): string {
  const start = HANDOVER.indexOf('### ٤.٢');
  const end = HANDOVER.indexOf('### ٤.٣', start);
  expect(start, 'HANDOVER.md has a §4.2 heading').toBeGreaterThan(-1);
  expect(end, 'HANDOVER.md has a §4.3 heading after §4.2').toBeGreaterThan(start);
  return HANDOVER.slice(start, end);
}

/** Table rows of §4.2, keyed by file: `| \`<file>.sql\` | … |`. */
function runbookRows(): Map<string, string> {
  const rows = new Map<string, string>();
  for (const line of runbookSection().split('\n')) {
    const m = /^\| `(\d+_[a-z0-9_]+\.sql)` \|/.exec(line);
    if (m) rows.set(m[1], line);
  }
  return rows;
}

/** The DATABASE_URL comment's list: `#   <file>.sql   ← …`. */
function envRows(): Map<string, string> {
  const rows = new Map<string, string>();
  for (const line of ENV_EXAMPLE.split('\n')) {
    const m = /^#\s+(\d+_[a-z0-9_]+\.sql)\b/.exec(line);
    if (m) rows.set(m[1], line);
  }
  return rows;
}

describe('the migration runbook (HANDOVER §4.2, bff/.env.example) = LOYALTY_MIGRATIONS', () => {
  it('RB1 — the deploy order is the base schema, the RLS file, then LOYALTY_MIGRATIONS', () => {
    expect(LOYALTY_MIGRATIONS[0]).toBe('20260909_loyalty_backend.sql');
    expect(LOYALTY_MIGRATIONS).not.toContain(RLS);
    for (const file of SERVER_REQUIRED) expect(LOYALTY_MIGRATIONS).toContain(file);
  });

  it('RB2 — every .sql in supabase/migrations is either deployed to loyalty or named as another system’s', () => {
    const onDisk = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
    expect(onDisk).toEqual([...BRANCH_SYSTEM, ...DEPLOY_ORDER].sort());
  });

  it('RB3 — the §4.2 table lists every loyalty migration, in deploy order', () => {
    expect([...runbookRows().keys()]).toEqual(DEPLOY_ORDER);
  });

  it('RB4 — the §4.2 «الترتيب» line names the same files, in the same order', () => {
    const line = runbookSection().split('\n').find((l) => l.startsWith('**الترتيب:**'));
    expect(line, '§4.2 has a «**الترتيب:**» line').toBeDefined();
    const stems = [...(line ?? '').matchAll(/`(\d{8,14})`/g)].map((m) => m[1]);
    expect(stems).toEqual(DEPLOY_ORDER.map(stem));
  });

  it('RB5 — the DATABASE_URL comment in bff/.env.example lists the same files, in the same order', () => {
    expect([...envRows().keys()]).toEqual(DEPLOY_ORDER);
  });

  it('RB6 — both lists mark every migration the server writes (20261001 on) as before the server deploy', () => {
    // Reviewers, 2026-10-20: this check covered only PR #103's three files, so
    // the marker on 20261019200000 (every history line writes
    // point_history.points_owed_change) could be deleted with every test green.
    const rows = runbookRows();
    const env = envRows();
    expect(BEFORE_SERVER, '«الاثنتا عشرة الأخيرة»').toHaveLength(12);
    expect(BEFORE_SERVER.at(-1)).toBe('20261019200000_points_owed_lines.sql');
    for (const file of BEFORE_SERVER) {
      expect(rows.get(file) ?? '', `HANDOVER §4.2 row for ${file}`).toContain('قبل نشر الخادم');
      expect(env.get(file) ?? '', `.env.example line for ${file}`).toContain('BEFORE deploying this BFF');
    }
  });

  it('RB7 — both lists mark the one-way files one-way, and no other file', () => {
    const rows = runbookRows();
    const env = envRows();
    for (const file of DEPLOY_ORDER) {
      const oneWay = ONE_WAY.includes(file);
      const row = rows.get(file) ?? '';
      const line = env.get(file) ?? '';
      // «ليس باتجاه واحد» would read as one-way to a substring check, and is
      // the claim the reviewers found wrong on 20261019200000.
      expect(row, `HANDOVER §4.2 row for ${file}`).not.toContain('ليس باتجاه واحد');
      expect(row.includes('باتجاه واحد'), `HANDOVER §4.2 row for ${file}: one-way = ${oneWay}`).toBe(oneWay);
      expect(line.includes('one-way'), `.env.example line for ${file}: one-way = ${oneWay}`).toBe(oneWay);
    }
  });
});

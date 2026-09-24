import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The loyalty schema as a deploy builds it: the migrations, IN ORDER, read from
 * supabase/migrations — never a copy kept beside the tests.
 *
 * 20260923_loyalty_rls.sql is deliberately not in this list: it REVOKEs from
 * Supabase's `anon`/`authenticated` roles, which a plain Postgres does not have.
 * migration.test.ts applies it on a database that recreates those roles.
 */
export const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'supabase', 'migrations',
);

export const LOYALTY_MIGRATIONS = [
  '20260909_loyalty_backend.sql',
  '20260924_idempotency_keys.sql',
  '20260925_restrict_financial_history.sql',
  '20260926_pos_sales.sql',
  '20260927_payment_intents.sql',
  '20260928_drop_members_plan_columns.sql',
  '20260929_pos_point_spends.sql',
  '20260930_pos_sale_refunds.sql',
  '20261001_referrals.sql',
  '20261002_member_transfers.sql',
  '20261003_member_profile_fields.sql',
] as const;

export const readMigration = (file: string): string => readFileSync(join(MIGRATIONS_DIR, file), 'utf8');

/** Every loyalty migration, concatenated in order — one string to `exec`. */
export const loyaltySchemaSql = (): string => LOYALTY_MIGRATIONS.map(readMigration).join('\n;\n');

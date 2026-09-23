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
] as const;

export const readMigration = (file: string): string => readFileSync(join(MIGRATIONS_DIR, file), 'utf8');

/** Every loyalty migration, concatenated in order — one string to `exec`. */
export const loyaltySchemaSql = (): string => LOYALTY_MIGRATIONS.map(readMigration).join('\n;\n');

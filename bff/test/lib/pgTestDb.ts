import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { fromPglite, type Db } from '../../src/backend/db';

/**
 * A real Postgres, from the real migration, in-process.
 *
 * 🔴 THE SCHEMA IS READ FROM supabase/migrations — NOT a copy kept beside the
 * tests. A test schema that drifts from the deployed one tests nothing: it
 * would pass on a column the production database does not have, which is the
 * failure mode migrations exist to prevent.
 */
export async function pgTestDb(): Promise<Db> {
  const pg = new PGlite();
  await pg.waitReady;
  // Resolved from THIS FILE, not from process.cwd() — the working directory
  // differs between `npm test`, a workspace run and an editor, and a schema the
  // tests cannot find is a suite that silently tests nothing.
  const here = dirname(fileURLToPath(import.meta.url));
  const sql = readFileSync(
    join(here, '..', '..', '..', 'supabase', 'migrations', '20260909_loyalty_backend.sql'),
    'utf8',
  );
  await pg.exec(sql);
  return fromPglite(pg);
}

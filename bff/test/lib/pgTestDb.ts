import { PGlite } from '@electric-sql/pglite';
import { fromPglite, type Db } from '../../src/backend/db';
import { loyaltySchemaSql } from './schema';

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
  // Resolved from the migrations folder (lib/schema.ts), not from
  // process.cwd() — the working directory differs between `npm test`, a
  // workspace run and an editor, and a schema the tests cannot find is a suite
  // that silently tests nothing. EVERY loyalty migration, in order: a table the
  // code writes that only a later migration creates must exist here too.
  const sql = loyaltySchemaSql();
  await pg.exec(sql);
  return fromPglite(pg);
}

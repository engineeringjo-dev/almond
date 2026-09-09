import { Pool } from 'pg';
import { config } from '../config';
import { createMemoryBackend } from './memory';
import { createOdooBackend } from './odoo';
import { createPostgresBackend } from './postgres';
import { fromPool } from './db';
import type { Backend } from './types';

/**
 * Which store the server runs on.
 *
 * 🔴 DATABASE_URL DECIDES, AND IT OUTRANKS DATA_SOURCE. The two answer
 * different questions: DATA_SOURCE says where the MENU and prices come from
 * (mock or Odoo), while this says where members, points and the corporate
 * register are KEPT. Conflating them is how `DATA_SOURCE=odoo` came to mean
 * "throw on every call" — createOdooBackend is still that deliberate stub.
 *
 * Unset, the server runs in memory: `npm run dev` and 397 tests need no
 * database, and that is worth keeping. But an in-memory store forgets on
 * restart, so anything a person TYPED — a company's discount, a 200-person
 * roster — is gone with it. That is the difference between a demonstration and
 * a tool, and it is one environment variable wide.
 */
export function createBackend(): Backend {
  if (config.DATABASE_URL) {
    return createPostgresBackend(fromPool(new Pool({
      connectionString: config.DATABASE_URL,
      // Supabase's pooler terminates TLS with a certificate chain Node does not
      // carry. The connection is still encrypted; what is not verified is the
      // hostname, which is why this is opt-in per environment rather than on.
      ...(config.DATABASE_SSL ? { ssl: { rejectUnauthorized: false } } : {}),
    })));
  }
  return config.DATA_SOURCE === 'odoo' ? createOdooBackend() : createMemoryBackend();
}
export type { Backend } from './types';

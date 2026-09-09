/**
 * The narrowest database surface this backend needs: a query, and a
 * transaction.
 *
 * 🔴 IT IS AN INTERFACE SO THE TESTS RUN THE REAL SQL. The production adapter
 * wraps `pg.Pool` against Supabase; the test adapter wraps PGlite, which is
 * Postgres compiled to WebAssembly and running in-process. Both execute the
 * SAME statements — so a broken index, a bad cast or a constraint the code
 * violates fails in CI rather than the first time a roster is uploaded.
 *
 * The alternative — a hand-written fake with maps — would test the fake.
 */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Runs `fn` inside BEGIN/COMMIT, rolling back on any throw. */
  tx<T>(fn: (t: Db) => Promise<T>): Promise<T>;
}

interface PgLike {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  release?: () => void;
}
interface PoolLike { connect(): Promise<PgLike & { release: () => void }> }

/** A `pg.Pool`. Each transaction takes its own client, which is what makes
 *  `SELECT ... FOR UPDATE` mean anything: a pool that handed out a different
 *  connection mid-transaction would lock a row nobody is writing. */
export function fromPool(pool: PoolLike & PgLike): Db {
  const wrap = (c: PgLike): Db => ({
    async query<T>(text: string, params?: unknown[]) {
      return (await c.query(text, params)).rows as T[];
    },
    async tx<T>(fn: (t: Db) => Promise<T>): Promise<T> {
      // Already inside one: reuse it rather than nesting, so a helper that
      // opens a transaction can be called from a method that already has.
      return fn(wrap(c));
    },
  });

  return {
    async query<T>(text: string, params?: unknown[]) {
      return (await pool.query(text, params)).rows as T[];
    },
    async tx<T>(fn: (t: Db) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const out = await fn(wrap(client));
        await client.query('commit');
        return out;
      } catch (e) {
        await client.query('rollback').catch(() => { /* the original error wins */ });
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

/** PGlite — one connection, so a transaction is BEGIN/COMMIT on it directly. */
export function fromPglite(db: PgLike): Db {
  let depth = 0;
  const self: Db = {
    async query<T>(text: string, params?: unknown[]) {
      return (await db.query(text, params)).rows as T[];
    },
    async tx<T>(fn: (t: Db) => Promise<T>): Promise<T> {
      if (depth > 0) return fn(self);          // already in one
      depth += 1;
      try {
        await db.query('begin');
        const out = await fn(self);
        await db.query('commit');
        return out;
      } catch (e) {
        await db.query('rollback').catch(() => { /* the original error wins */ });
        throw e;
      } finally {
        depth -= 1;
      }
    },
  };
  return self;
}

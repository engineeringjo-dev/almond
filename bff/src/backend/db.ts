import { AsyncLocalStorage } from 'node:async_hooks';

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

/**
 * Which Db (if any) the current async flow is inside a transaction of.
 *
 * 🔴 A TOP-LEVEL QUERY ISSUED FROM INSIDE A TRANSACTION IS A BUG ON BOTH
 * ADAPTERS, and this is what turns it from silent into loud:
 *   - on a pool it runs on a DIFFERENT connection — outside the transaction,
 *     blind to its uncommitted writes, and able to block for ever on the very
 *     row the transaction holds `FOR UPDATE` (a self-deadlock the database
 *     cannot see, because the two sessions look unrelated to it);
 *   - on PGlite it would either interleave into the open transaction or, now
 *     that transactions are serialised, wait for itself.
 * Code inside `tx(fn)` must use the handle `fn` receives.
 */
const txOwner = new AsyncLocalStorage<object>();

function refuseIfInside(owner: object, what: string): void {
  if (txOwner.getStore() === owner) {
    throw new Error(
      `Db.${what}() called on the top-level handle from inside a transaction — `
      + 'use the handle passed to tx(fn)',
    );
  }
}

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

  const self: Db = {
    async query<T>(text: string, params?: unknown[]) {
      refuseIfInside(self, 'query');
      return (await pool.query(text, params)).rows as T[];
    },
    async tx<T>(fn: (t: Db) => Promise<T>): Promise<T> {
      refuseIfInside(self, 'tx');
      const client = await pool.connect();
      try {
        await client.query('begin');
        const out = await txOwner.run(self, () => fn(wrap(client)));
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
  return self;
}

/**
 * PGlite — ONE connection, so every transaction must have it to itself.
 *
 * 🔴 THIS USED TO INTERLEAVE TRANSACTIONS, AND THE CONCURRENCY TESTS CAUGHT IT.
 * The previous version kept a `depth` counter and, when a second `tx()` began
 * while a first was open, ran the second's statements INSIDE the first's
 * BEGIN on the shared connection. `SELECT … FOR UPDATE` cannot block a
 * session that already holds the lock, so two read-modify-writes of one member
 * read the same balance and both wrote: measured, ten parallel 30-point spends
 * against a 100-point balance ALL succeeded, leaving the balance at 70 and the
 * history summing to −200 (bff/test/resilience-concurrency.test.ts). A rollback
 * in one flow would also have undone another flow's "committed" work.
 *
 * Production never ran this adapter — it is the test harness — but a harness
 * that corrupts under concurrency cannot say anything about concurrency. Now a
 * mutex gives each transaction, and each top-level statement, exclusive use of
 * the connection, which is what a single-connection database actually offers.
 * That makes PGlite a SERIAL executor: it proves the logic is correct under
 * any interleaving of whole transactions, and nothing about row locks — see
 * the capture test in resilience-concurrency for what pins `FOR UPDATE`.
 */
export function fromPglite(db: PgLike): Db {
  let tail: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => { /* the caller sees the error; the queue moves on */ });
    return run;
  };
  const inTx: Db = {
    async query<T>(text: string, params?: unknown[]) {
      return (await db.query(text, params)).rows as T[];
    },
    async tx<T>(fn: (t: Db) => Promise<T>): Promise<T> {
      return fn(inTx);                         // already in one: reuse it
    },
  };
  const self: Db = {
    async query<T>(text: string, params?: unknown[]) {
      refuseIfInside(self, 'query');
      return exclusive(async () => (await db.query(text, params)).rows as T[]);
    },
    async tx<T>(fn: (t: Db) => Promise<T>): Promise<T> {
      refuseIfInside(self, 'tx');
      return exclusive(async () => {
        await db.query('begin');
        try {
          const out = await txOwner.run(self, () => fn(inTx));
          await db.query('commit');
          return out;
        } catch (e) {
          await db.query('rollback').catch(() => { /* the original error wins */ });
          throw e;
        }
      });
    },
  };
  return self;
}

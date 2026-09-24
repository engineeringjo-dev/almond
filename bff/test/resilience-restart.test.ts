// Runs the second-visit engine ON: it is off in the shipped config (see the module).
import './lib/second-visit-on';
import { describe, it, expect, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { randomInt, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import { liveBalance } from '@almond/shared/loyalty/lots';
import { assignHoldout, holdoutSpecFromConfig } from '@almond/shared/loyalty/holdout';
import { createMemoryBackend } from '../src/backend/memory';
import { createPostgresBackend } from '../src/backend/postgres';
import { fromPglite, fromPool, type Db } from '../src/backend/db';
import type { Backend } from '../src/backend';
import { pgTestDb } from './lib/pgTestDb';
import { loyaltySchemaSql } from './lib/schema';
import { menuItems } from '@almond/shared/menu';

/**
 * R2 — WHAT SURVIVES A RESTART.
 *
 * The Postgres backend holds no state of its own: every fact is a row. So a
 * NEW backend object over the same database — which is exactly what a process
 * restart constructs — must read back byte-for-byte what the old one wrote.
 * Three depths of "restart" are exercised:
 *
 *   R2.1  a second backend object over the SAME open PGlite connection;
 *   R2.2  PGlite on disk: close the database, reopen the directory in a NEW
 *         PGlite instance (the closest in-process analogue of a server restart);
 *   R2.3  a real Postgres, through a brand-new pg.Pool (only with
 *         ALMOND_TEST_PG_URL — see resilience-concurrency.test.ts).
 *
 * R2.4 documents the OTHER side by test: the memory backend forgets
 * everything. That is its contract (`npm run dev`), not a bug — but it means a
 * deployment without DATABASE_URL loses every member, point and roster on
 * every restart, and the only thing that says so should not be a comment.
 *
 * R2.5 is the crash half of "restart": a transaction that dies between its
 * statements leaves NOTHING behind — not a spent balance without its ledger
 * line, not points gone without a redemption to show for them.
 */

const PG_URL = process.env.ALMOND_TEST_PG_URL;
/** Every loyalty migration, in order — the schema a deploy runs on. */
const MIGRATION = loyaltySchemaSql();
const phone = () => `+96278${randomInt(1_000_000, 10_000_000)}`;

interface World { memberIds: string[]; codes: string[] }

/** Write one of everything a member, the till and the back-office can create. */
async function populate(b: Backend): Promise<World> {
  const memberIds: string[] = [];
  const codes: string[] = [];
  await b.saveCompany({ id: 'acme', nameAr: 'أكمي', nameEn: 'Acme', percentOff: 25, active: true });
  await b.saveCompany({ id: 'off', nameAr: '', nameEn: 'Dormant', percentOff: 10, active: false });

  for (let i = 0; i < 3; i += 1) {
    const p = phone();
    const m = await b.findOrCreateByPhone(p, i === 0 ? 'حمزة' : undefined);
    memberIds.push(m.id);
    if (i === 0) {
      await b.replaceRoster('acme', [{ phone: p, companyId: 'acme', name: 'حمزة' }, { phone: phone(), companyId: 'acme' }]);
    }
    const order = await b.createOrder({
      memberId: m.id, branchId: `b${i}`, type: 'pickup', paymentMethod: 'cash',
      subtotal: 10, tax: 0.8, total: 10.8, pointsEarned: 0,
    });
    // Saga order: the voucher is evaluated BEFORE the grant (types.ts).
    await b.evaluateSecondVisitVoucher({
      memberId: m.id, orderId: order.id, basketHasDrink: true,
      arm: assignHoldout(m.id, holdoutSpecFromConfig('secondVisitVoucher')), at: new Date(),
    });
    await b.recordEarnBreakdown(order.id, { points: 54 } as never);
    await b.addPoints(m.id, 1_000 + i, 'نقاط طلب', 'Order points');
    await b.recordSpend(m.id, 10.8);
    await b.creditWallet(m.id, 15_000, 'topup');
    await b.debitWallet(m.id, 2_500);
    await b.setProfile(m.id, { name: `عضو ${i}`, birthday: '1990-01-0' + (i + 1) });
    const pending = await b.createRedemption(m.id, 100);
    const settled = await b.createRedemption(m.id, 200);
    await b.settleRedemption(settled.id, 'pos', new Date());
    const cancelled = await b.createRedemption(m.id, 50);
    await b.cancelRedemption(m.id, cancelled.id, new Date());
    codes.push(pending.code, settled.code, cancelled.code);
    if (i === 0) {
      await b.recordCorporateUse({
        memberId: m.id, companyId: 'acme', phone: p, at: new Date().toISOString(), orderId: order.id,
        items: [{ nameAr: 'لاتيه', nameEn: 'Latte', qty: 2 }], percentOff: 25, discountJod: 1.35,
      });
    }
  }
  return { memberIds, codes };
}

/** Everything the Backend interface can say about that world, via READS only.
 *  (activeRedemption is left out: it sweeps, i.e. it writes.) */
async function snapshot(b: Backend, w: World) {
  const members = [];
  for (const id of w.memberIds) {
    const m = await b.getMember(id);
    members.push({
      member: JSON.parse(JSON.stringify(m)),
      points: liveBalance(m.lots),
      wallet: liveBalance(m.walletLots),
      history: await b.getHistory(id),
      standing: await b.getStanding(id),
      voucher: await b.getSecondVisitVoucher(id),
      entitlement: await b.entitlementFor(id),
    });
  }
  const redemptions = [];
  for (const c of w.codes) redemptions.push(await b.findRedemptionByCode(c));
  return {
    members, redemptions,
    companies: await b.listCompanies(),
    roster: await b.listRoster(),
    uses: await b.listCorporateUses(),
  };
}

/** Every row of every table — the order table has no Backend read at all. */
async function dump(db: Db) {
  const out: Record<string, unknown[]> = {};
  for (const t of ['members', 'point_history', 'orders', 'second_visit_vouchers', 'redemptions',
    'companies', 'corporate_roster', 'corporate_uses', 'idempotency_keys', 'pos_sales', 'payment_intents',
    'pos_point_spends', 'pos_sale_refunds']) {
    out[t] = await db.query(`select * from ${t} order by 1`);
  }
  return JSON.parse(JSON.stringify(out));
}

/** Sanity on the snapshot itself: a restart test over an empty world proves nothing. */
function expectPopulated(s: Awaited<ReturnType<typeof snapshot>>) {
  expect(s.members).toHaveLength(3);
  for (const m of s.members) {
    expect(m.points).toBeGreaterThan(600);
    expect(m.wallet).toBe(12_500);
    expect(m.history.length).toBeGreaterThanOrEqual(5);
  }
  expect(s.members[0].entitlement?.percentOff).toBe(25);
  expect(s.redemptions.map((r) => r && (r.settledAt ? 'settled' : r.cancelledAt ? 'cancelled' : 'pending')))
    .toEqual(Array(3).fill(['pending', 'settled', 'cancelled']).flat());
  expect(s.companies).toHaveLength(2);
  expect(s.roster).toHaveLength(2);
  expect(s.uses).toHaveLength(1);
}

describe('R2 restart durability — postgres backend', () => {
  it('R2.1 a NEW backend object over the same db reads back everything, identically', async () => {
    const db = await pgTestDb();
    const before = createPostgresBackend(db);
    const w = await populate(before);
    const s1 = await snapshot(before, w);
    const d1 = await dump(db);
    expectPopulated(s1);

    const after = createPostgresBackend(db);
    expect(await snapshot(after, w)).toEqual(s1);
    expect(await dump(db)).toEqual(d1);                     // and reading changed nothing
    // It keeps working as the same ledger: the pending code still settles once.
    const pending = s1.redemptions[0]!;
    await after.settleRedemption(pending.id, 'pos', new Date());
    await expect(after.settleRedemption(pending.id, 'pos', new Date())).rejects.toMatchObject({ code: 'redemption_already_settled' });
  }, 60_000);

  it('R2.2 PGlite on disk: close the database, reopen the directory, read back identical', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'almond-restart-'));
    try {
      const pg1 = new PGlite(dir);
      await pg1.waitReady;
      await pg1.exec(MIGRATION);
      const b1 = createPostgresBackend(fromPglite(pg1));
      const w = await populate(b1);
      const s1 = await snapshot(b1, w);
      const d1 = await dump(fromPglite(pg1));
      expectPopulated(s1);
      await pg1.close();

      const pg2 = new PGlite(dir);                          // "the process came back"
      await pg2.waitReady;
      const db2 = fromPglite(pg2);
      expect(await snapshot(createPostgresBackend(db2), w)).toEqual(s1);
      expect(await dump(db2)).toEqual(d1);
      await pg2.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);

  it.skipIf(!PG_URL)('R2.3 real Postgres: a brand-new pg.Pool reads back identical', async () => {
    const admin = new Pool({ connectionString: PG_URL, max: 1 });
    const name = `restart_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    await admin.query(`create database ${name}`);
    const url = new URL(PG_URL!);
    url.pathname = `/${name}`;
    try {
      const pool1 = new Pool({ connectionString: url.toString(), max: 5 });
      await pool1.query(MIGRATION);
      const b1 = createPostgresBackend(fromPool(pool1));
      const w = await populate(b1);
      const s1 = await snapshot(b1, w);
      expectPopulated(s1);
      await pool1.end();                                    // every connection gone

      const pool2 = new Pool({ connectionString: url.toString(), max: 5 });
      expect(await snapshot(createPostgresBackend(fromPool(pool2)), w)).toEqual(s1);
      await pool2.end();
    } finally {
      await admin.query(`drop database if exists ${name}`);
      await admin.end();
    }
  }, 60_000);
});

describe('R2.4 the memory backend FORGETS on restart — by contract, asserted', () => {
  it('a new memory backend knows none of the members, points, codes or companies', async () => {
    const before = createMemoryBackend();
    const w = await populate(before);
    const s1 = await snapshot(before, w);
    expectPopulated(s1);
    const p0 = (await before.getMember(w.memberIds[0])).phone;

    const after = createMemoryBackend();                    // "the process came back"
    for (const id of w.memberIds) await expect(after.getMember(id)).rejects.toMatchObject({ code: 'not_found' });
    for (const c of w.codes) expect(await after.findRedemptionByCode(c)).toBeNull();
    expect(await after.listCompanies()).toEqual([]);
    expect(await after.listRoster()).toEqual([]);
    expect(await after.listCorporateUses()).toEqual([]);
    // Signing in again with the same phone mints a STRANGER with nothing.
    const again = await after.findOrCreateByPhone(p0);
    expect(again.id).not.toBe(w.memberIds[0]);
    expect(liveBalance(again.lots)).toBe(0);
    expect(liveBalance(again.walletLots)).toBe(0);
    expect(await after.getHistory(again.id)).toEqual([]);
  });
});

/** A Db that dies on the first statement matching `pattern` — a crash between
 *  two statements of one transaction. */
function crashingOn(inner: Db, pattern: RegExp): Db {
  const guard = (text: string) => { if (pattern.test(text)) throw new Error(`simulated crash at: ${text.trim().slice(0, 40)}`); };
  const child = (t: Db): Db => ({
    query<T>(text: string, params?: unknown[]) { guard(text); return t.query<T>(text, params); },
    tx<T>(fn: (x: Db) => Promise<T>) { return fn(child(t)); },
  });
  return {
    query<T>(text: string, params?: unknown[]) { guard(text); return inner.query<T>(text, params); },
    tx<T>(fn: (x: Db) => Promise<T>) { return inner.tx((t) => fn(child(t))); },
  };
}

/** A Db whose statement matching `pattern` fails INSIDE Postgres (division by
 *  zero, 22012) rather than in JS. Only a real SQL error aborts the enclosing
 *  transaction, so only this can prove a savepoint is doing its job. */
function sqlErrorOn(inner: Db, pattern: RegExp): Db {
  const swap = (text: string) => (pattern.test(text) ? 'select 1/0' : text);
  const child = (t: Db): Db => ({
    query<T>(text: string, params?: unknown[]) {
      return pattern.test(text) ? t.query<T>(swap(text)) : t.query<T>(text, params);
    },
    tx<T>(fn: (x: Db) => Promise<T>) { return fn(child(t)); },
  });
  return {
    query<T>(text: string, params?: unknown[]) { return inner.query<T>(swap(text), pattern.test(text) ? [] : params); },
    tx<T>(fn: (x: Db) => Promise<T>) { return inner.tx((t) => fn(child(t))); },
  };
}

describe('R2.5 🔴 a crash mid-transaction leaves nothing half-written', () => {
  it('spend dies after the member row is written but before its ledger line: rolled back whole', async () => {
    const db = await pgTestDb();
    const ok = createPostgresBackend(db);
    const id = (await ok.findOrCreateByPhone(phone())).id;
    await ok.addPoints(id, 500, 'منحة', 'Grant');
    const d0 = await dump(db);

    // saveMember's UPDATE runs first and succeeds; the history INSERT then dies.
    const dying = createPostgresBackend(crashingOn(db, /insert into point_history/));
    await expect(dying.spendPoints(id, 200, 'صرف', 'Spend')).rejects.toThrow(/simulated crash/);
    await expect(dying.createRedemption(id, 300)).rejects.toThrow(/simulated crash/);

    const fresh = createPostgresBackend(db);
    expect(liveBalance((await fresh.getMember(id)).lots)).toBe(500);
    expect(await dump(db)).toEqual(d0);                     // not one row moved
  }, 60_000);

  it('a redemption whose row insert dies does not keep the points it spent', async () => {
    const db = await pgTestDb();
    const ok = createPostgresBackend(db);
    const id = (await ok.findOrCreateByPhone(phone())).id;
    await ok.addPoints(id, 500, 'منحة', 'Grant');
    const d0 = await dump(db);
    const dying = createPostgresBackend(crashingOn(db, /insert into redemptions/));
    await expect(dying.createRedemption(id, 300)).rejects.toThrow(/simulated crash/);
    expect(await dump(db)).toEqual(d0);
    expect(liveBalance((await createPostgresBackend(db).getMember(id)).lots)).toBe(500);
  }, 60_000);
});

/** A throwaway database on the real server (ALMOND_TEST_PG_URL), migrated
 *  from the real files; `close` drops it. */
async function realPgDb(): Promise<{ db: Db; close(): Promise<void> }> {
  const admin = new Pool({ connectionString: PG_URL, max: 1 });
  const name = `restart_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  await admin.query(`create database ${name}`);
  const url = new URL(PG_URL!);
  url.pathname = `/${name}`;
  const pool = new Pool({ connectionString: url.toString(), max: 10 });
  await pool.query(MIGRATION);
  return {
    db: fromPool(pool),
    async close() {
      await pool.end();
      await admin.query(`drop database if exists ${name}`);
      await admin.end();
    },
  };
}

/** PGlite always; a real Postgres too when ALMOND_TEST_PG_URL is set. */
const STORES: [string, () => Promise<{ db: Db; close(): Promise<void> }>][] = [
  ['pglite', async () => ({ db: await pgTestDb(), close: async () => {} })],
  ...(PG_URL ? [['real-pg', realPgDb] as [string, () => Promise<{ db: Db; close(): Promise<void> }>]] : []),
];

/** "A new process": a fresh module graph (vi.resetModules), so no module-level
 *  state survives — over the SAME database, which is what a restart has. */
async function boot(backend: (pgMod: typeof import('../src/backend/postgres')) => Backend) {
  vi.resetModules();
  const { build } = await import('../src/server');
  const pgMod = await import('../src/backend/postgres');
  return build(backend(pgMod));
}
type App = Awaited<ReturnType<typeof boot>>;

/**
 * R2.6 🔴 THE Idempotency-Key SURVIVES A RESTART — this used to be a PINNED GAP.
 *
 * bff/src/plugins/idempotency.ts kept its keys in a module-level Map: the money
 * was durable (Postgres) and the memory of which request had already moved it
 * was not. A member redeemed, the process died before the phone read the 201,
 * the phone retried with the SAME key — exactly what the key is for — and the
 * restarted process spent the points AGAIN and minted a second code. This test
 * asserted that unsafe outcome (400 left of 1,000) until the keys moved into
 * the store (supabase/migrations/20260924_idempotency_keys.sql); it now asserts
 * the safe one, on PGlite and on a real Postgres.
 */
describe.each(STORES)('R2.6 🔴 Idempotency-Key across a restart — %s', (_name, make) => {
  let store: { db: Db; close(): Promise<void> };
  beforeEach(async () => { store = await make(); }, 60_000);
  afterEach(async () => { await store?.close(); });

  const member = async () => {
    const b = createPostgresBackend(store.db);
    const id = (await b.findOrCreateByPhone(phone())).id;
    await b.addPoints(id, 1_000, 'منحة', 'Grant');
    return id;
  };
  const points = async (id: string) => liveBalance((await createPostgresBackend(store.db).getMember(id)).lots);
  const redeem = (app: App, id: string, key: string, pts = 300) => app.inject({
    method: 'POST', url: '/v1/loyalty/redeem', payload: { points: pts },
    headers: { authorization: `Bearer ${app.jwt.sign({ sub: id })}`, 'idempotency-key': key },
  });
  const pg = (m: typeof import('../src/backend/postgres')) => m.createPostgresBackend(store.db);

  it('a retried redeem after a restart REPLAYS the first answer and spends nothing twice', async () => {
    const id = await member();
    const key = randomUUID();

    const app1 = await boot(pg);
    const first = await redeem(app1, id, key);
    expect(first.statusCode).toBe(201);
    const replay = await redeem(app1, id, key);            // same process: a replay is a replay
    expect(replay.headers['idempotent-replay']).toBe('true');
    expect(replay.body).toBe(first.body);
    expect(await points(id)).toBe(700);
    await app1.close();                                    // the process dies

    const app2 = await boot(pg);                           // …and comes back
    const retry = await redeem(app2, id, key);
    expect(retry.statusCode).toBe(201);
    expect(retry.headers['idempotent-replay']).toBe('true');
    expect(retry.body).toBe(first.body);                   // byte for byte: the SAME code
    expect(await points(id)).toBe(700);                    // was 400 while the gap was open
    // CONTROL: a NEW key is a new request, so the test can see a double spend.
    expect((await redeem(app2, id, randomUUID())).statusCode).toBe(201);
    expect(await points(id)).toBe(400);
    await app2.close();
  }, 60_000);

  it('two live instances over one database share the keys — sequentially and in parallel', async () => {
    const id = await member();
    const a = await boot(pg);
    const b = await boot(pg);
    const key = randomUUID();
    const first = await redeem(a, id, key);
    const other = await redeem(b, id, key);
    expect(other.headers['idempotent-replay']).toBe('true');
    expect(other.body).toBe(first.body);

    const k2 = randomUUID();
    const rs = await Promise.all(Array.from({ length: 8 }, (_, i) => redeem(i % 2 ? a : b, id, k2)));
    expect(rs.every((r) => r.statusCode === 201 || r.statusCode === 409)).toBe(true);
    const ids = new Set(rs.filter((r) => r.statusCode === 201).map((r) => r.json().redemption.id));
    expect(ids.size).toBe(1);
    for (const r of rs.filter((x) => x.statusCode === 409)) expect(r.json().error).toBe('request_in_progress');
    expect(await points(id)).toBe(400);                    // two keys, two spends — never more
    await a.close();
    await b.close();
  }, 60_000);

  it('the same key with a DIFFERENT body is 422 — not a replay, and it moves nothing', async () => {
    const id = await member();
    const app = await boot(pg);
    const key = randomUUID();
    expect((await redeem(app, id, key, 300)).statusCode).toBe(201);
    const reused = await redeem(app, id, key, 600);
    expect(reused.statusCode).toBe(422);
    expect(reused.json().error).toBe('idempotency_key_reused');
    expect(reused.headers['idempotent-replay']).toBeUndefined();
    expect(await points(id)).toBe(700);
    // The same key on ANOTHER route is another request too.
    const onCheckout = await app.inject({
      method: 'POST', url: '/v1/wallet/topup', payload: { amount: 5 },
      headers: { authorization: `Bearer ${app.jwt.sign({ sub: id })}`, 'idempotency-key': key },
    });
    expect(onCheckout.statusCode).toBe(422);
    await app.close();
  }, 60_000);

  it('🔴 a request whose process died after moving money is NEVER re-run: 409 until the key expires', async () => {
    const id = await member();
    const key = randomUUID();
    // The redemption commits, then the process dies before it can record how
    // the request ended — simulated by the completion write failing.
    const app1 = await boot((m) => ({
      ...m.createPostgresBackend(store.db),
      completeIdempotencyKey: async () => { throw new Error('process died'); },
    }));
    expect((await redeem(app1, id, key)).statusCode).toBe(201);   // the member was answered…
    await app1.close();
    expect(await points(id)).toBe(700);

    const app2 = await boot(pg);
    const retry = await redeem(app2, id, key);
    expect(retry.statusCode).toBe(409);                    // …and the retry cannot spend again
    expect(retry.json()).toEqual({ error: 'request_in_progress' });
    expect(await points(id)).toBe(700);
    await app2.close();
  }, 60_000);
});

/**
 * R2.8 🔴 CHECKOUT IS ONE TRANSACTION — a crash anywhere inside it leaves the
 * wallet as it was and no order.
 *
 * It was a three-transaction saga (debitWallet, createOrder, addPoints) whose
 * refund ran only on a thrown error. A process that died after the debit kept
 * the member's money with no order to show for it. Each crash point below is a
 * statement INSIDE Backend.checkout; the store must be byte-identical after.
 */
describe.each(STORES)('R2.8 🔴 a crash mid-checkout moves no money — %s', (_name, make) => {
  let store: { db: Db; close(): Promise<void> };
  beforeEach(async () => { store = await make(); }, 60_000);
  afterEach(async () => { await store?.close(); });

  const input = (id: string) => ({
    order: { branchId: 'b1', type: 'pickup' as const, paymentMethod: 'wallet' as const, subtotal: 5.37, tax: 0.43, total: 5.8 },
    walletDebitFils: 5_800, pointsEarned: 43,
    pointsReasonAr: 'نقاط طلب', pointsReasonEn: 'Order points',
    earn: { points: 43 } as never, spendJod: 5.8,
    corporateUse: { companyId: 'acme', items: [{ nameAr: 'لاتيه', nameEn: 'Latte', qty: 1 }], percentOff: 10, discountJod: 0.6 },
    secondVisit: { basketHasDrink: true, arm: assignHoldout(id, holdoutSpecFromConfig('secondVisitVoucher')) },
    at: new Date(),
  });

  it('dies at the points insert, the order insert, the use insert or the member write: nothing lands', async () => {
    const ok = createPostgresBackend(store.db);
    await ok.saveCompany({ id: 'acme', nameAr: '', nameEn: 'Acme', percentOff: 10, active: true });
    const id = (await ok.findOrCreateByPhone(phone())).id;
    await ok.creditWallet(id, 10_000, 'topup');
    const d0 = await dump(store.db);
    for (const at of [/insert into point_history/, /insert into orders/, /insert into corporate_uses/, /update members set/]) {
      const dying = createPostgresBackend(crashingOn(store.db, at));
      await expect(dying.checkout(id, input(id)), String(at)).rejects.toThrow(/simulated crash/);
      expect(await dump(store.db), String(at)).toEqual(d0);   // not one row moved
    }
    expect(liveBalance((await ok.getMember(id)).walletLots)).toBe(10_000);
    // CONTROL: the same call on a healthy store does move all of it.
    const r = await ok.checkout(id, input(id));
    expect(r.walletBalanceFils).toBe(4_200);
    const after = await dump(store.db);
    expect(after.orders).toHaveLength(1);
    expect(after.corporate_uses).toHaveLength(1);
  }, 60_000);

  it('a voucher failure is contained by its savepoint: the paid order stands, only the voucher is lost', async () => {
    const ok = createPostgresBackend(store.db);
    await ok.saveCompany({ id: 'acme', nameAr: '', nameEn: 'Acme', percentOff: 10, active: true });
    const id = (await ok.findOrCreateByPhone(phone())).id;
    await ok.creditWallet(id, 10_000, 'topup');
    // A REAL SQL error, so Postgres aborts the transaction: without the
    // savepoint rolled back, every statement after it would fail (25P02) and
    // take the paid order down with the voucher.
    const flaky = createPostgresBackend(sqlErrorOn(store.db, /insert into second_visit_vouchers/));
    const r = await flaky.checkout(id, input(id));
    expect((r.secondVisitError as { code?: string }).code).toBe('22012');
    expect(r.secondVisitVoucher).toBeNull();
    expect(liveBalance((await ok.getMember(id)).walletLots)).toBe(4_200);
    const d = await dump(store.db);
    expect(d.orders).toHaveLength(1);
    expect(d.second_visit_vouchers).toHaveLength(0);
  }, 60_000);

  it('top-up is one transaction too: a crash leaves no credit without its bonus', async () => {
    const ok = createPostgresBackend(store.db);
    const id = (await ok.findOrCreateByPhone(phone())).id;
    await ok.creditWallet(id, 20_000, 'topup');
    const d0 = await dump(store.db);
    const diesAtSave = createPostgresBackend(crashingOn(store.db, /update members set/));
    await expect(diesAtSave.topUpWallet(id, 20_000, 50, 'مكافأة', 'Bonus')).rejects.toThrow(/simulated crash/);
    // The top-up's credit is in the member row, its bonus in the ledger: the
    // ledger insert runs AFTER the member write, so dying there is the case a
    // two-call route could not survive.
    const diesAtBonus = createPostgresBackend(crashingOn(store.db, /insert into point_history/));
    await expect(diesAtBonus.topUpWallet(id, 20_000, 50, 'مكافأة', 'Bonus')).rejects.toThrow(/simulated crash/);
    expect(await dump(store.db)).toEqual(d0);
    expect(liveBalance((await ok.getMember(id)).walletLots)).toBe(20_000);
  }, 60_000);

  it('over HTTP: the process dies mid-checkout, restarts, and the retry with the same key charges ONCE', async () => {
    const seed = createPostgresBackend(store.db);
    const id = (await seed.findOrCreateByPhone(phone())).id;
    await seed.creditWallet(id, 20_000, 'topup');
    const item = menuItems.find((m) => m.inStock !== false && m.sizes.length > 0 && m.sizes[0].price > 0)!;
    const body = {
      branchId: 'b1', orderType: 'pickup', paymentMethod: 'wallet',
      lines: [{ itemId: item.id, sizeId: item.sizes[0].id, optionIds: [], qty: 1 }],
    };
    const key = randomUUID();
    const send = (app: App) => app.inject({
      method: 'POST', url: '/v1/checkout', payload: body,
      headers: { authorization: `Bearer ${app.jwt.sign({ sub: id })}`, 'idempotency-key': key },
    });
    const d0 = await dump(store.db);
    const dying = await boot((m) => m.createPostgresBackend(crashingOn(store.db, /insert into point_history/)));
    expect((await send(dying)).statusCode).toBe(500);
    await dying.close();
    const { idempotency_keys: _k, ...rest } = await dump(store.db);
    const { idempotency_keys: _k0, ...rest0 } = d0;
    expect(rest).toEqual(rest0);                           // no debit, no order, no ledger line

    const app = await boot(pg2(store.db));
    const ok = await send(app);
    expect(ok.statusCode).toBe(201);
    const again = await send(app);
    expect(again.headers['idempotent-replay']).toBe('true');
    expect(again.body).toBe(ok.body);
    const total = ok.json().total as number;
    expect(liveBalance((await seed.getMember(id)).walletLots)).toBe(20_000 - Math.round(total * 1000));
    expect((await dump(store.db)).orders).toHaveLength(1);
    await app.close();
  }, 60_000);
});

/**
 * R2.9 🔴 THE TILL'S EARN AND THE CARD PAYMENT ARE ONE TRANSACTION EACH — a
 * crash at any statement inside them leaves the store byte-identical, and a
 * restarted process answers a retrying till from the durable row.
 */
describe.each(STORES)('R2.9 🔴 a crash mid till-earn, mid reversal or mid card checkout moves nothing — %s', (_name, make) => {
  let store: { db: Db; close(): Promise<void> };
  beforeEach(async () => { store = await make(); }, 60_000);
  afterEach(async () => { await store?.close(); });

  const sale = (memberId: string, ref: string) => ({
    posOrderRef: ref, memberId, ticketJti: `t-${ref}`, ticketRefusal: null, branchId: 'b1',
    paidFils: 15_000, paidAt: new Date(), pointsEarned: 30, earn: { points: 30 } as never,
    spendJod: 15, spendDay: null, reasonAr: 'نقاط مشتريات الفرع', reasonEn: 'In-store purchase points', at: new Date(),
  });

  it('tillEarn dies at the sale insert, the ledger line or the member write: nothing lands; the retry grants once', async () => {
    const ok = createPostgresBackend(store.db);
    const id = (await ok.findOrCreateByPhone(phone())).id;
    const d0 = await dump(store.db);
    for (const at of [/insert into pos_sales/, /insert into point_history/, /update members set/]) {
      const dying = createPostgresBackend(crashingOn(store.db, at));
      await expect(dying.tillEarn(sale(id, 'Shop/9')), String(at)).rejects.toThrow(/simulated crash/);
      expect(await dump(store.db), String(at)).toEqual(d0);
    }
    // CONTROL: healthy, it lands — and a NEW process (a new backend object over
    // the same database) answers the till's retry from the row: a replay.
    const first = await ok.tillEarn(sale(id, 'Shop/9'));
    expect(first.replay).toBe(false);
    const restarted = createPostgresBackend(store.db);
    const retry = await restarted.tillEarn({ ...sale(id, 'Shop/9'), ticketRefusal: 'expired' as const });
    expect(retry).toEqual({ sale: first.sale, replay: true });
    expect(liveBalance((await restarted.getMember(id)).lots)).toBe(30);
    expect((await dump(store.db)).pos_sales).toHaveLength(1);
  }, 60_000);

  it('reverseTillEarn dies at the sale update, the ledger line or the member write: nothing lands', async () => {
    const ok = createPostgresBackend(store.db);
    const id = (await ok.findOrCreateByPhone(phone())).id;
    await ok.tillEarn(sale(id, 'Shop/10'));
    const d0 = await dump(store.db);
    for (const at of [/insert into pos_sale_refunds/, /update pos_sales set/, /insert into point_history/, /update members set/]) {
      const dying = createPostgresBackend(crashingOn(store.db, at));
      await expect(dying.reverseTillEarn('Shop/10', 'refund', new Date()), String(at)).rejects.toThrow(/simulated crash/);
      expect(await dump(store.db), String(at)).toEqual(d0);
    }
    const r = await ok.reverseTillEarn('Shop/10', 'refund', new Date());
    expect(r.sale).toMatchObject({ status: 'reversed', reversedPoints: 30, shortfall: 0 });
    expect(liveBalance((await ok.getMember(id)).lots)).toBe(0);
  }, 60_000);

  it('a PARTIAL refund dies at its refund insert, the sale update, the ledger line or the member write: nothing lands', async () => {
    const ok = createPostgresBackend(store.db);
    const id = (await ok.findOrCreateByPhone(phone())).id;
    await ok.tillEarn(sale(id, 'Shop/11'));                                   // 15 JOD, 30 points
    const d0 = await dump(store.db);
    const refund = { refundRef: 'Shop/11/R', refundedFils: 5_000 };
    for (const at of [/insert into pos_sale_refunds/, /update pos_sales set/, /insert into point_history/, /update members set/]) {
      const dying = createPostgresBackend(crashingOn(store.db, at));
      await expect(dying.reverseTillEarn('Shop/11', 'refund', new Date(), refund), String(at)).rejects.toThrow(/simulated crash/);
      expect(await dump(store.db), String(at)).toEqual(d0);
    }
    const r = await ok.reverseTillEarn('Shop/11', 'refund', new Date(), refund);
    expect(r.refund).toMatchObject({ targetPoints: 10, reversedPoints: 10 });
    // A restarted process answers the till's retry from the row.
    const retry = await createPostgresBackend(store.db).reverseTillEarn('Shop/11', 'refund', new Date(), refund);
    expect(retry).toEqual({ sale: r.sale, refund: r.refund, replay: true });
    expect(liveBalance((await ok.getMember(id)).lots)).toBe(20);
    expect((await dump(store.db)).pos_sale_refunds).toHaveLength(1);
  }, 60_000);

  const spendInput = (memberId: string, ref: string) => ({
    posOrderRef: ref, memberId, ticketJti: `s-${ref}`, ticketExpired: false, points: 40, valueJod: 0.4,
    reasonAr: 'دفع بالنقاط في الفرع', reasonEn: 'Paid with points in store', at: new Date(),
  });

  it('tillSpend dies at the spend insert, the ledger line or the member write: nothing lands; the retry debits once', async () => {
    const ok = createPostgresBackend(store.db);
    const id = (await ok.findOrCreateByPhone(phone())).id;
    await ok.addPoints(id, 100, 'منحة', 'Grant');
    const d0 = await dump(store.db);
    for (const at of [/insert into pos_point_spends/, /insert into point_history/, /update members set/]) {
      const dying = createPostgresBackend(crashingOn(store.db, at));
      await expect(dying.tillSpend(spendInput(id, 'Shop/S9')), String(at)).rejects.toThrow(/simulated crash/);
      expect(await dump(store.db), String(at)).toEqual(d0);
    }
    const first = await ok.tillSpend(spendInput(id, 'Shop/S9'));
    const restarted = createPostgresBackend(store.db);
    const retry = await restarted.tillSpend({ ...spendInput(id, 'Shop/S9'), ticketExpired: true });
    expect(retry).toEqual({ spend: first.spend, replay: true });
    expect(liveBalance((await restarted.getMember(id)).lots)).toBe(60);
    expect((await dump(store.db)).pos_point_spends).toHaveLength(1);
  }, 60_000);

  it('reverseTillSpend dies at the spend update, the ledger line or the member write: nothing lands', async () => {
    const ok = createPostgresBackend(store.db);
    const id = (await ok.findOrCreateByPhone(phone())).id;
    await ok.addPoints(id, 100, 'منحة', 'Grant');
    await ok.tillSpend(spendInput(id, 'Shop/S10'));
    const d0 = await dump(store.db);
    for (const at of [/update pos_point_spends set/, /insert into point_history/, /update members set/]) {
      const dying = createPostgresBackend(crashingOn(store.db, at));
      await expect(dying.reverseTillSpend('Shop/S10', 'void', new Date()), String(at)).rejects.toThrow(/simulated crash/);
      expect(await dump(store.db), String(at)).toEqual(d0);
    }
    const r = await ok.reverseTillSpend('Shop/S10', 'void', new Date());
    expect(r.spend).toMatchObject({ status: 'reversed', returnedPoints: 40, expiredPoints: 0 });
    expect(liveBalance((await ok.getMember(id)).lots)).toBe(100);
  }, 60_000);

  it('a card checkout that dies while binding its payment leaves the payment unspent and no order', async () => {
    const ok = createPostgresBackend(store.db);
    const id = (await ok.findOrCreateByPhone(phone())).id;
    const pi = await ok.createPaymentIntent({
      id: 'pi_crash', memberId: id, amountFils: 5_800, currency: 'JOD', cartHash: 'c', provider: 'mock', providerRef: 'ref_crash',
    }, new Date());
    const input = {
      order: { branchId: 'b1', type: 'pickup' as const, paymentMethod: 'visa' as const, subtotal: 5.37, tax: 0.43, total: 5.8 },
      walletDebitFils: 0, pointsEarned: 43, pointsReasonAr: 'نقاط طلب', pointsReasonEn: 'Order points',
      earn: { points: 43 } as never, spendJod: 5.8, corporateUse: null,
      secondVisit: { basketHasDrink: true, arm: assignHoldout(id, holdoutSpecFromConfig('secondVisitVoucher')) },
      at: new Date(), payment: { intentId: pi.id, amountFils: 5_800, cartHash: 'c', captureRef: 'cap' },
    };
    const d0 = await dump(store.db);
    for (const at of [/update payment_intents set/, /insert into point_history/, /update members set/]) {
      const dying = createPostgresBackend(crashingOn(store.db, at));
      await expect(dying.checkout(id, input), String(at)).rejects.toThrow(/simulated crash/);
      expect(await dump(store.db), String(at)).toEqual(d0);
    }
    const r = await ok.checkout(id, input);
    expect((await ok.getPaymentIntent(pi.id))?.orderId).toBe(r.order.id);
  }, 60_000);
});

const pg2 = (db: Db) => (m: typeof import('../src/backend/postgres')) => m.createPostgresBackend(db);

afterAll(() => { /* each test owns and closes its own database */ });

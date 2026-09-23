import { describe, it, expect, afterAll, vi } from 'vitest';
import { randomInt, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import { liveBalance } from '@almond/shared/loyalty/lots';
import { assignHoldout, holdoutSpecFromConfig } from '@almond/shared/loyalty/holdout';
import { createMemoryBackend } from '../src/backend/memory';
import { createPostgresBackend } from '../src/backend/postgres';
import { fromPglite, fromPool, type Db } from '../src/backend/db';
import type { Backend } from '../src/backend';
import { pgTestDb } from './lib/pgTestDb';

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
const MIGRATION = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'supabase', 'migrations', '20260909_loyalty_backend.sql'),
  'utf8',
);
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
    await b.activateSubscription(m.id);
    await b.redeemSubscriptionDrink(m.id);
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
      subscription: await b.getSubscription(id),
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
    'companies', 'corporate_roster', 'corporate_uses']) {
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
    expect(m.subscription.redeemedToday).toBe(1);
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

/**
 * R2.6 🔴 KNOWN GAP, PINNED — the Idempotency-Key does NOT survive a restart.
 *
 * bff/src/plugins/idempotency.ts keeps its keys in a module-level Map. The
 * money is durable (Postgres) but the memory of which requests already moved
 * it is not. The sequence below is an ordinary production event: a member
 * redeems points, the process dies (deploy, OOM, crash) before the phone reads
 * the 201, the phone retries with the SAME key — exactly what the key is for —
 * and the restarted process, holding an empty Map, spends the points AGAIN
 * and mints a second code. The same holds across two instances behind a load
 * balancer, with no restart at all. (/v1/loyalty/redeem is used because it is
 * live in production; /v1/wallet/topup is now refused there, and /v1/checkout
 * paying from the wallet has the same shape.)
 *
 * A "restart" here is a fresh module graph (vi.resetModules) over the SAME
 * database — which is precisely what a new process has. This test asserts the
 * CURRENT, UNSAFE outcome (spent twice) so it cannot pass by accident; when
 * the key store moves into Postgres it goes red — then assert 700.
 */
describe('R2.6 KNOWN GAP (pinned): Idempotency-Key across a restart', () => {
  it('a retried redeem after a restart spends the points TWICE', async () => {
    const db = await pgTestDb();
    const boot = async () => {
      vi.resetModules();                                   // a new process: fresh module state
      const { build } = await import('../src/server');
      const pgMod = await import('../src/backend/postgres');
      return build(pgMod.createPostgresBackend(db));
    };
    const b = createPostgresBackend(db);
    const id = (await b.findOrCreateByPhone(phone())).id;
    await b.addPoints(id, 1_000, 'منحة', 'Grant');
    const key = randomUUID();
    const redeem = async (app: Awaited<ReturnType<typeof boot>>) => app.inject({
      method: 'POST', url: '/v1/loyalty/redeem', payload: { points: 300 },
      headers: { authorization: `Bearer ${app.jwt.sign({ sub: id })}`, 'idempotency-key': key },
    });
    const points = async () => liveBalance((await createPostgresBackend(db).getMember(id)).lots);

    const app1 = await boot();
    const first = await redeem(app1);
    expect(first.statusCode).toBe(201);
    // Same process: the key works — a replay is a replay.
    const replay = await redeem(app1);
    expect(replay.headers['idempotent-replay']).toBe('true');
    expect(replay.json()).toEqual(first.json());
    expect(await points()).toBe(700);
    await app1.close();                                    // the process dies

    const app2 = await boot();                             // …and comes back
    const retry = await redeem(app2);
    expect(retry.statusCode).toBe(201);
    expect(retry.headers['idempotent-replay']).toBeUndefined();
    expect(retry.json().redemption.id).not.toBe(first.json().redemption.id);
    // SAFE STATE WOULD BE: 700, and `retry` a replay of `first`.
    expect(await points()).toBe(400);
    await app2.close();
  }, 60_000);
});

afterAll(() => { /* each test owns and closes its own database */ });

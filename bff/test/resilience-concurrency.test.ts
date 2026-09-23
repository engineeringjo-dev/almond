import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomInt, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type { FastifyInstance } from 'fastify';
import { liveBalance } from '@almond/shared/loyalty/lots';
import { menuItems } from '@almond/shared/menu';
import { assignHoldout, holdoutSpecFromConfig } from '@almond/shared/loyalty/holdout';
import { createMemoryBackend } from '../src/backend/memory';
import { createPostgresBackend } from '../src/backend/postgres';
import { fromPool, type Db } from '../src/backend/db';
import type { Backend } from '../src/backend';
import { build } from '../src/server';
import { config } from '../src/config';
import { pgTestDb } from './lib/pgTestDb';
import { loyaltySchemaSql } from './lib/schema';
import { signIn } from './lib/signIn';

/**
 * R1 — MONEY UNDER CONCURRENCY. Points and wallet fils are money; this file
 * asserts that no interleaving of requests can mint, duplicate or lose them.
 *
 * 🔴 WHAT EACH HARNESS PROVES — READ THIS BEFORE TRUSTING A GREEN RUN.
 *
 *  memory     One JS thread. A method is atomic iff it has no `await` between
 *             its check and its write. Parallel calls here DO interleave at
 *             every `await`, so an await slipped between a guard and its write
 *             turns these tests red (mutation-checked, see the report).
 *
 *  pglite     The real SQL on Postgres-in-WASM — but ONE connection. db.ts now
 *             serialises whole transactions on it (it used to interleave them:
 *             ten parallel spends of 30 on a balance of 100 all succeeded).
 *             So this proves the LOGIC is right under any ORDER of whole
 *             transactions, and proves NOTHING about row locks: with the
 *             member row lock (`FOR NO KEY UPDATE`) deleted from postgres.ts
 *             it stays green. That is why R1.8 captures the SQL and pins the
 *             lock textually.
 *
 *  real-pg    A real PostgreSQL through `pg.Pool` (max 20) — genuine parallel
 *             sessions contending for the same row. Runs only when
 *             ALMOND_TEST_PG_URL is set (a throwaway database is created and
 *             dropped per suite), e.g.
 *               ALMOND_TEST_PG_URL='postgresql://postgres@localhost/postgres?host=/path/to/sock'
 *             Unset (CI today) it is SKIPPED, not faked. With it set, deleting
 *             the row lock from withMember produces a real double-spend here.
 */

const PG_URL = process.env.ALMOND_TEST_PG_URL;
/** Every loyalty migration, in order (lib/schema.ts) — the HTTP tests below
 *  need 20260924's idempotency_keys as much as the base tables. */
const MIGRATION = loyaltySchemaSql();

interface Harness {
  backend: Backend;
  db?: Db;
  close(): Promise<void>;
}

/** A throwaway database on a real server, migrated from the real file. */
async function realPg(): Promise<Harness & { db: Db; url: string }> {
  const admin = new Pool({ connectionString: PG_URL, max: 1 });
  const name = `resil_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  await admin.query(`create database ${name}`);
  const url = new URL(PG_URL!);
  url.pathname = `/${name}`;
  const pool = new Pool({ connectionString: url.toString(), max: 20 });
  await pool.query(MIGRATION);
  const db = fromPool(pool);
  return {
    db,
    url: url.toString(),
    backend: createPostgresBackend(db),
    async close() {
      await pool.end();
      await admin.query(`drop database if exists ${name}`);
      await admin.end();
    },
  };
}

const HARNESSES: [string, () => Promise<Harness>][] = [
  ['memory', async () => ({ backend: createMemoryBackend(), close: async () => {} })],
  ['pglite', async () => { const db = await pgTestDb(); return { db, backend: createPostgresBackend(db), close: async () => {} }; }],
  ...(PG_URL ? [['real-pg', realPg] as [string, () => Promise<Harness>]] : []),
];

/** A fresh Jordanian mobile per call: canonical for the backend, local for OTP. */
const newPhone = () => {
  const d = String(randomInt(1_000_000, 10_000_000));
  return { canonical: `+96279${d}`, local: `079${d}` };
};

/** Count settled outcomes of a parallel burst. */
async function burst<T>(n: number, fn: (i: number) => Promise<T>) {
  const rs = await Promise.allSettled(Array.from({ length: n }, (_, i) => fn(i)));
  const ok = rs.filter((r): r is PromiseFulfilledResult<Awaited<T>> => r.status === 'fulfilled').map((r) => r.value);
  const errs = rs.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => (r.reason as { code?: string }).code ?? String(r.reason));
  return { ok, errs };
}

describe.each(HARNESSES)('R1 concurrency — %s', (_name, make) => {
  let h: Harness;
  beforeAll(async () => { h = await make(); }, 60_000);
  afterAll(async () => { await h?.close(); });

  const member = async () => (await h.backend.findOrCreateByPhone(newPhone().canonical)).id;
  const balance = async (id: string) => liveBalance((await h.backend.getMember(id)).lots);
  const ledgerSum = async (id: string) =>
    (await h.backend.getHistory(id)).reduce((s, e) => s + e.deltaPoints, 0);

  it('R1.1 🔴 N parallel point spends exceeding the balance: exactly the affordable ones succeed', async () => {
    const id = await member();
    await h.backend.addPoints(id, 100, 'منحة', 'Grant');
    const { ok, errs } = await burst(20, () => h.backend.spendPoints(id, 15, 'صرف', 'Spend'));
    expect(ok).toHaveLength(6);                               // floor(100 / 15)
    expect(errs).toHaveLength(14);
    expect(new Set(errs)).toEqual(new Set(['insufficient_points']));
    expect(Math.min(...ok)).toBeGreaterThanOrEqual(0);        // no reply ever saw a negative
    expect(await balance(id)).toBe(10);
    expect(await ledgerSum(id)).toBe(10);                     // history reconciles with lots
    // Every successful reply is a distinct post-spend balance: they were
    // applied one after another, not two against the same read.
    expect(new Set(ok).size).toBe(6);
  }, 60_000);

  it('R1.2 🔴 N parallel wallet debits exceeding the balance: no overdraft, no lost debit', async () => {
    const id = await member();
    await h.backend.creditWallet(id, 10_000, 'topup');
    const { ok, errs } = await burst(25, () => h.backend.debitWallet(id, 1_000));
    expect(ok).toHaveLength(10);
    expect(new Set(errs)).toEqual(new Set(['insufficient_wallet']));
    expect(liveBalance((await h.backend.getMember(id)).walletLots)).toBe(0);
    expect(new Set(ok).size).toBe(10);
  }, 60_000);

  it('R1.3 🔴 parallel redemptions exceeding the balance mint only what is affordable', async () => {
    const id = await member();
    await h.backend.addPoints(id, 500, 'منحة', 'Grant');
    const { ok, errs } = await burst(10, () => h.backend.createRedemption(id, 100));
    expect(ok).toHaveLength(5);
    expect(new Set(errs)).toEqual(new Set(['insufficient_points']));
    expect(new Set(ok.map((r) => r.code)).size).toBe(5);     // five distinct codes
    expect(await balance(id)).toBe(0);
    expect(await ledgerSum(id)).toBe(0);
  }, 60_000);

  it('R1.4 🔴 the same redemption settled in parallel: exactly one settlement', async () => {
    const id = await member();
    await h.backend.addPoints(id, 300, 'منحة', 'Grant');
    const r = await h.backend.createRedemption(id, 200);
    const at = new Date();
    const { ok, errs } = await burst(8, (i) => h.backend.settleRedemption(r.id, i % 2 ? 'pos' : 'web', at));
    expect(ok).toHaveLength(1);
    expect(errs).toEqual(Array(7).fill('redemption_already_settled'));
    // …and sequentially, after the fact.
    await expect(h.backend.settleRedemption(r.id, 'pos', at)).rejects.toMatchObject({ code: 'redemption_already_settled' });
    // A settled code is never refunded, however late the sweep.
    const late = new Date(Date.parse(r.expiresAt) + 60_000);
    expect(await h.backend.sweepRedemptions(id, late)).toBe(0);
    expect(await balance(id)).toBe(100);
    expect(await ledgerSum(id)).toBe(100);
  }, 60_000);

  it('R1.5 🔴 an expired redemption refunds EXACTLY once — parallel sweeps, and a cancel racing them', async () => {
    const id = await member();
    await h.backend.addPoints(id, 500, 'منحة', 'Grant');
    const r = await h.backend.createRedemption(id, 200);
    const past = new Date(Date.parse(r.expiresAt) + 1_000);
    const [sweeps, cancels] = await Promise.all([
      burst(8, () => h.backend.sweepRedemptions(id, past)),
      burst(4, () => h.backend.cancelRedemption(id, r.id, past)),
    ]);
    const refundedBySweep = sweeps.ok.reduce((s, n) => s + n, 0);
    expect(refundedBySweep).toBeLessThanOrEqual(1);
    expect(sweeps.errs).toEqual([]);
    expect(cancels.errs).toEqual([]);                         // cancel is idempotent
    expect(await balance(id)).toBe(500);                      // back IN FULL, not 700
    expect(await ledgerSum(id)).toBe(500);
    const refundLines = (await h.backend.getHistory(id)).filter((e) => e.deltaPoints === 200);
    expect(refundLines).toHaveLength(1);                      // one refund line, not two
    // And a refunded code can no longer be spent.
    await expect(h.backend.settleRedemption(r.id, 'pos', new Date(Date.parse(r.createdAt) + 1)))
      .rejects.toMatchObject({ code: 'redemption_cancelled' });
  }, 60_000);

  it('R1.6 🔴 a settle racing the expiry sweep: settled XOR refunded, never both, never neither', async () => {
    for (let round = 0; round < 5; round += 1) {
      const id = await member();
      await h.backend.addPoints(id, 500, 'منحة', 'Grant');
      const r = await h.backend.createRedemption(id, 200);
      const beforeExpiry = new Date(Date.parse(r.expiresAt) - 1_000);
      const afterExpiry = new Date(Date.parse(r.expiresAt) + 1_000);
      const [settle, sweep] = await Promise.allSettled([
        h.backend.settleRedemption(r.id, 'pos', beforeExpiry),
        h.backend.sweepRedemptions(id, afterExpiry),
      ]);
      const settled = settle.status === 'fulfilled';
      const refunded = sweep.status === 'fulfilled' && sweep.value === 1;
      expect(Number(settled) + Number(refunded), `round ${round}`).toBe(1);
      expect(await balance(id)).toBe(settled ? 300 : 500);
      expect(await ledgerSum(id)).toBe(settled ? 300 : 500);
    }
  }, 60_000);

  it('R1.7 🔴 a mixed parallel storm conserves every point', async () => {
    const id = await member();
    await h.backend.addPoints(id, 1_000, 'منحة', 'Grant');
    const ops: (() => Promise<unknown>)[] = [];
    for (let i = 0; i < 12; i += 1) ops.push(() => h.backend.addPoints(id, 10, 'منحة', 'Grant'));
    for (let i = 0; i < 12; i += 1) ops.push(() => h.backend.spendPoints(id, 70, 'صرف', 'Spend'));
    let cancelledCodes = 0;
    for (let i = 0; i < 8; i += 1) {
      ops.push(async () => {
        const r = await h.backend.createRedemption(id, 50);
        if (i % 2 === 0) cancelledCodes += 1;
        // Half get settled twice at once, half cancelled twice at once.
        if (i % 2) await Promise.allSettled([1, 2].map(() => h.backend.settleRedemption(r.id, 'pos', new Date())));
        else await Promise.allSettled([1, 2].map(() => h.backend.cancelRedemption(id, r.id, new Date())));
        return r;
      });
    }
    await Promise.allSettled(ops.map((f) => f()));
    const bal = await balance(id);
    expect(bal).toBeGreaterThanOrEqual(0);
    // The history is the complete ledger: every lot movement has a line.
    expect(await ledgerSum(id)).toBe(bal);
    // Conservation: grants − spends − redemptions that were NOT given back.
    const hist = await h.backend.getHistory(id);
    const spent = hist.filter((e) => e.reasonEn === 'Spend').length * 70;
    const redeemed = hist.filter((e) => e.reasonEn === 'Points redeemed').length * 50;
    const returned = hist.filter((e) => e.reasonEn === 'Redemption cancelled').length * 50;
    expect(bal).toBe(1_000 + 12 * 10 - spent - redeemed + returned);
    // Each cancelled code returned its points once — two parallel cancels of
    // one code must not refund it twice. (How many codes were minted depends on
    // the race with the spends; that they were each refunded once does not.)
    expect(returned).toBe(cancelledCodes * 50);
    expect(cancelledCodes).toBeGreaterThan(0);
  }, 60_000);

  it('R1.14 🔴 N parallel wallet checkouts exceeding the balance: no overdraft, and an order only where money moved', async () => {
    const id = await member();
    await h.backend.creditWallet(id, 10_000, 'topup');
    const { ok, errs } = await burst(12, () => h.backend.checkout(id, {
      order: { branchId: 'b1', type: 'pickup', paymentMethod: 'wallet', subtotal: 2.78, tax: 0.22, total: 3 },
      walletDebitFils: 3_000, pointsEarned: 22, pointsReasonAr: 'نقاط طلب', pointsReasonEn: 'Order points',
      earn: { points: 22 } as never, spendJod: 3, corporateUse: null,
      secondVisit: { basketHasDrink: true, arm: assignHoldout(id, holdoutSpecFromConfig('secondVisitVoucher')) },
      at: new Date(),
    }));
    expect(ok).toHaveLength(3);                               // floor(10 / 3)
    expect(new Set(errs)).toEqual(new Set(['insufficient_wallet']));
    expect(liveBalance((await h.backend.getMember(id)).walletLots)).toBe(1_000);
    expect(new Set(ok.map((r) => r.order.id)).size).toBe(3);
    expect(new Set(ok.map((r) => r.walletBalanceFils))).toEqual(new Set([7_000, 4_000, 1_000]));
    // Points and window only for the three that paid — a refused one wrote nothing.
    expect(await balance(id)).toBe(66);
    expect(await ledgerSum(id)).toBe(66);
    expect((await h.backend.getStanding(id)).windowSpend).toBe(9);
    if (h.db) {
      const orders = await h.db.query<{ n: number }>('select count(*)::int as n from orders where member_id = $1', [id]);
      expect(orders[0].n).toBe(3);
    }
  }, 60_000);

  it('R1.9 two parallel first sign-ins with one phone create ONE member', async () => {
    const p = newPhone().canonical;
    const { ok, errs } = await burst(6, () => h.backend.findOrCreateByPhone(p));
    expect(errs).toEqual([]);
    expect(new Set(ok.map((m) => m.id)).size).toBe(1);
  }, 60_000);

  // ---- through HTTP: the Idempotency-Key and the checkout grant ----

  describe('over HTTP', () => {
    let app: FastifyInstance;
    const auth = (token: string, key?: string) => ({
      authorization: `Bearer ${token}`, ...(key ? { 'idempotency-key': key } : {}),
    });
    beforeAll(async () => { app = await build(h.backend); });
    afterAll(async () => { await app?.close(); });

    it('R1.10 🔴 a replayed Idempotency-Key on /v1/wallet/topup: one credit, identical response', async () => {
      const token = await signIn(app, newPhone().local);
      const key = randomUUID();
      const send = () => app.inject({
        method: 'POST', url: '/v1/wallet/topup', payload: { amount: 20 }, headers: auth(token, key),
      });
      const first = await send();
      expect(first.statusCode).toBe(201);
      const again = await send();
      expect(again.statusCode).toBe(201);
      expect(again.headers['idempotent-replay']).toBe('true');
      expect(again.json()).toEqual(first.json());
      // Parallel replays of the same key, after the fact: all replays.
      const par = await Promise.all(Array.from({ length: 6 }, send));
      for (const r of par) expect(r.json()).toEqual(first.json());
      const id = await memberIdOf(app, token);
      expect(liveBalance((await h.backend.getMember(id)).walletLots)).toBe(20_000);   // once, not 8×

      // CONTROL: the test can see a double effect — a NEW key credits again.
      await app.inject({ method: 'POST', url: '/v1/wallet/topup', payload: { amount: 20 }, headers: auth(token, randomUUID()) });
      expect(liveBalance((await h.backend.getMember(id)).walletLots)).toBe(40_000);
    }, 60_000);

    it('R1.11 🔴 the same Idempotency-Key fired in PARALLEL on /v1/loyalty/redeem spends once', async () => {
      const token = await signIn(app, newPhone().local);
      const id = await memberIdOf(app, token);
      await h.backend.addPoints(id, 1_000, 'منحة', 'Grant');
      const key = randomUUID();
      const rs = await Promise.all(Array.from({ length: 8 }, () => app.inject({
        method: 'POST', url: '/v1/loyalty/redeem', payload: { points: 300 }, headers: auth(token, key),
      })));
      const codes = rs.map((r) => r.statusCode).sort();
      expect(codes.filter((c) => c === 201).length).toBeGreaterThanOrEqual(1);
      // The rest are either "in progress" or a replay of the SAME redemption.
      expect(codes.every((c) => c === 201 || c === 409)).toBe(true);
      const redemptionIds = new Set(rs.filter((r) => r.statusCode === 201).map((r) => r.json().redemption.id));
      expect(redemptionIds.size).toBe(1);
      for (const r of rs.filter((x) => x.statusCode === 409)) expect(r.json().error).toBe('request_in_progress');
      expect(await balance(id)).toBe(700);
      const replay = await app.inject({
        method: 'POST', url: '/v1/loyalty/redeem', payload: { points: 300 }, headers: auth(token, key),
      });
      expect(replay.json()).toEqual(rs.find((r) => r.statusCode === 201)!.json());
      expect(await balance(id)).toBe(700);
    }, 60_000);

    it('R1.12 🔴 parallel checkouts of one order (one Idempotency-Key) credit the points ONCE', async () => {
      const token = await signIn(app, newPhone().local);
      const id = await memberIdOf(app, token);
      const item = menuItems.find((m) => m.inStock !== false && m.sizes.length > 0)!;
      const body = {
        branchId: 'b1', orderType: 'pickup', paymentMethod: 'cash',
        lines: Array.from({ length: 5 }, () => ({ itemId: item.id, sizeId: item.sizes[0].id, optionIds: [], qty: 2 })),
      };
      const key = randomUUID();
      const rs = await Promise.all(Array.from({ length: 8 }, () => app.inject({
        method: 'POST', url: '/v1/checkout', payload: body, headers: auth(token, key),
      })));
      const created = rs.filter((r) => r.statusCode === 201);
      expect(new Set(created.map((r) => r.json().orderId)).size).toBe(1);
      expect(rs.every((r) => r.statusCode === 201 || r.statusCode === 409)).toBe(true);
      const earned = created[0].json().pointsEarned as number;
      expect(earned).toBeGreaterThan(0);                      // otherwise "once" proves nothing
      const orderLines = (await h.backend.getHistory(id)).filter((e) => e.reasonEn === 'Order points');
      expect(orderLines).toHaveLength(1);
      expect(await balance(id)).toBe(earned);
      // Replayed afterwards: same order id, still one grant.
      const replay = await app.inject({ method: 'POST', url: '/v1/checkout', payload: body, headers: auth(token, key) });
      expect(replay.json().orderId).toBe(created[0].json().orderId);
      expect(await balance(id)).toBe(earned);
    }, 60_000);

    it('R1.13 the POS settle route: one code presented at two tills at once settles once', async () => {
      const posKey = 'resilience-pos-key-'.padEnd(32, 'x');
      const prev = config.POS_SCAN_KEY;
      (config as unknown as { POS_SCAN_KEY: string }).POS_SCAN_KEY = posKey;
      try {
        const token = await signIn(app, newPhone().local);
        const id = await memberIdOf(app, token);
        await h.backend.addPoints(id, 400, 'منحة', 'Grant');
        const r = await h.backend.createRedemption(id, 250);
        const rs = await Promise.all(Array.from({ length: 6 }, () => app.inject({
          method: 'POST', url: '/v1/pos/redemption/settle',
          payload: { code: r.code }, headers: { 'x-pos-key': posKey },
        })));
        expect(rs.filter((x) => x.statusCode === 201)).toHaveLength(1);
        for (const x of rs.filter((y) => y.statusCode !== 201)) {
          expect(x.statusCode).toBe(409);
          expect(x.json().error).toBe('redemption_already_settled');
        }
        expect(await balance(id)).toBe(150);
      } finally {
        (config as unknown as { POS_SCAN_KEY: string }).POS_SCAN_KEY = prev;
      }
    }, 60_000);
  });
});

async function memberIdOf(app: FastifyInstance, token: string): Promise<string> {
  return (app.jwt.decode(token) as { sub: string }).sub;
}

// ---- R1.8: the lock, pinned in the SQL itself ----

type Group = { tx: boolean; sql: string[] };

/** A Db that forwards everything and writes down which statements ran in
 *  which transaction. The backend cannot tell it apart from the real one. */
function recording(inner: Db, groups: Group[]): Db {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const child = (t: Db, g: Group): Db => ({
    query<T>(text: string, params?: unknown[]) { g.sql.push(norm(text)); return t.query<T>(text, params); },
    tx<T>(fn: (x: Db) => Promise<T>) { return fn(child(t, g)); },
  });
  return {
    query<T>(text: string, params?: unknown[]) {
      groups.push({ tx: false, sql: [norm(text)] });
      return inner.query<T>(text, params);
    },
    tx<T>(fn: (x: Db) => Promise<T>) {
      return inner.tx((t) => { const g: Group = { tx: true, sql: [] }; groups.push(g); return fn(child(t, g)); });
    },
  };
}

describe('R1.8 🔴 postgres.ts takes a row lock (FOR NO KEY UPDATE on members) before every read-modify-write (SQL capture)', () => {
  const MUTABLE = ['members', 'redemptions', 'second_visit_vouchers'];
  let groups: Group[];
  let b: Backend;
  beforeAll(async () => { groups = []; b = createPostgresBackend(recording(await pgTestDb(), groups)); }, 60_000);

  /** Run one backend call and return the transactions it opened. */
  const during = async (fn: () => Promise<unknown>) => {
    const from = groups.length;
    await fn();
    return groups.slice(from);
  };

  /** The discipline, stated once: inside a transaction, a table is only ever
   *  UPDATEd after this same transaction SELECTed it FOR UPDATE; and no
   *  mutable row is UPDATEd outside a transaction at all. */
  const assertLocked = (gs: Group[], label: string) => {
    for (const g of gs) {
      g.sql.forEach((s, i) => {
        const m = /^update (\w+) set/.exec(s);
        if (!m || !MUTABLE.includes(m[1])) return;
        expect(g.tx, `${label}: "${s}" ran outside a transaction`).toBe(true);
        const locked = g.sql.slice(0, i).some((p) =>
          new RegExp(`^select .* from ${m[1]} .*for (no key )?update$`).test(p));
        expect(locked, `${label}: "${s}" without a prior SELECT … FROM ${m[1]} … FOR UPDATE`).toBe(true);
      });
    }
  };

  it('every money-moving method locks the member row first, in ONE transaction', async () => {
    const id = (await b.findOrCreateByPhone(newPhone().canonical)).id;
    const cases: [string, () => Promise<unknown>][] = [
      ['addPoints', () => b.addPoints(id, 500, 'أ', 'A')],
      ['spendPoints', () => b.spendPoints(id, 10, 'ب', 'B')],
      ['creditWallet', () => b.creditWallet(id, 5_000, 'topup')],
      ['debitWallet', () => b.debitWallet(id, 1_000)],
      ['setProfile', () => b.setProfile(id, { name: 'حمزة', birthday: null })],
      ['recordSpend', () => b.recordSpend(id, 12)],
      ['createRedemption', () => b.createRedemption(id, 100)],
      ['sweepRedemptions', () => b.sweepRedemptions(id, new Date())],
      ['activateSubscription', () => b.activateSubscription(id)],
      ['redeemSubscriptionDrink', () => b.redeemSubscriptionDrink(id)],
      // The composite movements that replaced multi-transaction sagas: ONE
      // transaction each, and it is the member lock that opens it.
      ['topUpWallet', () => b.topUpWallet(id, 20_000, 50, 'أ', 'A')],
      ['purchaseSubscription', () => b.purchaseSubscription(id, 1_000)],
      ['checkout', () => b.checkout(id, {
        order: { branchId: 'b1', type: 'pickup', paymentMethod: 'wallet', subtotal: 3, tax: 0.24, total: 3.24 },
        walletDebitFils: 3_240, pointsEarned: 16, pointsReasonAr: 'نقاط طلب', pointsReasonEn: 'Order points',
        earn: { points: 16 } as never, spendJod: 3.24, corporateUse: null,
        secondVisit: { basketHasDrink: true, arm: assignHoldout(id, holdoutSpecFromConfig('secondVisitVoucher')) },
        at: new Date(),
      })],
    ];
    for (const [label, call] of cases) {
      const gs = await during(call);
      const txs = gs.filter((g) => g.tx);
      expect(txs, `${label}: expected exactly one transaction`).toHaveLength(1);
      expect(txs[0].sql[0], label).toBe('select * from members where id = $1 for no key update');
      expect(txs[0].sql.some((s) => s.startsWith('update members set')), label).toBe(true);
      assertLocked(gs, label);
    }
  });

  it('settle, cancel and the voucher lock the row they flip', async () => {
    const id = (await b.findOrCreateByPhone(newPhone().canonical)).id;
    await b.addPoints(id, 900, 'أ', 'A');
    const r1 = await b.createRedemption(id, 100);
    let gs = await during(() => b.settleRedemption(r1.id, 'pos', new Date()));
    expect(gs.filter((g) => g.tx)[0].sql[0]).toBe('select * from redemptions where id = $1 for update');
    assertLocked(gs, 'settleRedemption');

    const r2 = await b.createRedemption(id, 100);
    gs = await during(() => b.cancelRedemption(id, r2.id, new Date()));
    assertLocked(gs, 'cancelRedemption');
    expect(gs.filter((g) => g.tx)).toHaveLength(1);

    const r3 = await b.createRedemption(id, 100);
    gs = await during(() => b.sweepRedemptions(id, new Date(Date.parse(r3.expiresAt) + 1)));
    assertLocked(gs, 'sweepRedemptions(refund)');
    expect(gs[0].sql.some((s) => /^select \* from redemptions .*for update$/.test(s))).toBe(true);

    // The second-visit voucher: issue (locks the member) and redeem (locks its row).
    const order = await b.createOrder({
      memberId: id, branchId: 'b1', type: 'pickup', paymentMethod: 'cash',
      subtotal: 3, tax: 0.24, total: 3.24, pointsEarned: 0,
    });
    gs = await during(() => b.evaluateSecondVisitVoucher({
      memberId: id, orderId: order.id, basketHasDrink: true,
      arm: assignHoldout(id, holdoutSpecFromConfig('secondVisitVoucher')), at: new Date(),
    }));
    expect(gs.filter((g) => g.tx)[0].sql[0]).toBe('select * from members where id = $1 for no key update');
    gs = await during(() => b.redeemSecondVisitVoucher(id, new Date()).catch(() => null));
    expect(gs.filter((g) => g.tx)[0].sql[0]).toBe('select * from second_visit_vouchers where member_id = $1 for update');
    assertLocked(gs, 'redeemSecondVisitVoucher');
  });

  it.skipIf(!PG_URL)('real-pg: the member lock blocks another money write but NOT an order insert for that member', async () => {
    const h = await realPg();
    const pool = new Pool({ connectionString: h.url, max: 2 });
    const other = await pool.connect();
    let release: () => void = () => {};
    let inFlight: Promise<unknown> = Promise.resolve();
    try {
      const id = (await h.backend.findOrCreateByPhone(newPhone().canonical)).id;
      // Hold a REAL backend transaction open with its member lock taken —
      // whatever lock withMember actually takes — by pausing it at its write.
      const gate = new Promise<void>((r) => { release = r; });
      let locked!: () => void;
      const isLocked = new Promise<void>((r) => { locked = r; });
      const pausing: Db = {
        query: (text, params) => h.db.query(text, params),
        tx: (fn) => h.db.tx((t) => fn({
          async query<T>(text: string, params?: unknown[]) {
            if (/^\s*update members set/.test(text)) { locked(); await gate; }
            return t.query<T>(text, params);
          },
          tx: (f) => f(t),
        })),
      };
      inFlight = createPostgresBackend(pausing).addPoints(id, 10, 'منحة', 'Grant');
      await isLocked;
      await other.query(`set statement_timeout = '1500ms'`);
      // An FK insert takes FOR KEY SHARE on the member row. Under FOR NO KEY
      // UPDATE it goes straight through; under FOR UPDATE it would queue
      // behind the money write and die on the timeout here.
      await other.query(`insert into orders (id, member_id, branch_id, order_type, payment_method, total)
        values ('o_while_locked', $1, 'b1', 'pickup', 'cash', 1)`, [id]);
      // A second money write on the same member still waits — the serialisation
      // every balance guard rests on is intact.
      await expect(other.query('select * from members where id = $1 for no key update', [id]))
        .rejects.toMatchObject({ code: '57014' });                       // canceled by the timeout
      release();
      expect(await inFlight).toBe(10);
    } finally {
      release();                                                        // never leave the tx hanging
      await inFlight.catch(() => {});
      other.release();
      await pool.end();
      await h.close();
    }
  }, 60_000);

  it('a top-level query issued from inside a transaction fails loudly (both adapters)', async () => {
    const db = await pgTestDb();
    await expect(db.tx(async () => db.query('select 1'))).rejects.toThrow(/inside a transaction/);
    // …and the adapter is still usable afterwards: the failed tx was rolled back.
    expect(await db.query('select 1 as n')).toEqual([{ n: 1 }]);
    if (PG_URL) {
      const pool = new Pool({ connectionString: PG_URL, max: 2 });
      const pdb = fromPool(pool);
      try {
        await expect(pdb.tx(async () => pdb.query('select 1'))).rejects.toThrow(/inside a transaction/);
        expect(await pdb.query('select 1 as n')).toEqual([{ n: 1 }]);
      } finally { await pool.end(); }
    }
  }, 60_000);
});

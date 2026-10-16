import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { liveBalance, type PointLot, type SpentSlice } from '@almond/shared/loyalty/lots';
import { restoreRedemptionPoints, toRedemptionView } from '@almond/shared/loyalty/redemption';
import { createMemoryBackend } from '../src/backend/memory';
import { createPostgresBackend } from '../src/backend/postgres';
import { fromPglite, type Db } from '../src/backend/db';
import type { Backend } from '../src/backend';
import { LOYALTY_MIGRATIONS, loyaltySchemaSql, readMigration } from './lib/schema';

const NOW = '2026-10-16T10:00:00Z';
const lots = (): PointLot[] => [
  { seq: 0, grantedOn: '2025-10-16', expiresOn: '2026-10-16', amount: 60, remaining: 60, source: 'earn' },
  { seq: 1, grantedOn: '2026-09-20', expiresOn: '2027-09-20', amount: 70, remaining: 70, source: 'bonus' },
];
const originalSlices: SpentSlice[] = [
  { grantedOn: '2025-10-16', expiresOn: '2026-10-16', points: 60, source: 'earn' },
  { grantedOn: '2026-09-20', expiresOn: '2027-09-20', points: 20, source: 'bonus' },
];
let phone = 1;

/** Same attack and recovery invariants against the runnable and durable stores. */
describe.each(['memory', 'postgres'] as const)('redemption keeps FIFO expiry — %s', (kind) => {
  let pg: PGlite | undefined;
  let db: Db | undefined;
  let backend: Backend;
  beforeAll(async () => {
    if (kind === 'postgres') {
      pg = new PGlite();
      await pg.waitReady;
      await pg.exec(loyaltySchemaSql());
      db = fromPglite(pg);
    }
  });
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    backend = db ? createPostgresBackend(db) : createMemoryBackend();
  });
  afterEach(() => { vi.useRealTimers(); });
  afterAll(async () => { await pg?.close(); });

  const member = async () => {
    const m = await backend.findOrCreateByPhone(`+962790${String(phone++).padStart(6, '0')}`);
    if (db) await db.query('update members set lots = $2, expiry_settled_through = $3 where id = $1',
      [m.id, JSON.stringify(lots()), '2026-10-15']);
    else { m.lots = lots(); m.expirySettledThrough = '2026-10-15'; }
    return m.id;
  };

  it('stores the original spent slices and cancellation cannot renew their expiry', async () => {
    const id = await member();
    const made = await backend.createRedemption(id, 80);
    expect(made).toMatchObject({ slices: originalSlices });
    const cancelled = await backend.cancelRedemption(id, made.id, new Date());
    expect(cancelled).toMatchObject({ returnedPoints: 80, expiredPoints: 0, refundReviewRequired: false });
    const active = (await backend.getMember(id)).lots.filter((l) => l.remaining > 0);
    expect(active.filter((l) => l.grantedOn === '2025-10-16').every((l) => l.expiresOn === '2026-10-16')).toBe(true);
    expect(liveBalance(active, new Date('2026-10-17T10:00:00Z'))).toBe(70);
    await backend.cancelRedemption(id, made.id, new Date());
    expect(liveBalance((await backend.getMember(id)).lots)).toBe(130);
    expect((await backend.getHistory(id)).filter((h) => h.kind === 'return')).toHaveLength(1);
  });

  it('cancel after an original lot expires returns only live slices and never resurrects the old points', async () => {
    const id = await member();
    const made = await backend.createRedemption(id, 80);
    vi.setSystemTime(new Date('2026-10-17T10:00:00Z'));
    const cancelled = await backend.cancelRedemption(id, made.id, new Date());
    expect(cancelled).toMatchObject({ returnedPoints: 20, expiredPoints: 60, refundReviewRequired: false });
    expect(liveBalance((await backend.getMember(id)).lots)).toBe(70);
    expect((await backend.getHistory(id)).find((h) => h.kind === 'return')?.deltaPoints).toBe(20);
    await backend.cancelRedemption(id, made.id, new Date());
    expect(liveBalance((await backend.getMember(id)).lots)).toBe(70);
  });

  it('an unused expired redemption returns live slices once, including after a durable backend restart', async () => {
    const id = await member();
    const made = await backend.createRedemption(id, 80);
    if (db) backend = createPostgresBackend(db);
    vi.setSystemTime(new Date('2026-10-17T10:00:00Z'));
    expect(await backend.sweepRedemptions(id, new Date())).toBe(1);
    expect(liveBalance((await backend.getMember(id)).lots)).toBe(70);
    const stored = await backend.findRedemptionByCode(made.code);
    expect(stored).toMatchObject({ slices: originalSlices, returnedPoints: 20, expiredPoints: 60, refundReviewRequired: false });
    expect(await backend.sweepRedemptions(id, new Date())).toBe(0);
    await backend.cancelRedemption(id, made.id, new Date());
    expect(liveBalance((await backend.getMember(id)).lots)).toBe(70);
    await expect(backend.settleRedemption(made.id, 'pos', new Date())).rejects.toMatchObject({ code: 'redemption_cancelled' });
  });

  it('repeating redeem/cancel cycles never gives old points a new lifetime', async () => {
    const id = await member();
    for (let i = 0; i < 3; i += 1) {
      const made = await backend.createRedemption(id, 80);
      await backend.cancelRedemption(id, made.id, new Date());
    }
    expect(liveBalance((await backend.getMember(id)).lots, new Date('2026-10-17T10:00:00Z'))).toBe(70);
  });

  it('the exact-row read refuses another member and never substitutes a newer code', async () => {
    const id = await member();
    const other = await member();
    const first = await backend.createRedemption(id, 20);
    await backend.createRedemption(id, 30);
    expect((await backend.getRedemption(id, first.id))?.id).toBe(first.id);
    expect(await backend.getRedemption(other, first.id)).toBeNull();
    expect(await backend.getRedemption(id, 'absent')).toBeNull();
  });

  it('concurrent cancel/sweep never restores a slice twice', async () => {
    const id = await member();
    const made = await backend.createRedemption(id, 80);
    vi.setSystemTime(new Date(Date.parse(made.expiresAt) + 1_000));
    await Promise.all([
      backend.cancelRedemption(id, made.id, new Date()),
      backend.cancelRedemption(id, made.id, new Date()),
      backend.sweepRedemptions(id, new Date()),
    ]);
    expect(liveBalance((await backend.getMember(id)).lots)).toBe(130);
    expect((await backend.getHistory(id)).filter((h) => h.kind === 'return')).toHaveLength(1);
  });
});

describe('legacy redemption lineage', () => {
  it('missing, mismatched or invalid slices move nothing and explicitly need review', () => {
    const held = lots();
    for (const slices of [null, [], originalSlices.slice(0, 1), [{ ...originalSlices[0], points: 80, expiresOn: 'invalid' }]]) {
      const back = restoreRedemptionPoints(held, { points: 80, slices }, new Date(NOW));
      expect(back).toEqual({ lots: held, returnedPoints: 0, expiredPoints: 0,
        recoveredPoints: 0, debtAfter: 0, refundReviewRequired: true });
    }
  });

  it('migration preserves balances and known slices; unknown legacy refunds are closed for review without a fresh grant', async () => {
    const pg = new PGlite();
    await pg.waitReady;
    try {
      // A genuine OLD schema/row, then the real migration, rather than faking
      // the upgraded column in a test-only schema.
      await pg.exec(LOYALTY_MIGRATIONS.filter((name) => name !== '20261016160212_redemption_slices.sql')
        .map(readMigration).join('\n;\n'));
      await pg.query(`insert into members (id, phone, name, expiry_settled_through, wallet_expiry_settled_through,
        held_tier_id, evaluated_through) values ('legacy', '+962790999999', '', '2026-10-16', '2026-10-16', 'base', '2026-Q4')`);
      await pg.query(`insert into redemptions (id, member_id, code, points, value_jod, created_at, expires_at)
        values ('old', 'legacy', 'ABCD2345', 80, 0.8, $1, $2)`, [NOW, '2026-10-16T10:15:00Z']);
      const migration = readMigration('20261016160212_redemption_slices.sql');
      await pg.exec(migration);
      await pg.exec(migration); // a retried deploy must preserve lineage/outcomes
      const b = createPostgresBackend(fromPglite(pg));
      expect((await b.getRedemption('legacy', 'old'))?.slices).toBeNull();
      const cancelled = await b.cancelRedemption('legacy', 'old', new Date(NOW));
      expect(cancelled).toMatchObject({ returnedPoints: 0, expiredPoints: 0, refundReviewRequired: true });
      expect(toRedemptionView(cancelled, new Date(NOW)).refundReviewRequired).toBe(true);
      expect(liveBalance((await b.getMember('legacy')).lots)).toBe(0);
      await b.cancelRedemption('legacy', 'old', new Date(NOW));
      expect((await b.getHistory('legacy')).filter((h) => h.kind === 'return')).toHaveLength(1);
      // Reapplying never overwrites recoverable lineage written by the new app.
      await pg.query('update redemptions set slices = $2 where id = $1', ['old', JSON.stringify(originalSlices)]);
      await pg.exec(migration);
      expect((await b.getRedemption('legacy', 'old'))?.slices).toEqual(originalSlices);
    } finally { await pg.close(); }
  });

  it('a disk-backed restart retains original expiry and cancellation outcome', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'almond-redemption-expiry-'));
    let pg: PGlite | undefined;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    try {
      pg = new PGlite(dir);
      await pg.waitReady;
      await pg.exec(loyaltySchemaSql());
      let b = createPostgresBackend(fromPglite(pg));
      const id = (await b.findOrCreateByPhone('+962790888888')).id;
      await pg.query('update members set lots = $2 where id = $1', [id, JSON.stringify(lots())]);
      const made = await b.createRedemption(id, 80);
      await pg.close();
      pg = new PGlite(dir);
      await pg.waitReady;
      b = createPostgresBackend(fromPglite(pg));
      vi.setSystemTime(new Date('2026-10-17T10:00:00Z'));
      const cancelled = await b.cancelRedemption(id, made.id, new Date());
      expect(cancelled).toMatchObject({ slices: originalSlices, returnedPoints: 20, expiredPoints: 60 });
      expect(liveBalance((await b.getMember(id)).lots)).toBe(70);
      await pg.close();
      pg = new PGlite(dir);
      await pg.waitReady;
      b = createPostgresBackend(fromPglite(pg));
      await b.cancelRedemption(id, made.id, new Date());
      expect(liveBalance((await b.getMember(id)).lots)).toBe(70);
    } finally {
      vi.useRealTimers();
      await pg?.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

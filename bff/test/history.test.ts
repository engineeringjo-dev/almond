import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { POINTS_KINDS, pointsSummary, type PointsKind } from '@almond/shared/loyalty/history';
import { readMigration } from './lib/schema';

/**
 * H1-H3 — the points history's counters (owner, 2026-10-15, after Al Ameed:
 * «نعمل سجل نقاط مثلهم»). The rule is loyalty/history.ts; the app and the
 * website both render pointsSummary, so it is pinned here once.
 */
const line = (kind: PointsKind | null, deltaPoints: number) => ({ kind, deltaPoints });

describe('H1 pointsSummary', () => {
  it('an empty history is three zeros', () => {
    expect(pointsSummary([])).toEqual({ redeemed: 0, visits: 0, expired: 0 });
  });

  it('counts redeemed points, purchases and expired points', () => {
    expect(pointsSummary([
      line('purchase', 40), line('purchase', 0), line('redeem', -100),
      line('expire', -12), line('bonus', 50), line('transfer', -5),
    ])).toEqual({ redeemed: 100, visits: 2, expired: 12 });
  });

  it('points given back are not redeemed: a cancelled or lapsed code, a voided till payment', () => {
    expect(pointsSummary([line('redeem', -100), line('return', 100), line('redeem', -30)]))
      .toEqual({ redeemed: 30, visits: 0, expired: 0 });
  });

  it('never shows a negative redeemed count, whatever order the lines arrive in', () => {
    expect(pointsSummary([line('return', 100)]).redeemed).toBe(0);
  });

  it('a refund takes points back but the visit stays; a 0-point purchase is still a visit', () => {
    expect(pointsSummary([line('refund', -25), line('purchase', 25), line('purchase', 0)]))
      .toEqual({ redeemed: 0, visits: 2, expired: 0 });
  });

  it('a line with no kind counts toward nothing', () => {
    expect(pointsSummary([line(null, -500), { deltaPoints: 70 }]))
      .toEqual({ redeemed: 0, visits: 0, expired: 0 });
  });
});

describe('H2 the kinds are one list', () => {
  it('the migration\'s check constraint allows exactly the shared kinds', () => {
    const sql = readMigration('20261015_point_history_detail.sql');
    const check = /check \(kind is null or kind in \(([\s\S]*?)\)\)/.exec(sql);
    expect(check, 'the kind check constraint').not.toBeNull();
    const inSql = [...check![1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
    expect(inSql).toEqual([...POINTS_KINDS].sort());
  });

  it('the backfill only writes kinds the constraint allows', () => {
    const sql = readMigration('20261015_point_history_detail.sql');
    const backfill = sql.slice(sql.indexOf('update point_history'));
    const written = [...backfill.matchAll(/then '([a-z]+)'/g)].map((m) => m[1]);
    expect(written.length).toBeGreaterThan(0);
    for (const k of written) expect(POINTS_KINDS).toContain(k);
  });
});

describe('H3 every reason a writer uses is recognised by the backfill', () => {
  // The backfill labels old rows from their exact English reason. A reason
  // the code writes that the backfill does not know would leave old rows of
  // that kind out of the counters. Collected from the source, not typed out.
  const ROOT = join(__dirname, '..', '..');
  const files = [
    'bff/src/backend/memory.ts', 'bff/src/backend/postgres.ts', 'bff/src/memberMoves.ts',
    'bff/src/pos/sales.ts', 'bff/src/routes/pos.ts', 'bff/src/routes/checkout.ts',
  ];
  const fixed = new Set<string>();
  for (const f of files) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    for (const m of src.matchAll(/(?:reasonEn|pointsReasonEn): '([^']+)'/g)) fixed.add(m[1]);
    for (const m of src.matchAll(/addPoints\([^)]*?'[^']*', '([^']+)'/g)) fixed.add(m[1]);
    for (const m of src.matchAll(/spendPoints\([^)]*?'[^']*', '([^']+)'/g)) fixed.add(m[1]);
  }
  const sql = readMigration('20261015_point_history_detail.sql');

  it('found the writers', () => {
    expect([...fixed]).toEqual(expect.arrayContaining([
      'Order points', 'In-store purchase points', 'Points redeemed', 'Points expired',
      'Partially refunded purchase points', 'Refunded purchase points',
    ]));
  });

  for (const reason of [...fixed].sort()) {
    it(`«${reason}»`, () => {
      expect(sql.includes(`'${reason}'`), `${reason} is not in the backfill`).toBe(true);
    });
  }
});

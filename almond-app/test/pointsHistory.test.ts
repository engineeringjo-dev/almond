import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ammanDayKey } from '@almond/shared/lib/ammanWeekday';
import { lotExpiresOn } from '@almond/shared/loyalty/lots';
import { pointsSummary } from '@almond/shared/loyalty/history';
import { mockLoyaltyService, __getMockUser } from '@/services/loyalty.service.mock';

/**
 * PH1-PH2 — «سجل النقاط» (owner, 2026-10-15, after Al Ameed: «نعمل سجل نقاط
 * مثلهم»). The server's half is T37 in bff/test/backend-contract.test.ts and
 * the counting rule is H1 in bff/test/history.test.ts; this is the app's half:
 * the mock writes the same fields the BFF does, and the screen shows them.
 */
describe('PH1 the mock writes what the server writes', () => {
  it('a purchase line carries its kind, its branch and its own lot\'s expiry', async () => {
    const id = `ph-${Math.random().toString(36).slice(2)}`;
    const u = __getMockUser(id);
    u.lots = [];
    u.history = [];
    u.expirySettledThrough = ammanDayKey();
    await mockLoyaltyService.earn({ userId: id, invoiceAmount: 20, paidFromBalance: false, branchId: 'rabyeh' });
    const [line] = await mockLoyaltyService.getHistory(id);
    expect(line).toMatchObject({
      kind: 'purchase', branchId: 'rabyeh', expiresOn: lotExpiresOn(ammanDayKey()),
    });
    expect(line.deltaPoints).toBeGreaterThan(0);
    expect(pointsSummary(await mockLoyaltyService.getHistory(id)).visits).toBe(1);
  });
});

describe('PH2 the wiring', () => {
  const src = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

  it('checkout tells the earn which branch the order is for', () => {
    expect(src('app/cart.tsx')).toMatch(/loyaltyService\.earn\(\{[\s\S]*?branchId: branch\.id[\s\S]*?\}\)/);
  });

  it('the rewards screen draws its history through PointsHistory, which counts with the shared rule', () => {
    expect(src('app/loyalty.tsx')).toMatch(/<PointsHistory entries=\{historyQ\.data \?\? \[\]\} \/>/);
    const comp = src('components/loyalty/PointsHistory.tsx');
    expect(comp).toMatch(/pointsSummary\(entries\)/);
    // The expiry shown is the line's stored date, never re-derived here.
    expect(comp).not.toMatch(/lotExpiresOn|POINT_LOT_LIFE_MONTHS/);
  });
});

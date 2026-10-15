import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ammanDayKey } from '@almond/shared/lib/ammanWeekday';
import { liveBalance } from '@almond/shared/loyalty/lots';
import { chooseLaunchSheet, type LaunchInput } from '@/lib/launchSheet';
import { mockLoyaltyService, __getMockUser } from '@/services/loyalty.service.mock';
import { ApiError } from '@/lib/apiClient';
import { config } from '@/constants/config';

/**
 * V1-V3 — the thank-you after a visit (owner, 2026-10-15, after Al Ameed:
 * «ابني لقطة التقييم واضافة النقاط»). The server's half is VR1-VR2 and T37;
 * this is the app's: which sheet opens by itself, the mock keeping the
 * server's rule, and the wiring.
 */
const BASE: LaunchInput = {
  earnSheet: true,
  visitRef: null,
  lastPromptedVisitRef: null,
  launchedFromLink: false,
  sheetOpen: false,
};

describe('V1 chooseLaunchSheet', () => {
  it('a pending visit not yet shown wins over the code', () => {
    expect(chooseLaunchSheet({ ...BASE, visitRef: 'pos:Shop/1' })).toBe('visit');
  });
  it('a visit already shown on this device is not asked again — the code opens instead', () => {
    expect(chooseLaunchSheet({ ...BASE, visitRef: 'pos:Shop/1', lastPromptedVisitRef: 'pos:Shop/1' })).toBe('earn');
  });
  it('a newer visit is asked about even though an older one was', () => {
    expect(chooseLaunchSheet({ ...BASE, visitRef: 'pos:Shop/2', lastPromptedVisitRef: 'pos:Shop/1' })).toBe('visit');
  });
  it('no visit: the code, when the earn rule allows it', () => {
    expect(chooseLaunchSheet(BASE)).toBe('earn');
    expect(chooseLaunchSheet({ ...BASE, earnSheet: false })).toBeNull();
  });
  it('nothing over a sheet already open, and nothing when a link brought them', () => {
    expect(chooseLaunchSheet({ ...BASE, visitRef: 'pos:Shop/1', sheetOpen: true })).toBeNull();
    expect(chooseLaunchSheet({ ...BASE, visitRef: 'pos:Shop/1', launchedFromLink: true })).toBeNull();
  });
});

describe('V2 the mock keeps the server\'s rule', () => {
  const fresh = () => {
    const id = `v-${Math.random().toString(36).slice(2)}`;
    const u = __getMockUser(id);
    u.lots = [];
    u.history = [];
    u.expirySettledThrough = ammanDayKey();
    return { id, u };
  };

  afterEach(() => { vi.useRealTimers(); });

  it('an order is asked about after it is collected, once, and the rating pays nothing', async () => {
    const { id, u } = fresh();
    expect(await mockLoyaltyService.getPendingVisit(id)).toBeNull();
    await mockLoyaltyService.earn({ userId: id, invoiceAmount: 20, paidFromBalance: false, branchId: 'rabyeh', orderId: 'o-1' });
    expect(await mockLoyaltyService.getPendingVisit(id)).toBeNull();      // just placed
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + (config.VISIT_RATING_ORDER_DELAY_MINUTES + 1) * 60_000);
    const visit = await mockLoyaltyService.getPendingVisit(id);
    expect(visit).toMatchObject({ ref: 'order:o-1', branchId: 'rabyeh' });
    expect(visit!.points).toBeGreaterThan(0);

    const before = liveBalance(u.lots);
    const historyBefore = u.history.length;
    expect(await mockLoyaltyService.rateVisit({ userId: id, ref: 'order:o-1', stars: 5, comment: ' ممتاز ' }))
      .toMatchObject({ ref: 'order:o-1', branchId: 'rabyeh', stars: 5, comment: 'ممتاز' });
    expect(liveBalance(u.lots)).toBe(before);
    expect(u.history).toHaveLength(historyBefore);
    expect(await mockLoyaltyService.getPendingVisit(id)).toBeNull();

    await expect(mockLoyaltyService.rateVisit({ userId: id, ref: 'order:o-1', stars: 1 }))
      .rejects.toMatchObject({ status: 409, code: 'visit_already_rated' });
    await expect(mockLoyaltyService.rateVisit({ userId: id, ref: 'order:nope', stars: 4 }))
      .rejects.toBeInstanceOf(ApiError);
  });
});

describe('V3 the wiring', () => {
  const src = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');
  const code = (rel: string) => src(rel).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  it('the root mounts the thank-you once; Home runs the shared decision', () => {
    expect(src('app/_layout.tsx').match(/<PostVisitSheet \/>/g)).toHaveLength(1);
    const hook = code('hooks/useLaunchSheets.ts');
    expect(hook).toMatch(/chooseLaunchSheet\(/);
    expect(hook).toMatch(/setLastVisitPrompt\(visit\.ref\)/);
    expect(hook).toMatch(/AppState\.addEventListener\('change'/);
  });

  it('checkout names the order, so the visit can be found', () => {
    expect(src('app/cart.tsx')).toMatch(/loyaltyService\.earn\(\{[\s\S]*?orderId: order\.id[\s\S]*?\}\)/);
  });

  it('the order screen and the thank-you rate through ONE sheet, and it promises nothing', () => {
    expect(code('app/order/[id].tsx')).toMatch(/<VisitRatingSheet[\s\S]*?visitRef=\{`order:\$\{order\.id\}`\}/);
    expect(code('components/loyalty/PostVisitSheet.tsx')).toMatch(/<VisitRatingSheet/);
    const sheet = code('components/loyalty/VisitRatingSheet.tsx');
    expect(sheet).toMatch(/loyaltyService\.rateVisit\(/);
    expect(sheet).not.toMatch(/rateRewarded|rewarded|addPoints/);
    for (const f of ['locales/ar.json', 'locales/en.json']) expect(src(f)).not.toMatch(/rateRewarded/);
  });

  it('the live client talks to the routes the server has', () => {
    const live = code('services/loyalty.service.live.ts');
    expect(live).toMatch(/get<[^>]*>\('\/v1\/me\/visit-rating'\)/);
    expect(live).toMatch(/post<[^>]*>\('\/v1\/me\/visit-rating'/);
    expect(live).not.toMatch(/rate-branch/);
  });
});

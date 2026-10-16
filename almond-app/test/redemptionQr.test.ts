import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RedemptionView } from '@almond/shared/loyalty/redemption';
import { parseRedemptionPresentation, redemptionPresentationDeadline, type RedemptionPresentation } from '@almond/shared/loyalty/redemptionPresentation';
import { grantLot, liveBalance, lotRulesFromConfig } from '@almond/shared/loyalty/lots';
import { createRedemptionQr } from '@/lib/redemptionQr';
import { mockLoyaltyService, __getMockUser } from '@/services/loyalty.service.mock';

const START = Date.parse('2026-10-16T10:00:00Z');
const row = (status: RedemptionView['status'] = 'pending'): RedemptionView => ({
  id: 'reserve-a', points: 100, valueJod: 1, status,
  expiresAt: new Date(START + 900_000).toISOString(), expiresIn: 900,
  returnedPoints: null, expiredPoints: null, recoveredPoints: 0, refundReviewRequired: false,
});
const wire = (patch: Partial<RedemptionPresentation> = {}): RedemptionPresentation => ({
  token: `signed-body.${'A'.repeat(43)}`, mode: 'redeem', redemptionId: 'reserve-a',
  issuedAt: new Date(START).toISOString(), expiresAt: new Date(START + 120_000).toISOString(), expiresIn: 120, ...patch,
});
const service = () => ({
  getRedemption: vi.fn(async () => row()),
  getRedemptionPresentation: vi.fn(async () => wire()),
  cancelRedemption: vi.fn(async () => row('cancelled')),
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('points barcode wire rejects unsupported authority', () => {
  it('accepts only an exact-id bounded live response; demo requires explicit opt-in', () => {
    expect(parseRedemptionPresentation(wire(), 'reserve-a').token).toBe(wire().token);
    for (const changed of [wire({ redemptionId: 'reserve-b' }), wire({ token: 'reserve-a' }),
      wire({ expiresIn: 121, expiresAt: new Date(START + 121_000).toISOString() }),
      wire({ issuedAt: 'invalid' }), wire({ mode: 'pay' as 'redeem' })]) {
      expect(() => parseRedemptionPresentation(changed, 'reserve-a')).toThrow();
    }
    const demo = wire({ token: 'ALMOND-DEMO-REDEMPTION:unsigned', demo: true });
    expect(() => parseRedemptionPresentation(demo, 'reserve-a')).toThrow();
    expect(parseRedemptionPresentation(demo, 'reserve-a', true).demo).toBe(true);
    expect(() => parseRedemptionPresentation(wire({ demo: true }), 'reserve-a', true)).toThrow();
  });
  it('network delay or a slow device clock cannot add seconds to the server lifetime', () => {
    expect(redemptionPresentationDeadline(wire(), START)).toBe(START + 120_000);
    expect(redemptionPresentationDeadline(wire(), START - 10_000)).toBe(START + 110_000);
    expect(redemptionPresentationDeadline(wire(), START + 10_000)).toBe(START + 120_000);
  });
});

describe('the actual QR presenter lifecycle', () => {
  it('shows only the issued token, removes it exactly at120s, and never auto-reissues', async () => {
    let now = START;
    const api = service();
    const presenter = createRedemptionQr(api, 'member', 'reserve-a', () => now);
    await presenter.refresh();
    expect(api.getRedemptionPresentation).toHaveBeenCalledWith('member', 'reserve-a');
    expect(presenter.getSnapshot()).toMatchObject({ status: 'ready', remaining: 120, presentation: { token: wire().token } });
    now += 119_999; presenter.tick();
    expect(presenter.getSnapshot().remaining).toBe(1);
    now++; presenter.tick();
    expect(presenter.getSnapshot()).toMatchObject({ status: 'expired', presentation: null });
    presenter.tick();
    expect(api.getRedemptionPresentation).toHaveBeenCalledTimes(1);
  });
  it('a delayed response retains the original deadline and expired responses stay hidden', async () => {
    let now = START;
    const api = service();
    api.getRedemptionPresentation.mockImplementation(async () => { now += 30_000; return wire(); });
    const presenter = createRedemptionQr(api, 'member', 'reserve-a', () => now);
    await presenter.refresh();
    expect(presenter.getSnapshot()).toMatchObject({ remaining: 90, deadline: START + 120_000 });
    api.getRedemptionPresentation.mockImplementation(async () => { now = START + 120_000; return wire(); });
    await presenter.refresh();
    expect(presenter.getSnapshot()).toMatchObject({ status: 'expired', presentation: null });
  });
  it('backgrounding discards in-flight answers; foreground ticks cannot resurrect them', async () => {
    const api = service();
    let resolve!: (value: RedemptionPresentation) => void;
    api.getRedemptionPresentation.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const presenter = createRedemptionQr(api, 'member', 'reserve-a', () => START);
    const pending = presenter.refresh();
    await Promise.resolve();
    presenter.pause(); resolve(wire()); await pending; presenter.tick();
    expect(presenter.getSnapshot()).toMatchObject({ status: 'expired', presentation: null });
    expect(api.getRedemptionPresentation).toHaveBeenCalledTimes(1);
  });
  it('closure via poll or refresh removes the barcode; failure never substitutes an id', async () => {
    const api = service();
    const presenter = createRedemptionQr(api, 'member', 'reserve-a', () => START);
    await presenter.refresh();
    api.getRedemption.mockResolvedValue(row('settled'));
    await presenter.poll();
    expect(presenter.getSnapshot()).toMatchObject({ status: 'closed', presentation: null, reservation: { status: 'settled' } });
    await presenter.refresh();
    expect(api.getRedemptionPresentation).toHaveBeenCalledTimes(1);
    api.getRedemption.mockRejectedValue(new Error('offline'));
    await presenter.refresh();
    expect(presenter.getSnapshot()).toMatchObject({ status: 'unavailable', presentation: null });
  });
  it('wrong rows or credentials fail closed and cancellation always targets the owned id', async () => {
    const api = service();
    const presenter = createRedemptionQr(api, 'member', 'reserve-a', () => START);
    api.getRedemptionPresentation.mockResolvedValue(wire({ redemptionId: 'reserve-b' }));
    await presenter.refresh();
    expect(presenter.getSnapshot().status).toBe('unavailable');
    await presenter.cancel('same-cancel-key');
    expect(api.cancelRedemption).toHaveBeenCalledWith('member', 'reserve-a', 'same-cancel-key');
    expect(presenter.getSnapshot()).toMatchObject({ status: 'closed', presentation: null });
  });
});

describe('demo reservation is distinct from its clearly unsigned presentation', () => {
  let seq = 0;
  const member = () => {
    const id = `qr-contract-${++seq}`;
    const u = __getMockUser(id);
    u.lots = grantLot([], 300, 'earn', new Date(), lotRulesFromConfig()).lots;
    u.history = []; u.vouchers = []; u.redemptions = []; u.redemptionIntents = {};
    return { id, u };
  };
  const input = { beans: 100, titleAr: 'خصم', titleEn: 'Discount', type: 'credit' as const, idempotencyKey: 'one-confirmation' };
  it('same confirmation debits once; repeated refresh never renews or spends the reserve', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(START);
    const { id, u } = member();
    const first = await mockLoyaltyService.redeemReward(id, input);
    const retry = await mockLoyaltyService.redeemReward(id, input);
    expect(retry.voucher.id).toBe(first.voucher.id);
    expect(liveBalance(u.lots)).toBe(200);
    const rid = first.voucher.redemptionId!;
    const before = await mockLoyaltyService.getRedemption(id, rid);
    const a = await mockLoyaltyService.getRedemptionPresentation(id, rid);
    vi.setSystemTime(START + 120_000);
    const b = await mockLoyaltyService.getRedemptionPresentation(id, rid);
    expect(a.demo).toBe(true); expect(b.token).not.toBe(a.token);
    expect(() => parseRedemptionPresentation(b, rid)).toThrow();
    expect((await mockLoyaltyService.getRedemption(id, rid)).expiresAt).toBe(before.expiresAt);
    expect(liveBalance(u.lots)).toBe(200);
    expect(u.redemptions).toHaveLength(1);
    await expect(mockLoyaltyService.redeemReward(id, { ...input, beans: 200 })).rejects.toThrow();
    await expect(mockLoyaltyService.getRedemptionPresentation('another-member', rid)).rejects.toThrow();
    vi.setSystemTime(Date.parse(before.expiresAt));
    const ended = await mockLoyaltyService.getRedemption(id, rid);
    expect(ended.status).not.toBe('pending');
    expect(ended.returnedPoints).toBe(100);
    expect(liveBalance(u.lots)).toBe(300);
    await expect(mockLoyaltyService.getRedemptionPresentation(id, rid)).rejects.toThrow();
    await mockLoyaltyService.cancelRedemption(id, rid, 'cancel-after-close');
    expect(liveBalance(u.lots)).toBe(300);
    expect(u.history.filter((entry) => entry.kind === 'return')).toMatchObject([{ deltaPoints: 100, sourceRef: `redemption:${rid}` }]);
    expect(u.history.filter((entry) => entry.kind === 'bonus')).toHaveLength(0);
  });
  it('cancellation preserves original FIFO dates rather than giving a fresh point lifetime', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(START);
    const { id, u } = member();
    u.lots = grantLot([], 300, 'earn', new Date(START - 30 * 86_400_000), lotRulesFromConfig()).lots;
    const original = u.lots[0];
    const result = await mockLoyaltyService.redeemReward(id, input);
    await mockLoyaltyService.cancelRedemption(id, result.voucher.redemptionId!, 'cancel');
    expect(liveBalance(u.lots)).toBe(300);
    expect(u.lots.every((lot) => lot.expiresOn === original.expiresOn && lot.grantedOn === original.grantedOn)).toBe(true);
  });
});

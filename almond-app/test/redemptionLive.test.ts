import { beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ apiGet: vi.fn(), apiPost: vi.fn(), apiDelete: vi.fn() }));
vi.mock('@/lib/apiClient', () => api);
import { liveLoyaltyService } from '@/services/loyalty.service.live';

const row = { id: 'exact-reserve', points: 100, valueJod: 1, status: 'pending', expiresAt: '2026-10-16T10:15:00Z', expiresIn: 900,
  returnedPoints: null, expiredPoints: null, recoveredPoints: 0, refundReviewRequired: false };
const presentation = { redemptionId: row.id, mode: 'redeem', token: `server-issued.${'A'.repeat(43)}`,
  issuedAt: '2026-10-16T10:00:00Z', expiresAt: '2026-10-16T10:02:00Z', expiresIn: 120 };
beforeEach(() => vi.resetAllMocks());

describe('live points redemption uses the authenticated server contract', () => {
  it('creation sends only points and the existing confirmation key; refresh cannot recreate', async () => {
    api.apiPost.mockResolvedValueOnce({ pointsBalance: 200, redemption: row }).mockResolvedValueOnce(presentation);
    const result = await liveLoyaltyService.redeemReward('client-id-is-not-authority', {
      beans: 100, titleAr: 'client title', titleEn: 'client title', type: 'credit', idempotencyKey: 'same-confirmation',
    });
    expect(result.voucher.redemptionId).toBe(row.id);
    expect(result.voucher.titleAr).toBe('قسيمة بقيمة 1.00 د.أ');
    expect(result.voucher.titleEn).toBe('JOD 1.00 credit voucher');
    expect(api.apiPost.mock.calls[0].slice(1)).toEqual(['/v1/loyalty/redeem', { points: 100 }, expect.objectContaining({ 'Idempotency-Key': 'same-confirmation' })]);
    expect((await liveLoyaltyService.getRedemptionPresentation('ignored', row.id)).token).toBe(presentation.token);
    expect(api.apiPost.mock.calls[1].slice(1, 3)).toEqual(['/v1/me/redemption/qr', { redemptionId: row.id }]);
  });
  it('reads the exact reservation and refuses another row instead of substituting latest', async () => {
    api.apiGet.mockResolvedValue({ redemption: row });
    expect((await liveLoyaltyService.getRedemption('ignored', row.id)).id).toBe(row.id);
    expect(api.apiGet.mock.calls[0][1]).toBe(`/v1/me/redemption/${row.id}`);
    await expect(liveLoyaltyService.getRedemption('ignored', 'other-reserve')).rejects.toThrow();
  });
  it('network/auth failures and unsigned demo responses never become a production barcode', async () => {
    api.apiPost.mockRejectedValueOnce(new Error('401 unauthorized'));
    await expect(liveLoyaltyService.getRedemptionPresentation('ignored', row.id)).rejects.toThrow('401');
    api.apiPost.mockResolvedValue({ ...presentation, demo: true, token: 'ALMOND-DEMO-REDEMPTION:unsigned' });
    await expect(liveLoyaltyService.getRedemptionPresentation('ignored', row.id)).rejects.toThrow();
  });
});

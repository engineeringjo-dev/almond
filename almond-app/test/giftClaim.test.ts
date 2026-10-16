import { describe, expect, it, vi } from 'vitest';

import { claimGiftOnce, giftClaimErrorKey, type GiftClaimResult } from '@/lib/giftClaim';
import { mockLoyaltyService } from '@/services/loyalty.service.mock';
import { walletStatement } from '@almond/shared/loyalty/history';

describe('GC1 one UI intent calls the existing claim service once', () => {
  it('ignores empty input and synchronous repeat submits, preserving raw input and the returned amount', async () => {
    let finish!: (reply: GiftClaimResult) => void;
    const reply = { amount: 5, walletBalance: 17.5 };
    const redeem = vi.fn((_code: string) => new Promise<GiftClaimResult>((resolve) => { finish = resolve; }));
    const lock = { current: false };
    expect(await claimGiftOnce(lock, '   ', redeem)).toBeNull();
    expect(redeem).not.toHaveBeenCalled();
    const first = claimGiftOnce(lock, '  alm-gift-2026  ', redeem);
    expect(lock.current).toBe(true);
    const repeat = claimGiftOnce(lock, '  alm-gift-2026  ', redeem);
    expect(redeem).toHaveBeenCalledTimes(1);
    expect(await repeat).toBeNull();
    expect(redeem).toHaveBeenCalledWith('  alm-gift-2026  ');
    finish(reply);
    expect(await first).toBe(reply);
    expect(lock.current).toBe(false);
  });

  it('releases a failed submission for retry without changing the code or inventing credit', async () => {
    const unavailable = new Error('network unavailable');
    const redeem = vi.fn<(code: string) => Promise<GiftClaimResult>>()
      .mockRejectedValueOnce(unavailable)
      .mockResolvedValueOnce({ amount: 10, walletBalance: 22.5 });
    const lock = { current: false };
    await expect(claimGiftOnce(lock, 'EXACT-CODE', redeem)).rejects.toBe(unavailable);
    expect(lock.current).toBe(false);
    expect(giftClaimErrorKey(unavailable, true)).toBe('gift.claimFailed');
    await expect(claimGiftOnce(lock, 'EXACT-CODE', redeem)).resolves.toEqual({ amount: 10, walletBalance: 22.5 });
    expect(redeem.mock.calls).toEqual([['EXACT-CODE'], ['EXACT-CODE']]);
  });
});

describe('GC2 only actual known mock refusals are described as invalid or used', () => {
  it('keeps invalid, used and unknown/provider failures distinct', () => {
    expect(giftClaimErrorKey(new Error('Invalid gift code'), true)).toBe('gift.invalidCode');
    expect(giftClaimErrorKey(new Error('Gift already redeemed'), true)).toBe('gift.alreadyUsed');
    expect(giftClaimErrorKey(new Error('Invalid gift code'), false)).toBe('gift.claimFailed');
    expect(giftClaimErrorKey(new Error('Gift already redeemed'), false)).toBe('gift.claimFailed');
    expect(giftClaimErrorKey(new Error('timeout'), true)).toBe('gift.claimFailed');
    expect(giftClaimErrorKey(null, true)).toBe('gift.claimFailed');
  });
});

describe('GC3 the unchanged mock claim contract credits a card only once', () => {
  it('rejects invalid input without changing the wallet, then normalizes and claims the existing demo card once', async () => {
    const recipient = 'gift-claim-contract';
    const otherRecipient = 'gift-claim-other';
    const before = await mockLoyaltyService.getWallet(recipient);
    const otherBefore = await mockLoyaltyService.getWallet(otherRecipient);
    const historyBefore = structuredClone(await mockLoyaltyService.getHistory(recipient));
    await expect(mockLoyaltyService.redeemGiftCode(recipient, 'NOT-A-GIFT')).rejects.toThrow('Invalid gift code');
    expect(await mockLoyaltyService.getWallet(recipient)).toBe(before);
    expect(await mockLoyaltyService.getHistory(recipient)).toEqual(historyBefore);
    const reply = await mockLoyaltyService.redeemGiftCode(recipient, '  alm-gift-2026  ');
    expect(reply).toEqual({ amount: 5, walletBalance: before + 5 });
    expect(await mockLoyaltyService.getWallet(recipient)).toBe(reply.walletBalance);
    for (const member of [recipient, otherRecipient]) {
      await expect(mockLoyaltyService.redeemGiftCode(member, 'ALM-GIFT-2026')).rejects.toThrow('Gift already redeemed');
    }
    expect(await mockLoyaltyService.getWallet(recipient)).toBe(reply.walletBalance);
    expect(await mockLoyaltyService.getWallet(otherRecipient)).toBe(otherBefore);
    const gifts = walletStatement(await mockLoyaltyService.getHistory(recipient)).filter((line) => line.reasonEn === 'Gift card');
    expect(gifts).toHaveLength(1);
    expect(gifts[0].deltaFils).toBe(5000);
  });

  it('two claimants racing for an actually issued mock card cannot credit it twice', async () => {
    const senderId = 'gift-race-sender';
    const gift = await mockLoyaltyService.sendGift({ senderId, designId: 'ar02', amount: 5, recipientName: 'Test recipient' });
    const recipients = ['gift-race-one', 'gift-race-two'];
    const before = await Promise.all(recipients.map((id) => mockLoyaltyService.getWallet(id)));
    const results = await Promise.allSettled(recipients.map((id) => mockLoyaltyService.redeemGiftCode(id, gift.code)));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const after = await Promise.all(recipients.map((id) => mockLoyaltyService.getWallet(id)));
    expect(after.reduce((sum, balance, index) => sum + balance - before[index], 0)).toBe(gift.amount);
  });
});

import type { LoyaltyService } from '@/services/loyalty.service';

export type GiftClaimResult = Awaited<ReturnType<LoyaltyService['redeemGiftCode']>>;

/** A UI submission lock, independent of React's next pending-state render.
 * Code normalization, ownership, validity and single-use credit stay in the
 * existing service. Pass its input and reply through unchanged. */
export async function claimGiftOnce(
  lock: { current: boolean },
  code: string,
  redeem: (code: string) => Promise<GiftClaimResult>,
): Promise<GiftClaimResult | null> {
  if (lock.current || !code.trim()) return null;
  lock.current = true;
  try {
    return await redeem(code);
  } finally {
    lock.current = false;
  }
}

/** The mock has two explicit refusals. The live gift endpoint has no named
 * refusal contract in this repo, so an unknown failure must not accuse the
 * member of using an invalid code. */
export function giftClaimErrorKey(error: unknown, mock: boolean) {
  if (mock && error instanceof Error) {
    if (error.message === 'Invalid gift code') return 'gift.invalidCode';
    if (error.message === 'Gift already redeemed') return 'gift.alreadyUsed';
  }
  return 'gift.claimFailed';
}

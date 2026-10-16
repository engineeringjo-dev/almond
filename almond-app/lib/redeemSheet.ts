/**
 * What the redeem sheet shows, from the state of the one redemption it runs.
 *
 * Four steps, in the order a member meets them: asked, waiting, done, or
 * failed with a way to try again. Pure, so the node suite can pin every
 * branch — including the failure, which the mock only reaches when the
 * balance moves under an open sheet (almond-app/test/rewardsHub.test.ts).
 *
 * It replaced lib/dialog.ts's confirmAction on the Rewards tab: the browser's
 * confirm() and alert() did work on the web, but they are a modal the task
 * does not need, they cannot show a failure with a retry, and they could not
 * offer the way to the coupon just made. A sheet stays on the page the member
 * redeemed from (HIG: sheets for a short, self-contained task).
 */
import type { Voucher } from '@/types';

export type RedeemStep = 'confirm' | 'pending' | 'done' | 'failed';

export function redeemStep(m: { isPending: boolean; isSuccess: boolean; isError: boolean }): RedeemStep {
  if (m.isPending) return 'pending';
  if (m.isSuccess) return 'done';
  if (m.isError) return 'failed';
  return 'confirm';
}

/**
 * Voucher is NOT RedemptionView: it has no spend code or QR credential. The
 * current mock may issue a preview voucher, but its id cannot become a code.
 * A live voucher remains not ready until that separate contract is integrated.
 * The service switch, never the member's balance, identifies preview data.
 */
export function voucherAvailabilityKey(source: 'mock' | 'odoo') {
  return source === 'mock' ? 'loyalty.voucherDemo' : 'loyalty.voucherNotReady';
}

/** The returned id selects one actual voucher; never substitute the first. */
export function voucherHandoff(vouchers: readonly Voucher[], voucherId?: string) {
  const selected = vouchers.find((voucher) => voucher.id === voucherId) ?? null;
  return {
    selected,
    others: selected ? vouchers.filter((voucher) => voucher.id !== selected.id) : [...vouchers],
  };
}

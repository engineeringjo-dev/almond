import { config } from '../config';

/** 12 CALENDAR months from `from`, not 12 × 30 days (that was 360 days — ~5
 *  days early against what the UI promises). See LOYALTY-EARN-PATCH §2 D10. */
// `months: number` is annotated, not inferred: `as const` on the config object
// narrows BEAN_EXPIRY_MONTHS to the literal 12, which would reject any other
// value. Same reason as the `weekdays` cast in loyalty/earn.ts (§3.2).
export function expiryAt(from: number, months: number = config.BEAN_EXPIRY_MONTHS): number {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

export function isExpired(lastEarnAt: number, now: number, months?: number): boolean {
  return now > expiryAt(lastEarnAt, months);
}

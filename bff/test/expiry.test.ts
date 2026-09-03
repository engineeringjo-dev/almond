import { describe, it, expect } from 'vitest';
import { config } from '@almond/shared/config';
import { expiryAt, isExpired } from '@almond/shared/loyalty/expiry';

/**
 * The pure expiry arithmetic (D10). It lives in @almond/shared precisely so the
 * RULE has a test that does not depend on the Expo app resolving — see
 * docs/LOYALTY-EARN-PATCH.md §3.1 and §7 ("D10 → T15 + the shared expiry.ts
 * unit tests"). The enforcement half (D11) is asserted in
 * almond-app/test/loyalty.mock.test.ts, which needs the app's own runner.
 */
describe('expiry (shared)', () => {
  it('expiryAt: 12 CALENDAR months, not 12 x 30 days (D10)', () => {
    const from = Date.UTC(2026, 0, 15, 10, 0, 0); // 2026-01-15
    const at = expiryAt(from, 12);
    expect(new Date(at).getFullYear()).toBe(2027);
    expect(new Date(at).getMonth()).toBe(new Date(from).getMonth());
    expect(new Date(at).getDate()).toBe(new Date(from).getDate());

    // The bug: 12 * 30 * 86400000 is 360 days, ~5 days early against what the
    // UI promises. The calendar answer must be strictly LATER than the old one.
    const legacy360 = from + 12 * 30 * 86400000;
    expect(at).toBeGreaterThan(legacy360);
    expect(Math.round((at - legacy360) / 86400000)).toBe(5);
  });

  it('expiryAt: defaults to config.BEAN_EXPIRY_MONTHS', () => {
    const from = Date.UTC(2026, 2, 1, 0, 0, 0);
    expect(expiryAt(from)).toBe(expiryAt(from, config.BEAN_EXPIRY_MONTHS));
  });

  it('isExpired: false up to the boundary, true after it', () => {
    const from = Date.UTC(2026, 0, 15, 10, 0, 0);
    const due = expiryAt(from, 12);
    expect(isExpired(from, from, 12)).toBe(false);
    expect(isExpired(from, due, 12)).toBe(false);
    expect(isExpired(from, due + 1, 12)).toBe(true);
    // 360 days after the last activity the member is NOT expired any more.
    expect(isExpired(from, from + 360 * 86400000, 12)).toBe(false);
  });
});

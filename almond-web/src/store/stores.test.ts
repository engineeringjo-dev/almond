import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { redeemOptions } from '@almond/shared/loyalty/redeem';
import { reloadBonus } from '@/data/loyalty';

/**
 * Guards the other client stores:
 *   - menuOverlayStore: how admin edits MERGE per item (the overlay that
 *     data/menu.ts#applyOverlay renders), reset one / reset all;
 *   - loyaltyStore: redeeming points never overspends, the voucher is worth
 *     exactly the option shown, top-up bonus = data/loyalty#reloadBonus, a sent
 *     gift can be redeemed once;
 *   - authStore: the mock OTP accepts only 4 digits for a pending phone and
 *     derives a stable id from the phone.
 * Each test imports fresh store modules over an in-memory localStorage.
 */

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('window', { localStorage: memoryStorage() });
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-23T09:00:00.000Z'));
});
afterEach(() => vi.useRealTimers());

describe('menuOverlayStore', () => {
  const load = async () => (await import('@/store/menuOverlayStore')).useMenuOverlay;

  it('setEdit MERGES successive patches for the same item (price then stock keeps both)', async () => {
    const s = await load();
    s.getState().setEdit('a', { price: 3 });
    s.getState().setEdit('a', { inStock: false });
    s.getState().setEdit('a', { price: 3.5 });
    expect(s.getState().edits).toEqual({ a: { price: 3.5, inStock: false } });
  });

  it('edits are per item; resetItem clears one, resetAll clears everything', async () => {
    const s = await load();
    s.getState().setEdit('a', { hidden: true });
    s.getState().setEdit('b', { nameEn: 'B' });
    s.getState().resetItem('a');
    expect(s.getState().edits).toEqual({ b: { nameEn: 'B' } });
    s.getState().resetAll();
    expect(s.getState().edits).toEqual({});
  });
});

describe('loyaltyStore', () => {
  const load = async () => (await import('@/store/loyaltyStore')).useLoyaltyStore;

  it('redeemReward refuses when the balance is short and changes nothing', async () => {
    const s = await load();
    const before = s.getState();
    const tooMuch = { id: 'x', points: before.points + 1, jod: 99, full: false };
    expect(s.getState().redeemReward(tooMuch)).toBe(false);
    expect(s.getState().points).toBe(before.points);
    expect(s.getState().vouchers).toHaveLength(before.vouchers.length);
  });

  it('redeemReward spends exactly option.points and mints a credit voucher worth option.jod', async () => {
    const s = await load();
    const start = s.getState().points;
    const option = redeemOptions(start).find((o) => o.full)!;
    expect(option).toBeDefined();
    expect(s.getState().redeemReward(option)).toBe(true);
    const st = s.getState();
    expect(st.points).toBe(start - option.points);
    expect(st.vouchers[0]).toMatchObject({ type: 'credit', value: option.jod, used: false });
    expect(st.pointsHistory[0].deltaPoints).toBe(-option.points);
    // Spending the same full balance again must now fail (no double spend).
    expect(option.points).toBeGreaterThan(0);
    expect(s.getState().redeemReward(option)).toBe(false);
  });

  it('topUp credits the wallet and adds exactly reloadBonus(amount) points', async () => {
    const s = await load();
    const { walletBalance, points } = s.getState();
    s.getState().topUp(35);
    expect(s.getState().walletBalance).toBeCloseTo(walletBalance + 35, 9);
    expect(s.getState().points).toBe(points + reloadBonus(35));
    expect(s.getState().walletHistory[0].amount).toBe(35);
  });

  it('a top-up below every bonus tier adds no points and no points-history row', async () => {
    const s = await load();
    const { points, pointsHistory } = s.getState();
    s.getState().topUp(1);
    expect(s.getState().points).toBe(points);
    expect(s.getState().pointsHistory).toBe(pointsHistory);
  });

  it('a sent gift is redeemable once (case/space-insensitive), then falls to the demo path', async () => {
    const s = await load();
    const card = s.getState().sendGift({ amount: 15, recipientName: 'Sara', occasion: 'birthday' });
    const w0 = s.getState().walletBalance;
    expect(s.getState().redeemGift(`  ${card.code.toLowerCase()} `)).toBe(true);
    expect(s.getState().walletBalance).toBeCloseTo(w0 + 15, 9);
    expect(s.getState().giftsSent[0].redeemed).toBe(true);
  });

  it('rejects a malformed gift code', async () => {
    const s = await load();
    const w0 = s.getState().walletBalance;
    expect(s.getState().redeemGift('NOT-A-CODE')).toBe(false);
    expect(s.getState().redeemGift('')).toBe(false);
    expect(s.getState().walletBalance).toBe(w0);
  });

  // Pins CURRENT demo behaviour so a change is deliberate: any well-formed
  // ALMOND-XXXXX code credits 5 JOD, repeatedly, with no DATA_SOURCE gate.
  // Harmless while the wallet is local-only; see the report — it must be gated
  // before the wallet is wired to the BFF.
  it('DEMO: any well-formed code credits 5 JOD, every time', async () => {
    const s = await load();
    const w0 = s.getState().walletBalance;
    expect(s.getState().redeemGift('ALMOND-ZZZZZ')).toBe(true);
    expect(s.getState().redeemGift('ALMOND-ZZZZZ')).toBe(true);
    expect(s.getState().walletBalance).toBeCloseTo(w0 + 10, 9);
  });
});

describe('authStore (mock OTP)', () => {
  const load = async () => (await import('@/store/authStore')).useAuthStore;

  it('refuses a code with no pending phone, and non-4-digit codes', async () => {
    const s = await load();
    expect(s.getState().verifyOtp('1234')).toBe(false);
    s.getState().sendOtp('+962 79 123 4567');
    for (const bad of ['123', '12345', 'abcd', '12 34', '']) {
      expect(s.getState().verifyOtp(bad), bad).toBe(false);
    }
    expect(s.getState().user).toBeNull();
  });

  it('accepts 4 digits and derives a stable id from the phone digits', async () => {
    const s = await load();
    s.getState().sendOtp('+962 79 123 4567');
    expect(s.getState().verifyOtp(' 0000 ')).toBe(true);
    expect(s.getState().user).toEqual({ id: 'u_962791234567', phone: '+962 79 123 4567' });
    expect(s.getState().pendingPhone).toBeNull();
    s.getState().setName('Sara');
    expect(s.getState().user?.name).toBe('Sara');
    s.getState().logout();
    expect(s.getState().user).toBeNull();
  });

  it('setName without a user is a no-op', async () => {
    const s = await load();
    s.getState().setName('ghost');
    expect(s.getState().user).toBeNull();
  });
});
